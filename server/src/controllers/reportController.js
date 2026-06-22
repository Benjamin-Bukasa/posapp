const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { sendExport } = require("../utils/exporter");
const {
  convertAmount,
  loadTenantCurrencySettings,
  normalizeCurrencyCode,
} = require("../utils/currencySettings");
const { ensureOrderAuditTables } = require("../utils/orderAuditStore");
const { isRestrictedSeller } = require("../utils/permissionAccess");

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const SALES_REPORT_EXPORT_COLUMNS = {
  period: [
    { key: "periodLabel", label: "Periode" },
    { key: "orderCount", label: "Tickets" },
    { key: "customerCount", label: "Clients" },
    { key: "quantityTotal", label: "Articles" },
    { key: "totalAmount", label: "Ventes" },
    { key: "cashAmount", label: "Cash" },
    { key: "nonCashAmount", label: "Non cash" },
    { key: "averageTicket", label: "Panier moyen" },
    { key: "cancellationCount", label: "Annulations" },
    { key: "refundCount", label: "Remboursements" },
  ],
  "by-item": [
    { key: "productName", label: "Article" },
    { key: "sku", label: "SKU" },
    { key: "quantity", label: "Quantite" },
    { key: "orderCount", label: "Tickets" },
    { key: "amount", label: "Chiffre d'affaires" },
    { key: "averagePrice", label: "Prix moyen" },
  ],
  "by-customer": [
    { key: "customerName", label: "Client" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Telephone" },
    { key: "orderCount", label: "Tickets" },
    { key: "quantity", label: "Articles" },
    { key: "amount", label: "Montant" },
  ],
  "by-date": [
    { key: "date", label: "Date" },
    { key: "orderCount", label: "Tickets" },
    { key: "customerCount", label: "Clients" },
    { key: "quantity", label: "Articles" },
    { key: "amount", label: "Montant" },
    { key: "cancellations", label: "Annulations" },
    { key: "refunds", label: "Remboursements" },
  ],
  cancellations: [
    { key: "createdAt", label: "Date" },
    { key: "orderId", label: "Vente" },
    { key: "customerName", label: "Client" },
    { key: "cashierName", label: "Caissier" },
    { key: "storeName", label: "Boutique" },
    { key: "amount", label: "Montant" },
    { key: "reason", label: "Motif" },
  ],
  refunds: [
    { key: "createdAt", label: "Date" },
    { key: "orderId", label: "Vente" },
    { key: "customerName", label: "Client" },
    { key: "cashierName", label: "Caissier" },
    { key: "storeName", label: "Boutique" },
    { key: "amount", label: "Montant" },
    { key: "reason", label: "Motif" },
  ],
  "by-cashier": [
    { key: "cashierName", label: "Caissier" },
    { key: "storeName", label: "Boutique" },
    { key: "orderCount", label: "Tickets" },
    { key: "customerCount", label: "Clients" },
    { key: "quantity", label: "Articles" },
    { key: "amount", label: "Montant" },
  ],
  "by-store": [
    { key: "storeName", label: "Boutique" },
    { key: "cashierCount", label: "Caissiers" },
    { key: "customerCount", label: "Clients" },
    { key: "orderCount", label: "Tickets" },
    { key: "quantity", label: "Articles" },
    { key: "amount", label: "Montant" },
  ],
  "top-items": [
    { key: "rank", label: "Rang" },
    { key: "productName", label: "Article" },
    { key: "sku", label: "SKU" },
    { key: "quantity", label: "Quantite" },
    { key: "orderCount", label: "Tickets" },
    { key: "amount", label: "Chiffre d'affaires" },
    { key: "averagePrice", label: "Prix moyen" },
  ],
  "least-items": [
    { key: "rank", label: "Rang" },
    { key: "productName", label: "Article" },
    { key: "sku", label: "SKU" },
    { key: "quantity", label: "Quantite" },
    { key: "orderCount", label: "Tickets" },
    { key: "amount", label: "Chiffre d'affaires" },
    { key: "averagePrice", label: "Prix moyen" },
  ],
};

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
  isRestrictedSeller(user) ? user.storeId || null : requestedStoreId || null;
const isSeller = isRestrictedSeller;
const formatDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toStartOfDay = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const toEndOfDay = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date;
};

const convertToPrimaryAmount = ({
  amount,
  currencyCode,
  primaryCurrencyCode,
  currencySettings,
}) =>
  toNumber(
    convertAmount(
      amount,
      normalizeCurrencyCode(currencyCode),
      primaryCurrencyCode,
      currencySettings,
    ),
  );

const buildCustomerLabel = (customer) =>
  [customer?.firstName, customer?.lastName].filter(Boolean).join(" ").trim() ||
  customer?.email ||
  customer?.phone ||
  "Client anonyme";

const buildUserLabel = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
  user?.email ||
  "Utilisateur inconnu";

const loadReportAuditRows = async ({
  tenantId,
  sellerUserId = null,
  storeId = null,
  createdFrom = null,
  createdTo = null,
}) => {
  await ensureOrderAuditTables();

  return prisma.$queryRaw(
    Prisma.sql`
      SELECT
        log."id" AS "id",
        log."orderId" AS "orderId",
        log."action" AS "action",
        log."reason" AS "reason",
        log."details" AS "details",
        log."createdAt" AS "createdAt",
        "order"."storeId" AS "storeId",
        store."name" AS "storeName",
        "order"."createdById" AS "cashierId",
        TRIM(COALESCE(cashier."firstName", '') || ' ' || COALESCE(cashier."lastName", '')) AS "cashierName",
        "order"."customerId" AS "customerId",
        TRIM(COALESCE(customer."firstName", '') || ' ' || COALESCE(customer."lastName", '')) AS "customerName"
      FROM "orderAuditLogs" log
      INNER JOIN "orders" "order" ON "order"."id" = log."orderId"
      LEFT JOIN "stores" store ON store."id" = "order"."storeId"
      LEFT JOIN "users" cashier ON cashier."id" = "order"."createdById"
      LEFT JOIN "customers" customer ON customer."id" = "order"."customerId"
      WHERE log."tenantId" = ${tenantId}
        AND log."action" IN ('DELETED', 'REFUNDED')
        ${sellerUserId ? Prisma.sql`AND "order"."createdById" = ${sellerUserId}` : Prisma.empty}
        ${storeId ? Prisma.sql`AND "order"."storeId" = ${storeId}` : Prisma.empty}
        ${createdFrom ? Prisma.sql`AND log."createdAt" >= ${createdFrom}` : Prisma.empty}
        ${createdTo ? Prisma.sql`AND log."createdAt" <= ${createdTo}` : Prisma.empty}
      ORDER BY log."createdAt" DESC
    `,
  );
};

const getSalesReport = async (req, res) => {
  const scopedStoreId = getScopedStoreId(req.user, req.query?.storeId);
  const requestedCashierId = req.query?.cashierId ? String(req.query.cashierId).trim() : null;
  const sellerUserId = isRestrictedSeller(req.user) ? req.user.id : requestedCashierId || null;
  const view = String(req.query?.view || "period").trim().toLowerCase();
  const exportType = req.query?.export ? String(req.query.export).trim().toLowerCase() : "";
  const createdFrom = toStartOfDay(req.query?.createdFrom);
  const createdTo = toEndOfDay(req.query?.createdTo);

  if (isRestrictedSeller(req.user) && !scopedStoreId) {
    return res.json({
      view,
      currencyCode: "USD",
      rows: [],
      summary: {
        totalAmount: 0,
        orderCount: 0,
        quantityTotal: 0,
        customerCount: 0,
        cancellationCount: 0,
        refundCount: 0,
        cashAmount: 0,
        nonCashAmount: 0,
      },
    });
  }

  const orderWhere = {
    tenantId: req.user.tenantId,
    ...(sellerUserId ? { createdById: sellerUserId } : {}),
    ...(scopedStoreId ? { storeId: scopedStoreId } : {}),
    ...((createdFrom || createdTo)
      ? {
          createdAt: {
            ...(createdFrom ? { gte: createdFrom } : {}),
            ...(createdTo ? { lte: createdTo } : {}),
          },
        }
      : {}),
  };

  const currencySettings = await loadTenantCurrencySettings(prisma, req.user.tenantId);
  const primaryCurrencyCode = currencySettings.primaryCurrencyCode;

  const [orders, auditRows] = await Promise.all([
    prisma.order.findMany({
      where: orderWhere,
      include: {
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            currencyCode: true,
            method: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    loadReportAuditRows({
      tenantId: req.user.tenantId,
      sellerUserId,
      storeId: scopedStoreId,
      createdFrom,
      createdTo,
    }),
  ]);

  const saleOrders = orders
    .filter(
      (order) =>
        order.status !== "CANCELED" &&
        (order.payments || []).some((payment) => payment.status === "COMPLETED"),
    )
    .map((order) => {
      const totalAmount = convertToPrimaryAmount({
        amount: order.total,
        currencyCode: order.currencyCode,
        primaryCurrencyCode,
        currencySettings,
      });

      const items = (order.items || []).map((item) => ({
        productId: item.productId,
        productName: item.product?.name || "Article",
        sku: item.product?.sku || "",
        quantity: Number(item.quantity || 0),
        totalAmount: convertToPrimaryAmount({
          amount: item.total,
          currencyCode: item.currencyCode || order.currencyCode,
          primaryCurrencyCode,
          currencySettings,
        }),
        unitPriceAmount: convertToPrimaryAmount({
          amount: item.unitPrice,
          currencyCode: item.currencyCode || order.currencyCode,
          primaryCurrencyCode,
          currencySettings,
        }),
      }));

      const completedPayments = (order.payments || []).filter(
        (payment) => payment.status === "COMPLETED",
      );

      return {
        ...order,
        totalAmount,
        items,
        quantityTotal: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        cashAmount: completedPayments
          .filter((payment) => payment.method === "CASH")
          .reduce(
            (sum, payment) =>
              sum +
              convertToPrimaryAmount({
                amount: payment.amount,
                currencyCode: payment.currencyCode || order.currencyCode,
                primaryCurrencyCode,
                currencySettings,
              }),
            0,
          ),
        nonCashAmount: completedPayments
          .filter((payment) => payment.method !== "CASH")
          .reduce(
            (sum, payment) =>
              sum +
              convertToPrimaryAmount({
                amount: payment.amount,
                currencyCode: payment.currencyCode || order.currencyCode,
                primaryCurrencyCode,
                currencySettings,
              }),
            0,
          ),
      };
    });

  const normalizedAuditRows = (auditRows || []).map((row) => {
    const details =
      row.details && typeof row.details === "object"
        ? row.details
        : (() => {
            try {
              return JSON.parse(row.details || "{}");
            } catch (_error) {
              return {};
            }
          })();

    const before = details.before || {};
    const amount = convertToPrimaryAmount({
      amount: before.total || 0,
      currencyCode:
        before.paymentCurrencyCode ||
        before.originalPaymentCurrencyCode ||
        primaryCurrencyCode,
      primaryCurrencyCode,
      currencySettings,
    });

    return {
      id: row.id,
      auditId: row.id,
      action: row.action,
      orderId: row.orderId,
      reason: row.reason || "",
      createdAt: row.createdAt,
      storeId: row.storeId || null,
      storeName: row.storeName || "Boutique inconnue",
      cashierId: row.cashierId || null,
      cashierName: row.cashierName || "Caissier inconnu",
      customerId: row.customerId || null,
      customerName: row.customerName || before.customerName || "Client anonyme",
      amount,
      itemCount: Array.isArray(before.items)
        ? before.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
        : 0,
      statusBefore: before.status || "",
    };
  });

  const cancellationRows = normalizedAuditRows.filter((row) => row.action === "DELETED");
  const refundRows = normalizedAuditRows.filter((row) => row.action === "REFUNDED");
  const totalAmount = saleOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const quantityTotal = saleOrders.reduce(
    (sum, order) => sum + Number(order.quantityTotal || 0),
    0,
  );
  const cashAmount = saleOrders.reduce((sum, order) => sum + Number(order.cashAmount || 0), 0);
  const nonCashAmount = saleOrders.reduce(
    (sum, order) => sum + Number(order.nonCashAmount || 0),
    0,
  );

  const byItemMap = new Map();
  saleOrders.forEach((order) => {
    order.items.forEach((item) => {
      const key = item.productId || `${item.productName}:${item.sku}`;
      const current = byItemMap.get(key) || {
        id: key,
        productId: item.productId || null,
        productName: item.productName,
        sku: item.sku || "",
        quantity: 0,
        orderCount: 0,
        amount: 0,
      };

      current.quantity += Number(item.quantity || 0);
      current.orderCount += 1;
      current.amount += Number(item.totalAmount || 0);
      byItemMap.set(key, current);
    });
  });

  const byCustomerMap = new Map();
  saleOrders.forEach((order) => {
    const key = order.customerId || "anonymous";
    const current = byCustomerMap.get(key) || {
      id: key,
      customerId: order.customerId || null,
      customerName: buildCustomerLabel(order.customer),
      email: order.customer?.email || "",
      phone: order.customer?.phone || "",
      orderCount: 0,
      quantity: 0,
      amount: 0,
    };

    current.orderCount += 1;
    current.quantity += Number(order.quantityTotal || 0);
    current.amount += Number(order.totalAmount || 0);
    byCustomerMap.set(key, current);
  });

  const byDateMap = new Map();
  saleOrders.forEach((order) => {
    const key = formatDateKey(order.createdAt);
    const current = byDateMap.get(key) || {
      id: key,
      date: key,
      orderCount: 0,
      customerCount: 0,
      quantity: 0,
      amount: 0,
      cancellations: 0,
      refunds: 0,
      customerIds: new Set(),
    };

    current.orderCount += 1;
    current.quantity += Number(order.quantityTotal || 0);
    current.amount += Number(order.totalAmount || 0);
    if (order.customerId) {
      current.customerIds.add(order.customerId);
    }
    byDateMap.set(key, current);
  });

  cancellationRows.forEach((row) => {
    const key = formatDateKey(row.createdAt);
    const current = byDateMap.get(key) || {
      id: key,
      date: key,
      orderCount: 0,
      customerCount: 0,
      quantity: 0,
      amount: 0,
      cancellations: 0,
      refunds: 0,
      customerIds: new Set(),
    };
    current.cancellations += 1;
    byDateMap.set(key, current);
  });

  refundRows.forEach((row) => {
    const key = formatDateKey(row.createdAt);
    const current = byDateMap.get(key) || {
      id: key,
      date: key,
      orderCount: 0,
      customerCount: 0,
      quantity: 0,
      amount: 0,
      cancellations: 0,
      refunds: 0,
      customerIds: new Set(),
    };
    current.refunds += 1;
    byDateMap.set(key, current);
  });

  const byCashierMap = new Map();
  saleOrders.forEach((order) => {
    const key = order.createdById || `cashier:${order.id}`;
    const current = byCashierMap.get(key) || {
      id: key,
      cashierId: order.createdById || null,
      cashierName: buildUserLabel(order.createdBy),
      storeName: order.store?.name || "Boutique inconnue",
      orderCount: 0,
      customerCount: 0,
      quantity: 0,
      amount: 0,
      customerIds: new Set(),
    };

    current.orderCount += 1;
    current.quantity += Number(order.quantityTotal || 0);
    current.amount += Number(order.totalAmount || 0);
    if (order.customerId) {
      current.customerIds.add(order.customerId);
    }
    byCashierMap.set(key, current);
  });

  const byStoreMap = new Map();
  saleOrders.forEach((order) => {
    const key = order.storeId || `store:${order.id}`;
    const current = byStoreMap.get(key) || {
      id: key,
      storeId: order.storeId || null,
      storeName: order.store?.name || "Boutique inconnue",
      orderCount: 0,
      cashierCount: 0,
      customerCount: 0,
      quantity: 0,
      amount: 0,
      cashierIds: new Set(),
      customerIds: new Set(),
    };

    current.orderCount += 1;
    current.quantity += Number(order.quantityTotal || 0);
    current.amount += Number(order.totalAmount || 0);
    if (order.createdById) {
      current.cashierIds.add(order.createdById);
    }
    if (order.customerId) {
      current.customerIds.add(order.customerId);
    }
    byStoreMap.set(key, current);
  });

  const baseItemRows = [...byItemMap.values()]
    .map((row) => ({
      ...row,
      averagePrice: row.quantity > 0 ? Number((row.amount / row.quantity).toFixed(2)) : 0,
    }))
    .sort((left, right) => right.amount - left.amount || right.quantity - left.quantity);

  const rowsByView = {
    period: [
      {
        id: "selected-period",
        periodLabel:
          createdFrom || createdTo
            ? `${createdFrom ? formatDateKey(createdFrom) : "..."} au ${createdTo ? formatDateKey(createdTo) : "..."}` 
            : "Toute la periode",
        orderCount: saleOrders.length,
        customerCount: new Set(saleOrders.map((order) => order.customerId).filter(Boolean)).size,
        quantityTotal,
        totalAmount,
        cashAmount,
        nonCashAmount,
        averageTicket: saleOrders.length ? Number((totalAmount / saleOrders.length).toFixed(2)) : 0,
        cancellationCount: cancellationRows.length,
        refundCount: refundRows.length,
      },
    ],
    "by-item": baseItemRows,
    "by-customer": [...byCustomerMap.values()]
      .sort((left, right) => right.amount - left.amount || right.orderCount - left.orderCount),
    "by-date": [...byDateMap.values()]
      .map((row) => {
        const customerCount = row.customerIds.size;
        const { customerIds, ...rest } = row;
        return {
          ...rest,
          customerCount,
        };
      })
      .sort((left, right) => String(right.date).localeCompare(String(left.date))),
    cancellations: cancellationRows,
    refunds: refundRows,
    "by-cashier": [...byCashierMap.values()]
      .map((row) => {
        const customerCount = row.customerIds.size;
        const { customerIds, ...rest } = row;
        return {
          ...rest,
          customerCount,
        };
      })
      .sort((left, right) => right.amount - left.amount || right.orderCount - left.orderCount),
    "by-store": [...byStoreMap.values()]
      .map((row) => {
        const cashierCount = row.cashierIds.size;
        const customerCount = row.customerIds.size;
        const { cashierIds, customerIds, ...rest } = row;
        return {
          ...rest,
          cashierCount,
          customerCount,
        };
      })
      .sort((left, right) => right.amount - left.amount || right.orderCount - left.orderCount),
    "top-items": baseItemRows.map((row, index) => ({
      ...row,
      rank: index + 1,
    })),
    "least-items": [...baseItemRows]
      .sort((left, right) => left.quantity - right.quantity || left.amount - right.amount)
      .map((row, index) => ({
        ...row,
        rank: index + 1,
      })),
  };

  const selectedRows = rowsByView[view] || rowsByView.period;

  if (["xlsx", "pdf", "csv"].includes(exportType)) {
    const exportRows = selectedRows.map((row) => {
      const normalized = { ...row };
      Object.keys(normalized).forEach((key) => {
        if (normalized[key] instanceof Set) {
          normalized[key] = normalized[key].size;
        }
      });
      return normalized;
    });

    return sendExport(
      res,
      exportRows,
      `sales-report-${view}`,
      exportType,
      {
        companyName: req.user.tenantName || "POSapp",
        columns: SALES_REPORT_EXPORT_COLUMNS[view] || SALES_REPORT_EXPORT_COLUMNS.period,
      },
    );
  }

  return res.json({
    view,
    currencyCode: primaryCurrencyCode,
    rows: selectedRows,
    summary: {
      totalAmount: Number(totalAmount.toFixed(2)),
      orderCount: saleOrders.length,
      quantityTotal,
      customerCount: new Set(saleOrders.map((order) => order.customerId).filter(Boolean)).size,
      cancellationCount: cancellationRows.length,
      refundCount: refundRows.length,
      cashAmount: Number(cashAmount.toFixed(2)),
      nonCashAmount: Number(nonCashAmount.toFixed(2)),
    },
  });
};

const getSalesSummary = async (req, res) => {
  const scopedStoreId = getScopedStoreId(req.user, req.query?.storeId);
  if (isRestrictedSeller(req.user) && !scopedStoreId) {
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
  getSalesReport,
  getSalesSummary,
};
