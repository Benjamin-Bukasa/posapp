const {
  DEFAULT_PRIMARY_CURRENCY,
  normalizeCurrencyCode,
} = require("./currencySettings");

const TABLE_NAME_MAP = {
  products: "products",
  orders: "orders",
  orderItems: "order_items",
  payments: "payements",
  stockEntryItems: "stockEntryItems",
  purchaseOrderItems: "purchaseOrderItems",
};

let moneyColumnsEnsured = false;

const ensureMoneyCurrencyColumns = async (prisma) => {
  if (moneyColumnsEnsured) {
    return;
  }

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "currencyCode" TEXT NOT NULL DEFAULT 'USD'`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "currencyCode" TEXT NOT NULL DEFAULT 'USD'`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "currencyCode" TEXT NOT NULL DEFAULT 'USD'`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "payements" ADD COLUMN IF NOT EXISTS "currencyCode" TEXT NOT NULL DEFAULT 'USD'`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "stockEntryItems" ADD COLUMN IF NOT EXISTS "currencyCode" TEXT NOT NULL DEFAULT 'USD'`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "purchaseOrderItems" ADD COLUMN IF NOT EXISTS "currencyCode" TEXT NOT NULL DEFAULT 'USD'`,
  );
  moneyColumnsEnsured = true;
};

const resolveTableName = (tableKey) => {
  const tableName = TABLE_NAME_MAP[tableKey];
  if (!tableName) {
    throw new Error(`Unsupported money currency table: ${tableKey}`);
  }
  return tableName;
};

const getCurrencyCodeMap = async (prisma, tableKey, ids = []) => {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map();
  }

  await ensureMoneyCurrencyColumns(prisma);

  const tableName = resolveTableName(tableKey);
  const placeholders = uniqueIds.map((_, index) => `$${index + 1}`).join(", ");
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "id", "currencyCode" FROM "${tableName}" WHERE "id" IN (${placeholders})`,
    ...uniqueIds,
  );

  return new Map(
    rows.map((row) => [
      row.id,
      normalizeCurrencyCode(row.currencyCode, DEFAULT_PRIMARY_CURRENCY),
    ]),
  );
};

const setCurrencyCode = async (prisma, tableKey, id, currencyCode) => {
  if (!id) return;

  await ensureMoneyCurrencyColumns(prisma);

  const tableName = resolveTableName(tableKey);
  await prisma.$executeRawUnsafe(
    `UPDATE "${tableName}" SET "currencyCode" = $1 WHERE "id" = $2`,
    normalizeCurrencyCode(currencyCode, DEFAULT_PRIMARY_CURRENCY),
    id,
  );
};

const setCurrencyCodes = async (prisma, tableKey, ids = [], currencyCode) => {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (!uniqueIds.length) return;

  await ensureMoneyCurrencyColumns(prisma);

  const tableName = resolveTableName(tableKey);
  const placeholders = uniqueIds.map((_, index) => `$${index + 2}`).join(", ");
  await prisma.$executeRawUnsafe(
    `UPDATE "${tableName}" SET "currencyCode" = $1 WHERE "id" IN (${placeholders})`,
    normalizeCurrencyCode(currencyCode, DEFAULT_PRIMARY_CURRENCY),
    ...uniqueIds,
  );
};

const attachCurrencyCodes = (
  records = [],
  currencyMap,
  { idField = "id", field = "currencyCode" } = {},
) =>
  (records || []).map((record) => {
    if (!record) return record;
    return {
      ...record,
      [field]: normalizeCurrencyCode(
        currencyMap?.get(record[idField]),
        DEFAULT_PRIMARY_CURRENCY,
      ),
    };
  });

module.exports = {
  ensureMoneyCurrencyColumns,
  getCurrencyCodeMap,
  setCurrencyCode,
  setCurrencyCodes,
  attachCurrencyCodes,
};
