const prisma = require("../config/prisma");
const {
  normalizeCurrencyCode,
} = require("../utils/currencySettings");
const {
  attachPaymentOriginalDetails,
  getPaymentOriginalMap,
} = require("../utils/paymentOriginalStore");
const {
  parseListParams,
  buildOrderBy,
  contains,
  buildMeta,
  buildDateRangeFilter,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const { sendErrorResponse } = require("../utils/httpErrors");
const { cancelOrderSale } = require("./orderController");
const isSeller = (user) => user?.role === "SELLER";

const hydratePaymentsWithCurrencyCodes = async (records) => {
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
    list.map((item) => item.id),
  );

  const hydrated = attachPaymentOriginalDetails(
    list.map((payment) => ({
      ...payment,
      currencyCode: normalizeCurrencyCode(payment.currencyCode),
    })),
    paymentOriginalMap,
  ).map((payment) => ({
    ...payment,
    order: payment.order
      ? {
        ...payment.order,
        currencyCode: normalizeCurrencyCode(payment.order.currencyCode || payment.currencyCode),
      }
      : payment.order,
  }));

  return Array.isArray(records) ? hydrated : hydrated[0];
};

const listPayments = async (req, res) => {
  const { status, method, orderId } = req.query || {};
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const searchFilter = search
    ? {
        OR: [
          { status: contains(search) },
          { method: contains(search) },
          { reference: contains(search) },
        ],
      }
    : {};

  const where = {
    tenantId: req.user.tenantId,
    ...(isSeller(req.user) ? { order: { createdById: req.user.id } } : {}),
    ...(status ? { status } : {}),
    ...(method ? { method } : {}),
    ...(orderId ? { orderId } : {}),
    ...createdAtFilter,
    ...searchFilter,
  };

  const orderBy =
    buildOrderBy(sortBy, sortDir, {
      createdAt: "createdAt",
      amount: "amount",
      status: "status",
      method: "method",
      paidAt: "paidAt",
    }) || { createdAt: "desc" };

  if (exportType) {
    const data = await prisma.payment.findMany({
      where,
      include: { order: { include: { customer: true } } },
      orderBy,
    });

    const rows = data.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      amount: item.amount,
      method: item.method,
      status: item.status,
      reference: item.reference,
      paidAt: item.paidAt,
      createdAt: item.createdAt,
    }));

    return sendExport(res, rows, "payments", exportType);
  }

  if (!paginate) {
    const payments = await prisma.payment.findMany({
      where,
      include: { order: { include: { customer: true } } },
      orderBy,
    });

    return res.json(await hydratePaymentsWithCurrencyCodes(payments));
  }

  const [total, payments] = await prisma.$transaction([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: { order: { include: { customer: true } } },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return res.json({
    data: await hydratePaymentsWithCurrencyCodes(payments),
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const getPayment = async (req, res) => {
  const { id } = req.params;

  const payment = await prisma.payment.findFirst({
    where: {
      id,
      tenantId: req.user.tenantId,
      ...(isSeller(req.user) ? { order: { createdById: req.user.id } } : {}),
    },
    include: { order: { include: { customer: true } } },
  });

  if (!payment) {
    return res.status(404).json({ message: "Payment not found." });
  }

  return res.json(await hydratePaymentsWithCurrencyCodes(payment));
};

const refundPayment = async (req, res) => {
  const { id } = req.params;
  const reason = req.body?.reason
    ? String(req.body.reason).trim()
    : "Remboursement client.";

  const payment = await prisma.payment.findFirst({
    where: {
      id,
      tenantId: req.user.tenantId,
      ...(isSeller(req.user) ? { order: { createdById: req.user.id } } : {}),
    },
    include: {
      order: {
        include: {
          customer: true,
        },
      },
    },
  });

  if (!payment) {
    return res.status(404).json({ message: "Payment not found." });
  }

  if (!payment.orderId) {
    return res.status(409).json({
      message: "Ce paiement n'est rattache a aucune vente remboursable.",
    });
  }

  try {
    const canceledOrder = await cancelOrderSale({
      tenantId: req.user.tenantId,
      orderId: payment.orderId,
      actorUserId: req.user.id,
      actorRole: req.user.role,
      reason,
      auditAction: "REFUNDED",
      auditReasonFallback: "Remboursement client.",
    });

    const refreshedPayment = await prisma.payment.findFirst({
      where: { id, tenantId: req.user.tenantId },
      include: { order: { include: { customer: true } } },
    });

    return res.json({
      message: "Client rembourse et vente annulee.",
      order: canceledOrder,
      payment: await hydratePaymentsWithCurrencyCodes(refreshedPayment),
    });
  } catch (error) {
    return sendErrorResponse(res, error, "Impossible de rembourser ce client.");
  }
};

module.exports = {
  listPayments,
  getPayment,
  refundPayment,
};
