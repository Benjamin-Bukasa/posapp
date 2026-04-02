const prisma = require("../config/prisma");
const { loadTenantCurrencySettings } = require("../utils/currencySettings");
const {
  attachCurrencyCodes,
  getCurrencyCodeMap,
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
const { emitToStore } = require("../socket");
const { buildStockEntryPdf } = require("../services/stockEntryPdf");
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
  decideDocumentApproval,
} = require("../utils/documentApprovalStore");
const {
  expandArticleItems,
  ensureComponentItems,
} = require("../utils/expandArticleItems");

const toNumber = (value) => Number(value || 0);
const STOCK_ENTRY_DOCUMENT_TYPE = "STOCK_ENTRY";

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
  const approvals = await getDocumentApprovals(tenantId, STOCK_ENTRY_DOCUMENT_TYPE, entry.id);
  return !approvals.length || approvals.some((item) => item.status === "REJECTED");
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

  const itemCurrencyMap = await getCurrencyCodeMap(
    prisma,
    "stockEntryItems",
    list.flatMap((entry) => entry.items || []).map((item) => item.id),
  );

  const hydrated = list.map((entry) => ({
    ...entry,
    items: attachCurrencyCodes(entry.items || [], itemCurrencyMap),
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
      return res.status(error.status || 500).json({
        message: error.message || "Invalid stock output.",
      });
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
      return res.status(error.status || 500).json({
        message: error.message || "Invalid stock entry.",
      });
    }
  }

  let resolvedStoreId = storeId;
  let deliveryNotePayload = null;
  const currencySettings = await loadTenantCurrencySettings(
    prisma,
    req.user.tenantId,
  );

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

const listStockEntries = async (req, res) => {
  const {
    status,
    sourceType,
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
    ...(storeId ? { storeId } : {}),
    ...(storageZoneId ? { storageZoneId } : {}),
    ...(createdById ? { createdById } : {}),
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

  return res.json(
    await decorateStockEntriesWithApprovals(
      await hydrateStockEntriesWithCurrencyCodes(entry),
    ),
  );
};

const getStockEntryPdf = async (req, res) => {
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

  if (!(await canModifyStockEntry(req.user.tenantId, entry))) {
    return res.status(400).json({
      message: "Only pending direct stock entries can be edited.",
    });
  }

  if (!storageZoneId) {
    return res.status(400).json({ message: "storageZoneId required." });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "items array required." });
  }

  let sourceItems = items;
  if (operationType === "OUT") {
    try {
      sourceItems = await expandArticleItems({
        tenantId: req.user.tenantId,
        items,
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        message: error.message || "Invalid stock entry.",
      });
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
      return res.status(error.status || 500).json({
        message: error.message || "Invalid stock entry.",
      });
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
      storeId,
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

  if (!(await canModifyStockEntry(req.user.tenantId, entry))) {
    return res.status(400).json({
      message: "Only pending direct stock entries can be deleted.",
    });
  }

  await prisma.stockEntry.delete({ where: { id } });
  return res.json({ message: "Stock entry deleted." });
};

const approveStockEntry = async (req, res) => {
  const { id } = req.params;
  const note = req.body?.note || null;

  const entry = await prisma.stockEntry.findUnique({
    where: { id },
    include: {
      store: true,
      storageZone: true,
      createdBy: true,
      approvedBy: true,
      items: { include: { product: true, unit: true } },
    },
  });
  if (!entry || entry.tenantId !== req.user.tenantId) {
    return res.status(404).json({ message: "Stock entry not found." });
  }

  const approvalConfig = await getStockEntryApprovalConfig(
    req.user.tenantId,
    entry.sourceType,
    getStockEntryOperationType(entry),
  );

  if (approvalConfig.requiresApproval) {
    try {
      const decision = await decideDocumentApproval({
        tenantId: req.user.tenantId,
        documentType: STOCK_ENTRY_DOCUMENT_TYPE,
        documentId: id,
        user: req.user,
        decision: "APPROVED",
        note,
      });

      let updated = entry;
      if (decision.lifecycleStatus === "APPROVED" && entry.status !== "APPROVED") {
        updated = await prisma.stockEntry.update({
          where: { id },
          data: {
            status: "APPROVED",
            approvedById: req.user.id,
            approvedAt: new Date(),
          },
          include: {
            store: true,
            storageZone: true,
            createdBy: true,
            approvedBy: true,
            items: { include: { product: true, unit: true } },
          },
        });

        emitToStore(entry.storeId || req.user.storeId, "stock:entry:approved", {
          id: updated.id,
          status: updated.status,
          storeId: entry.storeId || req.user.storeId,
        });
      }

      return res.json(
        await decorateStockEntriesWithApprovals(
          await hydrateStockEntriesWithCurrencyCodes(updated),
        ),
      );
    } catch (error) {
      return res.status(error.status || 500).json({
        message: error.message || "Impossible de valider cette entree de stock.",
      });
    }
  }

  if (entry.sourceType !== "DIRECT") {
    return res.status(400).json({ message: "This stock entry does not require approval." });
  }

  const updated = await prisma.stockEntry.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedById: req.user.id,
      approvedAt: new Date(),
    },
  });

  emitToStore(entry.storeId || req.user.storeId, "stock:entry:approved", {
    id: updated.id,
    status: updated.status,
    storeId: entry.storeId || req.user.storeId,
  });

  return res.json(
    await decorateStockEntriesWithApprovals(
      await hydrateStockEntriesWithCurrencyCodes(updated),
    ),
  );
};

const rejectStockEntry = async (req, res) => {
  const { id } = req.params;
  const note = req.body?.note || null;

  const entry = await prisma.stockEntry.findUnique({
    where: { id },
    include: {
      store: true,
      storageZone: true,
      createdBy: true,
      approvedBy: true,
      items: { include: { product: true, unit: true } },
    },
  });
  if (!entry || entry.tenantId !== req.user.tenantId) {
    return res.status(404).json({ message: "Stock entry not found." });
  }

  const approvalConfig = await getStockEntryApprovalConfig(
    req.user.tenantId,
    entry.sourceType,
    getStockEntryOperationType(entry),
  );
  if (!approvalConfig.requiresApproval) {
    return res.status(400).json({ message: "This stock entry does not use approval workflow." });
  }

  try {
    await decideDocumentApproval({
      tenantId: req.user.tenantId,
      documentType: STOCK_ENTRY_DOCUMENT_TYPE,
      documentId: id,
      user: req.user,
      decision: "REJECTED",
      note,
    });

    const updated = await prisma.stockEntry.update({
      where: { id },
      data: {
        status: "PENDING",
        approvedById: null,
        approvedAt: null,
      },
      include: {
        store: true,
        storageZone: true,
        createdBy: true,
        approvedBy: true,
        items: { include: { product: true, unit: true } },
      },
    });

    return res.json(
      await decorateStockEntriesWithApprovals(
        await hydrateStockEntriesWithCurrencyCodes(updated),
      ),
    );
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de rejeter cette entree de stock.",
    });
  }
};

const postStockEntry = async (req, res) => {
  const { id } = req.params;

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
  listStockEntries,
  getStockEntry,
  getStockEntryPdf,
  createStockEntry,
  updateStockEntry,
  deleteStockEntry,
  approveStockEntry,
  rejectStockEntry,
  postStockEntry,
};
