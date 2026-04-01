const prisma = require("../config/prisma");
const { parseListParams, buildMeta } = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const { loadTenantCurrencySettings } = require("../utils/currencySettings");
const {
  ensureCashSessionTables,
  getCurrentCashSession,
  getCashSessionById,
  createCashSession,
  closeCashSession,
  listCashSessions,
  listCashSessionMovements,
  recordCashMovement,
} = require("../utils/cashSessionStore");
const { emitToStore, emitToTenant, emitToUser } = require("../socket");

const toMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : NaN;
};

const resolveCashierStorageZone = async ({ tenantId, storeId, defaultStorageZoneId }) => {
  if (defaultStorageZoneId) {
    const zone = await prisma.storageZone.findFirst({
      where: {
        id: defaultStorageZoneId,
        tenantId,
        storeId,
      },
      select: { id: true, name: true },
    });

    if (zone) return zone;
  }

  const counterZone = await prisma.storageZone.findFirst({
    where: {
      tenantId,
      storeId,
      zoneType: "COUNTER",
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (counterZone) return counterZone;

  const storeZone = await prisma.storageZone.findFirst({
    where: {
      tenantId,
      storeId,
      zoneType: "STORE",
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (storeZone) return storeZone;

  return prisma.storageZone.findFirst({
    where: { tenantId, storeId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
};

const getCurrent = async (req, res) => {
  await ensureCashSessionTables();
  const currencySettings = await loadTenantCurrencySettings(prisma, req.user.tenantId);
  const session = await getCurrentCashSession({
    tenantId: req.user.tenantId,
    userId: req.user.id,
    storeId: req.user.storeId || null,
  });

  if (!session) {
    return res.status(404).json({ message: "Aucune caisse ouverte." });
  }

  return res.json({
    ...session,
    currencyCode: currencySettings.primaryCurrencyCode,
  });
};

const getById = async (req, res) => {
  await ensureCashSessionTables();
  const currencySettings = await loadTenantCurrencySettings(prisma, req.user.tenantId);
  const session = await getCashSessionById({
    tenantId: req.user.tenantId,
    sessionId: req.params.id,
  });

  if (!session) {
    return res.status(404).json({ message: "Session de caisse introuvable." });
  }

  const canView =
    req.user.role !== "USER" ||
    session.userId === req.user.id;

  if (!canView) {
    return res.status(403).json({
      message: "Vous ne pouvez pas consulter cette session de caisse.",
    });
  }

  const movements = await listCashSessionMovements({
    tenantId: req.user.tenantId,
    sessionId: req.params.id,
  });

  return res.json({
    ...session,
    currencyCode: currencySettings.primaryCurrencyCode,
    movements: movements.map((movement) => ({
      ...movement,
      currencyCode: currencySettings.primaryCurrencyCode,
    })),
  });
};

const open = async (req, res) => {
  const openingFloat = toMoney(req.body?.openingFloat ?? 0);
  const openingNote = req.body?.note ? String(req.body.note).trim() : null;

  if (!Number.isFinite(openingFloat) || openingFloat < 0) {
    return res.status(400).json({ message: "Le fonds de caisse initial est invalide." });
  }

  if (!req.user.storeId) {
    return res.status(400).json({
      message: "L'utilisateur connecte n'est rattache a aucune boutique.",
    });
  }

  const storageZone = await resolveCashierStorageZone({
    tenantId: req.user.tenantId,
    storeId: req.user.storeId,
    defaultStorageZoneId: req.user.defaultStorageZoneId,
  });

  if (!storageZone) {
    return res.status(400).json({
      message: "Aucune zone de caisse n'est configuree pour cette boutique.",
    });
  }

  try {
    const currencySettings = await loadTenantCurrencySettings(prisma, req.user.tenantId);
    const session = await createCashSession({
      tenantId: req.user.tenantId,
      storeId: req.user.storeId,
      userId: req.user.id,
      storageZoneId: storageZone.id,
      openingFloat,
      openingNote,
    });

    const payload = {
      id: session.id,
      storeId: session.storeId,
      userId: session.userId,
      status: session.status,
      openingFloat: session.openingFloat,
    };
    emitToTenant(req.user.tenantId, "cash:session:opened", payload);
    emitToStore(req.user.storeId, "cash:session:opened", payload);
    emitToUser(req.user.id, "cash:session:opened", payload);

    return res.status(201).json({
      ...session,
      currencyCode: currencySettings.primaryCurrencyCode,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible d'ouvrir la caisse.",
    });
  }
};

const close = async (req, res) => {
  const countedCash = toMoney(req.body?.countedCash);
  const closingNote = req.body?.note ? String(req.body.note).trim() : null;

  if (!Number.isFinite(countedCash) || countedCash < 0) {
    return res.status(400).json({ message: "Le montant compte est invalide." });
  }

  const session = await getCashSessionById({
    tenantId: req.user.tenantId,
    sessionId: req.params.id,
  });

  if (!session) {
    return res.status(404).json({ message: "Session de caisse introuvable." });
  }

  const canClose =
    session.userId === req.user.id ||
    req.user.role === "ADMIN" ||
    req.user.role === "SUPERADMIN";

  if (!canClose) {
    return res.status(403).json({
      message: "Vous ne pouvez pas cloturer cette caisse.",
    });
  }

  try {
    const currencySettings = await loadTenantCurrencySettings(prisma, req.user.tenantId);
    const closedSession = await closeCashSession({
      tenantId: req.user.tenantId,
      sessionId: req.params.id,
      countedCash,
      closingNote,
    });

    const payload = {
      id: closedSession.id,
      storeId: closedSession.storeId,
      userId: closedSession.userId,
      status: closedSession.status,
      variance: closedSession.variance,
    };
    emitToTenant(req.user.tenantId, "cash:session:closed", payload);
    emitToStore(closedSession.storeId, "cash:session:closed", payload);
    emitToUser(closedSession.userId, "cash:session:closed", payload);

    return res.json({
      ...closedSession,
      currencyCode: currencySettings.primaryCurrencyCode,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de cloturer la caisse.",
    });
  }
};

const list = async (req, res) => {
  await ensureCashSessionTables();
  const currencySettings = await loadTenantCurrencySettings(prisma, req.user.tenantId);
  const { page, pageSize, paginate, search, exportType } = parseListParams(req.query);
  const status = req.query?.status ? String(req.query.status).trim().toUpperCase() : null;
  const requestedUserId = req.query?.userId ? String(req.query.userId).trim() : null;
  const storeId = req.query?.storeId ? String(req.query.storeId).trim() : null;
  const scopedUserId = req.user.role === "USER" ? req.user.id : requestedUserId;

  if (exportType) {
    const exportRows = await listCashSessions({
      tenantId: req.user.tenantId,
      userId: scopedUserId,
      storeId,
      status,
      search,
      paginate: false,
    });

    const rows = exportRows.map((session) => ({
      id: session.id,
      statut: session.status,
      boutique: session.storeName || "",
      caissier: session.userName || "",
      zone: session.storageZoneName || "",
      fondsInitial: session.openingFloat,
      ventesCash: session.totalCashSales,
      ventesNonCash: session.totalNonCashSales,
      cashTheorique: session.expectedCash,
      cashCompte: session.closingCounted,
      ecart: session.variance,
      ouverteLe: session.openedAt,
      clotureeLe: session.closedAt,
    }));

    return sendExport(res, rows, "cash-sessions", exportType);
  }

  const result = await listCashSessions({
    tenantId: req.user.tenantId,
    userId: scopedUserId,
    storeId,
    status,
    search,
    page,
    pageSize,
    paginate,
  });

  if (!paginate) {
    return res.json(
      result.map((row) => ({
        ...row,
        currencyCode: currencySettings.primaryCurrencyCode,
      })),
    );
  }

  return res.json({
    data: result.rows.map((row) => ({
      ...row,
      currencyCode: currencySettings.primaryCurrencyCode,
    })),
    meta: buildMeta({
      page,
      pageSize,
      total: result.total,
    }),
  });
};

const addMovement = async (req, res) => {
  const type = String(req.body?.type || "").trim().toUpperCase();
  const amount = toMoney(req.body?.amount);
  const reason = String(req.body?.reason || "").trim();
  const note = req.body?.note ? String(req.body.note).trim() : null;

  if (!["IN", "OUT"].includes(type)) {
    return res.status(400).json({ message: "Le type de mouvement est invalide." });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: "Le montant du mouvement est invalide." });
  }
  if (!reason) {
    return res.status(400).json({ message: "Le motif du mouvement est obligatoire." });
  }

  const session = await getCashSessionById({
    tenantId: req.user.tenantId,
    sessionId: req.params.id,
  });

  if (!session) {
    return res.status(404).json({ message: "Session de caisse introuvable." });
  }

  const canEdit =
    session.userId === req.user.id ||
    req.user.role === "ADMIN" ||
    req.user.role === "SUPERADMIN";

  if (!canEdit) {
    return res.status(403).json({
      message: "Vous ne pouvez pas enregistrer un mouvement sur cette caisse.",
    });
  }

  try {
    const currencySettings = await loadTenantCurrencySettings(prisma, req.user.tenantId);
    const updatedSession = await recordCashMovement({
      tenantId: req.user.tenantId,
      sessionId: req.params.id,
      createdById: req.user.id,
      type,
      amount,
      reason,
      note,
    });

    const payload = {
      id: updatedSession.id,
      storeId: updatedSession.storeId,
      userId: updatedSession.userId,
      type,
      amount,
      reason,
    };
    emitToTenant(req.user.tenantId, "cash:session:movement", payload);
    emitToStore(updatedSession.storeId, "cash:session:movement", payload);
    emitToUser(updatedSession.userId, "cash:session:movement", payload);

    return res.status(201).json({
      ...updatedSession,
      currencyCode: currencySettings.primaryCurrencyCode,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible d'enregistrer le mouvement de caisse.",
    });
  }
};

module.exports = {
  getCurrent,
  getById,
  open,
  close,
  list,
  addMovement,
};
