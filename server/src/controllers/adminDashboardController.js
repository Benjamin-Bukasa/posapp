const prisma = require("../config/prisma");
const {
  convertAmount,
  loadTenantCurrencySettings,
} = require("../utils/currencySettings");
const {
  attachCurrencyCodes,
  getCurrencyCodeMap,
} = require("../utils/moneyCurrency");

const toNumber = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const buildLastMonths = (count = 3) => {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - index - 1), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      year: date.getFullYear(),
      month: date.getMonth(),
      label: new Intl.DateTimeFormat("fr-FR", {
        month: "short",
      }).format(date),
      fullLabel: new Intl.DateTimeFormat("fr-FR", {
        month: "short",
        year: "numeric",
      }).format(date),
    };
  });
};

const getBucketKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const buildCostHistory = (entries = [], currencySettings = {}) => {
  const history = new Map();

  entries.forEach((entry) => {
    const eventDate = entry.postedAt || entry.createdAt;
    const eventTime = new Date(eventDate).getTime();
    if (Number.isNaN(eventTime)) return;

    (entry.items || []).forEach((item) => {
      const quantity = toNumber(item.quantity);
      const unitCost = toNumber(
        convertAmount(
          item.unitCost,
          item.currencyCode,
          currencySettings.primaryCurrencyCode,
          currencySettings,
        ),
      );

      if (quantity <= 0 || unitCost <= 0 || !item.productId) {
        return;
      }

      const productHistory = history.get(item.productId) || [];
      productHistory.push({
        at: eventTime,
        unitCost,
      });
      history.set(item.productId, productHistory);
    });
  });

  history.forEach((events, productId) => {
    history.set(
      productId,
      events.sort((left, right) => left.at - right.at),
    );
  });

  return history;
};

const resolveUnitCostAt = (costHistory, productId, referenceDate) => {
  const events = costHistory.get(productId) || [];
  if (!events.length) return 0;

  const referenceTime = new Date(referenceDate).getTime();
  if (Number.isNaN(referenceTime)) {
    return events[events.length - 1]?.unitCost || 0;
  }

  let resolved = 0;

  for (const event of events) {
    if (event.at <= referenceTime) {
      resolved = event.unitCost;
      continue;
    }

    break;
  }

  return resolved || events[0]?.unitCost || 0;
};

const getAdminDashboard = async (req, res) => {
  const currencySettings = await loadTenantCurrencySettings(
    prisma,
    req.user.tenantId,
  );
  const months = buildLastMonths(3);
  const startDate = new Date(months[0].year, months[0].month, 1);
  const monthMap = Object.fromEntries(
    months.map((month) => [
      month.key,
      {
        monthKey: month.key,
        label: month.label,
        fullLabel: month.fullLabel,
        entryQuantity: 0,
        entryValue: 0,
        outputQuantity: 0,
        outputValue: 0,
        soldCost: 0,
      },
    ]),
  );

  const [postedEntries, paidOrders, inventoryRows, stores, activeProducts] = await Promise.all([
    prisma.stockEntry.findMany({
      where: {
        tenantId: req.user.tenantId,
        status: "POSTED",
        postedAt: { gte: startDate },
      },
      include: {
        items: true,
      },
    }),
    prisma.order.findMany({
      where: {
        tenantId: req.user.tenantId,
        status: "PAID",
        createdAt: { gte: startDate },
      },
      include: {
        items: true,
      },
    }),
    prisma.inventory.findMany({
      where: {
        tenantId: req.user.tenantId,
        quantity: { gt: 0 },
      },
      select: {
        storeId: true,
        productId: true,
        quantity: true,
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.store.findMany({
      where: { tenantId: req.user.tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.count({
      where: {
        tenantId: req.user.tenantId,
        isActive: true,
      },
    }),
  ]);

  const stockEntryItemCurrencyMap = await getCurrencyCodeMap(
    prisma,
    "stockEntryItems",
    postedEntries.flatMap((entry) => entry.items || []).map((item) => item.id),
  );
  const hydratedEntries = postedEntries.map((entry) => ({
    ...entry,
    items: attachCurrencyCodes(entry.items || [], stockEntryItemCurrencyMap),
  }));

  const costHistory = buildCostHistory(hydratedEntries, currencySettings);

  hydratedEntries.forEach((entry) => {
    const bucket = monthMap[getBucketKey(entry.postedAt || entry.createdAt)];
    if (!bucket) return;

    (entry.items || []).forEach((item) => {
      const quantity = Math.abs(toNumber(item.quantity));
      const unitCost = toNumber(
        convertAmount(
          item.unitCost,
          item.currencyCode,
          currencySettings.primaryCurrencyCode,
          currencySettings,
        ),
      );

      if (toNumber(item.quantity) > 0) {
        bucket.entryQuantity += quantity;
        bucket.entryValue += quantity * unitCost;
      } else if (toNumber(item.quantity) < 0) {
        const fallbackUnitCost =
          unitCost || resolveUnitCostAt(costHistory, item.productId, entry.postedAt || entry.createdAt);
        bucket.outputQuantity += quantity;
        bucket.outputValue += quantity * fallbackUnitCost;
      }
    });
  });

  paidOrders.forEach((order) => {
    const bucket = monthMap[getBucketKey(order.createdAt)];
    if (!bucket) return;

    (order.items || []).forEach((item) => {
      const quantity = toNumber(item.quantity);
      const unitCost = resolveUnitCostAt(costHistory, item.productId, order.createdAt);
      const extendedCost = quantity * unitCost;

      bucket.outputQuantity += quantity;
      bucket.outputValue += extendedCost;
      bucket.soldCost += extendedCost;
    });
  });

  const storeProductMap = new Map(
    stores.map((store) => [
      store.id,
      {
        storeId: store.id,
        label: store.name,
        products: new Set(),
        quantity: 0,
      },
    ]),
  );

  inventoryRows.forEach((row) => {
    if (!row.storeId) return;
    const bucket = storeProductMap.get(row.storeId);
    if (!bucket) return;
    bucket.products.add(row.productId);
    bucket.quantity += toNumber(row.quantity);
  });

  const storeDistribution = Array.from(storeProductMap.values())
    .map((item) => ({
      storeId: item.storeId,
      label: item.label,
      value: item.products.size,
      quantity: item.quantity,
    }))
    .filter((item) => item.value > 0 || item.quantity > 0);

  const flowComparison = months.map((month) => monthMap[month.key]);
  const soldCostVariation = months.map((month) => ({
    monthKey: month.key,
    label: month.label,
    fullLabel: month.fullLabel,
    value: monthMap[month.key].soldCost,
  }));

  const summary = {
    activeProducts,
    stores: stores.length,
    stockedStores: storeDistribution.length,
    entryQuantity: flowComparison.reduce((sum, item) => sum + item.entryQuantity, 0),
    entryValue: flowComparison.reduce((sum, item) => sum + item.entryValue, 0),
    outputQuantity: flowComparison.reduce((sum, item) => sum + item.outputQuantity, 0),
    outputValue: flowComparison.reduce((sum, item) => sum + item.outputValue, 0),
    soldCost: soldCostVariation.reduce((sum, item) => sum + item.value, 0),
  };

  return res.json({
    flowComparison,
    storeDistribution,
    soldCostVariation,
    summary,
    currencySettings,
  });
};

module.exports = {
  getAdminDashboard,
};
