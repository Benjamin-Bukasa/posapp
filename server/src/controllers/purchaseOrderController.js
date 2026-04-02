const prisma = require("../config/prisma");
const { loadTenantCurrencySettings } = require("../utils/currencySettings");
const {
  attachCurrencyCodes,
  getCurrencyCodeMap,
  setCurrencyCodes,
} = require("../utils/moneyCurrency");
const { ensureComponentItems } = require("../utils/expandArticleItems");
const {
  parseListParams,
  buildOrderBy,
  contains,
  buildMeta,
  buildDateRangeFilter,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const { emitToStore, emitToTenant } = require("../socket");
const { buildPurchaseOrderPdf } = require("../services/purchaseOrderPdf");
const { generateNextDocumentCode } = require("../utils/documentCodeStore");
const {
  getDocumentApprovalMap,
  getDocumentApprovals,
  prepareDocumentApprovals,
  decideDocumentApproval,
} = require("../utils/documentApprovalStore");

const PURCHASE_ORDER_DOCUMENT_TYPE = "PURCHASE_ORDER";
const PURCHASE_ORDER_FLOW_CODE = "PURCHASE_ORDER";

const mapPurchaseOrderStatus = (rawStatus, approvals = []) => {
  if (!approvals.length) return rawStatus;
  if (approvals.some((item) => item.status === "REJECTED")) return "REJECTED";
  if (rawStatus === "SENT" || rawStatus === "PARTIAL" || rawStatus === "COMPLETED" || rawStatus === "CANCELED") {
    return rawStatus;
  }
  return "SUBMITTED";
};

const decoratePurchaseOrdersWithApprovals = async (records, { includeApprovals = true } = {}) => {
  const list = Array.isArray(records) ? records.filter(Boolean) : records ? [records] : [];
  if (!list.length) return Array.isArray(records) ? [] : records;

  const approvalMap = await getDocumentApprovalMap(
    list[0].tenantId,
    PURCHASE_ORDER_DOCUMENT_TYPE,
    list.map((item) => item.id),
  );

  const mapped = list.map((item) => {
    const approvals = approvalMap.get(item.id) || [];
    return {
      ...item,
      rawStatus: item.status,
      status: mapPurchaseOrderStatus(item.status, approvals),
      ...(includeApprovals ? { approvals } : {}),
    };
  });

  return Array.isArray(records) ? mapped : mapped[0];
};

const canModifyPurchaseOrder = async (tenantId, order) => {
  if (order.status !== "DRAFT") return false;
  const approvals = await getDocumentApprovals(tenantId, PURCHASE_ORDER_DOCUMENT_TYPE, order.id);
  return !approvals.length || approvals.some((item) => item.status === "REJECTED");
};

const hydratePurchaseOrdersWithCurrencyCodes = async (records) => {
  const list = Array.isArray(records)
    ? records.filter(Boolean)
    : records
      ? [records]
      : [];

  if (!list.length) {
    return Array.isArray(records) ? [] : records;
  }

  const itemCurrencyMap = await getCurrencyCodeMap(
    prisma,
    "purchaseOrderItems",
    list.flatMap((order) => order.items || []).map((item) => item.id),
  );

  const hydrated = list.map((order) => ({
    ...order,
    items: attachCurrencyCodes(order.items || [], itemCurrencyMap),
  }));

  return Array.isArray(records) ? hydrated : hydrated[0];
};

const createPurchaseOrder = async (req, res) => {
  const {
    storeId,
    supplierId,
    purchaseRequestId,
    code,
    orderDate,
    expectedDate,
    note,
    items,
  } = req.body || {};

  if (!supplierId) {
    return res.status(400).json({ message: "supplierId is required." });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "items array required." });
  }

  if (!purchaseRequestId) {
    return res.status(400).json({
      message: "purchaseRequestId is required to create a purchase order.",
    });
  }

  try {
    await ensureComponentItems({
      tenantId: req.user.tenantId,
      items,
      message:
        "Les commandes fournisseur doivent etre saisies sur des produits composants.",
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Commande fournisseur invalide.",
    });
  }

  const purchaseRequest = await prisma.purchaseRequest.findFirst({
    where: {
      id: purchaseRequestId,
      tenantId: req.user.tenantId,
    },
    include: { items: true },
  });

  if (!purchaseRequest) {
    return res.status(404).json({ message: "Purchase request not found." });
  }

  if (purchaseRequest.status !== "APPROVED") {
    return res.status(400).json({
      message: "Only approved purchase requests can be converted to orders.",
    });
  }

  const currencySettings = await loadTenantCurrencySettings(
    prisma,
    req.user.tenantId,
  );
  const resolvedCode =
    String(code || "").trim() ||
    (await generateNextDocumentCode({
      tableName: "purchaseOrders",
      tenantId: req.user.tenantId,
      prefix: "CMD",
    }));

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      tenantId: req.user.tenantId,
      storeId: storeId || purchaseRequest.storeId,
      supplierId,
      purchaseRequestId,
      code: resolvedCode,
      orderDate: orderDate ? new Date(orderDate) : undefined,
      expectedDate: expectedDate ? new Date(expectedDate) : undefined,
      note,
      orderedById: req.user.id,
      status: "DRAFT",
      items: {
        create: items.map((item) => ({
          tenantId: req.user.tenantId,
          productId: item.productId,
          unitId: item.unitId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      },
    },
    include: { items: true },
  });
  await setCurrencyCodes(
    prisma,
    "purchaseOrderItems",
    (purchaseOrder.items || []).map((item) => item.id),
    currencySettings.primaryCurrencyCode,
  );

  await prisma.purchaseRequest.update({
    where: { id: purchaseRequestId },
    data: { status: "ORDERED" },
  });

  if (purchaseOrder.storeId) {
    emitToStore(purchaseOrder.storeId, "purchase:order:created", {
      id: purchaseOrder.id,
      status: purchaseOrder.status,
      storeId: purchaseOrder.storeId,
      code: purchaseOrder.code,
    });
  } else {
    emitToTenant(req.user.tenantId, "purchase:order:created", {
      id: purchaseOrder.id,
      status: purchaseOrder.status,
      code: purchaseOrder.code,
    });
  }

  return res.status(201).json({
    ...purchaseOrder,
    items: (purchaseOrder.items || []).map((item) => ({
      ...item,
      currencyCode: currencySettings.primaryCurrencyCode,
    })),
  });
};

const listPurchaseOrders = async (req, res) => {
  const { status, storeId, supplierId } = req.query || {};
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const searchFilter = search
    ? {
        OR: [
          { code: contains(search) },
          { status: contains(search) },
          { supplier: { name: contains(search) } },
          { store: { name: contains(search) } },
        ],
      }
    : {};

  const where = {
    tenantId: req.user.tenantId,
    ...(status ? { status } : {}),
    ...(storeId ? { storeId } : {}),
    ...(supplierId ? { supplierId } : {}),
    ...createdAtFilter,
    ...searchFilter,
  };

  const orderBy =
    buildOrderBy(sortBy, sortDir, {
      createdAt: "createdAt",
      status: "status",
      orderDate: "orderDate",
      code: "code",
    }) || { createdAt: "desc" };

  if (exportType) {
    const data = await prisma.purchaseOrder.findMany({
      where,
      include: { supplier: true, store: true, items: true },
      orderBy,
    });

    const rows = data.map((item) => ({
      id: item.id,
      code: item.code,
      status: item.status,
      supplier: item.supplier?.name || "",
      store: item.store?.name || "",
      itemsCount: item.items?.length || 0,
      orderDate: item.orderDate,
    }));

    return sendExport(res, rows, "purchase-orders", exportType);
  }

  if (!paginate) {
    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        items: { include: { product: true, unit: true } },
        supplier: true,
        store: true,
        purchaseRequest: true,
        orderedBy: true,
      },
      orderBy,
    });
    return res.json(
      await decoratePurchaseOrdersWithApprovals(
        await hydratePurchaseOrdersWithCurrencyCodes(orders),
      ),
    );
  }

  const [total, orders] = await prisma.$transaction([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
      where,
      include: {
        items: { include: { product: true, unit: true } },
        supplier: true,
        store: true,
        purchaseRequest: true,
        orderedBy: true,
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return res.json({
    data: await decoratePurchaseOrdersWithApprovals(
      await hydratePurchaseOrdersWithCurrencyCodes(orders),
    ),
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const getPurchaseOrder = async (req, res) => {
  const { id } = req.params;

  const order = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId: req.user.tenantId },
    include: {
      items: { include: { product: true, unit: true } },
      supplier: true,
      store: true,
      purchaseRequest: true,
      orderedBy: true,
      deliveryNotes: true,
    },
  });

  if (!order) {
    return res.status(404).json({ message: "Purchase order not found." });
  }

  return res.json(
    await decoratePurchaseOrdersWithApprovals(
      await hydratePurchaseOrdersWithCurrencyCodes(order),
    ),
  );
};

const getPurchaseOrderPdf = async (req, res) => {
  const { id } = req.params;

  const order = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId: req.user.tenantId },
    include: {
      items: { include: { product: true, unit: true } },
      supplier: true,
      store: true,
      purchaseRequest: true,
      orderedBy: true,
      deliveryNotes: true,
    },
  });

  if (!order) {
    return res.status(404).json({ message: "Purchase order not found." });
  }

  const hydratedOrder = await hydratePurchaseOrdersWithCurrencyCodes(order);
  const currencySettings = await loadTenantCurrencySettings(
    prisma,
    req.user.tenantId,
  );
  const pdfBuffer = await buildPurchaseOrderPdf(
    hydratedOrder,
    currencySettings,
    req.user.tenantName,
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${order.code || `purchase-order-${id}`}.pdf"`,
  );

  return res.send(pdfBuffer);
};

const sendPurchaseOrder = async (req, res) => {
  const { id } = req.params;

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order || order.tenantId !== req.user.tenantId) {
    return res.status(404).json({ message: "Purchase order not found." });
  }

  if (order.status !== "DRAFT") {
    return res.status(400).json({ message: "Only draft orders can be validated." });
  }

  if (!order.items.length) {
    return res.status(400).json({ message: "Purchase order has no items." });
  }

  const approvalSession = await prepareDocumentApprovals({
    tenantId: req.user.tenantId,
    documentType: PURCHASE_ORDER_DOCUMENT_TYPE,
    documentId: id,
    flowCodes: [PURCHASE_ORDER_FLOW_CODE],
  });

  let updated;
  if (!approvalSession.approvals.length) {
    updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "SENT" },
    });
  } else {
    updated = order;
  }

  if (approvalSession.approvals.length) {
    if (order.storeId) {
      emitToStore(order.storeId, "purchase:order:submitted", {
        id: order.id,
        status: "SUBMITTED",
        storeId: order.storeId,
        code: order.code,
      });
    } else {
      emitToTenant(req.user.tenantId, "purchase:order:submitted", {
        id: order.id,
        status: "SUBMITTED",
        code: order.code,
      });
    }
  } else if (updated.storeId) {
    emitToStore(updated.storeId, "purchase:order:sent", {
      id: updated.id,
      status: updated.status,
      storeId: updated.storeId,
      code: updated.code,
    });
  } else {
    emitToTenant(req.user.tenantId, "purchase:order:sent", {
      id: updated.id,
      status: updated.status,
      code: updated.code,
    });
  }

  const refreshed = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId: req.user.tenantId },
    include: {
      items: { include: { product: true, unit: true } },
      supplier: true,
      store: true,
      purchaseRequest: true,
      orderedBy: true,
      deliveryNotes: true,
    },
  });

  return res.json(
    await decoratePurchaseOrdersWithApprovals(
      await hydratePurchaseOrdersWithCurrencyCodes(refreshed),
    ),
  );
};

const approvePurchaseOrder = async (req, res) => {
  const { id } = req.params;
  const note = req.body?.note || null;

  const order = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId: req.user.tenantId },
    include: {
      items: { include: { product: true, unit: true } },
      supplier: true,
      store: true,
      purchaseRequest: true,
      orderedBy: true,
      deliveryNotes: true,
    },
  });

  if (!order) {
    return res.status(404).json({ message: "Purchase order not found." });
  }

  try {
    const decision = await decideDocumentApproval({
      tenantId: req.user.tenantId,
      documentType: PURCHASE_ORDER_DOCUMENT_TYPE,
      documentId: id,
      user: req.user,
      decision: "APPROVED",
      note,
    });

    let updated = order;
    if (decision.lifecycleStatus === "APPROVED" && order.status !== "SENT") {
      updated = await prisma.purchaseOrder.update({
        where: { id },
        data: { status: "SENT" },
        include: {
          items: { include: { product: true, unit: true } },
          supplier: true,
          store: true,
          purchaseRequest: true,
          orderedBy: true,
          deliveryNotes: true,
        },
      });

      if (updated.storeId) {
        emitToStore(updated.storeId, "purchase:order:sent", {
          id: updated.id,
          status: updated.status,
          storeId: updated.storeId,
          code: updated.code,
        });
      } else {
        emitToTenant(req.user.tenantId, "purchase:order:sent", {
          id: updated.id,
          status: updated.status,
          code: updated.code,
        });
      }
    }

    return res.json(
      await decoratePurchaseOrdersWithApprovals(
        await hydratePurchaseOrdersWithCurrencyCodes(updated),
      ),
    );
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de valider cette commande.",
    });
  }
};

const rejectPurchaseOrder = async (req, res) => {
  const { id } = req.params;
  const note = req.body?.note || null;

  const order = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId: req.user.tenantId },
    include: {
      items: { include: { product: true, unit: true } },
      supplier: true,
      store: true,
      purchaseRequest: true,
      orderedBy: true,
      deliveryNotes: true,
    },
  });

  if (!order) {
    return res.status(404).json({ message: "Purchase order not found." });
  }

  try {
    await decideDocumentApproval({
      tenantId: req.user.tenantId,
      documentType: PURCHASE_ORDER_DOCUMENT_TYPE,
      documentId: id,
      user: req.user,
      decision: "REJECTED",
      note,
    });

    if (order.storeId) {
      emitToStore(order.storeId, "purchase:order:rejected", {
        id: order.id,
        status: "REJECTED",
        storeId: order.storeId,
        code: order.code,
      });
    } else {
      emitToTenant(req.user.tenantId, "purchase:order:rejected", {
        id: order.id,
        status: "REJECTED",
        code: order.code,
      });
    }

    return res.json(
      await decoratePurchaseOrdersWithApprovals(
        await hydratePurchaseOrdersWithCurrencyCodes(order),
      ),
    );
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de rejeter cette commande.",
    });
  }
};

const updatePurchaseOrder = async (req, res) => {
  const { id } = req.params;
  const {
    storeId,
    supplierId,
    purchaseRequestId,
    code,
    orderDate,
    expectedDate,
    note,
    items,
  } = req.body || {};

  const order = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });

  if (!order) {
    return res.status(404).json({ message: "Purchase order not found." });
  }

  if (!(await canModifyPurchaseOrder(req.user.tenantId, order))) {
    return res.status(400).json({ message: "Only draft orders can be edited." });
  }

  if (!supplierId) {
    return res.status(400).json({ message: "supplierId is required." });
  }
  if (!purchaseRequestId) {
    return res.status(400).json({
      message: "purchaseRequestId is required to update a purchase order.",
    });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "items array required." });
  }

  try {
    await ensureComponentItems({
      tenantId: req.user.tenantId,
      items,
      message:
        "Les commandes fournisseur doivent etre saisies sur des produits composants.",
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Commande fournisseur invalide.",
    });
  }

  const currencySettings = await loadTenantCurrencySettings(
    prisma,
    req.user.tenantId,
  );

  const purchaseRequest = await prisma.purchaseRequest.findFirst({
    where: { id: purchaseRequestId, tenantId: req.user.tenantId },
  });

  if (!purchaseRequest) {
    return res.status(404).json({ message: "Purchase request not found." });
  }

  if (!["APPROVED", "ORDERED"].includes(purchaseRequest.status)) {
    return res.status(400).json({
      message: "Only approved purchase requests can be linked to orders.",
    });
  }

  await prisma.purchaseOrderItem.deleteMany({
    where: { purchaseOrderId: id },
  });

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      storeId: storeId || purchaseRequest.storeId,
      supplierId,
      purchaseRequestId,
      code:
        code === undefined || code === null || String(code).trim() === ""
          ? order.code
          : code,
      orderDate: orderDate ? new Date(orderDate) : undefined,
      expectedDate: expectedDate ? new Date(expectedDate) : undefined,
      note,
      items: {
        create: items.map((item) => ({
          tenantId: req.user.tenantId,
          productId: item.productId,
          unitId: item.unitId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      },
    },
    include: {
      items: { include: { product: true, unit: true } },
      supplier: true,
      store: true,
      purchaseRequest: true,
      orderedBy: true,
    },
  });
  await setCurrencyCodes(
    prisma,
    "purchaseOrderItems",
    (updated.items || []).map((item) => item.id),
    currencySettings.primaryCurrencyCode,
  );

  if (order.purchaseRequestId && order.purchaseRequestId !== purchaseRequestId) {
    await prisma.purchaseRequest.update({
      where: { id: order.purchaseRequestId },
      data: { status: "APPROVED" },
    });
  }

  await prisma.purchaseRequest.update({
    where: { id: purchaseRequestId },
    data: { status: "ORDERED" },
  });

  return res.json(
    await decoratePurchaseOrdersWithApprovals({
      ...updated,
      items: (updated.items || []).map((item) => ({
        ...item,
        currencyCode: currencySettings.primaryCurrencyCode,
      })),
    }),
  );
};

const deletePurchaseOrder = async (req, res) => {
  const { id } = req.params;

  const order = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });

  if (!order) {
    return res.status(404).json({ message: "Purchase order not found." });
  }

  if (!(await canModifyPurchaseOrder(req.user.tenantId, order))) {
    return res.status(400).json({ message: "Only draft orders can be deleted." });
  }

  await prisma.purchaseOrder.delete({ where: { id } });

  if (order.purchaseRequestId) {
    await prisma.purchaseRequest.update({
      where: { id: order.purchaseRequestId },
      data: { status: "APPROVED" },
    });
  }

  return res.json({ message: "Purchase order deleted." });
};

module.exports = {
  createPurchaseOrder,
  listPurchaseOrders,
  getPurchaseOrder,
  getPurchaseOrderPdf,
  sendPurchaseOrder,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
};
