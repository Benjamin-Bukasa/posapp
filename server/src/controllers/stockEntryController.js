const prisma = require("../config/prisma");
const {
  loadTenantCurrencySettings,
  normalizeCurrencyCode,
} = require("../utils/currencySettings");
const {
  setCurrencyCodes,
} = require("../utils/moneyCurrency");
const {
  parseListParams,
  buildOrderBy,
  contains,
  buildMeta,
  buildDateRangeFilter,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const { sendWorkbook, readSheetRows } = require("../utils/xlsxTemplates");
const { emitToStore } = require("../socket");
const { buildStockEntryPdf } = require("../services/stockEntryPdf");
const { notifyStockEntryApprovalStep } = require("../services/approvalNotificationService");
const {
  ensureInventoryLotTables,
  attachStockEntryLots,
  setStockEntryItemLots,
  incrementInventoryLot,
  consumeInventoryLotsFefo,
  emitLotExpiryNotifications,
} = require("../utils/inventoryLotStore");
const {
  loadApprovalFlow,
  getDocumentApprovals,
  getDocumentApprovalMap,
  prepareDocumentApprovals,
  resetDocumentApprovals,
  decideDocumentApproval,
  ensureDocumentApprovalTable,
} = require("../utils/documentApprovalStore");
const {
  expandArticleItems,
  ensureComponentItems,
} = require("../utils/expandArticleItems");
const { sendErrorResponse } = require("../utils/httpErrors");
const { hasScopedPermission } = require("../utils/documentPermissionScopes");

const toNumber = (value) => Number(value || 0);
const STOCK_ENTRY_DOCUMENT_TYPE = "STOCK_ENTRY";
const isSeller = (user) => user?.role === "SELLER";
const STOCK_ENTRY_TEMPLATE_SHEET = "StockEntries";
const STOCK_ENTRY_TEMPLATE_INFO_SHEET = "Instructions";

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

const isReasonableSpreadsheetYear = (date) => {
  const year = date.getUTCFullYear();
  return year >= 1900 && year <= 2100;
};

const buildIsoDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  if (!isReasonableSpreadsheetYear(date)) return null;
  return date.toISOString();
};

const parseExcelSerialDate = (serialValue) => {
  const serial = Number(serialValue);
  if (!Number.isFinite(serial) || serial <= 0) return null;

  // Excel stores dates as days since 1899-12-30 in the default 1900 date system.
  const excelEpochUtc = Date.UTC(1899, 11, 30);
  const wholeDays = Math.floor(serial);
  const fractionalDay = serial - wholeDays;
  const milliseconds =
    wholeDays * 24 * 60 * 60 * 1000 +
    Math.round(fractionalDay * 24 * 60 * 60 * 1000);

  return new Date(excelEpochUtc + milliseconds);
};

const parseOptionalDate = (value) => {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    return buildIsoDate(value);
  }

  if (typeof value === "number") {
    return buildIsoDate(parseExcelSerialDate(value));
  }

  const normalized = String(value).trim();
  if (!normalized) return null;

  if (/^\d+(\.\d+)?$/.test(normalized)) {
    const numericValue = Number(normalized);

    if (numericValue >= 59 && numericValue <= 60000) {
      return buildIsoDate(parseExcelSerialDate(numericValue));
    }

    if (/^\d{8}$/.test(normalized)) {
      const year = Number(normalized.slice(0, 4));
      const month = Number(normalized.slice(4, 6));
      const day = Number(normalized.slice(6, 8));
      return buildIsoDate(new Date(Date.UTC(year, month - 1, day)));
    }

    return null;
  }

  const frenchStyleMatch = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (frenchStyleMatch) {
    const [, dayRaw, monthRaw, yearRaw] = frenchStyleMatch;
    return buildIsoDate(
      new Date(Date.UTC(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw))),
    );
  }

  return buildIsoDate(new Date(normalized));
};

const parseRequiredPositiveNumber = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const resolveStockEntryFlowCodes = (sourceType, operationType = "IN") => {
  const normalizedOperationType = operationType === "OUT" ? "OUT" : "IN";
  if (sourceType === "DIRECT" && normalizedOperationType === "OUT") {
    return ["DIRECT_STOCK_EXIT", "STOCK_EXIT"];
  }
  if (sourceType === "DIRECT") {
    return ["DIRECT_STOCK_ENTRY", "STOCK_ENTRY"];
  }
  if (normalizedOperationType === "OUT") {
    return ["STOCK_EXIT"];
  }
  return ["STOCK_ENTRY"];
};

const mapStockEntryStatus = (rawStatus, approvals = []) => {
  if (!approvals.length) return rawStatus;
  if (rawStatus === "POSTED") return rawStatus;
  if (approvals.some((item) => item.status === "REJECTED")) return "REJECTED";
  if (rawStatus === "APPROVED") return rawStatus;
  return "SUBMITTED";
};

const decorateStockEntriesWithApprovals = async (records, { includeApprovals = true } = {}) => {
  const list = Array.isArray(records) ? records.filter(Boolean) : records ? [records] : [];
  if (!list.length) return Array.isArray(records) ? [] : records;

  const approvalMap = await getDocumentApprovalMap(
    list[0].tenantId,
    STOCK_ENTRY_DOCUMENT_TYPE,
    list.map((item) => item.id),
  );

  const mapped = list.map((item) => {
    const approvals = approvalMap.get(item.id) || [];
    return {
      ...item,
      rawStatus: item.status,
      status: mapStockEntryStatus(item.status, approvals),
      ...(includeApprovals ? { approvals } : {}),
    };
  });

  return Array.isArray(records) ? mapped : mapped[0];
};

const canModifyStockEntry = async (tenantId, entry) => {
  if (entry.sourceType !== "DIRECT" || entry.status !== "PENDING") return false;
  return true;
};

const resetStockEntryApprovals = async (tenantId, entryId) => {
  await resetDocumentApprovals({
    tenantId,
    documentType: STOCK_ENTRY_DOCUMENT_TYPE,
    documentId: entryId,
  });
};

const hydrateStockEntriesWithCurrencyCodes = async (records) => {
  const list = Array.isArray(records)
    ? records.filter(Boolean)
    : records
      ? [records]
      : [];

  if (!list.length) {
    return Array.isArray(records) ? [] : records;
  }

  const hydrated = list.map((entry) => ({
    ...entry,
    items: (entry.items || []).map((item) => ({
      ...item,
      currencyCode: normalizeCurrencyCode(item.currencyCode),
    })),
  }));

  const withLots = await Promise.all(
    hydrated.map(async (entry) => ({
      ...entry,
      items: await attachStockEntryLots(entry.items || []),
    })),
  );

  return Array.isArray(records) ? withLots : withLots[0];
};

const normalizeStockEntryItems = (items = [], operationType = "IN") =>
  items.map((item) => {
    const rawQuantity = Math.abs(toNumber(item.quantity));
    const quantity = operationType === "OUT" ? -rawQuantity : rawQuantity;

    return {
      productId: item.productId,
      unitId: item.unitId,
      quantity,
      unitCost: item.unitCost,
      batchNumber: item.batchNumber ? String(item.batchNumber).trim() : null,
      expiryDate: item.expiryDate || null,
      manufacturedAt: item.manufacturedAt || null,
    };
  });

const buildQuantityMap = (items = []) =>
  items.reduce((accumulator, item) => {
    const key = `${item.productId}:${item.unitId || ""}`;
    return {
      ...accumulator,
      [key]: (accumulator[key] || 0) + Math.abs(toNumber(item.quantity)),
    };
  }, {});

const hasQuantityMismatch = (expectedItems = [], actualItems = []) => {
  const expected = buildQuantityMap(expectedItems);
  const actual = buildQuantityMap(actualItems);
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);

  for (const key of keys) {
    if ((expected[key] || 0) !== (actual[key] || 0)) {
      return true;
    }
  }

  return false;
};

const getStockEntryOperationType = (entry) =>
  Array.isArray(entry?.items) && entry.items.some((item) => Number(item.quantity || 0) < 0) ? "OUT" : "IN";

const getStockEntryApprovalConfig = async (tenantId, sourceType, operationType = "IN") => {
  const flow = await loadApprovalFlow(tenantId, resolveStockEntryFlowCodes(sourceType, operationType));
  return {
    flow,
    requiresApproval: Boolean(flow?.steps?.length),
  };
};

const stockEntryInclude = {
  store: true,
  storageZone: true,
  createdBy: true,
  approvedBy: true,
  items: { include: { product: true, unit: true } },
};

const loadStockEntryById = (tenantId, id) =>
  prisma.stockEntry.findFirst({
    where: { id, tenantId },
    include: stockEntryInclude,
  });

const notifyCurrentStockEntryApprover = async (entry) => {
  try {
    const approvals = await getDocumentApprovals(
      entry.tenantId,
      STOCK_ENTRY_DOCUMENT_TYPE,
      entry.id,
    );
    const currentStep = approvals.find((item) => item.status === "PENDING");
    if (!currentStep) return;

    await notifyStockEntryApprovalStep({
      stockEntry: entry,
      approval: currentStep,
    });
  } catch (error) {
    console.error("[APPROVAL][EMAIL][STOCK_ENTRY]", {
      documentId: entry?.id || null,
      message: error.message || String(error),
    });
  }
};

const processStockEntryApprovalDecision = async ({
  tenantId,
  entryId,
  user,
  decision,
  note = null,
}) => {
  const entry = await loadStockEntryById(tenantId, entryId);
  if (!entry) {
    throw Object.assign(new Error("Stock entry not found."), { status: 404 });
  }

  const approvalConfig = await getStockEntryApprovalConfig(
    tenantId,
    entry.sourceType,
    getStockEntryOperationType(entry),
  );

  const normalizedDecision = String(decision || "").trim().toUpperCase();

  if (normalizedDecision === "APPROVED") {
    if (approvalConfig.requiresApproval) {
      const approvalDecision = await decideDocumentApproval({
        tenantId,
        documentType: STOCK_ENTRY_DOCUMENT_TYPE,
        documentId: entryId,
        user,
        decision: "APPROVED",
        note,
      });

      let updated = entry;
      if (approvalDecision.lifecycleStatus === "APPROVED" && entry.status !== "APPROVED") {
        updated = await prisma.stockEntry.update({
          where: { id: entryId },
          data: {
            status: "APPROVED",
            approvedById: user.id,
            approvedAt: new Date(),
          },
          include: stockEntryInclude,
        });

        emitToStore(entry.storeId || user.storeId, "stock:entry:approved", {
          id: updated.id,
          status: updated.status,
          storeId: entry.storeId || user.storeId,
        });
      } else {
        updated = await loadStockEntryById(tenantId, entryId);
      }

      if (approvalDecision.lifecycleStatus === "SUBMITTED") {
        await notifyCurrentStockEntryApprover(updated);
      }

      return {
        entry: await decorateStockEntriesWithApprovals(
          await hydrateStockEntriesWithCurrencyCodes(updated),
        ),
        lifecycleStatus: approvalDecision.lifecycleStatus,
      };
    }

    if (entry.sourceType !== "DIRECT") {
      throw Object.assign(
        new Error("This stock entry does not require approval."),
        { status: 400 },
      );
    }

    const updated = await prisma.stockEntry.update({
      where: { id: entryId },
      data: {
        status: "APPROVED",
        approvedById: user.id,
        approvedAt: new Date(),
      },
      include: stockEntryInclude,
    });

    emitToStore(entry.storeId || user.storeId, "stock:entry:approved", {
      id: updated.id,
      status: updated.status,
      storeId: entry.storeId || user.storeId,
    });

    return {
      entry: await decorateStockEntriesWithApprovals(
        await hydrateStockEntriesWithCurrencyCodes(updated),
      ),
      lifecycleStatus: "APPROVED",
    };
  }

  if (!approvalConfig.requiresApproval) {
    throw Object.assign(
      new Error("This stock entry does not use approval workflow."),
      { status: 400 },
    );
  }

  await decideDocumentApproval({
    tenantId,
    documentType: STOCK_ENTRY_DOCUMENT_TYPE,
    documentId: entryId,
    user,
    decision: "REJECTED",
    note,
  });

  const updated = await prisma.stockEntry.update({
    where: { id: entryId },
    data: {
      status: "PENDING",
      approvedById: null,
      approvedAt: null,
    },
    include: stockEntryInclude,
  });

  return {
    entry: await decorateStockEntriesWithApprovals(
      await hydrateStockEntriesWithCurrencyCodes(updated),
    ),
    lifecycleStatus: "REJECTED",
  };
};

const createStockEntry = async (req, res) => {
  const {
    sourceType,
    sourceId,
    storeId,
    storageZoneId,
    receiptNumber,
    operationType,
    note,
    items,
  } = req.body || {};

  if (!sourceType || !storageZoneId) {
    return res.status(400).json({ message: "sourceType and storageZoneId required." });
  }

  const normalizedOperationType = operationType === "OUT" ? "OUT" : "IN";
  let sourceItems = Array.isArray(items) ? items : [];

  if (sourceType === "DIRECT" && normalizedOperationType === "OUT" && sourceItems.length) {
    try {
      sourceItems = await expandArticleItems({
        tenantId: req.user.tenantId,
        items: sourceItems,
      });
    } catch (error) {
      return sendErrorResponse(res, error, "Invalid stock output.");
    }
  }

  if (normalizedOperationType === "IN" && sourceItems.length) {
    try {
      sourceItems = await ensureComponentItems({
        tenantId: req.user.tenantId,
        items: sourceItems,
        message:
          "Les entrees en stock doivent etre saisies sur des produits composants.",
      });
    } catch (error) {
      return sendErrorResponse(res, error, "Invalid stock entry.");
    }
  }

  let resolvedStoreId = storeId;
  let deliveryNotePayload = null;
  const currencySettings = await loadTenantCurrencySettings(
    prisma,
    req.user.tenantId,
  );

  if (isSeller(req.user) && !req.user.storeId) {
    return res.status(400).json({
      message: "Le vendeur doit etre rattache a une boutique pour creer un mouvement.",
    });
  }

  if (sourceType === "PURCHASE_ORDER") {
    if (!sourceId) {
      return res.status(400).json({
        message: "sourceId is required for purchase order stock entries.",
      });
    }

    if (!receiptNumber) {
      return res.status(400).json({
        message: "receiptNumber is required for purchase order receptions.",
      });
    }

    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: {
        id: sourceId,
        tenantId: req.user.tenantId,
      },
      include: {
        items: true,
        supplier: true,
      },
    });

    if (!purchaseOrder) {
      return res.status(404).json({ message: "Purchase order not found." });
    }

    if (purchaseOrder.status !== "SENT") {
      return res.status(400).json({
        message: "Only validated purchase orders can be received in stock.",
      });
    }

    if (!sourceItems.length) {
      sourceItems = purchaseOrder.items.map((item) => ({
        productId: item.productId,
        unitId: item.unitId,
        quantity: item.quantity,
        unitCost: item.unitPrice,
      }));
    }

    if (!sourceItems.length) {
      return res.status(400).json({
        message: "No items available to receive from this purchase order.",
      });
    }

    const normalizedItems = normalizeStockEntryItems(sourceItems, normalizedOperationType);

    if (hasQuantityMismatch(purchaseOrder.items, normalizedItems) && !note) {
      return res.status(400).json({
        message:
          "Add a description when the reception quantities differ from the purchase order.",
      });
    }

    resolvedStoreId = resolvedStoreId || purchaseOrder.storeId;
    deliveryNotePayload = {
      supplierId: purchaseOrder.supplierId,
      purchaseOrderId: purchaseOrder.id,
      code: receiptNumber,
      note,
      items: normalizedItems.map((item) => {
        const matchingItem = purchaseOrder.items.find(
          (orderItem) =>
            orderItem.productId === item.productId &&
            String(orderItem.unitId || "") === String(item.unitId || ""),
        );

        return {
          tenantId: req.user.tenantId,
          productId: item.productId,
          unitId: item.unitId,
          orderedQty: matchingItem?.quantity ?? Math.abs(item.quantity),
          deliveredQty: Math.abs(item.quantity),
        };
      }),
    };
  }

  if (!sourceItems.length) {
    return res.status(400).json({ message: "items array required." });
  }

  if (isSeller(req.user) && resolvedStoreId && resolvedStoreId !== req.user.storeId) {
    return res.status(403).json({
      message: "Le vendeur ne peut creer des mouvements que pour sa propre boutique.",
    });
  }

  if (isSeller(req.user)) {
    resolvedStoreId = req.user.storeId;
  }

  if (isSeller(req.user)) {
    const scopedZone = await prisma.storageZone.findFirst({
      where: {
        id: storageZoneId,
        tenantId: req.user.tenantId,
        storeId: req.user.storeId,
      },
      select: { id: true },
    });

    if (!scopedZone) {
      return res.status(403).json({
        message: "Le vendeur ne peut utiliser qu'une zone de sa propre boutique.",
      });
    }
  }

  const normalizedItems = normalizeStockEntryItems(sourceItems, normalizedOperationType);
  const hasNegativeItem = normalizedItems.some((item) => item.quantity < 0);
  const hasPositiveItem = normalizedItems.some((item) => item.quantity > 0);

  if (hasNegativeItem && hasPositiveItem) {
    return res.status(400).json({
      message: "All stock entry items must move in the same direction.",
    });
  }

  if (sourceType !== "DIRECT" && hasNegativeItem) {
    return res.status(400).json({
      message: "Only direct operations can create stock outputs.",
    });
  }

  await ensureInventoryLotTables();
  const approvalConfig = await getStockEntryApprovalConfig(
    req.user.tenantId,
    sourceType,
    normalizedOperationType,
  );
  const status = sourceType === "DIRECT" || approvalConfig.requiresApproval ? "PENDING" : "APPROVED";

  const entry = await prisma.stockEntry.create({
    data: {
      tenantId: req.user.tenantId,
      sourceType,
      sourceId,
      storeId: resolvedStoreId,
      storageZoneId,
      note,
      createdById: req.user.id,
      status,
      items: Array.isArray(sourceItems)
        ? {
            create: normalizedItems.map((item) => ({
              tenantId: req.user.tenantId,
              productId: item.productId,
              unitId: item.unitId,
              quantity: item.quantity,
              unitCost: item.unitCost,
            })),
          }
        : undefined,
    },
    include: { items: true },
  });
  await setCurrencyCodes(
    prisma,
    "stockEntryItems",
    (entry.items || []).map((item) => item.id),
    currencySettings.primaryCurrencyCode,
  );
  await setStockEntryItemLots(prisma, req.user.tenantId, entry.items || [], normalizedItems);
  if (approvalConfig.requiresApproval) {
    await prepareDocumentApprovals({
      tenantId: req.user.tenantId,
      documentType: STOCK_ENTRY_DOCUMENT_TYPE,
      documentId: entry.id,
      flowCodes: resolveStockEntryFlowCodes(sourceType, normalizedOperationType),
    });
    await notifyCurrentStockEntryApprover(
      await loadStockEntryById(req.user.tenantId, entry.id),
    );
  }

  if (deliveryNotePayload?.supplierId) {
    await prisma.deliveryNote.create({
      data: {
        tenantId: req.user.tenantId,
        supplierId: deliveryNotePayload.supplierId,
        purchaseOrderId: deliveryNotePayload.purchaseOrderId,
        code: deliveryNotePayload.code,
        note: deliveryNotePayload.note,
        receivedById: req.user.id,
        status: "PENDING",
        items: {
          create: deliveryNotePayload.items,
        },
      },
    });
  }

  if (entry.storeId) {
    emitToStore(entry.storeId, "stock:entry:created", {
      id: entry.id,
      status: entry.status,
      storeId: entry.storeId,
      sourceType: entry.sourceType,
    });
  }

  return res.status(201).json(
    await decorateStockEntriesWithApprovals({
      ...entry,
      items: (entry.items || []).map((item) => ({
        ...item,
        currencyCode: currencySettings.primaryCurrencyCode,
      })),
    }),
  );
};

const downloadStockEntryTemplate = async (_req, res) =>
  sendWorkbook(res, "template-entrees-directes-stock", [
    {
      name: STOCK_ENTRY_TEMPLATE_INFO_SHEET,
      rows: [
        {
          champ: "type entree",
          obligatoire: "Oui",
          exemple: "DIRECT",
          description: "Toujours DIRECT. Les imports depuis ce template ne creent que des entrees directes.",
        },
        {
          champ: "reference",
          obligatoire: "Oui",
          exemple: "ENT-2026-001",
          description: "Les lignes ayant la meme reference, boutique et zone seront regroupees dans une meme entree.",
        },
        {
          champ: "boutique",
          obligatoire: "Oui",
          exemple: "Boutique Gombe",
          description: "Nom exact de la boutique.",
        },
        {
          champ: "zone",
          obligatoire: "Oui",
          exemple: "Depot principal",
          description: "Nom exact de la zone de stockage rattachee a la boutique.",
        },
        {
          champ: "produit / code produit",
          obligatoire: "Oui",
          exemple: "Pain sandwich / PROD00001",
          description: "Renseignez au moins le nom ou le code produit du composant.",
        },
        {
          champ: "unite",
          obligatoire: "Non",
          exemple: "Piece",
          description: "Si vide, l'unite par defaut du produit sera utilisee.",
        },
        {
          champ: "qte",
          obligatoire: "Oui",
          exemple: "120",
          description: "Quantite positive uniquement.",
        },
        {
          champ: "cout unitaire",
          obligatoire: "Non",
          exemple: "0.35",
          description: "Cout unitaire de la ligne.",
        },
        {
          champ: "lot / date fabrication / date expiration",
          obligatoire: "Non",
          exemple: "LOT-PAIN-001 / 2026-05-26 / 2026-05-29",
          description: "Informations de lot si vous souhaitez tracer cette entree.",
        },
        {
          champ: "note",
          obligatoire: "Non",
          exemple: "Reception matinale",
          description: "Note commune aux lignes regroupees sous la meme reference.",
        },
      ],
    },
    {
      name: STOCK_ENTRY_TEMPLATE_SHEET,
      rows: [
        {
          "type entree": "DIRECT",
          reference: "ENT-2026-001",
          boutique: "Boutique Gombe",
          zone: "Depot principal",
          produit: "Pain sandwich",
          "code produit": "PROD00001",
          unite: "Piece",
          qte: 120,
          "cout unitaire": 0.35,
          lot: "LOT-PAIN-001",
          "date fabrication": "2026-05-26",
          "date expiration": "2026-05-29",
          note: "Reception matinale",
        },
        {
          "type entree": "DIRECT",
          reference: "ENT-2026-001",
          boutique: "Boutique Gombe",
          zone: "Depot principal",
          produit: "Saucisse fumee",
          "code produit": "PROD00002",
          unite: "Piece",
          qte: 120,
          "cout unitaire": 0.6,
          lot: "LOT-SAUC-001",
          "date fabrication": "2026-05-24",
          "date expiration": "2026-06-02",
          note: "Reception matinale",
        },
      ],
    },
  ]);

const importStockEntries = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Fichier Excel requis." });
  }

  if (isSeller(req.user) && !req.user.storeId) {
    return res.status(400).json({
      message: "Le vendeur doit etre rattache a une boutique pour importer des mouvements.",
    });
  }

  const currencySettings = await loadTenantCurrencySettings(
    prisma,
    req.user.tenantId,
  );

  try {
    const rows = readSheetRows(req.file.buffer, STOCK_ENTRY_TEMPLATE_SHEET);
    const groupedEntries = new Map();
    const errors = [];

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const entryType = pickFirstValue(row, [
        "type entree",
        "Type entree",
        "type",
        "Type",
        "sourceType",
        "SourceType",
      ]);
      const reference =
        pickFirstValue(row, ["reference", "Reference", "document", "Document"]) ||
        `IMPORT-${line}`;
      const storeName = pickFirstValue(row, ["boutique", "Boutique", "store", "Store"]);
      const zoneName = pickFirstValue(row, ["zone", "Zone", "zone stockage", "Zone stockage"]);
      const productCode = pickFirstValue(row, [
        "code produit",
        "Code produit",
        "sku",
        "SKU",
      ]);
      const productName = pickFirstValue(row, [
        "produit",
        "Produit",
        "product",
        "Product",
      ]);
      const unitName = pickFirstValue(row, ["unite", "Unite", "unit", "Unit"]);
      const quantity = parseRequiredPositiveNumber(
        pickFirstValue(row, ["qte", "Qte", "quantite", "Quantite", "quantity", "Quantity"]),
      );

      if (entryType && String(entryType).trim().toUpperCase() !== "DIRECT") {
        errors.push({
          line,
          identifier: reference,
          message:
            "Seules les entrees directes sont autorisees dans ce template. Utilisez DIRECT.",
        });
        continue;
      }

      if (!storeName || !zoneName || (!productCode && !productName) || quantity === null) {
        if (Object.values(row || {}).some((value) => String(value || "").trim() !== "")) {
          errors.push({
            line,
            identifier: productCode || productName || reference,
            message:
              "Boutique, zone, produit et quantite positive sont requis pour chaque ligne.",
          });
        }
        continue;
      }

      const store = await prisma.store.findFirst({
        where: {
          tenantId: req.user.tenantId,
          name: { equals: storeName, mode: "insensitive" },
        },
        select: { id: true, name: true },
      });

      if (!store) {
        errors.push({
          line,
          identifier: reference,
          message: `Boutique introuvable: ${storeName}.`,
        });
        continue;
      }

      if (isSeller(req.user) && store.id !== req.user.storeId) {
        errors.push({
          line,
          identifier: reference,
          message: "Le vendeur ne peut importer que pour sa propre boutique.",
        });
        continue;
      }

      const zone = await prisma.storageZone.findFirst({
        where: {
          tenantId: req.user.tenantId,
          storeId: store.id,
          name: { equals: zoneName, mode: "insensitive" },
        },
        select: { id: true, name: true, storeId: true },
      });

      if (!zone) {
        errors.push({
          line,
          identifier: reference,
          message: `Zone introuvable dans ${store.name}: ${zoneName}.`,
        });
        continue;
      }

      const product = await prisma.product.findFirst({
        where: {
          tenantId: req.user.tenantId,
          kind: "COMPONENT",
          isActive: true,
          OR: [
            ...(productCode
              ? [{ sku: { equals: productCode, mode: "insensitive" } }]
              : []),
            ...(productName
              ? [{ name: { equals: productName, mode: "insensitive" } }]
              : []),
          ],
        },
        select: {
          id: true,
          name: true,
          sku: true,
          saleUnitId: true,
          stockUnitId: true,
        },
      });

      if (!product) {
        errors.push({
          line,
          identifier: productCode || productName,
          message: "Produit composant introuvable.",
        });
        continue;
      }

      let unitId = product.saleUnitId || product.stockUnitId || null;
      if (unitName) {
        const unit = await prisma.unitOfMeasure.findFirst({
          where: {
            tenantId: req.user.tenantId,
            OR: [
              { name: { equals: unitName, mode: "insensitive" } },
              { symbol: { equals: unitName, mode: "insensitive" } },
            ],
          },
          select: { id: true },
        });
        if (!unit) {
          errors.push({
            line,
            identifier: product.sku || product.name,
            message: `Unite introuvable: ${unitName}.`,
          });
          continue;
        }
        unitId = unit.id;
      }

      if (!unitId) {
        errors.push({
          line,
          identifier: product.sku || product.name,
          message:
            "Aucune unite exploitable n'a ete trouvee pour ce produit.",
        });
        continue;
      }

      const groupKey = `${reference}::${store.id}::${zone.id}`;
      const currentGroup = groupedEntries.get(groupKey) || {
        reference,
        storeId: store.id,
        storageZoneId: zone.id,
        note:
          pickFirstValue(row, ["note", "Note", "commentaire", "Commentaire"]) ||
          null,
        rows: [],
      };

      currentGroup.rows.push({
        line,
        productId: product.id,
        unitId,
        quantity,
        unitCost: Number(
          pickFirstValue(row, [
            "cout unitaire",
            "Cout unitaire",
            "unitCost",
            "UnitCost",
          ]) || 0,
        ),
        batchNumber:
          pickFirstValue(row, ["lot", "Lot", "batch", "Batch"]) || null,
        expiryDate: parseOptionalDate(
          pickFirstValue(row, [
            "date expiration",
            "Date expiration",
            "expiryDate",
            "ExpiryDate",
          ]),
        ),
        manufacturedAt: parseOptionalDate(
          pickFirstValue(row, [
            "date fabrication",
            "Date fabrication",
            "manufacturedAt",
            "ManufacturedAt",
          ]),
        ),
      });

      groupedEntries.set(groupKey, currentGroup);
    }

    let created = 0;

    for (const [, group] of groupedEntries.entries()) {
      try {
        const scopedItems = await ensureComponentItems({
          tenantId: req.user.tenantId,
          items: group.rows,
          message:
            "Les entrees en stock doivent etre saisies sur des produits composants.",
        });
        const normalizedItems = normalizeStockEntryItems(scopedItems, "IN");
        await ensureInventoryLotTables();
        const approvalConfig = await getStockEntryApprovalConfig(
          req.user.tenantId,
          "DIRECT",
          "IN",
        );
        const entry = await prisma.stockEntry.create({
          data: {
            tenantId: req.user.tenantId,
            sourceType: "DIRECT",
            sourceId: null,
            storeId: group.storeId,
            storageZoneId: group.storageZoneId,
            note: group.note || `Import Excel ${group.reference}`,
            createdById: req.user.id,
            status: "PENDING",
            items: {
              create: normalizedItems.map((item) => ({
                tenantId: req.user.tenantId,
                productId: item.productId,
                unitId: item.unitId,
                quantity: item.quantity,
                unitCost: item.unitCost,
              })),
            },
          },
          include: { items: true },
        });

        await setCurrencyCodes(
          prisma,
          "stockEntryItems",
          (entry.items || []).map((item) => item.id),
          currencySettings.primaryCurrencyCode,
        );
        await setStockEntryItemLots(
          prisma,
          req.user.tenantId,
          entry.items || [],
          normalizedItems,
        );

        if (approvalConfig.requiresApproval) {
          await prepareDocumentApprovals({
            tenantId: req.user.tenantId,
            documentType: STOCK_ENTRY_DOCUMENT_TYPE,
            documentId: entry.id,
            flowCodes: resolveStockEntryFlowCodes("DIRECT", "IN"),
          });
          await notifyCurrentStockEntryApprover(await loadStockEntryById(req.user.tenantId, entry.id));
        }

        if (entry.storeId) {
          emitToStore(entry.storeId, "stock:entry:created", {
            id: entry.id,
            status: entry.status,
            storeId: entry.storeId,
            sourceType: entry.sourceType,
          });
        }

        created += 1;
      } catch (error) {
        group.rows.forEach((row) => {
          errors.push({
            line: row.line,
            identifier: group.reference,
            message: error.message || "Impossible de creer cette entree de stock.",
          });
        });
      }
    }

    return res.json({
      message: "Import des entrees en stock termine.",
      created,
      failed: errors.length,
      errors,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Impossible d'importer les entrees en stock.",
    });
  }
};

const listStockEntries = async (req, res) => {
  const {
    status,
    sourceType,
    operationType,
    storeId,
    storageZoneId,
    createdById,
    approvedById,
  } = req.query || {};
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);

  const searchFilter = search
    ? {
        OR: [
          { note: contains(search) },
          { storageZone: { name: contains(search) } },
          { store: { name: contains(search) } },
          { createdBy: { firstName: contains(search) } },
          { createdBy: { lastName: contains(search) } },
          { approvedBy: { firstName: contains(search) } },
          { approvedBy: { lastName: contains(search) } },
        ],
      }
    : {};

  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const where = {
    tenantId: req.user.tenantId,
    ...(status ? { status } : {}),
    ...(sourceType ? { sourceType } : {}),
    ...(operationType === "OUT"
      ? { items: { some: { quantity: { lt: 0 } } } }
      : operationType === "IN"
        ? { items: { some: { quantity: { gt: 0 } } } }
        : {}),
    ...(isSeller(req.user)
      ? {
          createdById: req.user.id,
          ...(req.user.storeId ? { storeId: req.user.storeId } : {}),
        }
      : storeId
        ? { storeId }
        : {}),
    ...(storageZoneId ? { storageZoneId } : {}),
    ...(isSeller(req.user) ? {} : createdById ? { createdById } : {}),
    ...(approvedById ? { approvedById } : {}),
    ...createdAtFilter,
    ...searchFilter,
  };

  const orderBy =
    buildOrderBy(sortBy, sortDir, {
      createdAt: "createdAt",
      status: "status",
      sourceType: "sourceType",
      approvedAt: "approvedAt",
      postedAt: "postedAt",
    }) || { createdAt: "desc" };

  if (exportType) {
    const data = await prisma.stockEntry.findMany({
      where,
      include: {
        store: true,
        storageZone: true,
        createdBy: true,
        approvedBy: true,
        items: true,
      },
      orderBy,
    });

    const rows = data.map((entry) => ({
      id: entry.id,
      sourceType: entry.sourceType,
      status: entry.status,
      store: entry.store?.name || "",
      storageZone: entry.storageZone?.name || "",
      itemsCount: entry.items?.length || 0,
      createdBy: [entry.createdBy?.firstName, entry.createdBy?.lastName]
        .filter(Boolean)
        .join(" "),
      approvedBy: [entry.approvedBy?.firstName, entry.approvedBy?.lastName]
        .filter(Boolean)
        .join(" "),
      createdAt: entry.createdAt,
      approvedAt: entry.approvedAt,
      postedAt: entry.postedAt,
    }));

    return sendExport(res, rows, "stock-entries", exportType);
  }

  if (!paginate) {
    const entries = await prisma.stockEntry.findMany({
      where,
      include: {
        store: true,
        storageZone: true,
        createdBy: true,
        approvedBy: true,
        items: { include: { product: true, unit: true } },
      },
      orderBy,
    });

    return res.json(
      await decorateStockEntriesWithApprovals(
        await hydrateStockEntriesWithCurrencyCodes(entries),
      ),
    );
  }

  const [total, entries] = await prisma.$transaction([
    prisma.stockEntry.count({ where }),
    prisma.stockEntry.findMany({
      where,
      include: {
        store: true,
        storageZone: true,
        createdBy: true,
        approvedBy: true,
        items: { include: { product: true, unit: true } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return res.json({
    data: await decorateStockEntriesWithApprovals(
      await hydrateStockEntriesWithCurrencyCodes(entries),
    ),
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const getStockEntry = async (req, res) => {
  const { id } = req.params;

  const entry = await prisma.stockEntry.findFirst({
    where: {
      id,
      tenantId: req.user.tenantId,
      ...(isSeller(req.user)
        ? {
            createdById: req.user.id,
            ...(req.user.storeId ? { storeId: req.user.storeId } : {}),
          }
        : {}),
    },
    include: {
      store: true,
      storageZone: true,
      createdBy: true,
      approvedBy: true,
      items: { include: { product: true, unit: true } },
    },
  });

  if (!entry) {
    return res.status(404).json({ message: "Stock entry not found." });
  }

  return res.json(
    await decorateStockEntriesWithApprovals(
      await hydrateStockEntriesWithCurrencyCodes(entry),
    ),
  );
};

const getStockEntryPdf = async (req, res) => {
  const { id } = req.params;

  const entry = await prisma.stockEntry.findFirst({
    where: {
      id,
      tenantId: req.user.tenantId,
      ...(isSeller(req.user)
        ? {
            createdById: req.user.id,
            ...(req.user.storeId ? { storeId: req.user.storeId } : {}),
          }
        : {}),
    },
    include: {
      store: true,
      storageZone: true,
      createdBy: true,
      approvedBy: true,
      items: { include: { product: true, unit: true } },
    },
  });

  if (!entry) {
    return res.status(404).json({ message: "Stock entry not found." });
  }

  const hydratedEntry = await hydrateStockEntriesWithCurrencyCodes(entry);
  const currencySettings = await loadTenantCurrencySettings(
    prisma,
    req.user.tenantId,
  );
  const pdfBuffer = await buildStockEntryPdf(
    hydratedEntry,
    currencySettings,
    req.user.tenantName,
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="stock-entry-${id}.pdf"`,
  );

  return res.send(pdfBuffer);
};

const updateStockEntry = async (req, res) => {
  const { id } = req.params;
  const {
    sourceId,
    storeId,
    storageZoneId,
    note,
    items,
    operationType,
  } = req.body || {};

  const entry = await prisma.stockEntry.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });

  if (!entry) {
    return res.status(404).json({ message: "Stock entry not found." });
  }

  const canUpdate = hasScopedPermission({
    user: req.user,
    fullPermission: "movements.update",
    ownPermission: "movements.update_own_draft",
    ownerId: entry.createdById,
    status: entry.status,
    allowedStatuses: ["PENDING"],
  });

  if (!canUpdate) {
    return res.status(403).json({
      message: "Vous n'avez pas la permission de modifier ce mouvement.",
    });
  }

  if (isSeller(req.user) && entry.createdById !== req.user.id) {
    return res.status(403).json({
      message: "Le vendeur ne peut modifier que ses propres mouvements.",
    });
  }

  if (!(await canModifyStockEntry(req.user.tenantId, entry))) {
    return res.status(400).json({
      message: "Only pending direct stock entries can be edited.",
    });
  }

  await resetStockEntryApprovals(req.user.tenantId, id);

  if (!storageZoneId) {
    return res.status(400).json({ message: "storageZoneId required." });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "items array required." });
  }

  if (isSeller(req.user)) {
    if (storeId && storeId !== req.user.storeId) {
      return res.status(403).json({
        message: "Le vendeur ne peut modifier des mouvements que pour sa propre boutique.",
      });
    }

    const scopedZone = await prisma.storageZone.findFirst({
      where: {
        id: storageZoneId,
        tenantId: req.user.tenantId,
        storeId: req.user.storeId,
      },
      select: { id: true },
    });

    if (!scopedZone) {
      return res.status(403).json({
        message: "Le vendeur ne peut utiliser qu'une zone de sa propre boutique.",
      });
    }
  }

  let sourceItems = items;
  if (operationType === "OUT") {
    try {
      sourceItems = await expandArticleItems({
        tenantId: req.user.tenantId,
        items,
      });
    } catch (error) {
      return sendErrorResponse(res, error, "Invalid stock entry.");
    }
  }

  if (operationType !== "OUT") {
    try {
      sourceItems = await ensureComponentItems({
        tenantId: req.user.tenantId,
        items: sourceItems,
        message:
          "Les entrees en stock doivent etre saisies sur des produits composants.",
      });
    } catch (error) {
      return sendErrorResponse(res, error, "Invalid stock entry.");
    }
  }

  const normalizedItems = normalizeStockEntryItems(
    sourceItems,
    operationType === "OUT" ? "OUT" : "IN",
  );
  await ensureInventoryLotTables();
  const currencySettings = await loadTenantCurrencySettings(
    prisma,
    req.user.tenantId,
  );

  await prisma.stockEntryItem.deleteMany({
    where: { stockEntryId: id },
  });

  const updated = await prisma.stockEntry.update({
    where: { id },
    data: {
      sourceId,
      storeId: isSeller(req.user) ? req.user.storeId : storeId,
      storageZoneId,
      note,
      items: {
        create: normalizedItems.map((item) => ({
          tenantId: req.user.tenantId,
          productId: item.productId,
          unitId: item.unitId,
          quantity: item.quantity,
          unitCost: item.unitCost,
        })),
      },
    },
    include: {
      store: true,
      storageZone: true,
      createdBy: true,
      approvedBy: true,
      items: { include: { product: true, unit: true } },
    },
  });
  await setCurrencyCodes(
    prisma,
    "stockEntryItems",
    (updated.items || []).map((item) => item.id),
    currencySettings.primaryCurrencyCode,
  );
  await setStockEntryItemLots(prisma, req.user.tenantId, updated.items || [], normalizedItems);

  return res.json(
    await decorateStockEntriesWithApprovals({
      ...updated,
      items: (updated.items || []).map((item) => ({
        ...item,
        currencyCode: currencySettings.primaryCurrencyCode,
      })),
    }),
  );
};

const deleteStockEntry = async (req, res) => {
  const { id } = req.params;

  const entry = await prisma.stockEntry.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });

  if (!entry) {
    return res.status(404).json({ message: "Stock entry not found." });
  }

  const canDelete = hasScopedPermission({
    user: req.user,
    fullPermission: "movements.delete",
    ownPermission: "movements.delete_own_draft",
    ownerId: entry.createdById,
    status: entry.status,
    allowedStatuses: ["PENDING"],
  });

  if (!canDelete) {
    return res.status(403).json({
      message: "Vous n'avez pas la permission de supprimer ce mouvement.",
    });
  }

  if (isSeller(req.user) && entry.createdById !== req.user.id) {
    return res.status(403).json({
      message: "Le vendeur ne peut supprimer que ses propres mouvements.",
    });
  }

  if (!(await canModifyStockEntry(req.user.tenantId, entry))) {
    return res.status(400).json({
      message: "Only pending direct stock entries can be deleted.",
    });
  }

  await prisma.stockEntry.delete({ where: { id } });
  return res.json({ message: "Stock entry deleted." });
};

const devalidateStockEntry = async (req, res) => {
  const { id } = req.params;

  const entry = await prisma.stockEntry.findFirst({
    where: { id, tenantId: req.user.tenantId },
    include: {
      store: true,
      storageZone: true,
      createdBy: true,
      approvedBy: true,
      items: { include: { product: true, unit: true } },
    },
  });

  if (!entry) {
    return res.status(404).json({ message: "Stock entry not found." });
  }

  if (entry.status === "POSTED") {
    return res.status(409).json({
      message: "A posted stock entry cannot be devalidated.",
    });
  }

  if (!["PENDING", "APPROVED"].includes(entry.status)) {
    return res.status(409).json({
      message: "This stock entry cannot be devalidated in its current state.",
    });
  }

  await resetStockEntryApprovals(req.user.tenantId, id);

  const updated = await prisma.stockEntry.update({
    where: { id },
    data: {
      status: "PENDING",
      approvedById: null,
      postedAt: null,
    },
    include: {
      store: true,
      storageZone: true,
      createdBy: true,
      approvedBy: true,
      items: { include: { product: true, unit: true } },
    },
  });

  const currencySettings = await loadTenantCurrencySettings(
    prisma,
    req.user.tenantId,
  );

  return res.json(
    await decorateStockEntriesWithApprovals({
      ...updated,
      items: (updated.items || []).map((item) => ({
        ...item,
        currencyCode: currencySettings.primaryCurrencyCode,
      })),
    }),
  );
};

const approveStockEntry = async (req, res) => {
  const { id } = req.params;
  const note = req.body?.note || null;

  if (isSeller(req.user)) {
    return res.status(403).json({
      message: "Le vendeur ne peut pas valider un mouvement de stock.",
    });
  }

  try {
    const result = await processStockEntryApprovalDecision({
      tenantId: req.user.tenantId,
      entryId: id,
      user: req.user,
      decision: "APPROVED",
      note,
    });
    return res.json(result.entry);
  } catch (error) {
    return sendErrorResponse(
      res,
      error,
      "Impossible de valider cette entree de stock.",
    );
  }
};

const rejectStockEntry = async (req, res) => {
  const { id } = req.params;
  const note = req.body?.note || null;

  if (isSeller(req.user)) {
    return res.status(403).json({
      message: "Le vendeur ne peut pas rejeter un mouvement de stock.",
    });
  }

  try {
    const result = await processStockEntryApprovalDecision({
      tenantId: req.user.tenantId,
      entryId: id,
      user: req.user,
      decision: "REJECTED",
      note,
    });
    return res.json(result.entry);
  } catch (error) {
    return sendErrorResponse(
      res,
      error,
      "Impossible de rejeter cette entree de stock.",
    );
  }
};

const postStockEntry = async (req, res) => {
  const { id } = req.params;

  if (isSeller(req.user)) {
    return res.status(403).json({
      message: "Le vendeur ne peut pas poster un mouvement de stock.",
    });
  }

  const entry = await prisma.stockEntry.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!entry || entry.tenantId !== req.user.tenantId) {
    return res.status(404).json({ message: "Stock entry not found." });
  }

  if (entry.status === "POSTED") {
    return res.status(400).json({ message: "Stock entry already posted." });
  }

  if (entry.status !== "APPROVED") {
    return res.status(403).json({ message: "Stock entry must be approved first." });
  }

  const storageZone = await prisma.storageZone.findUnique({
    where: { id: entry.storageZoneId },
  });

  if (!storageZone) {
    return res.status(400).json({ message: "Invalid storageZoneId." });
  }
  if (!storageZone.storeId) {
    return res.status(400).json({ message: "Storage zone must be linked to a store." });
  }

  for (const item of entry.items) {
    const quantity = toNumber(item.quantity);
    const movementType = quantity >= 0 ? "IN" : "OUT";
    const absoluteQuantity = Math.abs(quantity);
    const [lotMeta] = await attachStockEntryLots([item]);

    const existingInventory = await prisma.inventory.findUnique({
      where: {
        storageZoneId_productId: {
          storageZoneId: entry.storageZoneId,
          productId: item.productId,
        },
      },
    });

    if (quantity < 0 && (!existingInventory || toNumber(existingInventory.quantity) < absoluteQuantity)) {
      return res.status(400).json({
        message: "Insufficient stock to post this direct output.",
      });
    }

    if (quantity >= 0) {
      await incrementInventoryLot(prisma, {
        tenantId: entry.tenantId,
        storeId: storageZone.storeId,
        storageZoneId: entry.storageZoneId,
        productId: item.productId,
        quantity: absoluteQuantity,
        batchNumber: lotMeta?.batchNumber || null,
        expiryDate: lotMeta?.expiryDate || null,
        manufacturedAt: lotMeta?.manufacturedAt || null,
        unitCost: item.unitCost,
      });
    } else {
      await consumeInventoryLotsFefo(prisma, {
        tenantId: entry.tenantId,
        storeId: storageZone.storeId,
        storageZoneId: entry.storageZoneId,
        productId: item.productId,
        quantity: absoluteQuantity,
      });
    }

    await prisma.inventoryMovement.create({
      data: {
        tenantId: entry.tenantId,
        productId: item.productId,
        storageZoneId: entry.storageZoneId,
        quantity: absoluteQuantity,
        movementType,
        sourceType: entry.sourceType,
        sourceId: entry.id,
        createdById: req.user.id,
      },
    });
  }

  const updated = await prisma.stockEntry.update({
    where: { id },
    data: { status: "POSTED", postedAt: new Date() },
  });

  if (storageZone.storeId) {
    emitToStore(storageZone.storeId, "stock:entry:posted", {
      id: updated.id,
      status: updated.status,
      storeId: storageZone.storeId,
    });
  }

  await emitLotExpiryNotifications(entry.tenantId);

  return res.json(updated);
};

module.exports = {
  downloadStockEntryTemplate,
  importStockEntries,
  listStockEntries,
  getStockEntry,
  getStockEntryPdf,
  createStockEntry,
  updateStockEntry,
  deleteStockEntry,
  approveStockEntry,
  rejectStockEntry,
  devalidateStockEntry,
  postStockEntry,
  processStockEntryApprovalDecision,
};
