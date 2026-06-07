const prisma = require("../config/prisma");
const {
  convertAmount,
  loadTenantCurrencySettings,
  normalizeCurrencyCode,
} = require("../utils/currencySettings");

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const toNumber = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const sumOrderItems = (order) =>
  (order?.items || []).reduce(
    (sum, item) => sum + Number(item?.quantity || 0),
    0,
  );

const buildLastDays = (count) => {
  const days = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    date.setHours(0, 0, 0, 0);
    days.push(date);
  }
  return days;
};

const isSameDay = (date, compare) =>
  date.getFullYear() === compare.getFullYear() &&
  date.getMonth() === compare.getMonth() &&
  date.getDate() === compare.getDate();

const getWeekStart = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  return start;
};

const buildWeeklySeries = (orders, weeksCount, valueFn) => {
  const series = Array.from({ length: weeksCount }, () => 0);
  const now = new Date();
  const currentWeekStart = getWeekStart(now);

  orders.forEach((order) => {
    const date = new Date(order.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const orderWeekStart = getWeekStart(date);
    const diffMs = currentWeekStart - orderWeekStart;
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    if (diffWeeks < 0 || diffWeeks >= weeksCount) return;
    const index = weeksCount - diffWeeks - 1;
    series[index] += valueFn(order);
  });

  return series;
};

const buildWeeklyCustomerSeries = (orders, weeksCount) => {
  const buckets = Array.from({ length: weeksCount }, () => new Set());
  const now = new Date();
  const currentWeekStart = getWeekStart(now);

  orders.forEach((order) => {
    if (!order.customerId) return;
    const date = new Date(order.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const orderWeekStart = getWeekStart(date);
    const diffMs = currentWeekStart - orderWeekStart;
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    if (diffWeeks < 0 || diffWeeks >= weeksCount) return;
    const index = weeksCount - diffWeeks - 1;
    buckets[index].add(order.customerId);
  });

  return buckets.map((bucket) => bucket.size);
};

const getScopedStoreId = (user, requestedStoreId = null) =>
  user?.role === "SELLER" ? user.storeId || null : requestedStoreId || null;
const isSeller = (user) => user?.role === "SELLER";

const getSalesSummary = async (req, res) => {
  const scopedStoreId = getScopedStoreId(req.user, req.query?.storeId);
  if (req.user?.role === "SELLER" && !scopedStoreId) {
    return res.json({
      currencyCode: "USD",
      summary: {
        monthSales: 0,
        monthOrders: 0,
        activeCustomers: 0,
        validatedPayments: 0,
      },
      salesStatusData: [],
      salesQuantityData: [],
      paymentMethodData: [],
      ordersTrend: [],
      clientTrend: [],
      stockFlow: [],
    });
  }

  const now = new Date();
  const eightWeeksAgo = new Date(now);
  eightWeeksAgo.setDate(now.getDate() - 56);
  eightWeeksAgo.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const currencySettings = await loadTenantCurrencySettings(prisma, req.user.tenantId);
  const primaryCurrencyCode = currencySettings.primaryCurrencyCode;

  const [orders, stockEntries] = await Promise.all([
    prisma.order.findMany({
      where: {
        tenantId: req.user.tenantId,
        ...(isSeller(req.user) ? { createdById: req.user.id } : {}),
        ...(scopedStoreId ? { storeId: scopedStoreId } : {}),
        createdAt: { gte: eightWeeksAgo },
      },
      select: {
        id: true,
        status: true,
        total: true,
        currencyCode: true,
        createdAt: true,
        customerId: true,
        items: {
          select: {
            quantity: true,
          },
        },
        payments: {
          select: {
            method: true,
            status: true,
            paidAt: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.stockEntry.findMany({
      where: {
        tenantId: req.user.tenantId,
        ...(scopedStoreId ? { storeId: scopedStoreId } : {}),
        status: "POSTED",
        OR: [
          { postedAt: { gte: sevenDaysAgo } },
          { createdAt: { gte: sevenDaysAgo } },
        ],
      },
      select: {
        postedAt: true,
        createdAt: true,
        items: {
          select: {
            quantity: true,
          },
        },
      },
    }),
  ]);

  const normalizedOrders = orders.map((order) => ({
    ...order,
    totalInPrimaryCurrency: toNumber(
      convertAmount(
        order.total,
        normalizeCurrencyCode(order.currencyCode),
        primaryCurrencyCode,
        currencySettings,
      ),
    ),
  }));

  const paidOrders = normalizedOrders.filter((order) => order.status === "PAID");
  const monthOrders = normalizedOrders.filter((order) => new Date(order.createdAt) >= startOfMonth);
  const monthPaidOrders = paidOrders.filter((order) => new Date(order.createdAt) >= startOfMonth);

  const salesStatusData = [
    { label: "Réussies", value: paidOrders.length },
    {
      label: "Annulées",
      value: normalizedOrders.filter((order) => order.status === "CANCELED").length,
    },
    {
      label: "Échouées",
      value: normalizedOrders.filter(
        (order) =>
          order.payments?.some((payment) => payment.status === "FAILED") &&
          order.status !== "PAID",
      ).length,
    },
  ];
  const trackedStatuses = salesStatusData.reduce((sum, item) => sum + item.value, 0);
  salesStatusData.push({
    label: "En attente",
    value: Math.max(normalizedOrders.length - trackedStatuses, 0),
  });

  const salesQuantityData = buildLastDays(7).map((day) => ({
    label: DAY_LABELS[day.getDay()],
    value: paidOrders
      .filter((order) => isSameDay(new Date(order.createdAt), day))
      .reduce((sum, order) => sum + sumOrderItems(order), 0),
  }));

  const payments = normalizedOrders.flatMap((order) => order.payments || []);
  const paymentCounts = payments.reduce((accumulator, payment) => {
    const method = payment.method || "OTHER";
    accumulator[method] = (accumulator[method] || 0) + 1;
    return accumulator;
  }, {});
  const totalPayments = payments.length || 1;
  const paymentStats = {
    completed: payments.filter((payment) => payment.status === "COMPLETED").length,
    pending: payments.filter((payment) => payment.status === "PENDING").length,
    failed: payments.filter((payment) => payment.status === "FAILED").length,
  };
  const paymentMethodData = [
    { label: "Cash", value: Math.round(((paymentCounts.CASH || 0) / totalPayments) * 100) },
    {
      label: "Mobile Money",
      value: Math.round(((paymentCounts.MOBILE_MONEY || 0) / totalPayments) * 100),
    },
    { label: "Carte", value: Math.round(((paymentCounts.CARD || 0) / totalPayments) * 100) },
  ];

  const stockFlow = buildLastDays(7).map((day) => ({
    label: DAY_LABELS[day.getDay()],
    in: stockEntries
      .filter((entry) => isSameDay(new Date(entry.postedAt || entry.createdAt), day))
      .reduce(
        (sum, entry) =>
          sum +
          (entry.items || []).reduce(
            (itemSum, item) => itemSum + Math.abs(toNumber(item.quantity)),
            0,
          ),
        0,
      ),
    out: paidOrders
      .filter((order) => isSameDay(new Date(order.createdAt), day))
      .reduce((sum, order) => sum + sumOrderItems(order), 0),
  }));

  return res.json({
    currencyCode: primaryCurrencyCode,
    summary: {
      monthSales: monthPaidOrders.reduce((sum, order) => sum + order.totalInPrimaryCurrency, 0),
      monthOrders: monthOrders.length,
      activeCustomers: new Set(monthOrders.map((order) => order.customerId).filter(Boolean)).size,
      validatedPayments: paymentStats.completed,
    },
    salesStatusData,
    salesQuantityData,
    paymentMethodData,
    paymentStats,
    ordersTrend: buildWeeklySeries(normalizedOrders, 8, () => 1),
    clientTrend: buildWeeklyCustomerSeries(normalizedOrders, 8),
    stockFlow,
  });
};

module.exports = {
  getSalesSummary,
};
