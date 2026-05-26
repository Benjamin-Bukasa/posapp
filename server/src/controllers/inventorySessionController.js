const prisma = require("../config/prisma");
const { parseListParams, buildMeta } = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const { sendWorkbook, readSheetRows } = require("../utils/xlsxTemplates");
const { notifyInventoryApprovalStep } = require("../services/approvalNotificationService");
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

const isFrontOfficeRole = (role) => role === "USER" || role === "SELLER";
const INVENTORY_TEMPLATE_SHEET = "InventoryCounts";

const pickFirstValue = (row, keys = []) => {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(row || {}, key)) continue;
    const value = row[key];
    if (value === null || value === undefined) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return "";
};

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

const notifyCurrentInventoryApprover = async (detail) => {
  try {
    const currentStep = (detail?.approvals || []).find((item) => item.status === "PENDING");
    if (!currentStep) return;

    await notifyInventoryApprovalStep({
      session: detail,
      approval: currentStep,
    });
  } catch (error) {
    console.error("[APPROVAL][EMAIL][INVENTORY_SESSION]", {
      documentId: detail?.id || null,
      message: error.message || String(error),
    });
  }
};

const processInventorySessionApprovalDecision = async ({
  tenantId,
  sessionId,
  user,
  decision,
  note = null,
}) => {
  const session = await decideInventorySessionApproval({
    tenantId,
    sessionId,
    user,
    decision,
    note,
  });

  const detail = await loadInventorySessionDetail(tenantId, session.id);
  const normalizedDecision = String(decision || "").trim().toUpperCase();
  const eventName =
    normalizedDecision === "APPROVED"
      ? detail?.status === "APPROVED"
        ? "inventory:session:approved"
        : "inventory:session:submitted"
      : "inventory:session:rejected";

  emitInventoryEvent(tenantId, detail?.storeId, eventName, {
    id: detail?.id,
    code: detail?.code,
    status: detail?.status,
    storeId: detail?.storeId,
  });

  if (normalizedDecision === "APPROVED" && detail?.status === "SUBMITTED") {
    await notifyCurrentInventoryApprover(detail);
  }

  return detail;
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
    companyName: req.user.tenantName || "POSapp",
  });
};

const downloadTemplate = async (req, res) => {
  await ensureInventorySessionTables();
  const sessionId = String(req.query?.sessionId || req.params?.id || "").trim();

  if (!sessionId) {
    return res.status(400).json({
      message: "sessionId est requis pour telecharger le template d'inventaire.",
    });
  }

  const detail = await loadInventorySessionDetail(req.user.tenantId, sessionId);
  if (!detail) {
    return res.status(404).json({ message: "Inventaire introuvable." });
  }

  return sendWorkbook(res, `template-inventaire-${detail.code || detail.id}`, [
    {
      name: INVENTORY_TEMPLATE_SHEET,
      rows: (detail.items || []).map((item) => ({
        "id ligne": item.id,
        produit: item.product?.name || "",
        "code produit": item.product?.sku || "",
        lot: item.batchNumber || "",
        expiration: item.expiryDate || "",
        "qte stock": Number(item.systemQuantity || 0),
        "qte physique":
          item.physicalQuantity === null || item.physicalQuantity === undefined
            ? ""
            : Number(item.physicalQuantity || 0),
        note: item.note || "",
      })),
    },
  ]);
};

const importTemplate = async (req, res) => {
  await ensureInventorySessionTables();

  if (!req.file) {
    return res.status(400).json({ message: "Fichier Excel requis." });
  }

  const sessionId = String(req.body?.sessionId || req.query?.sessionId || "").trim();
  if (!sessionId) {
    return res.status(400).json({
      message: "sessionId est requis pour importer un inventaire.",
    });
  }

  const detail = await loadInventorySessionDetail(req.user.tenantId, sessionId);
  if (!detail) {
    return res.status(404).json({ message: "Inventaire introuvable." });
  }

  if (!["DRAFT", "REJECTED"].includes(detail.status)) {
    return res.status(409).json({
      message: "Seuls les inventaires non soumis peuvent etre importes.",
    });
  }

  try {
    const rows = readSheetRows(req.file.buffer, INVENTORY_TEMPLATE_SHEET);
    const detailItems = Array.isArray(detail.items) ? detail.items : [];
    const itemById = new Map(detailItems.map((item) => [item.id, item]));
    const errors = [];
    const payloadItems = [];

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const itemId = pickFirstValue(row, ["id ligne", "ID ligne", "itemId", "ItemId"]);
      const physicalRaw = pickFirstValue(row, [
        "qte physique",
        "Qte physique",
        "quantite physique",
        "Quantite physique",
        "physicalQuantity",
        "PhysicalQuantity",
      ]);
      const note = pickFirstValue(row, ["note", "Note"]);

      if (!itemId) {
        if (Object.values(row || {}).some((value) => String(value || "").trim() !== "")) {
          errors.push({
            line,
            identifier: pickFirstValue(row, ["code produit", "produit"]) || "--",
            message: "La colonne 'id ligne' est requise dans le template d'inventaire.",
          });
        }
        continue;
      }

      const existing = itemById.get(itemId);
      if (!existing) {
        errors.push({
          line,
          identifier: itemId,
          message: "Ligne d'inventaire introuvable pour cette session.",
        });
        continue;
      }

      if (physicalRaw && !Number.isFinite(Number(physicalRaw))) {
        errors.push({
          line,
          identifier: existing.product?.sku || existing.product?.name || itemId,
          message: "La quantite physique doit etre numerique.",
        });
        continue;
      }

      payloadItems.push({
        itemId,
        physicalQuantity: physicalRaw === "" ? null : Number(physicalRaw),
        note: note || "",
      });
    }

    const updated = await updateInventorySessionCounts({
      tenantId: req.user.tenantId,
      sessionId,
      items: payloadItems,
    });

    return res.json({
      message: "Import de l'inventaire termine.",
      created: payloadItems.length,
      failed: errors.length,
      errors,
      session: updated,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible d'importer cet inventaire.",
    });
  }
};

const create = async (req, res) => {
  await ensureInventorySessionTables();
  const requestedStoreId =
    req.body?.storeId && !isFrontOfficeRole(req.user.role)
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
      req.body?.storageZoneId && !isFrontOfficeRole(req.user.role)
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
    const detail = await loadInventorySessionDetail(req.user.tenantId, session.id);

    emitInventoryEvent(req.user.tenantId, session.storeId, "inventory:session:submitted", {
      id: session.id,
      code: session.code,
      status: session.status,
      storeId: session.storeId,
    });

    if (detail?.status === "SUBMITTED") {
      await notifyCurrentInventoryApprover(detail);
    }

    return res.json(detail);
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de soumettre cet inventaire.",
    });
  }
};

const approve = async (req, res) => {
  try {
    const session = await processInventorySessionApprovalDecision({
      tenantId: req.user.tenantId,
      sessionId: req.params.id,
      user: req.user,
      decision: "APPROVED",
      note: req.body?.note ? String(req.body.note).trim() : null,
    });

    return res.json(session);
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de valider cet inventaire.",
    });
  }
};

const reject = async (req, res) => {
  try {
    const session = await processInventorySessionApprovalDecision({
      tenantId: req.user.tenantId,
      sessionId: req.params.id,
      user: req.user,
      decision: "REJECTED",
      note: req.body?.note ? String(req.body.note).trim() : null,
    });

    return res.json(session);
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
  downloadTemplate,
  importTemplate,
  create,
  updateCounts,
  submit,
  approve,
  reject,
  close,
  processInventorySessionApprovalDecision,
};
