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

const createDeliveryNote = async (req, res) => {
  const {
    supplierId,
    purchaseOrderId,
    code,
    receivedAt,
    note,
    items,
  } = req.body || {};

  if (!supplierId) {
    return res.status(400).json({ message: "supplierId is required." });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "items array required." });
  }

  const deliveryNote = await prisma.deliveryNote.create({
    data: {
      tenantId: req.user.tenantId,
      supplierId,
      purchaseOrderId,
      code,
      receivedAt: receivedAt ? new Date(receivedAt) : undefined,
      note,
      receivedById: req.user.id,
      status: "PENDING",
      items: {
        create: items.map((item) => ({
          tenantId: req.user.tenantId,
          productId: item.productId,
          unitId: item.unitId,
          orderedQty: item.orderedQty,
          deliveredQty: item.deliveredQty,
        })),
      },
    },
    include: { items: true },
  });

  let storeId = null;
  if (purchaseOrderId) {
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: { storeId: true },
    });
    storeId = purchaseOrder?.storeId || null;
  }

  if (storeId) {
    emitToStore(storeId, "delivery:note:created", {
      id: deliveryNote.id,
      status: deliveryNote.status,
      storeId,
      code: deliveryNote.code,
    });
  } else {
    emitToTenant(req.user.tenantId, "delivery:note:created", {
      id: deliveryNote.id,
      status: deliveryNote.status,
      code: deliveryNote.code,
    });
  }

  return res.status(201).json(deliveryNote);
};

const listDeliveryNotes = async (req, res) => {
  const { status, supplierId, purchaseOrderId } = req.query || {};
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const searchFilter = search
    ? {
        OR: [
          { code: contains(search) },
          { status: contains(search) },
          { supplier: { name: contains(search) } },
        ],
      }
    : {};

  const where = {
    tenantId: req.user.tenantId,
    ...(status ? { status } : {}),
    ...(supplierId ? { supplierId } : {}),
    ...(purchaseOrderId ? { purchaseOrderId } : {}),
    ...createdAtFilter,
    ...searchFilter,
  };

  const orderBy =
    buildOrderBy(sortBy, sortDir, {
      createdAt: "createdAt",
      status: "status",
      receivedAt: "receivedAt",
      code: "code",
    }) || { createdAt: "desc" };

  if (exportType) {
    const data = await prisma.deliveryNote.findMany({
      where,
      include: { supplier: true, items: true },
      orderBy,
    });

    const rows = data.map((item) => ({
      id: item.id,
      code: item.code,
      status: item.status,
      supplier: item.supplier?.name || "",
      itemsCount: item.items?.length || 0,
      receivedAt: item.receivedAt,
      createdAt: item.createdAt,
    }));

    return sendExport(res, rows, "delivery-notes", exportType);
  }

  if (!paginate) {
    const notes = await prisma.deliveryNote.findMany({
      where,
      include: {
        items: { include: { product: true, unit: true } },
        supplier: true,
        purchaseOrder: true,
        receivedBy: true,
      },
      orderBy,
    });
    return res.json(notes);
  }

  const [total, notes] = await prisma.$transaction([
    prisma.deliveryNote.count({ where }),
    prisma.deliveryNote.findMany({
      where,
      include: {
        items: { include: { product: true, unit: true } },
        supplier: true,
        purchaseOrder: true,
        receivedBy: true,
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return res.json({
    data: notes,
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const getDeliveryNote = async (req, res) => {
  const { id } = req.params;

  const note = await prisma.deliveryNote.findFirst({
    where: { id, tenantId: req.user.tenantId },
    include: {
      items: { include: { product: true, unit: true } },
      supplier: true,
      purchaseOrder: true,
      receivedBy: true,
    },
  });

  if (!note) {
    return res.status(404).json({ message: "Delivery note not found." });
  }

  return res.json(note);
};

const receiveDeliveryNote = async (req, res) => {
  const { id } = req.params;

  const note = await prisma.deliveryNote.findUnique({ where: { id } });
  if (!note || note.tenantId !== req.user.tenantId) {
    return res.status(404).json({ message: "Delivery note not found." });
  }

  const updated = await prisma.deliveryNote.update({
    where: { id },
    data: { status: "RECEIVED", receivedAt: new Date() },
  });

  let storeId = null;
  if (note.purchaseOrderId) {
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: note.purchaseOrderId },
      select: { storeId: true },
    });
    storeId = purchaseOrder?.storeId || null;
  }

  if (storeId) {
    emitToStore(storeId, "delivery:note:received", {
      id: updated.id,
      status: updated.status,
      storeId,
      code: updated.code,
    });
  } else {
    emitToTenant(req.user.tenantId, "delivery:note:received", {
      id: updated.id,
      status: updated.status,
      code: updated.code,
    });
  }

  return res.json(updated);
};

module.exports = {
  createDeliveryNote,
  listDeliveryNotes,
  getDeliveryNote,
  receiveDeliveryNote,
};
