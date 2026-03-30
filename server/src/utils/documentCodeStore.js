const prisma = require("../config/prisma");

const TABLES = {
  purchaseRequests: '"purchaseRequests"',
  supplyRequests: '"supplyRequests"',
  purchaseOrders: '"purchaseOrders"',
  productTransferts: '"productTransferts"',
};

const escapeSqlValue = (value) => `'${String(value).replace(/'/g, "''")}'`;

const resolveTableName = (tableName) => {
  const resolved = TABLES[tableName];
  if (!resolved) {
    throw new Error(`Unsupported document code table: ${tableName}`);
  }
  return resolved;
};

const formatDocumentCode = (prefix, nextValue, width = 4) =>
  `${prefix}${String(nextValue).padStart(width, "0")}`;

const ensureDocumentCodeColumn = async (tableName) => {
  const resolvedTable = resolveTableName(tableName);
  const indexName = `${tableName}_code_idx`;

  await prisma.$executeRawUnsafe(`
    ALTER TABLE ${resolvedTable}
    ADD COLUMN IF NOT EXISTS "code" TEXT NULL
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "${indexName}"
    ON ${resolvedTable} ("code")
  `);
};

const generateNextDocumentCode = async ({
  tableName,
  tenantId,
  prefix,
  width = 4,
}) => {
  await ensureDocumentCodeColumn(tableName);
  const resolvedTable = resolveTableName(tableName);
  const pattern = `^${prefix}([0-9]+)$`;
  const searchPattern = `^${prefix}[0-9]+$`;

  const rows = await prisma.$queryRawUnsafe(`
    SELECT COALESCE(
      MAX(CAST(SUBSTRING("code" FROM ${escapeSqlValue(pattern)}) AS INTEGER)),
      0
    ) AS "lastNumber"
    FROM ${resolvedTable}
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "code" ~ ${escapeSqlValue(searchPattern)}
  `);

  return formatDocumentCode(prefix, Number(rows?.[0]?.lastNumber || 0) + 1, width);
};

const assignGeneratedDocumentCode = async ({
  tableName,
  tenantId,
  id,
  prefix,
  currentCode,
  width = 4,
}) => {
  await ensureDocumentCodeColumn(tableName);

  if (currentCode) {
    return currentCode;
  }

  const nextCode = await generateNextDocumentCode({ tableName, tenantId, prefix, width });
  const resolvedTable = resolveTableName(tableName);

  await prisma.$executeRawUnsafe(`
    UPDATE ${resolvedTable}
    SET "code" = ${escapeSqlValue(nextCode)}
    WHERE "id" = ${escapeSqlValue(id)}
  `);

  return nextCode;
};

const getDocumentCodeMap = async (tableName, ids = []) => {
  await ensureDocumentCodeColumn(tableName);
  const resolvedTable = resolveTableName(tableName);
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (!uniqueIds.length) return new Map();

  const rows = await prisma.$queryRawUnsafe(`
    SELECT "id", "code"
    FROM ${resolvedTable}
    WHERE "id" IN (${uniqueIds.map(escapeSqlValue).join(", ")})
  `);

  return new Map(rows.map((row) => [row.id, row.code || null]));
};

const attachDocumentCodes = async (tableName, records) => {
  const list = Array.isArray(records)
    ? records.filter(Boolean)
    : records
      ? [records]
      : [];

  if (!list.length) {
    return Array.isArray(records) ? [] : records;
  }

  const codeMap = await getDocumentCodeMap(
    tableName,
    list.map((item) => item.id),
  );

  const hydrated = list.map((item) => ({
    ...item,
    code: item.code || codeMap.get(item.id) || null,
  }));

  return Array.isArray(records) ? hydrated : hydrated[0];
};

module.exports = {
  ensureDocumentCodeColumn,
  generateNextDocumentCode,
  assignGeneratedDocumentCode,
  getDocumentCodeMap,
  attachDocumentCodes,
};
