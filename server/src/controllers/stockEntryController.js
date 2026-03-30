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

const toNumber = (value) => Number(value || 0);

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

  return Array.isArray(records) ? hydrated : hydrated[0];
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
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "items array required." });
  }

  const normalizedOperationType = operationType === "OUT" ? "OUT" : "IN";
  const normalizedItems = normalizeStockEntryItems(items, normalizedOperationType);
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

  const status = sourceType === "DIRECT" ? "PENDING" : "APPROVED";

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
      items: Array.isArray(items)
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

  return res.status(201).json({
    ...entry,
    items: (entry.items || []).map((item) => ({
      ...item,
      currencyCode: currencySettings.primaryCurrencyCode,
    })),
  });
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

    return res.json(await hydrateStockEntriesWithCurrencyCodes(entries));
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
    data: await hydrateStockEntriesWithCurrencyCodes(entries),
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

  return res.json(await hydrateStockEntriesWithCurrencyCodes(entry));
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

  if (entry.status !== "PENDING") {
    return res.status(400).json({
      message: "Only pending direct stock entries can be edited.",
    });
  }

  if (entry.sourceType !== "DIRECT") {
    return res.status(400).json({
      message: "Only direct stock entries can be edited.",
    });
  }

  if (!storageZoneId) {
    return res.status(400).json({ message: "storageZoneId required." });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "items array required." });
  }

  const normalizedItems = normalizeStockEntryItems(items, operationType === "OUT" ? "OUT" : "IN");
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

  return res.json({
    ...updated,
    items: (updated.items || []).map((item) => ({
      ...item,
      currencyCode: currencySettings.primaryCurrencyCode,
    })),
  });
};

const deleteStockEntry = async (req, res) => {
  const { id } = req.params;

  const entry = await prisma.stockEntry.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });

  if (!entry) {
    return res.status(404).json({ message: "Stock entry not found." });
  }

  if (entry.status !== "PENDING" || entry.sourceType !== "DIRECT") {
    return res.status(400).json({
      message: "Only pending direct stock entries can be deleted.",
    });
  }

  await prisma.stockEntry.delete({ where: { id } });
  return res.json({ message: "Stock entry deleted." });
};

const approveStockEntry = async (req, res) => {
  const { id } = req.params;

  const entry = await prisma.stockEntry.findUnique({ where: { id } });
  if (!entry || entry.tenantId !== req.user.tenantId) {
    return res.status(404).json({ message: "Stock entry not found." });
  }

  if (entry.sourceType !== "DIRECT") {
    return res.status(400).json({ message: "Only DIRECT entries require approval." });
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

  return res.json(updated);
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

  if (entry.sourceType === "DIRECT" && entry.status !== "APPROVED") {
    return res.status(403).json({ message: "Direct entry must be approved first." });
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

    await prisma.inventory.upsert({
      where: {
        storageZoneId_productId: {
          storageZoneId: entry.storageZoneId,
          productId: item.productId,
        },
      },
      create: {
        tenantId: entry.tenantId,
        storeId: storageZone.storeId,
        storageZoneId: entry.storageZoneId,
        productId: item.productId,
        quantity,
      },
      update: {
        quantity: { increment: quantity },
      },
    });

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
  postStockEntry,
};
