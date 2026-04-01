const prisma = require("../config/prisma");
const { parseListParams, buildMeta } = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const {
  ensureInventorySessionTables,
  listInventorySessions,
  getInventorySessionById,
  getCurrentActiveInventorySession,
  getInventorySessionItems,
  getInventorySessionApprovals,
  createInventorySession,
  updateInventorySessionCounts,
  submitInventorySession,
  decideInventorySessionApproval,
  closeInventorySession,
} = require("../utils/inventorySessionStore");
const { emitLotExpiryNotifications } = require("../utils/inventoryLotStore");
const { emitToStore, emitToTenant } = require("../socket");

const resolveInventoryZoneId = async ({ tenantId, storeId, requestedZoneId, defaultZoneId }) => {
  if (requestedZoneId) {
    const zone = await prisma.storageZone.findFirst({
      where: {
        id: requestedZoneId,
        tenantId,
        ...(storeId ? { storeId } : {}),
      },
      select: { id: true },
    });
    return zone?.id || null;
  }

  if (defaultZoneId) {
    const zone = await prisma.storageZone.findFirst({
      where: {
        id: defaultZoneId,
        tenantId,
        ...(storeId ? { storeId } : {}),
      },
      select: { id: true },
    });
    if (zone) return zone.id;
  }

  const firstZone = await prisma.storageZone.findFirst({
    where: {
      tenantId,
      ...(storeId ? { storeId } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return firstZone?.id || null;
};

const loadInventorySessionDetail = async (tenantId, sessionId) => {
  const session = await getInventorySessionById(tenantId, sessionId);
  if (!session) return null;

  const [items, approvals] = await Promise.all([
    getInventorySessionItems(tenantId, sessionId),
    getInventorySessionApprovals(tenantId, sessionId),
  ]);

  return {
    ...session,
    items,
    approvals,
  };
};

const buildInventorySessionExportRows = (detail) =>
  (detail?.items || []).map((item) => ({
    produit: item.product?.name || "",
    code: item.product?.sku || "",
    lot: item.batchNumber || "Sans lot",
    expiration: item.expiryDate || "",
    quantiteSysteme: Number(item.systemQuantity || 0),
    quantitePhysique:
      item.physicalQuantity === null || item.physicalQuantity === undefined
        ? ""
        : Number(item.physicalQuantity || 0),
    ecart:
      item.varianceQuantity === null || item.varianceQuantity === undefined
        ? ""
        : Number(item.varianceQuantity || 0),
    note: item.note || "",
    zone: detail?.storageZone?.name || "",
    boutique: detail?.store?.name || "",
  }));

const emitInventoryEvent = (tenantId, storeId, event, payload) => {
  emitToTenant(tenantId, event, payload);
  if (storeId) {
    emitToStore(storeId, event, payload);
  }
};

const list = async (req, res) => {
  await ensureInventorySessionTables();
  const { page, pageSize, paginate, search, exportType } = parseListParams(req.query);
  const storeId = req.query?.storeId ? String(req.query.storeId).trim() : null;
  const status = req.query?.status ? String(req.query.status).trim().toUpperCase() : null;

  if (exportType) {
    const rows = await listInventorySessions({
      tenantId: req.user.tenantId,
      storeId,
      status,
      search,
      paginate: false,
    });

    return sendExport(
      res,
      rows.map((row) => ({
        code: row.code || row.id,
        statut: row.status,
        boutique: row.store?.name || "",
        zone: row.storageZone?.name || "",
        demandePar: [row.requestedBy?.firstName, row.requestedBy?.lastName]
          .filter(Boolean)
          .join(" "),
        lignes: row.itemsCount,
        ecarts: row.discrepancyCount,
        validations: row.approvalsCount,
        creeLe: row.createdAt,
        clotureLe: row.closedAt,
      })),
      "inventory-sessions",
      exportType,
    );
  }

  const result = await listInventorySessions({
    tenantId: req.user.tenantId,
    storeId,
    status,
    search,
    paginate,
    page,
    pageSize,
  });

  if (!paginate) {
    return res.json(result);
  }

  return res.json({
    data: result.rows,
    meta: buildMeta({
      page,
      pageSize,
      total: result.total,
    }),
  });
};

const getCurrent = async (req, res) => {
  await ensureInventorySessionTables();
  const session = await getCurrentActiveInventorySession(req.user.tenantId);
  if (!session) {
    return res.status(404).json({ message: "Aucun inventaire actif." });
  }

  const detail = await loadInventorySessionDetail(req.user.tenantId, session.id);
  return res.json(detail);
};

const getById = async (req, res) => {
  await ensureInventorySessionTables();
  const detail = await loadInventorySessionDetail(req.user.tenantId, req.params.id);

  if (!detail) {
    return res.status(404).json({ message: "Inventaire introuvable." });
  }

  return res.json(detail);
};

const exportById = async (req, res) => {
  await ensureInventorySessionTables();
  const detail = await loadInventorySessionDetail(req.user.tenantId, req.params.id);

  if (!detail) {
    return res.status(404).json({ message: "Inventaire introuvable." });
  }

  const exportType = ["csv", "xlsx", "pdf"].includes(String(req.query?.export || ""))
    ? String(req.query.export)
    : "xlsx";

  const rows = buildInventorySessionExportRows(detail);
  const filename = detail.code || `inventaire-${detail.id}`;

  return sendExport(res, rows, filename, exportType, {
<<<<<<< HEAD
    companyName: req.user.tenantName || "POSapp",
=======
    companyName: req.user.tenantName || "NEOPHARMA",
>>>>>>> aed4c876093dd2e186d658b809f50bca4071b79d
  });
};

const create = async (req, res) => {
  await ensureInventorySessionTables();
  const requestedStoreId =
    req.body?.storeId && req.user.role !== "USER"
      ? String(req.body.storeId).trim()
      : req.user.storeId || null;

  if (!requestedStoreId) {
    return res.status(400).json({
      message: "Aucune boutique n'est rattachee a cet inventaire.",
    });
  }

  const storageZoneId = await resolveInventoryZoneId({
    tenantId: req.user.tenantId,
    storeId: requestedStoreId,
    requestedZoneId:
      req.body?.storageZoneId && req.user.role !== "USER"
        ? String(req.body.storageZoneId).trim()
        : req.body?.storageZoneId
          ? String(req.body.storageZoneId).trim()
          : null,
    defaultZoneId: req.user.defaultStorageZoneId,
  });

  if (!storageZoneId) {
    return res.status(400).json({
      message: "Aucune zone de stockage valide n'a ete trouvee pour cet inventaire.",
    });
  }

  try {
    const session = await createInventorySession({
      tenantId: req.user.tenantId,
      storeId: requestedStoreId,
      storageZoneId,
      requestedById: req.user.id,
      note: req.body?.note ? String(req.body.note).trim() : null,
    });

    emitInventoryEvent(req.user.tenantId, session.storeId, "inventory:session:created", {
      id: session.id,
      code: session.code,
      status: session.status,
      storeId: session.storeId,
    });

    return res.status(201).json(await loadInventorySessionDetail(req.user.tenantId, session.id));
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de creer l'inventaire.",
    });
  }
};

const updateCounts = async (req, res) => {
  try {
    const session = await updateInventorySessionCounts({
      tenantId: req.user.tenantId,
      sessionId: req.params.id,
      items: Array.isArray(req.body?.items) ? req.body.items : [],
    });

    emitInventoryEvent(req.user.tenantId, session.storeId, "inventory:session:updated", {
      id: session.id,
      code: session.code,
      status: session.status,
      storeId: session.storeId,
    });

    return res.json(await loadInventorySessionDetail(req.user.tenantId, session.id));
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de mettre a jour les comptages.",
    });
  }
};

const submit = async (req, res) => {
  try {
    const session = await submitInventorySession(req.user.tenantId, req.params.id);

    emitInventoryEvent(req.user.tenantId, session.storeId, "inventory:session:submitted", {
      id: session.id,
      code: session.code,
      status: session.status,
      storeId: session.storeId,
    });

    return res.json(await loadInventorySessionDetail(req.user.tenantId, session.id));
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de soumettre cet inventaire.",
    });
  }
};

const approve = async (req, res) => {
  try {
    const session = await decideInventorySessionApproval({
      tenantId: req.user.tenantId,
      sessionId: req.params.id,
      user: req.user,
      decision: "APPROVED",
      note: req.body?.note ? String(req.body.note).trim() : null,
    });

    emitInventoryEvent(req.user.tenantId, session.storeId, "inventory:session:approved", {
      id: session.id,
      code: session.code,
      status: session.status,
      storeId: session.storeId,
    });

    return res.json(await loadInventorySessionDetail(req.user.tenantId, session.id));
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de valider cet inventaire.",
    });
  }
};

const reject = async (req, res) => {
  try {
    const session = await decideInventorySessionApproval({
      tenantId: req.user.tenantId,
      sessionId: req.params.id,
      user: req.user,
      decision: "REJECTED",
      note: req.body?.note ? String(req.body.note).trim() : null,
    });

    emitInventoryEvent(req.user.tenantId, session.storeId, "inventory:session:rejected", {
      id: session.id,
      code: session.code,
      status: session.status,
      storeId: session.storeId,
    });

    return res.json(await loadInventorySessionDetail(req.user.tenantId, session.id));
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de rejeter cet inventaire.",
    });
  }
};

const close = async (req, res) => {
  try {
    const session = await closeInventorySession({
      tenantId: req.user.tenantId,
      sessionId: req.params.id,
      closedById: req.user.id,
      note: req.body?.note ? String(req.body.note).trim() : null,
    });

    emitInventoryEvent(req.user.tenantId, session.storeId, "inventory:session:closed", {
      id: session.id,
      code: session.code,
      status: session.status,
      storeId: session.storeId,
    });

    await emitLotExpiryNotifications(req.user.tenantId);

    return res.json(await loadInventorySessionDetail(req.user.tenantId, session.id));
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de cloturer cet inventaire.",
    });
  }
};

module.exports = {
  list,
  getCurrent,
  getById,
  exportById,
  create,
  updateCounts,
  submit,
  approve,
  reject,
  close,
};
