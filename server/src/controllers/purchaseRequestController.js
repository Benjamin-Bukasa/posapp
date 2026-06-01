const prisma = require("../config/prisma");
const {
  parseListParams,
  buildOrderBy,
  contains,
  buildMeta,
  buildDateRangeFilter,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const { emitToStore, emitToTenant } = require("../socket");
const { buildPurchaseRequestPdf } = require("../services/purchaseRequestPdf");
const { hasPermission } = require("../utils/permissionAccess");
const { hasScopedPermission } = require("../utils/documentPermissionScopes");
const {
  attachDocumentCodes,
  assignGeneratedDocumentCode,
} = require("../utils/documentCodeStore");
const { expandArticleItems } = require("../utils/expandArticleItems");
const { sendErrorResponse } = require("../utils/httpErrors");

const isSeller = (user) => user?.role === "SELLER";

const includesSearch = (value, search) =>
  String(value || "")
    .toLowerCase()
    .includes(String(search || "").trim().toLowerCase());

const matchesPurchaseRequestSearch = (item, search) => {
  if (!search) return true;
  return [
    item.code,
    item.title,
    item.status,
    item.store?.name,
    item.requestedBy?.firstName,
    item.requestedBy?.lastName,
  ].some((value) => includesSearch(value, search));
};

const loadPurchaseRequestFlow = (tenantId) =>
  prisma.approvalFlow.findUnique({
    where: {
      tenantId_code: {
        tenantId,
        code: "PURCHASE_REQUEST",
      },
    },
    include: { steps: true },
  });

const ensurePurchaseRequestApprovals = async (tenantId, purchaseRequestId) => {
  const existingCount = await prisma.purchaseRequestApproval.count({
    where: { purchaseRequestId },
  });

  if (existingCount > 0) {
    return existingCount;
  }

  const flow = await loadPurchaseRequestFlow(tenantId);
  if (!flow?.steps?.length) {
    return 0;
  }

  await prisma.purchaseRequestApproval.createMany({
    data: flow.steps.map((step) => ({
      tenantId,
      purchaseRequestId,
      stepOrder: step.stepOrder,
      approverRole: step.approverRole,
      approverId: step.approverUserId,
    })),
  });

  return flow.steps.length;
};

const syncPurchaseRequestStatus = async (purchaseRequestId) => {
  const approvals = await prisma.purchaseRequestApproval.findMany({
    where: { purchaseRequestId },
    orderBy: { stepOrder: "asc" },
  });

  if (!approvals.length) {
    return prisma.purchaseRequest.update({
      where: { id: purchaseRequestId },
      data: { status: "APPROVED" },
    });
  }

  const approvedCount = approvals.filter((item) => item.status === "APPROVED").length;
  const rejectedCount = approvals.filter((item) => item.status === "REJECTED").length;
  const nextStatus =
    rejectedCount > 0
      ? "REJECTED"
      : approvedCount === approvals.length
        ? "APPROVED"
        : approvedCount > 0
          ? "SUBMITTED"
          : "DRAFT";

  return prisma.purchaseRequest.update({
    where: { id: purchaseRequestId },
    data: { status: nextStatus },
  });
};

const resetPurchaseRequestApprovals = async (purchaseRequestId) => {
  await prisma.purchaseRequestApproval.updateMany({
    where: { purchaseRequestId },
    data: {
      status: "PENDING",
      decidedAt: null,
      note: null,
    },
  });
};

const createPurchaseRequest = async (req, res) => {
  const { title, storeId, supplyRequestId, note, items } = req.body || {};
  let resolvedStoreId = storeId;

  if (!title) {
    return res.status(400).json({ message: "title is required." });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "items array required." });
  }
  if (supplyRequestId) {
    return res.status(400).json({
      message:
        "Purchase requests cannot be created from supply requests. Requisitions are only for stock replenishment.",
    });
  }

  if (isSeller(req.user) && !req.user.storeId) {
    return res.status(400).json({
      message: "Le vendeur doit etre rattache a une boutique pour creer une demande d'achat.",
    });
  }

  if (isSeller(req.user) && resolvedStoreId && resolvedStoreId !== req.user.storeId) {
    return res.status(403).json({
      message: "Le vendeur ne peut creer une demande d'achat que pour sa propre boutique.",
    });
  }

  if (isSeller(req.user)) {
    resolvedStoreId = req.user.storeId;
  }

  let expandedItems;
  try {
    expandedItems = await expandArticleItems({
      tenantId: req.user.tenantId,
      items,
    });
  } catch (error) {
    return sendErrorResponse(
      res,
      error,
      "Impossible de preparer les lignes de demande d'achat.",
    );
  }

  let purchaseRequest = await prisma.purchaseRequest.create({
    data: {
      tenantId: req.user.tenantId,
      title,
      storeId: resolvedStoreId,
      note,
      requestedById: req.user.id,
      status: "DRAFT",
      items: {
        create: expandedItems.map((item) => ({
          tenantId: req.user.tenantId,
          productId: item.productId,
          unitId: item.unitId,
          quantity: item.quantity,
          note: item.note,
        })),
      },
    },
    include: { items: true },
  });

  purchaseRequest = {
    ...purchaseRequest,
    code: await assignGeneratedDocumentCode({
      tableName: "purchaseRequests",
      tenantId: req.user.tenantId,
      id: purchaseRequest.id,
      prefix: "DA",
      currentCode: purchaseRequest.code,
    }),
  };

  const approvalCount = await ensurePurchaseRequestApprovals(
    req.user.tenantId,
    purchaseRequest.id
  );

  if (approvalCount === 0) {
    purchaseRequest = await prisma.purchaseRequest.update({
      where: { id: purchaseRequest.id },
      data: { status: "APPROVED" },
      include: { items: true },
    });
  }

  if (purchaseRequest.storeId) {
    emitToStore(purchaseRequest.storeId, "purchase:request:created", {
      id: purchaseRequest.id,
      status: purchaseRequest.status,
      storeId: purchaseRequest.storeId,
      title: purchaseRequest.title,
    });
  } else {
    emitToTenant(req.user.tenantId, "purchase:request:created", {
      id: purchaseRequest.id,
      status: purchaseRequest.status,
      title: purchaseRequest.title,
    });
  }

  return res.status(201).json(await attachDocumentCodes("purchaseRequests", purchaseRequest));
};

const listPurchaseRequests = async (req, res) => {
  const { status, storeId } = req.query || {};
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const where = {
    tenantId: req.user.tenantId,
    ...(status ? { status } : {}),
    ...(isSeller(req.user)
      ? {
          requestedById: req.user.id,
          ...(req.user.storeId ? { storeId: req.user.storeId } : {}),
        }
      : storeId
        ? { storeId }
        : {}),
    ...createdAtFilter,
  };

  const orderBy =
    buildOrderBy(sortBy, sortDir, {
      createdAt: "createdAt",
      status: "status",
      title: "title",
    }) || { createdAt: "desc" };

  if (exportType) {
    const data = await prisma.purchaseRequest.findMany({
      where,
      include: { store: true, requestedBy: true, items: true },
      orderBy,
    });

    const hydratedData = (await attachDocumentCodes("purchaseRequests", data)).filter((item) =>
      matchesPurchaseRequestSearch(item, search),
    );
    const rows = hydratedData.map((item) => ({
      id: item.id,
      code: item.code || "",
      title: item.title,
      status: item.status,
      store: item.store?.name || "",
      requestedBy: [item.requestedBy?.firstName, item.requestedBy?.lastName]
        .filter(Boolean)
        .join(" "),
      itemsCount: item.items?.length || 0,
      createdAt: item.createdAt,
    }));

    return sendExport(res, rows, "purchase-requests", exportType);
  }

  if (!paginate) {
    const requests = await prisma.purchaseRequest.findMany({
      where,
      include: {
        items: { include: { product: true, unit: true } },
        approvals: true,
        store: true,
        requestedBy: true,
        supplyRequest: true,
      },
      orderBy,
    });
    return res.json(
      (await attachDocumentCodes("purchaseRequests", requests)).filter((item) =>
        matchesPurchaseRequestSearch(item, search),
      ),
    );
  }

  const requests = await prisma.purchaseRequest.findMany({
    where,
    include: {
      items: { include: { product: true, unit: true } },
      approvals: true,
      store: true,
      requestedBy: true,
      supplyRequest: true,
    },
    orderBy,
  });
  const filteredRequests = (await attachDocumentCodes("purchaseRequests", requests)).filter(
    (item) => matchesPurchaseRequestSearch(item, search),
  );
  const total = filteredRequests.length;

  return res.json({
    data: filteredRequests.slice((page - 1) * pageSize, page * pageSize),
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const getPurchaseRequest = async (req, res) => {
  const { id } = req.params;

  const request = await prisma.purchaseRequest.findFirst({
    where: {
      id,
      tenantId: req.user.tenantId,
      ...(isSeller(req.user) ? { requestedById: req.user.id } : {}),
    },
    include: {
      items: { include: { product: true, unit: true } },
      approvals: true,
      store: true,
      requestedBy: true,
      supplyRequest: true,
    },
  });

  if (!request) {
    return res.status(404).json({ message: "Purchase request not found." });
  }

  return res.json(await attachDocumentCodes("purchaseRequests", request));
};

const getPurchaseRequestPdf = async (req, res) => {
  const { id } = req.params;

  const request = await prisma.purchaseRequest.findFirst({
    where: {
      id,
      tenantId: req.user.tenantId,
      ...(isSeller(req.user) ? { requestedById: req.user.id } : {}),
    },
    include: {
      items: { include: { product: true, unit: true } },
      approvals: true,
      store: true,
      requestedBy: true,
    },
  });

  if (!request) {
    return res.status(404).json({ message: "Purchase request not found." });
  }

  const requestWithCode = await attachDocumentCodes("purchaseRequests", request);
  const pdfBuffer = await buildPurchaseRequestPdf(requestWithCode, req.user.tenantName);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${requestWithCode.code || `purchase-request-${id}`}.pdf"`,
  );

  return res.send(pdfBuffer);
};

const submitPurchaseRequest = async (req, res) => {
  const { id } = req.params;

  const request = await prisma.purchaseRequest.findUnique({
    where: { id },
  });

  if (!request || request.tenantId !== req.user.tenantId) {
    return res.status(404).json({ message: "Purchase request not found." });
  }

  const approvalCount = await ensurePurchaseRequestApprovals(req.user.tenantId, id);

  if (approvalCount === 0) {
    const updated = await prisma.purchaseRequest.update({
      where: { id },
      data: { status: "APPROVED" },
    });
    if (updated.storeId) {
      emitToStore(updated.storeId, "purchase:request:approved", {
        id: updated.id,
        status: updated.status,
        storeId: updated.storeId,
      });
    } else {
      emitToTenant(req.user.tenantId, "purchase:request:approved", {
        id: updated.id,
        status: updated.status,
      });
    }
    return res.json(updated);
  }

  const updated = await syncPurchaseRequestStatus(id);

  if (updated.storeId) {
    emitToStore(updated.storeId, "purchase:request:submitted", {
      id: updated.id,
      status: updated.status,
      storeId: updated.storeId,
    });
  } else {
    emitToTenant(req.user.tenantId, "purchase:request:submitted", {
      id: updated.id,
      status: updated.status,
    });
  }

  return res.json(await attachDocumentCodes("purchaseRequests", updated));
};

const approvePurchaseRequest = async (req, res) => {
  const { id } = req.params;
  const { note } = req.body || {};

  const request = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!request || request.tenantId !== req.user.tenantId) {
    return res.status(404).json({ message: "Purchase request not found." });
  }

  const approvalCount = await ensurePurchaseRequestApprovals(req.user.tenantId, id);
  if (approvalCount === 0) {
    const updated = await prisma.purchaseRequest.update({
      where: { id },
      data: { status: "APPROVED" },
    });
    return res.json(updated);
  }

  const approvals = await prisma.purchaseRequestApproval.findMany({
    where: { purchaseRequestId: id, status: "PENDING" },
    orderBy: { stepOrder: "asc" },
  });

  if (!approvals.length) {
    return res.status(400).json({ message: "No pending approvals." });
  }

  const [currentStep] = approvals;

  const canApprove =
    (currentStep.approverId && currentStep.approverId === req.user.id) ||
    (currentStep.approverRole && currentStep.approverRole === req.user.role);

  if (!canApprove) {
    return res.status(403).json({ message: "Not allowed to approve this step." });
  }

  await prisma.purchaseRequestApproval.update({
    where: { id: currentStep.id },
    data: { status: "APPROVED", decidedAt: new Date(), note },
  });

  const updated = await syncPurchaseRequestStatus(id);

  if (updated.status === "APPROVED") {
    if (updated.storeId) {
      emitToStore(updated.storeId, "purchase:request:approved", {
        id: updated.id,
        status: updated.status,
        storeId: updated.storeId,
      });
    } else {
      emitToTenant(req.user.tenantId, "purchase:request:approved", {
        id: updated.id,
        status: updated.status,
      });
    }
  } else {
    if (updated.storeId) {
      emitToStore(updated.storeId, "purchase:request:submitted", {
        id: updated.id,
        status: updated.status,
        storeId: updated.storeId,
      });
    } else {
      emitToTenant(req.user.tenantId, "purchase:request:submitted", {
        id: updated.id,
        status: updated.status,
      });
    }
  }

  return res.json(updated);
};

const rejectPurchaseRequest = async (req, res) => {
  const { id } = req.params;
  const { note } = req.body || {};

  const request = await prisma.purchaseRequest.findUnique({ where: { id } });
  if (!request || request.tenantId !== req.user.tenantId) {
    return res.status(404).json({ message: "Purchase request not found." });
  }

  const approvals = await prisma.purchaseRequestApproval.findMany({
    where: { purchaseRequestId: id, status: "PENDING" },
    orderBy: { stepOrder: "asc" },
  });

  if (!approvals.length) {
    return res.status(400).json({ message: "No pending approvals." });
  }

  const [currentStep] = approvals;
  const canReject =
    (currentStep.approverId && currentStep.approverId === req.user.id) ||
    (currentStep.approverRole && currentStep.approverRole === req.user.role);

  if (!canReject) {
    return res.status(403).json({ message: "Not allowed to reject this step." });
  }

  await prisma.purchaseRequestApproval.update({
    where: { id: currentStep.id },
    data: { status: "REJECTED", decidedAt: new Date(), note },
  });

  const updated = await syncPurchaseRequestStatus(id);

  if (request.storeId) {
    emitToStore(request.storeId, "purchase:request:rejected", {
      id: request.id,
      status: updated.status,
      storeId: request.storeId,
    });
  } else {
    emitToTenant(req.user.tenantId, "purchase:request:rejected", {
      id: request.id,
      status: updated.status,
    });
  }

  return res.json(updated);
};

const updatePurchaseRequest = async (req, res) => {
  const { id } = req.params;
  const { title, storeId, note, items } = req.body || {};
  let resolvedStoreId = storeId;

  const request = await prisma.purchaseRequest.findFirst({
    where: { id, tenantId: req.user.tenantId },
    include: { approvals: true },
  });

  if (!request) {
    return res.status(404).json({ message: "Purchase request not found." });
  }

  const canUpdateAny = hasPermission(req.user, "purchase_requests.update");
  const canUpdateOwnDraft =
    hasPermission(req.user, "purchase_requests.update_own_draft") &&
    request.requestedById === req.user.id &&
    ["DRAFT", "SUBMITTED", "REJECTED"].includes(request.status);

  if (!canUpdateAny && !canUpdateOwnDraft) {
    return res.status(403).json({
      message:
        "Vous n'avez pas la permission de modifier cette demande d'achat.",
    });
  }

  if (!["DRAFT", "SUBMITTED", "REJECTED"].includes(request.status)) {
    return res.status(400).json({
      message: "Only non-validated purchase requests can be edited.",
    });
  }

  if (!title) {
    return res.status(400).json({ message: "title is required." });
  }

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "items array required." });
  }

  if (isSeller(req.user) && !req.user.storeId) {
    return res.status(400).json({
      message: "Le vendeur doit etre rattache a une boutique pour creer une demande d'achat.",
    });
  }

  if (isSeller(req.user) && resolvedStoreId && resolvedStoreId !== req.user.storeId) {
    return res.status(403).json({
      message: "Le vendeur ne peut creer une demande d'achat que pour sa propre boutique.",
    });
  }

  if (isSeller(req.user)) {
    resolvedStoreId = req.user.storeId;
  }

  let expandedItems;
  try {
    expandedItems = await expandArticleItems({
      tenantId: req.user.tenantId,
      items,
    });
  } catch (error) {
    return sendErrorResponse(
      res,
      error,
      "Impossible de preparer les lignes de demande d'achat.",
    );
  }

  if (request.status !== "DRAFT") {
    await resetPurchaseRequestApprovals(id);
  }

  await prisma.purchaseRequestItem.deleteMany({
    where: { purchaseRequestId: id },
  });

  const updated = await prisma.purchaseRequest.update({
    where: { id },
    data: {
      status: "DRAFT",
      title,
      storeId: resolvedStoreId,
      note,
      items: {
        create: expandedItems.map((item) => ({
          tenantId: req.user.tenantId,
          productId: item.productId,
          unitId: item.unitId,
          quantity: item.quantity,
          note: item.note,
        })),
      },
    },
    include: {
      items: { include: { product: true, unit: true } },
      approvals: true,
      store: true,
      requestedBy: true,
      supplyRequest: true,
    },
  });

  return res.json(updated);
};

const deletePurchaseRequest = async (req, res) => {
  const { id } = req.params;

  const request = await prisma.purchaseRequest.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });

  if (!request) {
    return res.status(404).json({ message: "Purchase request not found." });
  }

  const canDelete = hasScopedPermission({
    user: req.user,
    fullPermission: "purchase_requests.delete",
    ownPermission: "purchase_requests.delete_own_draft",
    ownerId: request.requestedById,
    status: request.status,
    allowedStatuses: ["DRAFT", "SUBMITTED", "REJECTED"],
  });

  if (!canDelete) {
    return res.status(403).json({
      message:
        "Vous n'avez pas la permission de supprimer cette demande d'achat.",
    });
  }

  if (!["DRAFT", "SUBMITTED", "REJECTED"].includes(request.status)) {
    return res.status(400).json({
      message: "Only non-validated purchase requests can be deleted.",
    });
  }

  await prisma.purchaseRequest.delete({ where: { id } });
  return res.json({ message: "Purchase request deleted." });
};

const devalidatePurchaseRequest = async (req, res) => {
  const { id } = req.params;

  const request = await prisma.purchaseRequest.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });

  if (!request) {
    return res.status(404).json({ message: "Purchase request not found." });
  }

  if (request.status === "ORDERED") {
    return res.status(409).json({
      message: "A purchase request already linked to an order cannot be devalidated.",
    });
  }

  if (!["SUBMITTED", "APPROVED", "REJECTED"].includes(request.status)) {
    return res.status(409).json({
      message: "Only non-closed validated purchase requests can be devalidated.",
    });
  }

  await resetPurchaseRequestApprovals(id);

  const updated = await prisma.purchaseRequest.update({
    where: { id },
    data: { status: "DRAFT" },
    include: {
      items: { include: { product: true, unit: true } },
      approvals: true,
      store: true,
      requestedBy: true,
      supplyRequest: true,
    },
  });

  return res.json(await attachDocumentCodes("purchaseRequests", updated));
};

module.exports = {
  createPurchaseRequest,
  listPurchaseRequests,
  getPurchaseRequest,
  getPurchaseRequestPdf,
  submitPurchaseRequest,
  approvePurchaseRequest,
  rejectPurchaseRequest,
  updatePurchaseRequest,
  deletePurchaseRequest,
  devalidatePurchaseRequest,
};
