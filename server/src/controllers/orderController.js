const prisma = require("../config/prisma");
const {
  convertAmount,
  loadTenantCurrencySettings,
  normalizeCurrencyCode,
} = require("../utils/currencySettings");
const {
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
  ensureOrderItemOfferTable,
  listOrderItemOffersMap,
  replaceOrderItemOffers,
} = require("../utils/orderItemOfferStore");
const {
  consumeInventoryLotsFefo,
  incrementInventoryLot,
  emitLotExpiryNotifications,
  ensureInventoryLotTables,
  synchronizeInventoryAggregate,
} = require("../utils/inventoryLotStore");
const { normalizeError } = require("../utils/httpErrors");
const { hasPermission } = require("../utils/permissionAccess");

const LONG_TRANSACTION_OPTIONS = {
  maxWait: 15000,
  timeout: 45000,
};
const isSeller = (user) => user?.role === "SELLER";

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
const GIFT_REASON_TYPES = new Set([
  "BONUS_POINTS",
  "THRESHOLD_PURCHASE",
  "MANUAL",
]);

const escapeSqlValue = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replace(/'/g, "''")}'`;
};

const toNumber = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : NaN;
};

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));
const normalizeGiftReasonType = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return GIFT_REASON_TYPES.has(normalized) ? normalized : null;
};
const validateGiftEligibility = (saleSnapshot) => {
  for (const item of saleSnapshot.orderItems || []) {
    if (!item.isGift || item.giftReasonType !== "THRESHOLD_PURCHASE") {
      continue;
    }

    const thresholdAmount = Number(item.giftThresholdAmount || 0);
    if (!Number.isFinite(thresholdAmount) || thresholdAmount <= 0) {
      throw Object.assign(
        new Error("Un montant d'achat valide est obligatoire pour un article offert sur seuil."),
        { status: 400 },
      );
    }

    if (Number(saleSnapshot.total || 0) < thresholdAmount) {
      throw Object.assign(
        new Error(
          `Le panier payant doit atteindre ${thresholdAmount.toFixed(
            2,
          )} pour valider cet article offert.`,
        ),
        { status: 400 },
      );
    }
  }
};
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

  const paymentOriginalMap = await getPaymentOriginalMap(
    prisma,
    list.flatMap((item) => item.payments || []).map((payment) => payment.id),
  );
  await ensureOrderItemOfferTable();
  const itemOfferMap = await listOrderItemOffersMap(
    list[0]?.tenantId,
    list.flatMap((item) => item.items || []).map((orderItem) => orderItem.id),
  );

  const hydrated = list.map((order) => ({
    ...order,
    currencyCode: normalizeCurrencyCode(order.currencyCode),
    items: (order.items || []).map((item) => ({
      ...item,
      currencyCode: normalizeCurrencyCode(item.currencyCode),
      isGift: itemOfferMap.has(item.id),
      giftReasonType: itemOfferMap.get(item.id)?.reasonType || null,
      giftReasonNote: itemOfferMap.get(item.id)?.reasonNote || null,
      giftThresholdAmount: itemOfferMap.get(item.id)?.thresholdAmount ?? null,
      giftBonusPointsUsed: itemOfferMap.get(item.id)?.bonusPointsUsed || 0,
    })),
    payments: attachPaymentOriginalDetails(
      (order.payments || []).map((payment) => ({
        ...payment,
        currencyCode: normalizeCurrencyCode(payment.currencyCode),
      })),
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
    const isGift = Boolean(item?.isGift);
    const giftReasonType = isGift
      ? normalizeGiftReasonType(item?.giftReasonType)
      : null;
    const giftReasonNote = String(item?.giftReasonNote || "").trim();
    const giftThresholdAmount =
      item?.giftThresholdAmount === undefined ||
      item?.giftThresholdAmount === null ||
      item?.giftThresholdAmount === ""
        ? null
        : roundMoney(Number(item.giftThresholdAmount));

    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
      throw Object.assign(new Error(`Invalid item on line ${index + 1}.`), {
        status: 400,
      });
    }

    if (isGift && !giftReasonType) {
      throw Object.assign(
        new Error(`Gift reason required on line ${index + 1}.`),
        { status: 400 },
      );
    }

    if (giftReasonType === "THRESHOLD_PURCHASE") {
      if (!Number.isFinite(giftThresholdAmount) || giftThresholdAmount <= 0) {
        throw Object.assign(
          new Error(`Invalid threshold amount on line ${index + 1}.`),
          { status: 400 },
        );
      }
    }

    return {
      productId,
      quantity,
      isGift,
      giftReasonType,
      giftReasonNote,
      giftThresholdAmount,
      giftBonusPointsUsed: 0,
    };
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
  let grossSubtotal = 0;

  (items || []).forEach((item) => {
    const article = articleMap.get(item.productId);
    if (!article) {
      throw Object.assign(new Error("Invalid article selected."), { status: 400 });
    }

    const convertedUnitPrice = Number(
      convertAmount(
        article.unitPrice,
        articleCurrencyMap.get(article.id),
        currencySettings.primaryCurrencyCode,
        currencySettings,
      ) || 0,
    );
    const grossLineTotal = roundMoney(convertedUnitPrice * item.quantity);
    const lineTotal = item.isGift ? 0 : grossLineTotal;
    subtotal += lineTotal;
    grossSubtotal += grossLineTotal;
    orderItems.push({
      productId: article.id,
      quantity: item.quantity,
      unitPrice: roundMoney(convertedUnitPrice),
      total: lineTotal,
      isGift: Boolean(item.isGift),
      giftReasonType: item.giftReasonType || null,
      giftReasonNote: item.giftReasonNote || null,
      giftThresholdAmount:
        item.giftThresholdAmount === null || item.giftThresholdAmount === undefined
          ? null
          : roundMoney(item.giftThresholdAmount),
      grossLineTotal,
      giftBonusPointsUsed: Number(item.giftBonusPointsUsed || 0),
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
    grossSubtotal: roundMoney(grossSubtotal),
    giftedTotal: roundMoney(grossSubtotal - subtotal),
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
      isGift: Boolean(item.isGift),
      giftReasonType: item.giftReasonType || null,
      giftReasonNote: item.giftReasonNote || null,
      giftBonusPointsUsed: Number(item.giftBonusPointsUsed || 0),
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

  const values = uniqueProductIds.map((id) => `(${escapeSqlValue(id)})`).join(", ");
  const rows = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS "count"
    FROM "inventoryLots"
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "storageZoneId" = ${escapeSqlValue(storageZoneId)}
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

const canAccessStoreSales = (user) =>
  isSeller(user) && hasPermission(user, "sales.read_store") && Boolean(user?.storeId);

const canManageStoreSales = (user, permissionCode) =>
  isSeller(user) && hasPermission(user, permissionCode) && Boolean(user?.storeId);

const buildSellerOrderScope = (user) => {
  if (!isSeller(user)) return {};
  if (canAccessStoreSales(user)) {
    return { storeId: user.storeId };
  }
  return { createdById: user.id };
};

const assertSellerOwnsOrder = (
  user,
  order,
  message = "Vous ne pouvez pas acceder a cette vente.",
  storePermissionCode = null,
) => {
  if (!order) return;
  if (!isSeller(user)) return;
  if (String(order.createdById || "") === String(user.id || "")) {
    return;
  }

  if (
    storePermissionCode &&
    canManageStoreSales(user, storePermissionCode) &&
    String(order.storeId || "") === String(user.storeId || "")
  ) {
    return;
  }

  throw Object.assign(new Error(message), { status: 403 });
};

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
    ...buildSellerOrderScope(req.user),
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
    where: {
      id,
      tenantId: req.user.tenantId,
      ...buildSellerOrderScope(req.user),
    },
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
    where: {
      id,
      tenantId: req.user.tenantId,
      ...buildSellerOrderScope(req.user),
    },
    select: { id: true, createdById: true },
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

const cancelOrderSale = async ({
  tenantId,
  orderId,
  actorUserId,
  actorRole = null,
  actorPermissions = null,
  reason,
  auditAction = "DELETED",
  auditReasonFallback = "Suppression logique de la vente.",
}) => {
  await ensureInventoryLotTables();

  const existingOrder = await getOrderWithRelations(tenantId, orderId);
  if (!existingOrder) {
    throw Object.assign(new Error("Order not found."), { status: 404 });
  }
  assertSellerOwnsOrder(
    { id: actorUserId, role: actorRole, permissions: actorPermissions },
    existingOrder,
    "Vous ne pouvez pas annuler la vente d'un autre vendeur.",
    "sales.cancel_store",
  );
  if (existingOrder.status === "CANCELED") {
    throw Object.assign(new Error("Cette vente est deja annulee."), { status: 409 });
  }

  const payment = existingOrder.payments?.[0];
  if (!payment) {
    throw Object.assign(new Error("Cette vente ne contient aucun paiement."), { status: 409 });
  }

  const cashSession = await getCashSessionByPaymentId({
    tenantId,
    paymentId: payment.id,
  });

  if (!cashSession?.storageZoneId) {
    throw Object.assign(
      new Error("Impossible de determiner la zone de stock de cette vente."),
      { status: 409 },
    );
  }

  const saleSnapshot = await buildSaleFromItems({
    tenantId,
    items: (existingOrder.items || []).map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity || 0),
    })),
    currencySettings: await loadTenantCurrencySettings(prisma, tenantId),
    allowInactiveArticles: true,
    allowInactiveComponents: true,
  });

  const beforeSnapshot = buildOrderAuditSnapshot(
    await hydrateOrdersWithCurrencyCodes(existingOrder),
  );

  const runCancelTransaction = async ({ aggregateOnly = false } = {}) => {
    await prisma.$transaction(async (tx) => {
      let movementRows = [];

      if (aggregateOnly) {
        movementRows = await restoreAggregateInventoryForRequirements(tx, {
          tenantId,
          storeId: existingOrder.storeId,
          storageZoneId: cashSession.storageZoneId,
          inventoryRequirements: saleSnapshot.inventoryRequirements,
          sourceId: existingOrder.id,
          createdById: actorUserId,
        });
      } else {
        const restoredProductIds = new Set();
        movementRows = [];

        for (const [productId, quantity] of saleSnapshot.inventoryRequirements.entries()) {
          await incrementInventoryLot(tx, {
            tenantId,
            storeId: existingOrder.storeId,
            storageZoneId: cashSession.storageZoneId,
            productId,
            quantity,
            syncAggregate: false,
          });

          restoredProductIds.add(productId);
          movementRows.push({
            tenantId,
            productId,
            storageZoneId: cashSession.storageZoneId,
            quantity,
            movementType: "IN",
            sourceType: "DIRECT",
            sourceId: existingOrder.id,
            createdById: actorUserId,
          });
        }

        for (const productId of restoredProductIds) {
          await synchronizeInventoryAggregate(tx, {
            tenantId,
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
        tenantId,
        paymentId: payment.id,
        previousAmount: Number(existingOrder.total || 0),
        previousMethod: payment.method,
        nextAmount: 0,
        nextMethod: payment.method,
      });
    }, LONG_TRANSACTION_OPTIONS);
  };

  let aggregateRestockOnly = await hasLegacyOrderWithoutLots({
    tenantId,
    storageZoneId: cashSession.storageZoneId,
    productIds: [...saleSnapshot.inventoryRequirements.keys()],
  });

  try {
    await runCancelTransaction({ aggregateOnly: aggregateRestockOnly });
  } catch (transactionError) {
    const isTransactionTimeout =
      transactionError?.code === "P2028" ||
      String(transactionError?.message || "").includes("Transaction already closed");

    if (!isTransactionTimeout || aggregateRestockOnly) {
      throw transactionError;
    }

    aggregateRestockOnly = true;
    await runCancelTransaction({ aggregateOnly: true });
  }

  const canceledOrder = await hydrateOrdersWithCurrencyCodes(
    await getOrderWithRelations(tenantId, existingOrder.id),
  );
  const afterSnapshot = buildOrderAuditSnapshot(canceledOrder);
  await recordOrderAudit(prisma, {
    tenantId,
    orderId: existingOrder.id,
    action: auditAction,
    actorUserId,
    reason: reason || auditReasonFallback,
    details: {
      before: beforeSnapshot,
      after: afterSnapshot,
      changes: buildAuditChanges(beforeSnapshot, afterSnapshot),
      aggregateRestockOnly,
    },
  });

  emitToTenant(tenantId, "sale:updated", {
    id: canceledOrder.id,
    storeId: canceledOrder.storeId,
    total: canceledOrder.total,
    status: canceledOrder.status,
  });
  emitToTenant(tenantId, "payment:updated", {
    id: payment.id,
    orderId: canceledOrder.id,
    status: "FAILED",
  });

  if (canceledOrder.storeId) {
    emitToStore(canceledOrder.storeId, "sale:updated", {
      id: canceledOrder.id,
      storeId: canceledOrder.storeId,
      total: canceledOrder.total,
      status: canceledOrder.status,
    });
    emitToStore(canceledOrder.storeId, "payment:updated", {
      id: payment.id,
      orderId: canceledOrder.id,
      status: "FAILED",
    });
  }

  await emitLotExpiryNotifications(tenantId);

  return canceledOrder;
};

const updateOrder = async (req, res) => {
  try {
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
    assertSellerOwnsOrder(
      req.user,
      existingOrder,
      "Vous ne pouvez pas modifier la vente d'un autre vendeur.",
      "sales.update_store",
    );
    const hydratedExistingOrder = await hydrateOrdersWithCurrencyCodes(existingOrder);
    if (existingOrder.status === "CANCELED") {
      return res.status(409).json({ message: "Impossible de modifier une vente supprimee." });
    }

    const existingPayment = existingOrder.payments?.[0];
    if (!existingPayment) {
      return res.status(409).json({ message: "Cette vente ne contient aucun paiement." });
    }

    let nextItems = (hydratedExistingOrder.items || []).map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity || 0),
      isGift: Boolean(item.isGift),
      giftReasonType: item.giftReasonType || null,
      giftReasonNote: item.giftReasonNote || null,
      giftThresholdAmount: item.giftThresholdAmount ?? null,
      giftBonusPointsUsed: Number(item.giftBonusPointsUsed || 0),
    }));
    if (items !== undefined) {
      if (!Array.isArray(items) || !items.length) {
        return res.status(400).json({ message: "items array required." });
      }

      try {
        nextItems = normalizeOrderItemsInput(items);
      } catch (error) {
        const normalized = normalizeError(error);
        return res.status(normalized.status).json({
          message: normalized.message || "Invalid sale.",
        });
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
    validateGiftEligibility(nextSaleSnapshot);

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
      ...hydratedExistingOrder,
      payments: attachPaymentOriginalDetails(hydratedExistingOrder.payments || [], new Map([
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
        },
      });

      let recreatedItems = null;
      if (items !== undefined) {
        await tx.orderItem.deleteMany({
          where: { orderId: existingOrder.id },
        });
        recreatedItems = [];
        for (const item of nextSaleSnapshot.orderItems) {
          const createdItem = await tx.orderItem.create({
            data: {
              orderId: existingOrder.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            },
          });
          recreatedItems.push(createdItem);
        }
        await setCurrencyCodes(
          tx,
          "orderItems",
          recreatedItems.map((item) => item.id),
          primaryCurrencyCode,
        );
        await replaceOrderItemOffers(tx, {
          tenantId: req.user.tenantId,
          orderId: existingOrder.id,
          createdItems: recreatedItems,
          sourceItems: nextSaleSnapshot.orderItems,
        });
      }

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
  } catch (error) {
    const normalized = normalizeError(error);
    console.error("updateOrder failed:", {
      status: normalized.status,
      message: normalized.message,
      code: error?.code || null,
      rawMessage: error?.message || null,
    });
    return res.status(normalized.status).json({ message: normalized.message });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const deletedOrder = await cancelOrderSale({
      tenantId: req.user.tenantId,
      orderId: req.params.id,
      actorUserId: req.user.id,
      actorRole: req.user.role,
      actorPermissions: req.user.permissions,
      reason: req.body?.reason,
      auditAction: "DELETED",
      auditReasonFallback: "Suppression logique de la vente.",
    });
    return res.json(deletedOrder);
  } catch (error) {
    const normalized = normalizeError(error);
    console.error("deleteOrder failed:", {
      status: normalized.status,
      message: normalized.message,
      code: error?.code || null,
      rawMessage: error?.message || null,
    });
    return res.status(normalized.status).json({
      message:
        normalized.status === 500 && normalized.message === "Une erreur interne est survenue."
          ? "Impossible de supprimer cette vente."
          : normalized.message,
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
    normalizedItems = normalizeOrderItemsInput(items);
  } catch (error) {
    const normalized = normalizeError(error);
    return res.status(normalized.status).json({
      message: normalized.message || "Invalid sale.",
    });
  }
  const currencySettings = await loadTenantCurrencySettings(
    prisma,
    req.user.tenantId,
  );

  let customer = null;
  if (customerId) {
    customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: req.user.tenantId },
      select: { id: true, points: true, firstName: true, lastName: true },
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }
  }
  let saleSnapshot;
  try {
    saleSnapshot = await buildSaleFromItems({
      tenantId: req.user.tenantId,
      items: normalizedItems,
      currencySettings,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return res.status(normalized.status).json({
      message: normalized.message || "Invalid sale.",
    });
  }

  const activeBonusProgram = await getCurrentCustomerBonusProgram(req.user.tenantId);
  let totalBonusPointsUsed = 0;
  try {
    normalizedItems = normalizedItems.map((item, index) => {
      const pricedItem = saleSnapshot.orderItems[index];
      if (!item.isGift || item.giftReasonType !== "BONUS_POINTS") {
        return { ...item, giftBonusPointsUsed: 0 };
      }

      if (!customer?.id) {
        throw Object.assign(
          new Error("Un client est obligatoire pour offrir un article via les points bonus."),
          { status: 400 },
        );
      }

      const pointValueAmount = Number(activeBonusProgram?.pointValueAmount || 0);
      if (!Number.isFinite(pointValueAmount) || pointValueAmount <= 0) {
        throw Object.assign(
          new Error("Le programme bonus actif ne permet pas encore de convertir les points en montant."),
          { status: 400 },
        );
      }

      const pointsToUse = Math.max(1, Math.ceil(Number(pricedItem?.grossLineTotal || 0) / pointValueAmount));
      totalBonusPointsUsed += pointsToUse;
      saleSnapshot.orderItems[index] = {
        ...pricedItem,
        giftBonusPointsUsed: pointsToUse,
      };

      return {
        ...item,
        giftBonusPointsUsed: pointsToUse,
      };
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return res.status(normalized.status).json({
      message: normalized.message || "Invalid gift configuration.",
    });
  }

  if (totalBonusPointsUsed > 0 && Number(customer?.points || 0) < totalBonusPointsUsed) {
    return res.status(400).json({
      message: "Le client ne dispose pas d'assez de points bonus pour couvrir les articles offerts.",
    });
  }
  try {
    validateGiftEligibility(saleSnapshot);
  } catch (error) {
    const normalized = normalizeError(error);
    return res.status(normalized.status).json({
      message: normalized.message || "Invalid gift configuration.",
    });
  }

  const total = roundMoney(saleSnapshot.total);
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
      productId: { in: [...saleSnapshot.inventoryRequirements.keys()] },
    },
    select: {
      productId: true,
      quantity: true,
    },
  });

  const inventoryMap = new Map(
    inventoryRows.map((row) => [row.productId, Number(row.quantity || 0)]),
  );

  for (const [productId, requiredQuantity] of saleSnapshot.inventoryRequirements.entries()) {
    const availableQuantity = inventoryMap.get(productId) || 0;
    if (availableQuantity < requiredQuantity) {
      return res.status(400).json({
        message: `Insufficient stock for ${saleSnapshot.requirementLabels.get(productId) || productId}.`,
      });
    }
  }

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
        subtotal: total,
        tax: 0,
        total,
      },
    });
    const createdItems = [];
    for (const item of saleSnapshot.orderItems) {
      const createdItem = await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        },
      });
      createdItems.push(createdItem);
    }

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
      createdItems.map((item) => item.id),
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
    await replaceOrderItemOffers(tx, {
      tenantId: req.user.tenantId,
      orderId: order.id,
      createdItems,
      sourceItems: saleSnapshot.orderItems,
    });

    for (const [productId, requiredQuantity] of saleSnapshot.inventoryRequirements.entries()) {
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

    if (customer?.id && totalBonusPointsUsed > 0) {
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          points: { decrement: totalBonusPointsUsed },
        },
      });

      const giftedBonusItems = saleSnapshot.orderItems.filter(
        (item) => item.isGift && item.giftReasonType === "BONUS_POINTS" && item.giftBonusPointsUsed > 0,
      );

      for (const giftedItem of giftedBonusItems) {
        await tx.bonusRecord.create({
          data: {
            tenantId: req.user.tenantId,
            customerId: customer.id,
            points: -Math.abs(Number(giftedItem.giftBonusPointsUsed || 0)),
            reason:
              giftedItem.giftReasonNote?.trim() ||
              `Article offert sur points bonus - vente ${order.id}`,
          },
        });
      }
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
      bonusPointsUsed: totalBonusPointsUsed,
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

  const hydratedCreatedOrder = await hydrateOrdersWithCurrencyCodes(createdOrder);

  emitToTenant(req.user.tenantId, "order:created", {
    id: hydratedCreatedOrder.id,
    storeId: hydratedCreatedOrder.storeId,
    total: hydratedCreatedOrder.total,
    status: hydratedCreatedOrder.status,
  });

  emitToTenant(req.user.tenantId, "sale:created", {
    id: hydratedCreatedOrder.id,
    storeId: hydratedCreatedOrder.storeId,
    total: hydratedCreatedOrder.total,
    status: hydratedCreatedOrder.status,
  });

  if (hydratedCreatedOrder.storeId) {
    emitToStore(hydratedCreatedOrder.storeId, "order:created", {
      id: hydratedCreatedOrder.id,
      storeId: hydratedCreatedOrder.storeId,
      total: hydratedCreatedOrder.total,
      status: hydratedCreatedOrder.status,
    });

    emitToStore(hydratedCreatedOrder.storeId, "sale:created", {
      id: hydratedCreatedOrder.id,
      storeId: hydratedCreatedOrder.storeId,
      total: hydratedCreatedOrder.total,
      status: hydratedCreatedOrder.status,
    });
  }

  await emitLotExpiryNotifications(req.user.tenantId);

  return res.status(201).json(hydratedCreatedOrder);
};

module.exports = {
  listOrders,
  getOrder,
  getOrderHistory,
  createOrder,
  updateOrder,
  deleteOrder,
  cancelOrderSale,
};
