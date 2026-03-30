const prisma = require("../config/prisma");
const {
  convertAmount,
  loadTenantCurrencySettings,
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

  const hydrated = attachCurrencyCodes(list, orderCurrencyMap).map((order) => ({
    ...order,
    items: attachCurrencyCodes(order.items || [], itemCurrencyMap),
    payments: attachCurrencyCodes(order.payments || [], paymentCurrencyMap),
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
      },
    });

    if (zone) {
      return zone;
    }
  }

  const counterZone = await prisma.storageZone.findFirst({
    where: {
      tenantId,
      storeId,
      zoneType: "COUNTER",
    },
    orderBy: { createdAt: "asc" },
  });

  if (counterZone) {
    return counterZone;
  }

  const storeZone = await prisma.storageZone.findFirst({
    where: {
      tenantId,
      storeId,
      zoneType: "STORE",
    },
    orderBy: { createdAt: "asc" },
  });

  if (storeZone) {
    return storeZone;
  }

  return prisma.storageZone.findFirst({
    where: {
      tenantId,
      storeId,
    },
    orderBy: { createdAt: "asc" },
  });
};

const listOrders = async (req, res) => {
  const { status, storeId, customerId } = req.query || {};
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

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
    },
  });

  if (!order) {
    return res.status(404).json({ message: "Order not found." });
  }

  return res.json(await hydrateOrdersWithCurrencyCodes(order));
};

const createOrder = async (req, res) => {
  const { items, customerId, paymentMethod, amountReceived, reference, pointsEarned } =
    req.body || {};

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

  const storageZone = await resolveCashierStorageZone({
    tenantId: req.user.tenantId,
    storeId: cashier.storeId,
    defaultStorageZoneId: cashier.defaultStorageZoneId,
  });

  if (!storageZone) {
    return res.status(400).json({
      message: "No stock zone is configured for this cashier.",
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
  const paidAmount = amountReceived === undefined ? total : Number(amountReceived);
  if (!Number.isFinite(paidAmount) || paidAmount < total) {
    return res.status(400).json({
      message: "Received amount must cover the sale total.",
    });
  }

  const inventoryRows = await prisma.inventory.findMany({
    where: {
      tenantId: req.user.tenantId,
      storageZoneId: storageZone.id,
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
      currencySettings.primaryCurrencyCode,
    );

    for (const [productId, requiredQuantity] of inventoryRequirements.entries()) {
      await tx.inventory.update({
        where: {
          storageZoneId_productId: {
            storageZoneId: storageZone.id,
            productId,
          },
        },
        data: {
          quantity: { decrement: requiredQuantity },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          tenantId: req.user.tenantId,
          productId,
          storageZoneId: storageZone.id,
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
        currencyCode: currencySettings.primaryCurrencyCode,
      })),
    };
  });

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

  return res.status(201).json(createdOrder);
};

module.exports = {
  listOrders,
  getOrder,
  createOrder,
};
