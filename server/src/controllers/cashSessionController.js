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
  replaceCashSessionStockSnapshot,
  getCashSessionStockAudit,
} = require("../utils/cashSessionStore");
const { listGiftHistoryByCashSession } = require("../utils/orderItemOfferStore");
const { emitToStore, emitToTenant, emitToUser } = require("../socket");
const { sendErrorResponse } = require("../utils/httpErrors");

const toMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : NaN;
};

const isFrontOfficeRole = (role) => role === "USER" || role === "SELLER";

const loadSessionClosureInsights = async (tenantId, sessionId) => {
  const [stockAuditResult, giftHistoryResult] = await Promise.allSettled([
    getCashSessionStockAudit({
      tenantId,
      sessionId,
    }),
    listGiftHistoryByCashSession({
      tenantId,
      cashSessionId: sessionId,
    }),
  ]);

  if (stockAuditResult.status === "rejected") {
    console.error("[cash-session] stock audit unavailable after close", {
      tenantId,
      sessionId,
      message: stockAuditResult.reason?.message || "Unknown error",
    });
  }

  if (giftHistoryResult.status === "rejected") {
    console.error("[cash-session] gift history unavailable after close", {
      tenantId,
      sessionId,
      message: giftHistoryResult.reason?.message || "Unknown error",
    });
  }

  return {
    stockAudit: stockAuditResult.status === "fulfilled" ? stockAuditResult.value : null,
    giftHistory: giftHistoryResult.status === "fulfilled" ? giftHistoryResult.value : [],
  };
};

const resolveCashierStorageZone = async ({ tenantId, storeId, defaultStorageZoneId }) => {
  if (defaultStorageZoneId) {
    const zone = await prisma.storageZone.findFirst({
      where: {
        id: defaultStorageZoneId,
        tenantId,
        storeId,
        zoneType: "STORE",
      },
      select: { id: true, name: true, zoneType: true },
    });

    if (zone) return zone;
  }

  return prisma.storageZone.findFirst({
    where: {
      tenantId,
      storeId,
      zoneType: "STORE",
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, zoneType: true },
  });
};

const normalizeStockAuditItemsInput = (items = []) =>
  (Array.isArray(items) ? items : []).map((item, index) => {
    const productId = String(item?.productId || "").trim();
    const productName = String(item?.productName || "").trim();
    const sku = item?.sku ? String(item.sku).trim() : "";
    const theoreticalQuantity = Number(item?.theoreticalQuantity || 0);
    const countedQuantity =
      item?.countedQuantity === undefined || item?.countedQuantity === null || item?.countedQuantity === ""
        ? null
        : Number(item.countedQuantity);

    if (!productId || !productName) {
      throw Object.assign(
        new Error(`Ligne de stock invalide a la position ${index + 1}.`),
        { status: 400 },
      );
    }
    if (!Number.isFinite(theoreticalQuantity) || theoreticalQuantity < 0) {
      throw Object.assign(
        new Error(`Stock theorique invalide a la position ${index + 1}.`),
        { status: 400 },
      );
    }
    if (countedQuantity !== null && (!Number.isFinite(countedQuantity) || countedQuantity < 0)) {
      throw Object.assign(
        new Error(`Stock compte invalide a la position ${index + 1}.`),
        { status: 400 },
      );
    }

    return {
      productId,
      productName,
      sku,
      theoreticalQuantity,
      countedQuantity,
    };
  });

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

  const sessionZone = session.storageZoneId
    ? await prisma.storageZone.findFirst({
        where: {
          id: session.storageZoneId,
          tenantId: req.user.tenantId,
          storeId: session.storeId,
        },
        select: { id: true, name: true, zoneType: true },
      })
    : null;

  let currentSession = session;
  if (sessionZone?.zoneType !== "STORE") {
    const boutiqueZone = await resolveCashierStorageZone({
      tenantId: req.user.tenantId,
      storeId: session.storeId,
      defaultStorageZoneId: req.user.defaultStorageZoneId,
    });

    if (boutiqueZone && Number(session.orderCount || 0) === 0) {
      await prisma.$executeRawUnsafe(`
        UPDATE "cashSessions"
        SET
          "storageZoneId" = ${JSON.stringify(boutiqueZone.id)},
          "updatedAt" = NOW()
        WHERE "id" = ${JSON.stringify(session.id)}
      `);

      currentSession = {
        ...session,
        storageZoneId: boutiqueZone.id,
        storageZoneName: boutiqueZone.name || "",
      };
    }
  }

  return res.json({
    ...currentSession,
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

  const canView = !isFrontOfficeRole(req.user.role) || session.userId === req.user.id;

  if (!canView) {
    return res.status(403).json({
      message: "Vous ne pouvez pas consulter cette session de caisse.",
    });
  }

  const movements = await listCashSessionMovements({
    tenantId: req.user.tenantId,
    sessionId: req.params.id,
  });
  const stockAudit = await getCashSessionStockAudit({
    tenantId: req.user.tenantId,
    sessionId: req.params.id,
  });

  return res.json({
    ...session,
    currencyCode: currencySettings.primaryCurrencyCode,
    stockAudit,
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
      message: "Aucune zone de stock boutique (STORE) n'est configuree pour cette boutique.",
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
    return sendErrorResponse(res, error, "Impossible d'ouvrir la caisse.");
  }
};

const close = async (req, res) => {
  const countedCash = toMoney(req.body?.countedCash);
  const closingNote = req.body?.note ? String(req.body.note).trim() : null;
  let stockItems = [];

  if (!Number.isFinite(countedCash) || countedCash < 0) {
    return res.status(400).json({ message: "Le montant compte est invalide." });
  }
  try {
    stockItems = normalizeStockAuditItemsInput(req.body?.stockItems || []);
  } catch (error) {
    return sendErrorResponse(res, error, "Controle de stock de cloture invalide.");
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
    if (stockItems.length) {
      await replaceCashSessionStockSnapshot({
        tenantId: req.user.tenantId,
        sessionId: req.params.id,
        stage: "CLOSING",
        items: stockItems,
      });
    }
    const closedSession = await closeCashSession({
      tenantId: req.user.tenantId,
      sessionId: req.params.id,
      countedCash,
      closingNote,
    });
    const { stockAudit, giftHistory } = await loadSessionClosureInsights(
      req.user.tenantId,
      req.params.id,
    );

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
      stockAudit,
      giftHistory,
    });
  } catch (error) {
    return sendErrorResponse(res, error, "Impossible de cloturer la caisse.");
  }
};

const saveOpeningStockSnapshot = async (req, res) => {
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
      message: "Vous ne pouvez pas enregistrer le stock d'ouverture de cette caisse.",
    });
  }

  try {
    const stockItems = normalizeStockAuditItemsInput(req.body?.stockItems || []);
    await replaceCashSessionStockSnapshot({
      tenantId: req.user.tenantId,
      sessionId: req.params.id,
      stage: "OPENING",
      items: stockItems.map((item) => ({
        ...item,
        countedQuantity:
          item.countedQuantity == null ? item.theoreticalQuantity : item.countedQuantity,
      })),
    });

    return res.status(201).json(
      await getCashSessionStockAudit({
        tenantId: req.user.tenantId,
        sessionId: req.params.id,
      }),
    );
  } catch (error) {
    return sendErrorResponse(
      res,
      error,
      "Impossible d'enregistrer le stock d'ouverture.",
    );
  }
};

const getStockAudit = async (req, res) => {
  const session = await getCashSessionById({
    tenantId: req.user.tenantId,
    sessionId: req.params.id,
  });

  if (!session) {
    return res.status(404).json({ message: "Session de caisse introuvable." });
  }

  const canView = !isFrontOfficeRole(req.user.role) || session.userId === req.user.id;
  if (!canView) {
    return res.status(403).json({
      message: "Vous ne pouvez pas consulter ce controle de stock.",
    });
  }

  return res.json(
    await getCashSessionStockAudit({
      tenantId: req.user.tenantId,
      sessionId: req.params.id,
    }),
  );
};

const getGiftHistory = async (req, res) => {
  const session = await getCashSessionById({
    tenantId: req.user.tenantId,
    sessionId: req.params.id,
  });

  if (!session) {
    return res.status(404).json({ message: "Session de caisse introuvable." });
  }

  const canView = !isFrontOfficeRole(req.user.role) || session.userId === req.user.id;
  if (!canView) {
    return res.status(403).json({
      message: "Vous ne pouvez pas consulter l'historique des offerts de cette caisse.",
    });
  }

  const history = await listGiftHistoryByCashSession({
    tenantId: req.user.tenantId,
    cashSessionId: req.params.id,
  });
  return res.json(history);
};

const list = async (req, res) => {
  await ensureCashSessionTables();
  const currencySettings = await loadTenantCurrencySettings(prisma, req.user.tenantId);
  const { page, pageSize, paginate, search, exportType } = parseListParams(req.query);
  const status = req.query?.status ? String(req.query.status).trim().toUpperCase() : null;
  const requestedUserId = req.query?.userId ? String(req.query.userId).trim() : null;
  const storeId = req.query?.storeId ? String(req.query.storeId).trim() : null;
  const scopedUserId = isFrontOfficeRole(req.user.role) ? req.user.id : requestedUserId;

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
    return sendErrorResponse(
      res,
      error,
      "Impossible d'enregistrer le mouvement de caisse.",
    );
  }
};

module.exports = {
  getCurrent,
  getById,
  open,
  close,
  list,
  addMovement,
  saveOpeningStockSnapshot,
  getStockAudit,
  getGiftHistory,
};
