const prisma = require("../config/prisma");
const {
  convertAmount,
  loadTenantCurrencySettings,
  normalizeCurrencyCode,
} = require("../utils/currencySettings");
const {
  attachCurrencyCodes,
  getCurrencyCodeMap,
  setCurrencyCode,
  setCurrencyCodes,
} = require("../utils/moneyCurrency");
const {
  parseListParams,
  buildOrderBy,
  contains,
  buildMeta,
  buildDateRangeFilter,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const { emitToStore, emitToTenant } = require("../socket");
const { getCurrentCustomerBonusProgram } = require("../utils/customerBonusProgramStore");
const {
  getCurrentCashSession,
  getCashSessionByPaymentId,
  linkPaymentToCashSession,
  adjustLinkedPaymentCashTotals,
} = require("../utils/cashSessionStore");
const {
  attachPaymentOriginalDetails,
  getPaymentOriginalMap,
  setPaymentOriginal,
} = require("../utils/paymentOriginalStore");
const {
  listOrderAuditLogs,
  recordOrderAudit,
} = require("../utils/orderAuditStore");
const {
  consumeInventoryLotsFefo,
  incrementInventoryLot,
  emitLotExpiryNotifications,
  ensureInventoryLotTables,
  synchronizeInventoryAggregate,
} = require("../utils/inventoryLotStore");

const LONG_TRANSACTION_OPTIONS = {
  maxWait: 10000,
  timeout: 20000,
};

const PAYMENT_METHOD_MAP = {
  cash: "CASH",
  CASH: "CASH",
  card: "CARD",
  CARD: "CARD",
  mobile: "MOBILE_MONEY",
  MOBILE: "MOBILE_MONEY",
  mobile_money: "MOBILE_MONEY",
  MOBILE_MONEY: "MOBILE_MONEY",
  transfer: "TRANSFER",
  TRANSFER: "TRANSFER",
};

const toNumber = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : NaN;
};

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));
const computeProgramPoints = (total, program) => {
  const threshold = Number(program?.amountThreshold || 0);
  const pointsAwarded = Number(program?.pointsAwarded || 0);
  if (!Number.isFinite(threshold) || threshold <= 0) return 0;
  if (!Number.isFinite(pointsAwarded) || pointsAwarded <= 0) return 0;

  return Math.max(0, Math.floor(Number(total || 0) / threshold) * Math.trunc(pointsAwarded));
};

const normalizePaymentMethod = (value) => PAYMENT_METHOD_MAP[value] || null;

const orderDeliveryInclude = {
  delivery: {
    include: {
      driver: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
        },
      },
      store: {
        select: {
          id: true,
          name: true,
          code: true,
          city: true,
          commune: true,
          country: true,
        },
      },
    },
  },
};

const hydrateOrdersWithCurrencyCodes = async (records) => {
  const list = Array.isArray(records)
    ? records.filter(Boolean)
    : records
      ? [records]
      : [];

  if (!list.length) {
    return Array.isArray(records) ? [] : records;
  }

  const orderCurrencyMap = await getCurrencyCodeMap(
    prisma,
    "orders",
    list.map((item) => item.id),
  );
  const itemCurrencyMap = await getCurrencyCodeMap(
    prisma,
    "orderItems",
    list.flatMap((item) => item.items || []).map((item) => item.id),
  );
  const paymentCurrencyMap = await getCurrencyCodeMap(
    prisma,
    "payments",
    list.flatMap((item) => item.payments || []).map((payment) => payment.id),
  );
  const paymentOriginalMap = await getPaymentOriginalMap(
    prisma,
    list.flatMap((item) => item.payments || []).map((payment) => payment.id),
  );

  const hydrated = attachCurrencyCodes(list, orderCurrencyMap).map((order) => ({
    ...order,
    items: attachCurrencyCodes(order.items || [], itemCurrencyMap),
    payments: attachPaymentOriginalDetails(
      attachCurrencyCodes(order.payments || [], paymentCurrencyMap),
      paymentOriginalMap,
    ),
  }));

  return Array.isArray(records) ? hydrated : hydrated[0];
};

const resolveCashierStorageZone = async ({ tenantId, storeId, defaultStorageZoneId }) => {
  if (defaultStorageZoneId) {
    const zone = await prisma.storageZone.findFirst({
      where: {
        id: defaultStorageZoneId,
        tenantId,
        storeId,
        zoneType: "STORE",
      },
    });

    if (zone) {
      return zone;
    }
  }

  return prisma.storageZone.findFirst({
    where: {
      tenantId,
      storeId,
      zoneType: "STORE",
    },
    orderBy: { createdAt: "asc" },
  });
};

const normalizeOrderItemsInput = (items = []) =>
  (items || []).map((item, index) => {
    const productId = item?.productId || item?.articleId;
    const quantity = Number(item?.quantity || item?.cartQty || 0);

    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
      throw Object.assign(new Error(`Invalid item on line ${index + 1}.`), {
        status: 400,
      });
    }

    return { productId, quantity };
  });

const mapRequirementsDiff = (previousRequirements = new Map(), nextRequirements = new Map()) => {
  const allKeys = new Set([
    ...previousRequirements.keys(),
    ...nextRequirements.keys(),
  ]);

  return [...allKeys].map((productId) => ({
    productId,
    diff:
      Number(nextRequirements.get(productId) || 0) -
      Number(previousRequirements.get(productId) || 0),
  }));
};

const buildSaleFromItems = async ({
  tenantId,
  items,
  currencySettings,
  allowInactiveArticles = false,
  allowInactiveComponents = false,
}) => {
  const articleIds = [...new Set((items || []).map((item) => item.productId).filter(Boolean))];
  const articles = await prisma.product.findMany({
    where: {
      tenantId,
      id: { in: articleIds },
      kind: "ARTICLE",
      ...(allowInactiveArticles ? {} : { isActive: true }),
    },
    include: {
      components: {
        include: {
          componentProduct: {
            select: {
              id: true,
              kind: true,
              isActive: true,
              name: true,
            },
          },
        },
      },
    },
  });
  const articleCurrencyMap = await getCurrencyCodeMap(prisma, "products", articleIds);

  if (articles.length !== articleIds.length) {
    throw Object.assign(
      new Error("Only ARTICLE products can be sold from the cashier."),
      { status: 400 },
    );
  }

  const articleMap = new Map(articles.map((item) => [item.id, item]));
  const inventoryRequirements = new Map();
  const requirementLabels = new Map();
  const orderItems = [];
  let subtotal = 0;

  (items || []).forEach((item) => {
    const article = articleMap.get(item.productId);
    if (!article) {
      throw Object.assign(new Error("Invalid article selected."), { status: 400 });
    }

    const unitPrice = roundMoney(
      convertAmount(
        article.unitPrice,
        articleCurrencyMap.get(article.id),
        currencySettings.primaryCurrencyCode,
        currencySettings,
      ),
    );
    const lineTotal = roundMoney(unitPrice * item.quantity);
    subtotal += lineTotal;
    orderItems.push({
      productId: article.id,
      quantity: item.quantity,
      unitPrice,
      total: lineTotal,
    });

    if (!Array.isArray(article.components) || article.components.length === 0) {
      throw Object.assign(
        new Error(`L'article ${article.name} ne peut pas etre vendu sans fiche technique.`),
        { status: 400 },
      );
    }

    article.components.forEach((component) => {
      if (!component.componentProductId || !component.componentProduct) {
        throw Object.assign(
          new Error(`Technical sheet incomplete for article ${article.name}.`),
          { status: 400 },
        );
      }

      if (component.componentProduct.kind !== "COMPONENT") {
        throw Object.assign(
          new Error(`Article ${article.name} contains a non-component product.`),
          { status: 400 },
        );
      }

      if (!allowInactiveComponents && !component.componentProduct.isActive) {
        throw Object.assign(
          new Error(`Component ${component.componentProduct.name} is inactive.`),
          { status: 400 },
        );
      }

      const perArticle = toNumber(component.quantity);
      const requiredQuantity = perArticle * item.quantity;

      if (!Number.isInteger(requiredQuantity) || requiredQuantity <= 0) {
        throw Object.assign(
          new Error(
            `Technical sheet quantities for ${article.name} must result in whole stock units.`,
          ),
          { status: 400 },
        );
      }

      inventoryRequirements.set(
        component.componentProductId,
        (inventoryRequirements.get(component.componentProductId) || 0) + requiredQuantity,
      );
      requirementLabels.set(
        component.componentProductId,
        component.componentProduct.name || component.componentName || component.componentProductId,
      );
    });
  });

  return {
    orderItems,
    inventoryRequirements,
    requirementLabels,
    subtotal: roundMoney(subtotal),
    total: roundMoney(subtotal),
  };
};

const buildOrderAuditSnapshot = (order) => {
  const payment = order?.payments?.[0] || null;
  return {
    id: order?.id,
    status: order?.status || "",
    customerId: order?.customerId || null,
    customerName: order?.customer
      ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ")
      : "",
    paymentMethod: payment?.method || "",
    paymentReference: payment?.reference || "",
    paymentCurrencyCode: payment?.currencyCode || order?.currencyCode || "USD",
    originalPaymentCurrencyCode:
      payment?.originalCurrencyCode || payment?.currencyCode || order?.currencyCode || "USD",
    originalAmountReceived:
      payment?.originalAmount == null ? null : Number(payment.originalAmount),
    total: Number(order?.total || 0),
    items: (order?.items || []).map((item) => ({
      productId: item.productId,
      productName: item.product?.name || "",
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      total: Number(item.total || 0),
    })),
  };
};

const buildAuditChanges = (beforeSnapshot, afterSnapshot) => {
  const changes = [];
  const candidates = [
    ["status", "Statut"],
    ["customerName", "Client"],
    ["paymentMethod", "Mode de paiement"],
    ["paymentReference", "Reference"],
    ["originalAmountReceived", "Montant remis"],
    ["originalPaymentCurrencyCode", "Devise remise"],
    ["total", "Total"],
  ];

  candidates.forEach(([field, label]) => {
    const beforeValue = beforeSnapshot?.[field] ?? null;
    const afterValue = afterSnapshot?.[field] ?? null;
    if (String(beforeValue ?? "") !== String(afterValue ?? "")) {
      changes.push({ field, label, before: beforeValue, after: afterValue });
    }
  });

  const beforeItems = JSON.stringify(beforeSnapshot?.items || []);
  const afterItems = JSON.stringify(afterSnapshot?.items || []);
  if (beforeItems !== afterItems) {
    changes.push({
      field: "items",
      label: "Articles vendus",
      before: beforeSnapshot?.items || [],
      after: afterSnapshot?.items || [],
    });
  }

  return changes;
};

const hasLegacyOrderWithoutLots = async ({
  tenantId,
  storageZoneId,
  productIds = [],
}) => {
  const uniqueProductIds = [...new Set((productIds || []).filter(Boolean))];
  if (!uniqueProductIds.length) return true;

  const values = uniqueProductIds.map((id) => `(${JSON.stringify(id)})`).join(",");
  const rows = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS "count"
    FROM "inventoryLots"
    WHERE "tenantId" = ${JSON.stringify(tenantId)}
      AND "storageZoneId" = ${JSON.stringify(storageZoneId)}
      AND "productId" IN (SELECT "value" FROM (VALUES ${values}) AS ids("value"))
  `);

  return Number(rows?.[0]?.count || 0) === 0;
};

const restoreAggregateInventoryForRequirements = async (
  tx,
  {
    tenantId,
    storeId,
    storageZoneId,
    inventoryRequirements,
    sourceId = null,
    createdById = null,
  },
) => {
  const movementRows = [];

  for (const [productId, quantity] of inventoryRequirements.entries()) {
    await tx.inventory.upsert({
      where: {
        storageZoneId_productId: {
          storageZoneId,
          productId,
        },
      },
      update: {
        quantity: {
          increment: quantity,
        },
        ...(storeId ? { storeId } : {}),
      },
      create: {
        tenantId,
        storeId,
        storageZoneId,
        productId,
        quantity,
      },
    });

    movementRows.push({
      tenantId,
      productId,
      storageZoneId,
      quantity,
      movementType: "IN",
      sourceType: "DIRECT",
      sourceId,
      createdById,
    });
  }

  return movementRows;
};

const getOrderWithRelations = (tenantId, id) =>
  prisma.order.findFirst({
    where: { id, tenantId },
    include: {
      items: { include: { product: true } },
      customer: true,
      store: true,
      payments: true,
      createdBy: true,
      ...orderDeliveryInclude,
    },
  });

const listOrders = async (req, res) => {
  const { status, storeId, customerId, deliveryStatus } = req.query || {};
  const hasDelivery =
    req.query?.hasDelivery === undefined
      ? undefined
      : String(req.query.hasDelivery).toLowerCase() === "true";
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const deliveryFilter =
    deliveryStatus
      ? { delivery: { is: { status: String(deliveryStatus).toUpperCase() } } }
      : hasDelivery === undefined
        ? {}
        : hasDelivery
          ? { delivery: { isNot: null } }
          : { delivery: { is: null } };

  const searchFilter = search
    ? {
        OR: [
          { status: contains(search) },
          { customer: { firstName: contains(search) } },
          { customer: { lastName: contains(search) } },
          { store: { name: contains(search) } },
        ],
      }
    : {};

  const where = {
    tenantId: req.user.tenantId,
    ...(status ? { status } : {}),
    ...(storeId ? { storeId } : {}),
    ...(customerId ? { customerId } : {}),
    ...deliveryFilter,
    ...createdAtFilter,
    ...searchFilter,
  };

  const orderBy =
    buildOrderBy(sortBy, sortDir, {
      createdAt: "createdAt",
      total: "total",
      status: "status",
    }) || { createdAt: "desc" };

  if (exportType) {
    const data = await prisma.order.findMany({
      where,
      include: { customer: true, store: true, payments: true, items: true },
      orderBy,
    });

    const rows = data.map((item) => ({
      id: item.id,
      status: item.status,
      store: item.store?.name || "",
      customer: [item.customer?.firstName, item.customer?.lastName]
        .filter(Boolean)
        .join(" "),
      total: item.total,
      itemsCount: item.items?.length || 0,
      createdAt: item.createdAt,
    }));

    return sendExport(res, rows, "orders", exportType);
  }

  if (!paginate) {
    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { include: { product: true } },
        customer: true,
        store: true,
        payments: true,
        createdBy: true,
        ...orderDeliveryInclude,
      },
      orderBy,
    });
    return res.json(await hydrateOrdersWithCurrencyCodes(orders));
  }

  const [total, orders] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        items: { include: { product: true } },
        customer: true,
        store: true,
        payments: true,
        createdBy: true,
        ...orderDeliveryInclude,
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return res.json({
    data: await hydrateOrdersWithCurrencyCodes(orders),
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const getOrder = async (req, res) => {
  const { id } = req.params;

  const order = await prisma.order.findFirst({
    where: { id, tenantId: req.user.tenantId },
    include: {
      items: { include: { product: true } },
      customer: true,
      store: true,
      payments: true,
      createdBy: true,
      ...orderDeliveryInclude,
    },
  });

  if (!order) {
    return res.status(404).json({ message: "Order not found." });
  }

  return res.json(await hydrateOrdersWithCurrencyCodes(order));
};

const getOrderHistory = async (req, res) => {
  const { id } = req.params;
  const order = await prisma.order.findFirst({
    where: { id, tenantId: req.user.tenantId },
    select: { id: true },
  });

  if (!order) {
    return res.status(404).json({ message: "Order not found." });
  }

  const history = await listOrderAuditLogs({
    tenantId: req.user.tenantId,
    orderId: id,
  });

  return res.json(history);
};

const updateOrder = async (req, res) => {
  await ensureInventoryLotTables();
  const { id } = req.params;
  const {
    customerId,
    paymentMethod,
    amountReceived,
    originalAmountReceived,
    paymentCurrencyCode,
    reference,
    items,
    reason,
  } = req.body || {};

  const existingOrder = await getOrderWithRelations(req.user.tenantId, id);
  if (!existingOrder) {
    return res.status(404).json({ message: "Order not found." });
  }
  if (existingOrder.status === "CANCELED") {
    return res.status(409).json({ message: "Impossible de modifier une vente supprimee." });
  }

  const existingPayment = existingOrder.payments?.[0];
  if (!existingPayment) {
    return res.status(409).json({ message: "Cette vente ne contient aucun paiement." });
  }

  let nextItems = (existingOrder.items || []).map((item) => ({
    productId: item.productId,
    quantity: Number(item.quantity || 0),
  }));
  if (items !== undefined) {
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: "items array required." });
    }

    try {
      nextItems = normalizeOrderItemsInput(items);
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message || "Invalid sale." });
    }
  }

  let customer = null;
  if (customerId) {
    customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: req.user.tenantId },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }
  }

  const currencySettings = await loadTenantCurrencySettings(prisma, req.user.tenantId);
  const primaryCurrencyCode = currencySettings.primaryCurrencyCode;
  const previousSaleSnapshot = await buildSaleFromItems({
    tenantId: req.user.tenantId,
    items: (existingOrder.items || []).map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity || 0),
    })),
    currencySettings,
    allowInactiveArticles: true,
    allowInactiveComponents: true,
  });
  const nextSaleSnapshot = await buildSaleFromItems({
    tenantId: req.user.tenantId,
    items: nextItems,
    currencySettings,
    allowInactiveArticles: true,
    allowInactiveComponents: true,
  });
  const normalizedPaymentCurrencyCode = normalizeCurrencyCode(
    paymentCurrencyCode ||
      existingPayment.originalCurrencyCode ||
      existingPayment.currencyCode ||
      primaryCurrencyCode,
    primaryCurrencyCode,
  );
  const rawOriginalPaidAmount =
    originalAmountReceived !== undefined
      ? Number(originalAmountReceived)
      : amountReceived !== undefined
        ? Number(amountReceived)
        : Number(existingPayment.originalAmount ?? existingOrder.total);

  const convertedPaidAmount = roundMoney(
    convertAmount(
      rawOriginalPaidAmount,
      normalizedPaymentCurrencyCode,
      primaryCurrencyCode,
      currencySettings,
    ),
  );
  const nextOrderTotal = Number(nextSaleSnapshot.total || 0);

  if (!Number.isFinite(convertedPaidAmount) || convertedPaidAmount < nextOrderTotal) {
    return res.status(400).json({
      message: "Received amount must cover the sale total.",
    });
  }

  const normalizedMethod = paymentMethod
    ? normalizePaymentMethod(paymentMethod)
    : existingPayment.method;
  if (!normalizedMethod) {
    return res.status(400).json({ message: "Invalid payment method." });
  }

  const beforeSnapshot = buildOrderAuditSnapshot({
    ...existingOrder,
    payments: attachPaymentOriginalDetails(existingOrder.payments || [], new Map([
      [
        existingPayment.id,
        {
          originalAmount:
            existingPayment.originalAmount == null
              ? Number(existingOrder.total || 0)
              : Number(existingPayment.originalAmount),
          originalCurrencyCode:
            existingPayment.originalCurrencyCode ||
            existingPayment.currencyCode ||
            primaryCurrencyCode,
        },
      ],
    ])),
  });

  const cashSession = await getCashSessionByPaymentId({
    tenantId: req.user.tenantId,
    paymentId: existingPayment.id,
  });

  if (!cashSession?.storageZoneId) {
    return res.status(409).json({
      message: "Impossible de determiner la zone de stock de cette vente.",
    });
  }

  const requirementsDiff = mapRequirementsDiff(
    previousSaleSnapshot.inventoryRequirements,
    nextSaleSnapshot.inventoryRequirements,
  );
  const positiveAdjustments = requirementsDiff.filter((item) => item.diff > 0);

  if (positiveAdjustments.length) {
    const inventoryRows = await prisma.inventory.findMany({
      where: {
        tenantId: req.user.tenantId,
        storageZoneId: cashSession.storageZoneId,
        productId: { in: positiveAdjustments.map((item) => item.productId) },
      },
      select: {
        productId: true,
        quantity: true,
      },
    });
    const inventoryMap = new Map(
      inventoryRows.map((row) => [row.productId, Number(row.quantity || 0)]),
    );

    for (const adjustment of positiveAdjustments) {
      const available = Number(inventoryMap.get(adjustment.productId) || 0);
      if (available < adjustment.diff) {
        return res.status(400).json({
          message: `Insufficient stock for ${
            nextSaleSnapshot.requirementLabels.get(adjustment.productId) || adjustment.productId
          }.`,
        });
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: existingOrder.id },
      data: {
        customerId: customerId === undefined ? existingOrder.customerId : customer?.id || null,
        subtotal: nextOrderTotal,
        total: nextOrderTotal,
        items:
          items !== undefined
            ? {
                deleteMany: {},
                create: nextSaleSnapshot.orderItems,
              }
            : undefined,
      },
    });

    await tx.payment.update({
      where: { id: existingPayment.id },
      data: {
        amount: nextOrderTotal,
        method: normalizedMethod,
        reference:
          reference === undefined ? existingPayment.reference : reference || null,
      },
    });

    await setPaymentOriginal(tx, existingPayment.id, {
      originalAmount: rawOriginalPaidAmount,
      originalCurrencyCode: normalizedPaymentCurrencyCode,
    });

    await adjustLinkedPaymentCashTotals(tx, {
      tenantId: req.user.tenantId,
      paymentId: existingPayment.id,
      previousAmount: Number(existingOrder.total || 0),
      previousMethod: existingPayment.method,
      nextAmount: nextOrderTotal,
      nextMethod: normalizedMethod,
    });

    if (items !== undefined) {
      for (const adjustment of requirementsDiff) {
        if (!adjustment.diff) continue;

        if (adjustment.diff > 0) {
          await consumeInventoryLotsFefo(tx, {
            tenantId: req.user.tenantId,
            storeId: existingOrder.storeId,
            storageZoneId: cashSession.storageZoneId,
            productId: adjustment.productId,
            quantity: adjustment.diff,
          });

          await tx.inventoryMovement.create({
            data: {
              tenantId: req.user.tenantId,
              productId: adjustment.productId,
              storageZoneId: cashSession.storageZoneId,
              quantity: adjustment.diff,
              movementType: "OUT",
              sourceType: "DIRECT",
              sourceId: existingOrder.id,
              createdById: req.user.id,
            },
          });
          continue;
        }

        await incrementInventoryLot(tx, {
          tenantId: req.user.tenantId,
          storeId: existingOrder.storeId,
          storageZoneId: cashSession.storageZoneId,
          productId: adjustment.productId,
          quantity: Math.abs(adjustment.diff),
        });

        await tx.inventoryMovement.create({
          data: {
            tenantId: req.user.tenantId,
            productId: adjustment.productId,
            storageZoneId: cashSession.storageZoneId,
            quantity: Math.abs(adjustment.diff),
            movementType: "IN",
            sourceType: "DIRECT",
            sourceId: existingOrder.id,
            createdById: req.user.id,
          },
        });
      }
    }
  }, LONG_TRANSACTION_OPTIONS);

  const updatedOrder = await hydrateOrdersWithCurrencyCodes(
    await getOrderWithRelations(req.user.tenantId, existingOrder.id),
  );
  const afterSnapshot = buildOrderAuditSnapshot(updatedOrder);
  const changes = buildAuditChanges(beforeSnapshot, afterSnapshot);

  await recordOrderAudit(prisma, {
    tenantId: req.user.tenantId,
    orderId: existingOrder.id,
    action: "UPDATED",
    actorUserId: req.user.id,
    reason: reason || "Modification manuelle de la vente.",
    details: {
      before: beforeSnapshot,
      after: afterSnapshot,
      changes,
    },
  });

  emitToTenant(req.user.tenantId, "sale:updated", {
    id: updatedOrder.id,
    storeId: updatedOrder.storeId,
    total: updatedOrder.total,
    status: updatedOrder.status,
  });
  if (updatedOrder.storeId) {
    emitToStore(updatedOrder.storeId, "sale:updated", {
      id: updatedOrder.id,
      storeId: updatedOrder.storeId,
      total: updatedOrder.total,
      status: updatedOrder.status,
    });
  }

  await emitLotExpiryNotifications(req.user.tenantId);

  return res.json(updatedOrder);
};

const deleteOrder = async (req, res) => {
  await ensureInventoryLotTables();
  const { id } = req.params;
  const { reason } = req.body || {};

  const existingOrder = await getOrderWithRelations(req.user.tenantId, id);
  if (!existingOrder) {
    return res.status(404).json({ message: "Order not found." });
  }
  if (existingOrder.status === "CANCELED") {
    return res.status(409).json({ message: "Cette vente est deja supprimee." });
  }

  const payment = existingOrder.payments?.[0];
  if (!payment) {
    return res.status(409).json({ message: "Cette vente ne contient aucun paiement." });
  }

  const cashSession = await getCashSessionByPaymentId({
    tenantId: req.user.tenantId,
    paymentId: payment.id,
  });

  if (!cashSession?.storageZoneId) {
    return res.status(409).json({
      message: "Impossible de determiner la zone de stock de cette vente.",
    });
  }

  try {
    const saleSnapshot = await buildSaleFromItems({
      tenantId: req.user.tenantId,
      items: (existingOrder.items || []).map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity || 0),
      })),
      currencySettings: await loadTenantCurrencySettings(prisma, req.user.tenantId),
      allowInactiveArticles: true,
      allowInactiveComponents: true,
    });

    const beforeSnapshot = buildOrderAuditSnapshot(
      await hydrateOrdersWithCurrencyCodes(existingOrder),
    );

    const runDeleteTransaction = async ({ aggregateOnly = false } = {}) => {
      await prisma.$transaction(async (tx) => {
        let movementRows = [];

        if (aggregateOnly) {
          movementRows = await restoreAggregateInventoryForRequirements(tx, {
            tenantId: req.user.tenantId,
            storeId: existingOrder.storeId,
            storageZoneId: cashSession.storageZoneId,
            inventoryRequirements: saleSnapshot.inventoryRequirements,
            sourceId: existingOrder.id,
            createdById: req.user.id,
          });
        } else {
          const restoredProductIds = new Set();
          movementRows = [];

          for (const [productId, quantity] of saleSnapshot.inventoryRequirements.entries()) {
            await incrementInventoryLot(tx, {
              tenantId: req.user.tenantId,
              storeId: existingOrder.storeId,
              storageZoneId: cashSession.storageZoneId,
              productId,
              quantity,
              syncAggregate: false,
            });

            restoredProductIds.add(productId);
            movementRows.push({
              tenantId: req.user.tenantId,
              productId,
              storageZoneId: cashSession.storageZoneId,
              quantity,
              movementType: "IN",
              sourceType: "DIRECT",
              sourceId: existingOrder.id,
              createdById: req.user.id,
            });
          }

          for (const productId of restoredProductIds) {
            await synchronizeInventoryAggregate(tx, {
              tenantId: req.user.tenantId,
              storeId: existingOrder.storeId,
              storageZoneId: cashSession.storageZoneId,
              productId,
            });
          }
        }

        if (movementRows.length) {
          await tx.inventoryMovement.createMany({
            data: movementRows,
          });
        }

        await tx.order.update({
          where: { id: existingOrder.id },
          data: { status: "CANCELED" },
        });

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "FAILED",
            reference: payment.reference,
          },
        });

        await adjustLinkedPaymentCashTotals(tx, {
          tenantId: req.user.tenantId,
          paymentId: payment.id,
          previousAmount: Number(existingOrder.total || 0),
          previousMethod: payment.method,
          nextAmount: 0,
          nextMethod: payment.method,
        });
      }, LONG_TRANSACTION_OPTIONS);
    };

    let aggregateRestockOnly = await hasLegacyOrderWithoutLots({
      tenantId: req.user.tenantId,
      storageZoneId: cashSession.storageZoneId,
      productIds: [...saleSnapshot.inventoryRequirements.keys()],
    });

    try {
      await runDeleteTransaction({ aggregateOnly: aggregateRestockOnly });
    } catch (transactionError) {
      const isTransactionTimeout =
        transactionError?.code === "P2028" ||
        String(transactionError?.message || "").includes("Transaction already closed");

      if (!isTransactionTimeout || aggregateRestockOnly) {
        throw transactionError;
      }

      aggregateRestockOnly = true;
      await runDeleteTransaction({ aggregateOnly: true });
    }

    const deletedOrder = await hydrateOrdersWithCurrencyCodes(
      await getOrderWithRelations(req.user.tenantId, existingOrder.id),
    );
    const afterSnapshot = buildOrderAuditSnapshot(deletedOrder);
    await recordOrderAudit(prisma, {
      tenantId: req.user.tenantId,
      orderId: existingOrder.id,
      action: "DELETED",
      actorUserId: req.user.id,
      reason: reason || "Suppression logique de la vente.",
      details: {
        before: beforeSnapshot,
        after: afterSnapshot,
        changes: buildAuditChanges(beforeSnapshot, afterSnapshot),
        aggregateRestockOnly,
      },
    });

    emitToTenant(req.user.tenantId, "sale:updated", {
      id: deletedOrder.id,
      storeId: deletedOrder.storeId,
      total: deletedOrder.total,
      status: deletedOrder.status,
    });
    if (deletedOrder.storeId) {
      emitToStore(deletedOrder.storeId, "sale:updated", {
        id: deletedOrder.id,
        storeId: deletedOrder.storeId,
        total: deletedOrder.total,
        status: deletedOrder.status,
      });
    }

    await emitLotExpiryNotifications(req.user.tenantId);

    return res.json(deletedOrder);
  } catch (error) {
    console.error("deleteOrder failed:", error);
    return res.status(error.status || 500).json({
      message: "Impossible de supprimer cette vente.",
    });
  }
};

const createOrder = async (req, res) => {
  await ensureInventoryLotTables();
  const {
    items,
    customerId,
    paymentMethod,
    amountReceived,
    originalAmountReceived,
    paymentCurrencyCode,
    reference,
    pointsEarned,
  } = req.body || {};

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "items array required." });
  }

  const normalizedMethod = normalizePaymentMethod(paymentMethod || "cash");
  if (!normalizedMethod) {
    return res.status(400).json({ message: "Invalid payment method." });
  }

  const cashier = await prisma.user.findFirst({
    where: { id: req.user.id, tenantId: req.user.tenantId },
    select: {
      id: true,
      storeId: true,
      defaultStorageZoneId: true,
    },
  });

  if (!cashier?.storeId) {
    return res.status(400).json({
      message: "The connected user is not assigned to a store.",
    });
  }

  const cashSession = await getCurrentCashSession({
    tenantId: req.user.tenantId,
    userId: req.user.id,
    storeId: cashier.storeId,
  });

  if (!cashSession) {
    return res.status(400).json({
      message: "Aucune caisse ouverte pour ce caissier.",
    });
  }

  const storageZone = cashSession.storageZoneId
    ? await prisma.storageZone.findFirst({
        where: {
          id: cashSession.storageZoneId,
          tenantId: req.user.tenantId,
          storeId: cashier.storeId,
        },
      })
    : await resolveCashierStorageZone({
        tenantId: req.user.tenantId,
        storeId: cashier.storeId,
        defaultStorageZoneId: cashier.defaultStorageZoneId,
      });

  let resolvedStorageZone = storageZone;

  if (resolvedStorageZone?.zoneType !== "STORE") {
    const boutiqueZone = await resolveCashierStorageZone({
      tenantId: req.user.tenantId,
      storeId: cashier.storeId,
      defaultStorageZoneId: cashier.defaultStorageZoneId,
    });

    if (!boutiqueZone) {
      return res.status(400).json({
        message: "No boutique stock zone (STORE) is configured for this cashier.",
      });
    }

    if (Number(cashSession.orderCount || 0) > 0) {
      return res.status(400).json({
        message:
          "La caisse ouverte n'utilise pas le stock boutique. Fermez puis rouvrez la caisse avant de vendre.",
      });
    }

    await prisma.$executeRawUnsafe(`
      UPDATE "cashSessions"
      SET
        "storageZoneId" = ${JSON.stringify(boutiqueZone.id)},
        "updatedAt" = NOW()
      WHERE "id" = ${JSON.stringify(cashSession.id)}
    `);

    resolvedStorageZone = boutiqueZone;
  }

  if (!resolvedStorageZone) {
    return res.status(400).json({
      message: "No boutique stock zone (STORE) is configured for this cashier.",
    });
  }

  let normalizedItems = [];
  try {
    normalizedItems = items.map((item, index) => {
      const productId = item?.productId || item?.articleId;
      const quantity = Number(item?.quantity || item?.cartQty || 0);

      if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
        throw Object.assign(
          new Error(`Invalid item on line ${index + 1}.`),
          { status: 400 },
        );
      }

      return { productId, quantity };
    });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || "Invalid sale." });
  }

  const articleIds = [...new Set(normalizedItems.map((item) => item.productId))];
  const currencySettings = await loadTenantCurrencySettings(
    prisma,
    req.user.tenantId,
  );
  const articles = await prisma.product.findMany({
    where: {
      tenantId: req.user.tenantId,
      id: { in: articleIds },
      kind: "ARTICLE",
      isActive: true,
    },
    include: {
      components: {
        include: {
          componentProduct: {
            select: {
              id: true,
              kind: true,
              isActive: true,
              name: true,
            },
          },
        },
      },
    },
  });
  const articleCurrencyMap = await getCurrencyCodeMap(
    prisma,
    "products",
    articleIds,
  );

  if (articles.length !== articleIds.length) {
    return res.status(400).json({
      message: "Only ARTICLE products can be sold from the cashier.",
    });
  }

  let customer = null;
  if (customerId) {
    customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: req.user.tenantId },
      select: { id: true },
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }
  }

  const articleMap = new Map(articles.map((item) => [item.id, item]));
  const inventoryRequirements = new Map();
  const requirementLabels = new Map();
  const orderItems = [];
  let subtotal = 0;

  try {
    normalizedItems.forEach((item) => {
      const article = articleMap.get(item.productId);
      if (!article) {
        throw Object.assign(new Error("Invalid article selected."), { status: 400 });
      }

      const unitPrice = roundMoney(
        convertAmount(
          article.unitPrice,
          articleCurrencyMap.get(article.id),
          currencySettings.primaryCurrencyCode,
          currencySettings,
        ),
      );
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;
      orderItems.push({
        productId: article.id,
        quantity: item.quantity,
        unitPrice,
        total: roundMoney(lineTotal),
      });

      if (!Array.isArray(article.components) || article.components.length === 0) {
        throw Object.assign(
          new Error(`L'article ${article.name} ne peut pas etre vendu sans fiche technique.`),
          { status: 400 },
        );
      }

      article.components.forEach((component) => {
        if (!component.componentProductId || !component.componentProduct) {
          throw Object.assign(
            new Error(`Technical sheet incomplete for article ${article.name}.`),
            { status: 400 },
          );
        }

        if (component.componentProduct.kind !== "COMPONENT") {
          throw Object.assign(
            new Error(`Article ${article.name} contains a non-component product.`),
            { status: 400 },
          );
        }

        if (!component.componentProduct.isActive) {
          throw Object.assign(
            new Error(`Component ${component.componentProduct.name} is inactive.`),
            { status: 400 },
          );
        }

        const perArticle = toNumber(component.quantity);
        const requiredQuantity = perArticle * item.quantity;

        if (!Number.isInteger(requiredQuantity) || requiredQuantity <= 0) {
          throw Object.assign(
            new Error(
              `Technical sheet quantities for ${article.name} must result in whole stock units.`,
            ),
            { status: 400 },
          );
        }

        inventoryRequirements.set(
          component.componentProductId,
          (inventoryRequirements.get(component.componentProductId) || 0) + requiredQuantity,
        );
        requirementLabels.set(
          component.componentProductId,
          component.componentProduct.name || component.componentName || component.componentProductId,
        );
      });
    });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || "Invalid sale." });
  }

  const total = roundMoney(subtotal);
  const primaryCurrencyCode = currencySettings.primaryCurrencyCode;
  const normalizedPaymentCurrencyCode = normalizeCurrencyCode(
    paymentCurrencyCode || primaryCurrencyCode,
    primaryCurrencyCode,
  );
  const rawOriginalPaidAmount =
    originalAmountReceived !== undefined
      ? Number(originalAmountReceived)
      : amountReceived === undefined
        ? total
        : Number(amountReceived);
  const hasExplicitForeignCurrencyPayment =
    originalAmountReceived !== undefined || normalizedPaymentCurrencyCode !== primaryCurrencyCode;
  const paidAmount = hasExplicitForeignCurrencyPayment
    ? roundMoney(
        convertAmount(
          rawOriginalPaidAmount,
          normalizedPaymentCurrencyCode,
          primaryCurrencyCode,
          currencySettings,
        ),
      )
    : amountReceived === undefined
      ? total
      : Number(amountReceived);
  const normalizedOriginalPaidAmount = roundMoney(rawOriginalPaidAmount);
  if (!Number.isFinite(paidAmount) || paidAmount < total) {
    return res.status(400).json({
      message: "Received amount must cover the sale total.",
    });
  }

  const inventoryRows = await prisma.inventory.findMany({
    where: {
      tenantId: req.user.tenantId,
      storageZoneId: resolvedStorageZone.id,
      productId: { in: [...inventoryRequirements.keys()] },
    },
    select: {
      productId: true,
      quantity: true,
    },
  });

  const inventoryMap = new Map(
    inventoryRows.map((row) => [row.productId, Number(row.quantity || 0)]),
  );

  for (const [productId, requiredQuantity] of inventoryRequirements.entries()) {
    const availableQuantity = inventoryMap.get(productId) || 0;
    if (availableQuantity < requiredQuantity) {
      return res.status(400).json({
        message: `Insufficient stock for ${requirementLabels.get(productId) || productId}.`,
      });
    }
  }

  const activeBonusProgram = await getCurrentCustomerBonusProgram(req.user.tenantId);
  const configuredPoints = computeProgramPoints(total, activeBonusProgram);
  const loyaltyPoints =
    configuredPoints > 0
      ? configuredPoints
      : Number.isInteger(Number(pointsEarned))
        ? Math.max(0, Number(pointsEarned))
        : 0;

  const createdOrder = await prisma.$transaction(async (tx) => {
    let bonusUnlocked = null;
    const order = await tx.order.create({
      data: {
        tenantId: req.user.tenantId,
        storeId: cashier.storeId,
        customerId: customer?.id,
        createdById: req.user.id,
        status: "PAID",
        subtotal,
        tax: 0,
        total,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: true,
      },
    });

    const payment = await tx.payment.create({
      data: {
        tenantId: req.user.tenantId,
        orderId: order.id,
        amount: total,
        method: normalizedMethod,
        status: "COMPLETED",
        reference: reference || null,
        paidAt: new Date(),
      },
    });
    await linkPaymentToCashSession(tx, {
      tenantId: req.user.tenantId,
      cashSessionId: cashSession.id,
      paymentId: payment.id,
      amount: total,
      method: normalizedMethod,
    });
    await setCurrencyCode(
      tx,
      "orders",
      order.id,
      currencySettings.primaryCurrencyCode,
    );
    await setCurrencyCodes(
      tx,
      "orderItems",
      (order.items || []).map((item) => item.id),
      currencySettings.primaryCurrencyCode,
    );
    await setCurrencyCode(
      tx,
      "payments",
      payment.id,
      primaryCurrencyCode,
    );
    await setPaymentOriginal(tx, payment.id, {
      originalAmount: normalizedOriginalPaidAmount,
      originalCurrencyCode: normalizedPaymentCurrencyCode,
    });

    for (const [productId, requiredQuantity] of inventoryRequirements.entries()) {
      await consumeInventoryLotsFefo(tx, {
        tenantId: req.user.tenantId,
        storeId: cashier.storeId,
        storageZoneId: resolvedStorageZone.id,
        productId,
        quantity: requiredQuantity,
      });

      await tx.inventoryMovement.create({
        data: {
          tenantId: req.user.tenantId,
          productId,
          storageZoneId: resolvedStorageZone.id,
          quantity: requiredQuantity,
          movementType: "OUT",
          sourceType: "DIRECT",
          sourceId: order.id,
          createdById: req.user.id,
        },
      });
    }

    if (customer?.id && loyaltyPoints > 0) {
      const amountEquivalent = Number(activeBonusProgram?.pointValueAmount || 0) * loyaltyPoints;
      let currentPeriodPoints = null;

      if (activeBonusProgram?.quotaPoints && activeBonusProgram?.quotaPeriodDays) {
        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - Number(activeBonusProgram.quotaPeriodDays));
        const currentWindow = await tx.bonusRecord.aggregate({
          _sum: { points: true },
          where: {
            tenantId: req.user.tenantId,
            customerId: customer.id,
            createdAt: { gte: windowStart },
          },
        });
        currentPeriodPoints = Number(currentWindow?._sum?.points || 0);
      }

      await tx.customer.update({
        where: { id: customer.id },
        data: {
          points: { increment: loyaltyPoints },
        },
      });

      await tx.bonusRecord.create({
        data: {
          tenantId: req.user.tenantId,
          customerId: customer.id,
          points: loyaltyPoints,
          reason:
            amountEquivalent > 0
              ? `Sale ${order.id} - equivalent montant ${amountEquivalent.toFixed(2)}`
              : `Sale ${order.id}`,
        },
      });

      if (
        currentPeriodPoints !== null &&
        currentPeriodPoints < Number(activeBonusProgram.quotaPoints) &&
        currentPeriodPoints + loyaltyPoints >= Number(activeBonusProgram.quotaPoints)
      ) {
        bonusUnlocked = {
          programName: activeBonusProgram.name,
          quotaPoints: Number(activeBonusProgram.quotaPoints),
          quotaPeriodDays: Number(activeBonusProgram.quotaPeriodDays),
          rewardAmount: Number(activeBonusProgram.quotaRewardAmount || 0),
        };

        await tx.bonusRecord.create({
          data: {
            tenantId: req.user.tenantId,
            customerId: customer.id,
            points: 0,
            reason:
              bonusUnlocked.rewardAmount > 0
                ? `Quota bonus atteint - prime ${bonusUnlocked.rewardAmount.toFixed(2)}`
                : "Quota bonus atteint",
          },
        });
      }
    }

    const created = await tx.order.findUnique({
      where: { id: order.id },
      include: {
        items: { include: { product: true } },
        customer: true,
        store: true,
        payments: true,
        createdBy: true,
      },
    });

    return {
      ...created,
      currencyCode: currencySettings.primaryCurrencyCode,
      loyaltyPoints,
      bonusUnlocked,
      items: (created?.items || []).map((item) => ({
        ...item,
        currencyCode: currencySettings.primaryCurrencyCode,
      })),
      payments: (created?.payments || []).map((item) => ({
        ...item,
        currencyCode: primaryCurrencyCode,
        originalAmount: normalizedOriginalPaidAmount,
        originalCurrencyCode: normalizedPaymentCurrencyCode,
      })),
    };
  }, LONG_TRANSACTION_OPTIONS);

  emitToTenant(req.user.tenantId, "order:created", {
    id: createdOrder.id,
    storeId: createdOrder.storeId,
    total: createdOrder.total,
    status: createdOrder.status,
  });

  emitToTenant(req.user.tenantId, "sale:created", {
    id: createdOrder.id,
    storeId: createdOrder.storeId,
    total: createdOrder.total,
    status: createdOrder.status,
  });

  if (createdOrder.storeId) {
    emitToStore(createdOrder.storeId, "order:created", {
      id: createdOrder.id,
      storeId: createdOrder.storeId,
      total: createdOrder.total,
      status: createdOrder.status,
    });

    emitToStore(createdOrder.storeId, "sale:created", {
      id: createdOrder.id,
      storeId: createdOrder.storeId,
      total: createdOrder.total,
      status: createdOrder.status,
    });
  }

  await emitLotExpiryNotifications(req.user.tenantId);

  return res.status(201).json(createdOrder);
};

module.exports = {
  listOrders,
  getOrder,
  getOrderHistory,
  createOrder,
  updateOrder,
  deleteOrder,
};
