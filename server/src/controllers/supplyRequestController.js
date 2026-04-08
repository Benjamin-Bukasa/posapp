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
const { buildSupplyRequestPdf } = require("../services/supplyRequestPdf");
const {
  attachDocumentCodes,
  assignGeneratedDocumentCode,
} = require("../utils/documentCodeStore");
const { expandArticleItems } = require("../utils/expandArticleItems");

const includesSearch = (value, search) =>
  String(value || "")
    .toLowerCase()
    .includes(String(search || "").trim().toLowerCase());

const matchesSupplyRequestSearch = (item, search) => {
  if (!search) return true;
  return [
    item.code,
    item.title,
    item.status,
    item.store?.name,
    item.storageZone?.name,
    item.requestedBy?.firstName,
    item.requestedBy?.lastName,
  ].some((value) => includesSearch(value, search));
};

const loadSupplyRequestFlow = (tenantId) =>
  prisma.approvalFlow.findUnique({
    where: {
      tenantId_code: {
        tenantId,
        code: "SUPPLY_REQUEST",
      },
    },
    include: { steps: true },
  });

const ensureSupplyRequestApprovals = async (tenantId, supplyRequestId) => {
  const existingCount = await prisma.supplyRequestApproval.count({
    where: { supplyRequestId },
  });

  if (existingCount > 0) {
    return existingCount;
  }

  const flow = await loadSupplyRequestFlow(tenantId);
  if (!flow?.steps?.length) {
    return 0;
  }

  await prisma.supplyRequestApproval.createMany({
    data: flow.steps.map((step) => ({
      tenantId,
      supplyRequestId,
      stepOrder: step.stepOrder,
      approverRole: step.approverRole,
      approverId: step.approverUserId,
    })),
  });

  return flow.steps.length;
};

const syncSupplyRequestStatus = async (supplyRequestId) => {
  const approvals = await prisma.supplyRequestApproval.findMany({
    where: { supplyRequestId },
    orderBy: { stepOrder: "asc" },
  });

  if (!approvals.length) {
    return prisma.supplyRequest.update({
      where: { id: supplyRequestId },
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

  return prisma.supplyRequest.update({
    where: { id: supplyRequestId },
    data: { status: nextStatus },
  });
};

const sanitizeRequest = (request, pdfOverride) => {
  if (!request) return request;
  const { pdfData, ...rest } = request;
  const hasPdf =
    pdfOverride !== undefined ? Boolean(pdfOverride) : Boolean(pdfData);
  return { ...rest, pdfAvailable: hasPdf };
};

const createSupplyRequest = async (req, res) => {
  const { title, storeId, storageZoneId, note, items } = req.body || {};

  if (!title) {
    return res.status(400).json({ message: "title is required." });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "items array required." });
  }

  let expandedItems;
  try {
    expandedItems = await expandArticleItems({
      tenantId: req.user.tenantId,
      items,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de preparer les lignes de requisition.",
    });
  }

  let supplyRequest = await prisma.supplyRequest.create({
    data: {
      tenantId: req.user.tenantId,
      title,
      storeId,
      storageZoneId,
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
    include: {
      items: { include: { product: true, unit: true } },
      store: true,
      storageZone: true,
      requestedBy: true,
    },
  });

  supplyRequest = {
    ...supplyRequest,
    code: await assignGeneratedDocumentCode({
      tableName: "supplyRequests",
      tenantId: req.user.tenantId,
      id: supplyRequest.id,
      prefix: "REQ",
      currentCode: supplyRequest.code,
    }),
  };

  const approvalCount = await ensureSupplyRequestApprovals(
    req.user.tenantId,
    supplyRequest.id
  );
  if (approvalCount === 0) {
    supplyRequest = await prisma.supplyRequest.update({
      where: { id: supplyRequest.id },
      data: { status: "APPROVED" },
      include: {
        items: { include: { product: true, unit: true } },
        store: true,
        storageZone: true,
        requestedBy: true,
      },
    });
  }

  let pdfBuffer = null;
  let pdfFileName = null;
  try {
    pdfBuffer = await buildSupplyRequestPdf(
      await attachDocumentCodes("supplyRequests", supplyRequest),
      req.user.tenantName,
    );
    if (pdfBuffer) {
      pdfFileName = `requisition-${supplyRequest.id}.pdf`;
      await prisma.supplyRequest.update({
        where: { id: supplyRequest.id },
        data: {
          pdfData: pdfBuffer,
          pdfFileName,
          pdfGeneratedAt: new Date(),
        },
      });
    }
  } catch (error) {
    // PDF generation failure should not block the request creation
    pdfBuffer = null;
  }

  if (supplyRequest.storeId) {
    emitToStore(supplyRequest.storeId, "supply:request:created", {
      id: supplyRequest.id,
      status: supplyRequest.status,
      storeId: supplyRequest.storeId,
      title: supplyRequest.title,
    });
  } else {
    emitToTenant(req.user.tenantId, "supply:request:created", {
      id: supplyRequest.id,
      status: supplyRequest.status,
      title: supplyRequest.title,
    });
  }

  const responsePayload = sanitizeRequest(
    await attachDocumentCodes("supplyRequests", { ...supplyRequest, pdfFileName }),
    pdfBuffer
  );
  return res.status(201).json(responsePayload);
};

const listSupplyRequests = async (req, res) => {
  const { status, storeId } = req.query || {};
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const where = {
    tenantId: req.user.tenantId,
    ...(status ? { status } : {}),
    ...(storeId ? { storeId } : {}),
    ...createdAtFilter,
  };

  const orderBy =
    buildOrderBy(sortBy, sortDir, {
      createdAt: "createdAt",
      status: "status",
      title: "title",
    }) || { createdAt: "desc" };

  if (exportType) {
    const data = await prisma.supplyRequest.findMany({
      where,
      include: {
        store: true,
        storageZone: true,
        requestedBy: true,
        items: true,
      },
      orderBy,
    });

    const hydratedData = (await attachDocumentCodes("supplyRequests", data)).filter((item) =>
      matchesSupplyRequestSearch(item, search),
    );
    const rows = hydratedData.map((item) => ({
      id: item.id,
      code: item.code || "",
      title: item.title,
      status: item.status,
      store: item.store?.name || "",
      zone: item.storageZone?.name || "",
      requestedBy: [item.requestedBy?.firstName, item.requestedBy?.lastName]
        .filter(Boolean)
        .join(" "),
      itemsCount: item.items?.length || 0,
      createdAt: item.createdAt,
    }));

    return sendExport(res, rows, "supply-requests", exportType);
  }

  if (!paginate) {
    const requests = await prisma.supplyRequest.findMany({
      where,
      include: {
        items: { include: { product: true, unit: true } },
        approvals: true,
        store: true,
        storageZone: true,
        requestedBy: true,
      },
      orderBy,
    });
    return res.json(
      (await attachDocumentCodes("supplyRequests", requests))
        .filter((item) => matchesSupplyRequestSearch(item, search))
        .map((item) => sanitizeRequest(item)),
    );
  }

  const requests = await prisma.supplyRequest.findMany({
    where,
    include: {
      items: { include: { product: true, unit: true } },
      approvals: true,
      store: true,
      storageZone: true,
      requestedBy: true,
    },
    orderBy,
  });
  const filteredRequests = (await attachDocumentCodes("supplyRequests", requests)).filter(
    (item) => matchesSupplyRequestSearch(item, search),
  );
  const total = filteredRequests.length;

  return res.json({
    data: filteredRequests
      .slice((page - 1) * pageSize, page * pageSize)
      .map((item) => sanitizeRequest(item)),
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const getSupplyRequest = async (req, res) => {
  const { id } = req.params;

  const request = await prisma.supplyRequest.findFirst({
    where: { id, tenantId: req.user.tenantId },
    include: {
      items: { include: { product: true, unit: true } },
      approvals: true,
      store: true,
      storageZone: true,
      requestedBy: true,
    },
  });

  if (!request) {
    return res.status(404).json({ message: "Supply request not found." });
  }

  return res.json(sanitizeRequest(await attachDocumentCodes("supplyRequests", request)));
};

const getSupplyRequestPdf = async (req, res) => {
  const { id } = req.params;
  const request = await prisma.supplyRequest.findFirst({
    where: { id, tenantId: req.user.tenantId },
    include: {
      items: { include: { product: true, unit: true } },
      approvals: true,
      store: true,
      storageZone: true,
      requestedBy: true,
    },
  });

  if (!request) {
    return res.status(404).json({ message: "PDF not found." });
  }

  const requestWithCode = await attachDocumentCodes("supplyRequests", request);
  let pdfData = request.pdfData;
  let pdfFileName = request.pdfFileName;

  if (!pdfData) {
    pdfData = await buildSupplyRequestPdf(requestWithCode, req.user.tenantName);
    pdfFileName = `${requestWithCode.code || `requisition-${id}`}.pdf`;

    await prisma.supplyRequest.update({
      where: { id },
      data: {
        pdfData,
        pdfFileName,
        pdfGeneratedAt: new Date(),
      },
    });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${pdfFileName || requestWithCode.code || `requisition-${id}`}.pdf"`
  );
  return res.send(pdfData);
};

const submitSupplyRequest = async (req, res) => {
  const { id } = req.params;

  const request = await prisma.supplyRequest.findUnique({
    where: { id },
    include: { approvals: true },
  });

  if (!request || request.tenantId !== req.user.tenantId) {
    return res.status(404).json({ message: "Supply request not found." });
  }

  const approvalCount = await ensureSupplyRequestApprovals(req.user.tenantId, id);

  if (approvalCount === 0) {
    const updated = await prisma.supplyRequest.update({
      where: { id },
      data: { status: "APPROVED" },
    });
    if (updated.storeId) {
      emitToStore(updated.storeId, "supply:request:approved", {
        id: updated.id,
        status: updated.status,
        storeId: updated.storeId,
      });
    } else {
      emitToTenant(req.user.tenantId, "supply:request:approved", {
        id: updated.id,
        status: updated.status,
      });
    }
    return res.json(updated);
  }

  const updated = await syncSupplyRequestStatus(id);

  if (updated.storeId) {
    emitToStore(updated.storeId, "supply:request:submitted", {
      id: updated.id,
      status: updated.status,
      storeId: updated.storeId,
    });
  } else {
    emitToTenant(req.user.tenantId, "supply:request:submitted", {
      id: updated.id,
      status: updated.status,
    });
  }

  return res.json(updated);
};

const approveSupplyRequest = async (req, res) => {
  const { id } = req.params;
  const { note } = req.body || {};

  const request = await prisma.supplyRequest.findUnique({ where: { id } });
  if (!request || request.tenantId !== req.user.tenantId) {
    return res.status(404).json({ message: "Supply request not found." });
  }

  const approvalCount = await ensureSupplyRequestApprovals(req.user.tenantId, id);
  if (approvalCount === 0) {
    const updated = await prisma.supplyRequest.update({
      where: { id },
      data: { status: "APPROVED" },
    });
    return res.json(updated);
  }

  const approvals = await prisma.supplyRequestApproval.findMany({
    where: { supplyRequestId: id, status: "PENDING" },
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

  await prisma.supplyRequestApproval.update({
    where: { id: currentStep.id },
    data: { status: "APPROVED", decidedAt: new Date(), note },
  });

  const updated = await syncSupplyRequestStatus(id);

  if (updated.status === "APPROVED") {
    if (updated.storeId) {
      emitToStore(updated.storeId, "supply:request:approved", {
        id: updated.id,
        status: updated.status,
        storeId: updated.storeId,
      });
    } else {
      emitToTenant(req.user.tenantId, "supply:request:approved", {
        id: updated.id,
        status: updated.status,
      });
    }
  } else {
    if (updated.storeId) {
      emitToStore(updated.storeId, "supply:request:submitted", {
        id: updated.id,
        status: updated.status,
        storeId: updated.storeId,
      });
    } else {
      emitToTenant(req.user.tenantId, "supply:request:submitted", {
        id: updated.id,
        status: updated.status,
      });
    }
  }

  return res.json(updated);
};

const rejectSupplyRequest = async (req, res) => {
  const { id } = req.params;
  const { note } = req.body || {};

  const request = await prisma.supplyRequest.findUnique({ where: { id } });
  if (!request || request.tenantId !== req.user.tenantId) {
    return res.status(404).json({ message: "Supply request not found." });
  }

  const approvals = await prisma.supplyRequestApproval.findMany({
    where: { supplyRequestId: id, status: "PENDING" },
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

  await prisma.supplyRequestApproval.update({
    where: { id: currentStep.id },
    data: { status: "REJECTED", decidedAt: new Date(), note },
  });

  const updated = await syncSupplyRequestStatus(id);

  if (request.storeId) {
    emitToStore(request.storeId, "supply:request:rejected", {
      id: request.id,
      status: updated.status,
      storeId: request.storeId,
    });
  } else {
    emitToTenant(req.user.tenantId, "supply:request:rejected", {
      id: request.id,
      status: updated.status,
    });
  }

  return res.json(updated);
};

const updateSupplyRequest = async (req, res) => {
  const { id } = req.params;
  const { title, storeId, storageZoneId, note, items } = req.body || {};

  const request = await prisma.supplyRequest.findFirst({
    where: { id, tenantId: req.user.tenantId },
    include: { approvals: true },
  });

  if (!request) {
    return res.status(404).json({ message: "Supply request not found." });
  }

  const canManageRequest =
    request.requestedById === req.user.id ||
    req.user.role === "ADMIN" ||
    req.user.role === "SUPERADMIN" ||
    req.user.role === "MANAGER";

  if (!canManageRequest) {
    return res.status(403).json({
      message: "Vous ne pouvez modifier que vos propres requisitions non validees.",
    });
  }

  if (request.status !== "DRAFT") {
    return res.status(400).json({
      message: "Only non-validated requisitions can be edited.",
    });
  }

  if (!title) {
    return res.status(400).json({ message: "title is required." });
  }

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "items array required." });
  }

  let expandedItems;
  try {
    expandedItems = await expandArticleItems({
      tenantId: req.user.tenantId,
      items,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de preparer les lignes de requisition.",
    });
  }

  await prisma.supplyRequestItem.deleteMany({
    where: { supplyRequestId: id },
  });

  const updated = await prisma.supplyRequest.update({
    where: { id },
    data: {
      title,
      storeId,
      storageZoneId,
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
      storageZone: true,
      requestedBy: true,
    },
  });

  return res.json(
    sanitizeRequest(await attachDocumentCodes("supplyRequests", updated)),
  );
};

const deleteSupplyRequest = async (req, res) => {
  const { id } = req.params;

  const request = await prisma.supplyRequest.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });

  if (!request) {
    return res.status(404).json({ message: "Supply request not found." });
  }

  const canManageRequest =
    request.requestedById === req.user.id ||
    req.user.role === "ADMIN" ||
    req.user.role === "SUPERADMIN" ||
    req.user.role === "MANAGER";

  if (!canManageRequest) {
    return res.status(403).json({
      message: "Vous ne pouvez supprimer que vos propres requisitions non validees.",
    });
  }

  if (request.status !== "DRAFT") {
    return res.status(400).json({
      message: "Only non-validated requisitions can be deleted.",
    });
  }

  await prisma.supplyRequest.delete({ where: { id } });
  return res.json({ message: "Supply request deleted." });
};

const createTransferFromSupplyRequest = async (req, res) => {
  const { id } = req.params;
  const { fromZoneId, toZoneId, note, items } = req.body || {};

  const request = await prisma.supplyRequest.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!request || request.tenantId !== req.user.tenantId) {
    return res.status(404).json({ message: "Supply request not found." });
  }

  if (request.status !== "APPROVED") {
    return res.status(400).json({ message: "Supply request must be fully approved." });
  }

  const warehouseZone = fromZoneId
    ? await prisma.storageZone.findFirst({
        where: { id: fromZoneId, tenantId: req.user.tenantId },
      })
    : await prisma.storageZone.findFirst({
        where: { tenantId: req.user.tenantId, zoneType: "WAREHOUSE" },
        orderBy: { createdAt: "asc" },
      });

  if (!warehouseZone || !warehouseZone.storeId) {
    return res.status(400).json({ message: "Invalid from zone." });
  }

  const targetZoneId = toZoneId || request.storageZoneId;
  let targetStoreId = request.storeId;

  let resolvedTargetZoneId = targetZoneId;

  if (!resolvedTargetZoneId && targetStoreId) {
    const targetZones = await prisma.storageZone.findMany({
      where: { tenantId: req.user.tenantId, storeId: targetStoreId },
      orderBy: { createdAt: "asc" },
    });

    resolvedTargetZoneId =
      targetZones.find((zone) => zone.zoneType === "STORE")?.id ||
      targetZones.find((zone) => zone.zoneType === "COUNTER")?.id ||
      targetZones[0]?.id ||
      null;
  }

  if (resolvedTargetZoneId && !targetStoreId) {
    const targetZone = await prisma.storageZone.findFirst({
      where: {
        id: resolvedTargetZoneId,
        tenantId: req.user.tenantId,
      },
      select: {
        id: true,
        storeId: true,
      },
    });

    targetStoreId = targetZone?.storeId || null;
  }

  if (!resolvedTargetZoneId || !targetStoreId) {
    return res.status(400).json({ message: "Target store/zone required." });
  }

  const sourceItems = Array.isArray(items) && items.length ? items : request.items;
  const transferItems = sourceItems
    .map((item) => ({
      tenantId: req.user.tenantId,
      productId: item.productId,
      unitId: item.unitId,
      quantity: item.quantity,
    }))
    .filter((item) => item.productId && Number(item.quantity || 0) > 0);

  if (!transferItems.length) {
    return res.status(400).json({ message: "No items to transfer." });
  }

  const transfer = await prisma.productTransfer.create({
    data: {
      tenantId: req.user.tenantId,
      fromStoreId: warehouseZone.storeId,
      toStoreId: targetStoreId,
      fromZoneId: warehouseZone.id,
      toZoneId: resolvedTargetZoneId,
      requestedById: request.requestedById,
      status: "DRAFT",
      note: note || `Transfert depuis réquisition ${request.title}`,
      items: { create: transferItems },
    },
    include: { items: true },
  });

  emitToStore(warehouseZone.storeId, "transfer:created", {
    id: transfer.id,
    status: transfer.status,
    fromStoreId: warehouseZone.storeId,
    toStoreId: targetStoreId,
  });
  if (targetStoreId && targetStoreId !== warehouseZone.storeId) {
    emitToStore(targetStoreId, "transfer:created", {
      id: transfer.id,
      status: transfer.status,
      fromStoreId: warehouseZone.storeId,
      toStoreId: targetStoreId,
    });
  }

  return res.status(201).json(transfer);
};

const createPurchaseRequestFromSupplyRequest = async (req, res) => {
  return res.status(400).json({
    message:
      "Purchase requests cannot be created from requisitions. Requisitions are reserved for store stock replenishment.",
  });
};

module.exports = {
  createSupplyRequest,
  listSupplyRequests,
  getSupplyRequest,
  getSupplyRequestPdf,
  submitSupplyRequest,
  approveSupplyRequest,
  rejectSupplyRequest,
  updateSupplyRequest,
  deleteSupplyRequest,
  createTransferFromSupplyRequest,
  createPurchaseRequestFromSupplyRequest,
};
