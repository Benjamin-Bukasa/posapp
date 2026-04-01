const crypto = require("crypto");
const prisma = require("../config/prisma");
const { emitToTenant } = require("../socket");

const createId = () => crypto.randomUUID();

const toNumber = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const escapeSqlValue = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replace(/'/g, "''")}'`;
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

const buildNullableEquality = (columnName, value) =>
  value === null || value === undefined
    ? `${columnName} IS NULL`
    : `${columnName} = ${escapeSqlValue(normalizeDate(value) || value)}`;

const normalizeLotRow = (row) => ({
  id: row.id,
  tenantId: row.tenantId,
  storeId: row.storeId,
  storageZoneId: row.storageZoneId,
  productId: row.productId,
  batchNumber: row.batchNumber || null,
  expiryDate: row.expiryDate || null,
  manufacturedAt: row.manufacturedAt || null,
  unitCost: row.unitCost === null || row.unitCost === undefined ? null : Number(row.unitCost),
  quantity: Number(row.quantity || 0),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const ensureInventoryLotTables = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "inventoryLots" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "storeId" TEXT NOT NULL,
      "storageZoneId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "batchNumber" TEXT NULL,
      "expiryDate" TIMESTAMPTZ NULL,
      "manufacturedAt" TIMESTAMPTZ NULL,
      "unitCost" DECIMAL(18, 4) NULL,
      "quantity" DECIMAL(18, 4) NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "inventoryLots_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
      CONSTRAINT "inventoryLots_store_fk" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE,
      CONSTRAINT "inventoryLots_zone_fk" FOREIGN KEY ("storageZoneId") REFERENCES "storageZone"("id") ON DELETE CASCADE,
      CONSTRAINT "inventoryLots_product_fk" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "stockEntryItemLots" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "stockEntryItemId" TEXT NOT NULL,
      "batchNumber" TEXT NULL,
      "expiryDate" TIMESTAMPTZ NULL,
      "manufacturedAt" TIMESTAMPTZ NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "stockEntryItemLots_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
      CONSTRAINT "stockEntryItemLots_entry_fk" FOREIGN KEY ("stockEntryItemId") REFERENCES "stockEntryItems"("id") ON DELETE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "stockEntryItemLots_entry_unique"
    ON "stockEntryItemLots" ("stockEntryItemId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "inventoryLots_zone_product_idx"
    ON "inventoryLots" ("storageZoneId", "productId", "expiryDate")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "inventoryLots_tenant_store_idx"
    ON "inventoryLots" ("tenantId", "storeId", "updatedAt")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "inventoryLotAlertStates" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "inventoryLotId" TEXT NOT NULL,
      "lastStatus" TEXT NOT NULL DEFAULT 'SANS_DATE',
      "lastNotifiedAt" TIMESTAMPTZ NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "inventoryLotAlertStates_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "inventoryLotAlertStates_lot_unique"
    ON "inventoryLotAlertStates" ("inventoryLotId")
  `);
};

const getLotSnapshotById = async (executor, inventoryLotId) => {
  const rows = await executor.$queryRawUnsafe(`
    SELECT
      lot."id" AS "id",
      lot."tenantId" AS "tenantId",
      lot."storeId" AS "storeId",
      lot."storageZoneId" AS "storageZoneId",
      lot."productId" AS "productId",
      lot."batchNumber" AS "batchNumber",
      lot."expiryDate" AS "expiryDate",
      lot."quantity" AS "quantity",
      product."name" AS "productName",
      product."sku" AS "productSku",
      store."name" AS "storeName",
      zone."name" AS "storageZoneName"
    FROM "inventoryLots" lot
    INNER JOIN "products" product ON product."id" = lot."productId"
    INNER JOIN "stores" store ON store."id" = lot."storeId"
    INNER JOIN "storageZone" zone ON zone."id" = lot."storageZoneId"
    WHERE lot."id" = ${escapeSqlValue(inventoryLotId)}
    LIMIT 1
  `);
  return rows[0] || null;
};

const syncInventoryLotAlertState = async (executor, inventoryLotId) => {
  await ensureInventoryLotTables();
  const lot = await getLotSnapshotById(executor, inventoryLotId);
  if (!lot) return null;

  const nextStatus = getExpiryStatus(lot.expiryDate);
  const stateRows = await executor.$queryRawUnsafe(`
    SELECT *
    FROM "inventoryLotAlertStates"
    WHERE "inventoryLotId" = ${escapeSqlValue(inventoryLotId)}
    LIMIT 1
  `);
  const previousStatus = stateRows[0]?.lastStatus || null;

  if (stateRows.length) {
    await executor.$executeRawUnsafe(`
      UPDATE "inventoryLotAlertStates"
      SET
        "lastStatus" = ${escapeSqlValue(nextStatus)},
        "updatedAt" = NOW(),
        "lastNotifiedAt" = CASE
          WHEN ${escapeSqlValue(nextStatus)} IN ('EXPIRE_BIENTOT', 'EXPIRE')
            AND ${escapeSqlValue(previousStatus)} IS DISTINCT FROM ${escapeSqlValue(nextStatus)}
          THEN NOW()
          ELSE "lastNotifiedAt"
        END
      WHERE "id" = ${escapeSqlValue(stateRows[0].id)}
    `);
  } else {
    await executor.$executeRawUnsafe(`
      INSERT INTO "inventoryLotAlertStates" (
        "id", "tenantId", "inventoryLotId", "lastStatus", "lastNotifiedAt", "createdAt", "updatedAt"
      )
      VALUES (
        ${escapeSqlValue(createId())},
        ${escapeSqlValue(lot.tenantId)},
        ${escapeSqlValue(inventoryLotId)},
        ${escapeSqlValue(nextStatus)},
        ${nextStatus === "EXPIRE_BIENTOT" || nextStatus === "EXPIRE" ? "NOW()" : "NULL"},
        NOW(),
        NOW()
      )
    `);
  }

  if (
    (nextStatus === "EXPIRE_BIENTOT" || nextStatus === "EXPIRE") &&
    previousStatus !== nextStatus &&
    Number(lot.quantity || 0) > 0
  ) {
    return {
      tenantId: lot.tenantId,
      title: nextStatus === "EXPIRE" ? "Lot expire" : "Lot proche de peremption",
      message:
        `${lot.productName || "Produit"}${lot.batchNumber ? ` - lot ${lot.batchNumber}` : ""} ` +
        `${nextStatus === "EXPIRE" ? "est expire" : "expire bientot"} ` +
        `(${lot.storeName || "--"} / ${lot.storageZoneName || "--"}).`,
      payload: {
        inventoryLotId: lot.id,
        productId: lot.productId,
        productName: lot.productName,
        productSku: lot.productSku,
        batchNumber: lot.batchNumber || null,
        expiryDate: lot.expiryDate || null,
        quantity: Number(lot.quantity || 0),
        status: nextStatus,
        storeId: lot.storeId,
        storageZoneId: lot.storageZoneId,
      },
      createdAt: Date.now(),
    };
  }

  return null;
};

const emitLotExpiryNotifications = async (tenantId, executor = prisma) => {
  await ensureInventoryLotTables();
  const rows = await executor.$queryRawUnsafe(`
    SELECT "id"
    FROM "inventoryLots"
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND COALESCE("quantity", 0) > 0
  `);

  const notifications = [];
  for (const row of rows) {
    const payload = await syncInventoryLotAlertState(executor, row.id);
    if (payload) notifications.push(payload);
  }

  for (const notification of notifications) {
    emitToTenant(tenantId, "notification:new", notification);
  }

  return notifications;
};

const getStockEntryItemLotMap = async (stockEntryItemIds = []) => {
  await ensureInventoryLotTables();
  const ids = Array.from(
    new Set((Array.isArray(stockEntryItemIds) ? stockEntryItemIds : []).filter(Boolean)),
  );

  if (!ids.length) {
    return new Map();
  }

  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      "stockEntryItemId",
      "batchNumber",
      "expiryDate",
      "manufacturedAt"
    FROM "stockEntryItemLots"
    WHERE "stockEntryItemId" IN (${ids.map((item) => escapeSqlValue(item)).join(", ")})
  `);

  return new Map(
    rows.map((row) => [
      row.stockEntryItemId,
      {
        batchNumber: row.batchNumber || null,
        expiryDate: row.expiryDate || null,
        manufacturedAt: row.manufacturedAt || null,
      },
    ]),
  );
};

const attachStockEntryLots = async (items = []) => {
  const lotMap = await getStockEntryItemLotMap(items.map((item) => item.id));
  return items.map((item) => ({
    ...item,
    ...(lotMap.get(item.id) || {
      batchNumber: null,
      expiryDate: null,
      manufacturedAt: null,
    }),
  }));
};

const setStockEntryItemLots = async (tx, tenantId, itemRows = [], sourceItems = []) => {
  if (!Array.isArray(itemRows) || !itemRows.length) return;

  const itemIds = itemRows.map((item) => item.id).filter(Boolean);
  if (itemIds.length) {
    await tx.$executeRawUnsafe(`
      DELETE FROM "stockEntryItemLots"
      WHERE "tenantId" = ${escapeSqlValue(tenantId)}
        AND "stockEntryItemId" IN (${itemIds.map((item) => escapeSqlValue(item)).join(", ")})
    `);
  }

  for (const [index, row] of itemRows.entries()) {
    const source = sourceItems[index] || {};
    const batchNumber = source.batchNumber ? String(source.batchNumber).trim() : null;
    const expiryDate = normalizeDate(source.expiryDate);
    const manufacturedAt = normalizeDate(source.manufacturedAt);

    if (!batchNumber && !expiryDate && !manufacturedAt) continue;

    await tx.$executeRawUnsafe(`
      INSERT INTO "stockEntryItemLots" (
        "id", "tenantId", "stockEntryItemId", "batchNumber", "expiryDate", "manufacturedAt", "createdAt", "updatedAt"
      )
      VALUES (
        ${escapeSqlValue(createId())},
        ${escapeSqlValue(tenantId)},
        ${escapeSqlValue(row.id)},
        ${escapeSqlValue(batchNumber)},
        ${escapeSqlValue(expiryDate)},
        ${escapeSqlValue(manufacturedAt)},
        NOW(),
        NOW()
      )
    `);
  }
};

const synchronizeInventoryAggregate = async (
  tx,
  { tenantId, storeId, storageZoneId, productId },
) => {
  const totalRows = await tx.$queryRawUnsafe(`
    SELECT COALESCE(SUM("quantity"), 0) AS "quantity"
    FROM "inventoryLots"
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "storageZoneId" = ${escapeSqlValue(storageZoneId)}
      AND "productId" = ${escapeSqlValue(productId)}
  `);

  const totalQuantity = Number(totalRows?.[0]?.quantity || 0);
  const existing = await tx.inventory.findFirst({
    where: {
      tenantId,
      storageZoneId,
      productId,
    },
  });

  if (existing) {
    await tx.inventory.update({
      where: { id: existing.id },
      data: {
        quantity: totalQuantity,
        ...(storeId ? { storeId } : {}),
      },
    });
    return totalQuantity;
  }

  if (totalQuantity > 0) {
    await tx.inventory.create({
      data: {
        tenantId,
        storeId,
        storageZoneId,
        productId,
        quantity: totalQuantity,
      },
    });
  }

  return totalQuantity;
};

const materializeResidualUntrackedLot = async (
  tx,
  { tenantId, storeId, storageZoneId, productId },
) => {
  const [aggregateRow] = await Promise.all([
    tx.inventory.findFirst({
      where: {
        tenantId,
        storageZoneId,
        productId,
      },
    }),
  ]);

  const aggregateQuantity = Number(aggregateRow?.quantity || 0);
  if (aggregateQuantity <= 0) return;

  const lotRows = await tx.$queryRawUnsafe(`
    SELECT
      COALESCE(SUM("quantity"), 0) AS "totalQuantity"
    FROM "inventoryLots"
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "storageZoneId" = ${escapeSqlValue(storageZoneId)}
      AND "productId" = ${escapeSqlValue(productId)}
  `);
  const lotTotal = Number(lotRows?.[0]?.totalQuantity || 0);
  const residual = aggregateQuantity - lotTotal;
  if (residual <= 0.0001) return;

  const unlottedRows = await tx.$queryRawUnsafe(`
    SELECT *
    FROM "inventoryLots"
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "storeId" = ${escapeSqlValue(storeId)}
      AND "storageZoneId" = ${escapeSqlValue(storageZoneId)}
      AND "productId" = ${escapeSqlValue(productId)}
      AND "batchNumber" IS NULL
      AND "expiryDate" IS NULL
    ORDER BY "createdAt" ASC
    LIMIT 1
  `);

  if (unlottedRows.length) {
    await tx.$executeRawUnsafe(`
      UPDATE "inventoryLots"
      SET
        "quantity" = "quantity" + ${escapeSqlValue(residual)},
        "updatedAt" = NOW()
      WHERE "id" = ${escapeSqlValue(unlottedRows[0].id)}
    `);
    return;
  }

  await tx.$executeRawUnsafe(`
    INSERT INTO "inventoryLots" (
      "id", "tenantId", "storeId", "storageZoneId", "productId", "batchNumber", "expiryDate", "manufacturedAt", "unitCost", "quantity", "createdAt", "updatedAt"
    )
    VALUES (
      ${escapeSqlValue(createId())},
      ${escapeSqlValue(tenantId)},
      ${escapeSqlValue(storeId)},
      ${escapeSqlValue(storageZoneId)},
      ${escapeSqlValue(productId)},
      NULL,
      NULL,
      NULL,
      NULL,
      ${escapeSqlValue(residual)},
      NOW(),
      NOW()
    )
  `);
};

const incrementInventoryLot = async (
  tx,
  {
    tenantId,
    storeId,
    storageZoneId,
    productId,
    quantity,
    batchNumber = null,
    expiryDate = null,
    manufacturedAt = null,
    unitCost = null,
    syncAggregate = true,
  },
) => {
  const normalizedQuantity = Math.abs(toNumber(quantity));
  if (!normalizedQuantity) return null;

  const normalizedExpiryDate = normalizeDate(expiryDate);
  const normalizedManufacturedAt = normalizeDate(manufacturedAt);
  const normalizedBatchNumber = batchNumber ? String(batchNumber).trim() : null;

  const rows = await tx.$queryRawUnsafe(`
    SELECT *
    FROM "inventoryLots"
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "storageZoneId" = ${escapeSqlValue(storageZoneId)}
      AND "productId" = ${escapeSqlValue(productId)}
      AND ${buildNullableEquality(`"batchNumber"`, normalizedBatchNumber)}
      AND ${buildNullableEquality(`"expiryDate"`, normalizedExpiryDate)}
    ORDER BY "createdAt" ASC
    LIMIT 1
  `);

  let lotId = null;
  if (rows.length) {
    lotId = rows[0].id;
    await tx.$executeRawUnsafe(`
      UPDATE "inventoryLots"
      SET
        "quantity" = "quantity" + ${escapeSqlValue(normalizedQuantity)},
        "unitCost" = COALESCE(${escapeSqlValue(unitCost)}, "unitCost"),
        "manufacturedAt" = COALESCE(${escapeSqlValue(normalizedManufacturedAt)}, "manufacturedAt"),
        "updatedAt" = NOW()
      WHERE "id" = ${escapeSqlValue(lotId)}
    `);
  } else {
    lotId = createId();
    await tx.$executeRawUnsafe(`
      INSERT INTO "inventoryLots" (
        "id", "tenantId", "storeId", "storageZoneId", "productId", "batchNumber", "expiryDate", "manufacturedAt", "unitCost", "quantity", "createdAt", "updatedAt"
      )
      VALUES (
        ${escapeSqlValue(lotId)},
        ${escapeSqlValue(tenantId)},
        ${escapeSqlValue(storeId)},
        ${escapeSqlValue(storageZoneId)},
        ${escapeSqlValue(productId)},
        ${escapeSqlValue(normalizedBatchNumber)},
        ${escapeSqlValue(normalizedExpiryDate)},
        ${escapeSqlValue(normalizedManufacturedAt)},
        ${escapeSqlValue(unitCost)},
        ${escapeSqlValue(normalizedQuantity)},
        NOW(),
        NOW()
      )
    `);
  }

  if (syncAggregate) {
    await synchronizeInventoryAggregate(tx, {
      tenantId,
      storeId,
      storageZoneId,
      productId,
    });
  }

  return lotId;
};

const getAvailableInventoryLots = async (
  tx,
  { tenantId, storeId, storageZoneId, productId },
) => {
  await materializeResidualUntrackedLot(tx, {
    tenantId,
    storeId,
    storageZoneId,
    productId,
  });

  const rows = await tx.$queryRawUnsafe(`
    SELECT *
    FROM "inventoryLots"
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "storageZoneId" = ${escapeSqlValue(storageZoneId)}
      AND "productId" = ${escapeSqlValue(productId)}
      AND COALESCE("quantity", 0) > 0
    ORDER BY
      CASE WHEN "expiryDate" IS NULL THEN 1 ELSE 0 END ASC,
      "expiryDate" ASC,
      "createdAt" ASC
  `);

  return rows.map(normalizeLotRow);
};

const consumeInventoryLotsFefo = async (
  tx,
  {
    tenantId,
    storeId,
    storageZoneId,
    productId,
    quantity,
  },
) => {
  const normalizedQuantity = Math.abs(toNumber(quantity));
  if (!normalizedQuantity) return [];

  const lots = await getAvailableInventoryLots(tx, {
    tenantId,
    storeId,
    storageZoneId,
    productId,
  });

  const totalAvailable = lots.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  if (totalAvailable + 0.0001 < normalizedQuantity) {
    throw Object.assign(new Error("Stock insuffisant par lot pour cette operation."), {
      status: 400,
    });
  }

  let remaining = normalizedQuantity;
  const consumed = [];

  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(lot.quantity || 0));
    if (take <= 0) continue;

    await tx.$executeRawUnsafe(`
      UPDATE "inventoryLots"
      SET
        "quantity" = "quantity" - ${escapeSqlValue(take)},
        "updatedAt" = NOW()
      WHERE "id" = ${escapeSqlValue(lot.id)}
    `);

    consumed.push({
      ...lot,
      consumedQuantity: take,
    });
    remaining -= take;
  }

  await synchronizeInventoryAggregate(tx, {
    tenantId,
    storeId,
    storageZoneId,
    productId,
  });

  return consumed;
};

const transferInventoryLotsFefo = async (
  tx,
  {
    tenantId,
    fromStoreId,
    fromZoneId,
    toStoreId,
    toZoneId,
    productId,
    quantity,
  },
) => {
  const consumedLots = await consumeInventoryLotsFefo(tx, {
    tenantId,
    storeId: fromStoreId,
    storageZoneId: fromZoneId,
    productId,
    quantity,
  });

  for (const consumed of consumedLots) {
    await incrementInventoryLot(tx, {
      tenantId,
      storeId: toStoreId,
      storageZoneId: toZoneId,
      productId,
      quantity: consumed.consumedQuantity,
      batchNumber: consumed.batchNumber,
      expiryDate: consumed.expiryDate,
      manufacturedAt: consumed.manufacturedAt,
      unitCost: consumed.unitCost,
    });
  }

  return consumedLots;
};

const setInventoryLotQuantity = async (
  tx,
  {
    tenantId,
    storeId,
    storageZoneId,
    productId,
    inventoryLotId = null,
    batchNumber = null,
    expiryDate = null,
    manufacturedAt = null,
    unitCost = null,
    quantity,
  },
) => {
  const normalizedQuantity = Math.max(0, toNumber(quantity));
  const normalizedExpiryDate = normalizeDate(expiryDate);
  const normalizedManufacturedAt = normalizeDate(manufacturedAt);
  const normalizedBatchNumber = batchNumber ? String(batchNumber).trim() : null;

  let targetId = inventoryLotId || null;
  if (!targetId) {
    const rows = await tx.$queryRawUnsafe(`
      SELECT *
      FROM "inventoryLots"
      WHERE "tenantId" = ${escapeSqlValue(tenantId)}
        AND "storageZoneId" = ${escapeSqlValue(storageZoneId)}
        AND "productId" = ${escapeSqlValue(productId)}
        AND ${buildNullableEquality(`"batchNumber"`, normalizedBatchNumber)}
        AND ${buildNullableEquality(`"expiryDate"`, normalizedExpiryDate)}
      ORDER BY "createdAt" ASC
      LIMIT 1
    `);
    targetId = rows[0]?.id || null;
  }

  if (targetId) {
    await tx.$executeRawUnsafe(`
      UPDATE "inventoryLots"
      SET
        "batchNumber" = ${escapeSqlValue(normalizedBatchNumber)},
        "expiryDate" = ${escapeSqlValue(normalizedExpiryDate)},
        "manufacturedAt" = ${escapeSqlValue(normalizedManufacturedAt)},
        "unitCost" = COALESCE(${escapeSqlValue(unitCost)}, "unitCost"),
        "quantity" = ${escapeSqlValue(normalizedQuantity)},
        "updatedAt" = NOW()
      WHERE "id" = ${escapeSqlValue(targetId)}
    `);
  } else if (normalizedQuantity > 0) {
    targetId = createId();
    await tx.$executeRawUnsafe(`
      INSERT INTO "inventoryLots" (
        "id", "tenantId", "storeId", "storageZoneId", "productId", "batchNumber", "expiryDate", "manufacturedAt", "unitCost", "quantity", "createdAt", "updatedAt"
      )
      VALUES (
        ${escapeSqlValue(targetId)},
        ${escapeSqlValue(tenantId)},
        ${escapeSqlValue(storeId)},
        ${escapeSqlValue(storageZoneId)},
        ${escapeSqlValue(productId)},
        ${escapeSqlValue(normalizedBatchNumber)},
        ${escapeSqlValue(normalizedExpiryDate)},
        ${escapeSqlValue(normalizedManufacturedAt)},
        ${escapeSqlValue(unitCost)},
        ${escapeSqlValue(normalizedQuantity)},
        NOW(),
        NOW()
      )
    `);
  }

  await synchronizeInventoryAggregate(tx, {
    tenantId,
    storeId,
    storageZoneId,
    productId,
  });

  return targetId;
};

const listInventoryLots = async ({
  tenantId,
  storeId = null,
  storageZoneId = null,
  productId = null,
  search = "",
  includeZero = false,
}) => {
  await ensureInventoryLotTables();
  const clauses = [`lot."tenantId" = ${escapeSqlValue(tenantId)}`];
  if (storeId) clauses.push(`lot."storeId" = ${escapeSqlValue(storeId)}`);
  if (storageZoneId) clauses.push(`lot."storageZoneId" = ${escapeSqlValue(storageZoneId)}`);
  if (productId) clauses.push(`lot."productId" = ${escapeSqlValue(productId)}`);
  if (!includeZero) clauses.push(`COALESCE(lot."quantity", 0) > 0`);
  if (search) {
    clauses.push(`(
      product."name" ILIKE ${escapeSqlValue(`%${search}%`)}
      OR COALESCE(product."sku", '') ILIKE ${escapeSqlValue(`%${search}%`)}
      OR COALESCE(lot."batchNumber", '') ILIKE ${escapeSqlValue(`%${search}%`)}
      OR COALESCE(zone."name", '') ILIKE ${escapeSqlValue(`%${search}%`)}
      OR COALESCE(store."name", '') ILIKE ${escapeSqlValue(`%${search}%`)}
    )`);
  }

  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      lot."id" AS "id",
      lot."tenantId" AS "tenantId",
      lot."storeId" AS "storeId",
      lot."storageZoneId" AS "storageZoneId",
      lot."productId" AS "productId",
      lot."batchNumber" AS "batchNumber",
      lot."expiryDate" AS "expiryDate",
      lot."manufacturedAt" AS "manufacturedAt",
      lot."unitCost" AS "unitCost",
      lot."quantity" AS "quantity",
      lot."createdAt" AS "createdAt",
      lot."updatedAt" AS "updatedAt",
      product."name" AS "productName",
      product."sku" AS "productSku",
      product."minLevel" AS "productMinLevel",
      product."maxLevel" AS "productMaxLevel",
      store."name" AS "storeName",
      zone."name" AS "storageZoneName",
      zone."zoneType" AS "zoneType"
    FROM "inventoryLots" lot
    INNER JOIN "products" product ON product."id" = lot."productId"
    INNER JOIN "stores" store ON store."id" = lot."storeId"
    INNER JOIN "storageZone" zone ON zone."id" = lot."storageZoneId"
    WHERE ${clauses.join(" AND ")}
    ORDER BY
      CASE WHEN lot."expiryDate" IS NULL THEN 1 ELSE 0 END ASC,
      lot."expiryDate" ASC,
      product."name" ASC,
      lot."createdAt" ASC
  `);

  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenantId,
    storeId: row.storeId,
    storageZoneId: row.storageZoneId,
    productId: row.productId,
    batchNumber: row.batchNumber || null,
    expiryDate: row.expiryDate || null,
    manufacturedAt: row.manufacturedAt || null,
    unitCost: row.unitCost === null || row.unitCost === undefined ? null : Number(row.unitCost),
    quantity: Number(row.quantity || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    store: row.storeId ? { id: row.storeId, name: row.storeName || "" } : null,
    storageZone: row.storageZoneId
      ? { id: row.storageZoneId, name: row.storageZoneName || "", zoneType: row.zoneType || null }
      : null,
    product: row.productId
      ? {
          id: row.productId,
          name: row.productName || "",
          sku: row.productSku || null,
          minLevel: row.productMinLevel == null ? null : Number(row.productMinLevel),
          maxLevel: row.productMaxLevel == null ? null : Number(row.productMaxLevel),
        }
      : null,
  }));
};

module.exports = {
  ensureInventoryLotTables,
  getStockEntryItemLotMap,
  attachStockEntryLots,
  setStockEntryItemLots,
  synchronizeInventoryAggregate,
  materializeResidualUntrackedLot,
  incrementInventoryLot,
  getAvailableInventoryLots,
  consumeInventoryLotsFefo,
  transferInventoryLotsFefo,
  setInventoryLotQuantity,
  listInventoryLots,
  emitLotExpiryNotifications,
};
