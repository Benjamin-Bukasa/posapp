const prisma = require("../config/prisma");
const {
  parseListParams,
  buildOrderBy,
  contains,
  buildMeta,
  buildDateRangeFilter,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const {
  ensureInventoryLotTables,
  listInventoryLots,
  incrementInventoryLot,
  consumeInventoryLotsFefo,
  setInventoryLotQuantity,
  materializeResidualUntrackedLot,
  emitLotExpiryNotifications,
} = require("../utils/inventoryLotStore");

const toNumber = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const getExpiryStatus = (expiryDate) => {
  if (!expiryDate) return "SANS_DATE";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(expiryDate);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((target.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "EXPIRE";
  if (diffDays <= 30) return "EXPIRE_BIENTOT";
  return "OK";
};

const listInventory = async (req, res) => {
  const { storeId, storageZoneId, zoneType, productId, detailed, expiryStatus } = req.query || {};
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const updatedAtFilter = buildDateRangeFilter(
    req.query,
    "updatedAt"
  );

  if (String(detailed).toLowerCase() === "true" || String(detailed).toLowerCase() === "lots") {
    await ensureInventoryLotTables();
    const aggregateRows = await prisma.inventory.findMany({
      where: {
        tenantId: req.user.tenantId,
        ...(storeId ? { storeId } : {}),
        ...(storageZoneId ? { storageZoneId } : {}),
        ...(productId ? { productId } : {}),
      },
      select: {
        storeId: true,
        storageZoneId: true,
        productId: true,
      },
    });
    await prisma.$transaction(async (tx) => {
      for (const row of aggregateRows) {
        await materializeResidualUntrackedLot(tx, {
          tenantId: req.user.tenantId,
          storeId: row.storeId,
          storageZoneId: row.storageZoneId,
          productId: row.productId,
        });
      }
    });
    const lotRows = await listInventoryLots({
      tenantId: req.user.tenantId,
      storeId,
      storageZoneId,
      productId,
      search,
    });

    const filteredRows = lotRows
      .filter((row) => (zoneType ? row.storageZone?.zoneType === zoneType : true))
      .filter((row) => {
        const updatedAt = row.updatedAt ? new Date(row.updatedAt) : null;
        const after = req.query.updatedFrom ? new Date(req.query.updatedFrom) : null;
        const before = req.query.updatedTo ? new Date(req.query.updatedTo) : null;
        if (updatedAt && after && updatedAt < after) return false;
        if (updatedAt && before && updatedAt > before) return false;
        return true;
      })
      .map((row) => {
        const expiryStatus = getExpiryStatus(row.expiryDate);
        return {
          ...row,
          expiryStatus,
          daysToExpiry:
            row.expiryDate == null
              ? null
              : Math.ceil(
                  (new Date(row.expiryDate).getTime() - new Date().setHours(0, 0, 0, 0)) /
                    86400000,
                ),
          minLevel: row.product?.minLevel ?? 0,
        };
      })
      .filter((row) =>
        expiryStatus ? String(row.expiryStatus || "").toUpperCase() === String(expiryStatus).toUpperCase() : true,
      );

    const compareMap = {
      updatedAt: (row) => new Date(row.updatedAt || 0).getTime(),
      quantity: (row) => toNumber(row.quantity),
      product: (row) => row.product?.name || "",
      store: (row) => row.store?.name || "",
      zone: (row) => row.storageZone?.name || "",
      batchNumber: (row) => row.batchNumber || "",
      expiryDate: (row) => (row.expiryDate ? new Date(row.expiryDate).getTime() : Number.MAX_SAFE_INTEGER),
    };
    const keyAccessor = compareMap[sortBy] || compareMap.updatedAt;
    const direction = String(sortDir || "asc").toLowerCase() === "asc" ? 1 : -1;
    filteredRows.sort((left, right) => {
      const leftValue = keyAccessor(left);
      const rightValue = keyAccessor(right);
      if (leftValue < rightValue) return -1 * direction;
      if (leftValue > rightValue) return 1 * direction;
      return 0;
    });

    if (exportType) {
      const rows = filteredRows.map((item) => ({
        id: item.id,
        product: item.product?.name || "",
        sku: item.product?.sku || "",
        store: item.store?.name || "",
        storageZone: item.storageZone?.name || "",
        batchNumber: item.batchNumber || "Sans lot",
        expiryDate: item.expiryDate,
        expiryStatus: item.expiryStatus,
        quantity: item.quantity,
        unitCost: item.unitCost,
        updatedAt: item.updatedAt,
      }));

      return sendExport(res, rows, "inventory-lots", exportType);
    }

    if (!paginate) {
      return res.json(filteredRows);
    }

    const total = filteredRows.length;
    const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
    return res.json({
      data: paginatedRows,
      meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
    });
  }

  const searchFilter = search
    ? {
        OR: [
          { product: { name: contains(search) } },
          { storageZone: { name: contains(search) } },
          { store: { name: contains(search) } },
        ],
      }
    : {};

  const where = {
    tenantId: req.user.tenantId,
    ...(storeId ? { storeId } : {}),
    ...(storageZoneId ? { storageZoneId } : {}),
    ...(productId ? { productId } : {}),
    ...(zoneType ? { storageZone: { zoneType } } : {}),
    ...updatedAtFilter,
    ...searchFilter,
  };

  const orderBy =
    buildOrderBy(sortBy, sortDir, {
      updatedAt: "updatedAt",
      quantity: "quantity",
      product: (dir) => ({ product: { name: dir } }),
      store: (dir) => ({ store: { name: dir } }),
      zone: (dir) => ({ storageZone: { name: dir } }),
    }) || { updatedAt: "desc" };

  if (exportType) {
    const data = await prisma.inventory.findMany({
      where,
      include: { product: true, storageZone: true, store: true },
      orderBy,
    });

    const rows = data.map((item) => ({
      id: item.id,
      product: item.product?.name || "",
      store: item.store?.name || "",
      storageZone: item.storageZone?.name || "",
      quantity: item.quantity,
      minLevel: item.minLevel,
      updatedAt: item.updatedAt,
    }));

    return sendExport(res, rows, "inventory", exportType);
  }

  if (!paginate) {
    const inventory = await prisma.inventory.findMany({
      where,
      include: { product: true, storageZone: true, store: true },
      orderBy,
    });

    return res.json(inventory);
  }

  const [total, inventory] = await prisma.$transaction([
    prisma.inventory.count({ where }),
    prisma.inventory.findMany({
      where,
      include: { product: true, storageZone: true, store: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return res.json({
    data: inventory,
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const adjustInventory = async (req, res) => {
  const { storageZoneId, productId, quantity, mode, note, batchNumber, expiryDate } = req.body || {};

  if (!storageZoneId || !productId || quantity === undefined) {
    return res.status(400).json({
      message: "storageZoneId, productId and quantity are required.",
    });
  }

  const storageZone = await prisma.storageZone.findFirst({
    where: { id: storageZoneId, tenantId: req.user.tenantId },
  });

  if (!storageZone || !storageZone.storeId) {
    return res.status(400).json({ message: "Invalid storageZoneId." });
  }

  const modeValue = mode || "SET";
  const amount = Number(quantity);
  await ensureInventoryLotTables();

  const existing = await prisma.inventory.findFirst({
    where: {
      tenantId: req.user.tenantId,
      storageZoneId,
      productId,
    },
  });

  let delta = amount;
  if (!existing && modeValue === "DECREMENT") {
    return res.status(400).json({ message: "Cannot decrement missing inventory." });
  }

  if (modeValue === "INCREMENT") {
    await incrementInventoryLot(prisma, {
      tenantId: req.user.tenantId,
      storeId: storageZone.storeId,
      storageZoneId,
      productId,
      quantity: amount,
      batchNumber,
      expiryDate,
    });
    delta = amount;
  } else if (modeValue === "DECREMENT") {
    await consumeInventoryLotsFefo(prisma, {
      tenantId: req.user.tenantId,
      storeId: storageZone.storeId,
      storageZoneId,
      productId,
      quantity: amount,
    });
    delta = -amount;
  } else if (modeValue === "SET") {
    await setInventoryLotQuantity(prisma, {
      tenantId: req.user.tenantId,
      storeId: storageZone.storeId,
      storageZoneId,
      productId,
      batchNumber: batchNumber || null,
      expiryDate: expiryDate || null,
      quantity: amount,
    });
    delta = amount - Number(existing?.quantity || 0);
  } else {
    return res.status(400).json({ message: "Invalid mode." });
  }

  await prisma.inventoryMovement.create({
    data: {
      tenantId: req.user.tenantId,
      productId,
      storageZoneId,
      quantity: delta,
      movementType: "ADJUSTMENT",
      sourceType: "DIRECT",
      sourceId: null,
      createdById: req.user.id,
    },
  });

  await emitLotExpiryNotifications(req.user.tenantId);

  return res.json({
    inventory: await prisma.inventory.findFirst({
      where: {
        tenantId: req.user.tenantId,
        storageZoneId,
        productId,
      },
    }),
    note,
  });
};

const updateMinLevel = async (req, res) => {
  const { id } = req.params;
  const { minLevel } = req.body || {};

  if (minLevel === undefined) {
    return res.status(400).json({ message: "minLevel required." });
  }

  const item = await prisma.inventory.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });

  if (!item) {
    return res.status(404).json({ message: "Inventory not found." });
  }

  const updated = await prisma.inventory.update({
    where: { id },
    data: { minLevel: Number(minLevel) },
  });

  return res.json(updated);
};

module.exports = {
  listInventory,
  adjustInventory,
  updateMinLevel,
};
