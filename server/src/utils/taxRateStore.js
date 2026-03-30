const prisma = require("../config/prisma");

const escapeSqlValue = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replace(/'/g, "''")}'`;
};

const createId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `tax_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const ensureTaxRatesTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "taxRates" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "name" TEXT NULL,
      "rate" DECIMAL(10, 2) NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "taxRates_tenantId_idx"
    ON "taxRates" ("tenantId")
  `);
};

const mapTaxRate = (row) =>
  row
    ? {
        ...row,
        rate: Number(row.rate || 0),
        isActive: Boolean(row.isActive),
        status: row.isActive ? "ACTIVE" : "INACTIVE",
      }
    : null;

const listTaxRates = async ({
  tenantId,
  search,
  paginate,
  page,
  pageSize,
  sortBy,
  sortDir,
}) => {
  await ensureTaxRatesTable();
  const clauses = [`base."tenantId" = ${escapeSqlValue(tenantId)}`];
  if (search) {
    clauses.push(`(
      base."code" ILIKE ${escapeSqlValue(`%${search}%`)}
      OR COALESCE(base."name", '') ILIKE ${escapeSqlValue(`%${search}%`)}
      OR CAST(base."rate" AS TEXT) ILIKE ${escapeSqlValue(`%${search}%`)}
    )`);
  }
  const whereSql = clauses.join(" AND ");
  const orderMap = {
    code: `base."code"`,
    name: `base."name"`,
    rate: `base."rate"`,
    createdAt: `base."createdAt"`,
    isActive: `base."isActive"`,
  };
  const direction = String(sortDir).toLowerCase() === "asc" ? "ASC" : "DESC";
  const orderSql = `${orderMap[sortBy] || `base."createdAt"`} ${direction}, base."createdAt" DESC`;

  const selectSql = `
    SELECT
      base."id",
      base."tenantId",
      base."code",
      base."name",
      base."rate",
      base."isActive",
      base."createdAt",
      base."updatedAt"
    FROM "taxRates" base
    WHERE ${whereSql}
    ORDER BY ${orderSql}
  `;

  if (!paginate) {
    const rows = await prisma.$queryRawUnsafe(selectSql);
    return rows.map(mapTaxRate);
  }

  const [countRows, rows] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS "count"
      FROM "taxRates" base
      WHERE ${whereSql}
    `),
    prisma.$queryRawUnsafe(`
      ${selectSql}
      LIMIT ${Number(pageSize)}
      OFFSET ${Number((page - 1) * pageSize)}
    `),
  ]);

  return {
    total: countRows?.[0]?.count || 0,
    rows: rows.map(mapTaxRate),
  };
};

const getTaxRateById = async (tenantId, id) => {
  await ensureTaxRatesTable();
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      base."id",
      base."tenantId",
      base."code",
      base."name",
      base."rate",
      base."isActive",
      base."createdAt",
      base."updatedAt"
    FROM "taxRates" base
    WHERE base."tenantId" = ${escapeSqlValue(tenantId)}
      AND base."id" = ${escapeSqlValue(id)}
    LIMIT 1
  `);
  return mapTaxRate(rows[0] || null);
};

const findTaxRateByCodeOrName = async (tenantId, value) => {
  await ensureTaxRatesTable();
  const lookup = String(value || "").trim();
  if (!lookup) return null;
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      base."id",
      base."tenantId",
      base."code",
      base."name",
      base."rate",
      base."isActive",
      base."createdAt",
      base."updatedAt"
    FROM "taxRates" base
    WHERE base."tenantId" = ${escapeSqlValue(tenantId)}
      AND (
        LOWER(base."code") = LOWER(${escapeSqlValue(lookup)})
        OR LOWER(COALESCE(base."name", '')) = LOWER(${escapeSqlValue(lookup)})
      )
    LIMIT 1
  `);
  return mapTaxRate(rows[0] || null);
};

const createTaxRate = async ({ tenantId, code, name, rate = 0, isActive = true }) => {
  await ensureTaxRatesTable();
  const id = createId();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "taxRates" ("id", "tenantId", "code", "name", "rate", "isActive")
    VALUES (
      ${escapeSqlValue(id)},
      ${escapeSqlValue(tenantId)},
      ${escapeSqlValue(code)},
      ${escapeSqlValue(name || null)},
      ${escapeSqlValue(rate)},
      ${escapeSqlValue(isActive)}
    )
  `);
  return getTaxRateById(tenantId, id);
};

const updateTaxRate = async ({ tenantId, id, code, name, rate, isActive }) => {
  await ensureTaxRatesTable();
  await prisma.$executeRawUnsafe(`
    UPDATE "taxRates"
    SET
      "code" = ${escapeSqlValue(code)},
      "name" = ${escapeSqlValue(name || null)},
      "rate" = ${escapeSqlValue(rate)},
      "isActive" = ${escapeSqlValue(isActive)},
      "updatedAt" = NOW()
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "id" = ${escapeSqlValue(id)}
  `);
  return getTaxRateById(tenantId, id);
};

const deleteTaxRate = async ({ tenantId, id }) => {
  await ensureTaxRatesTable();
  await prisma.$executeRawUnsafe(`
    DELETE FROM "taxRates"
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "id" = ${escapeSqlValue(id)}
  `);
};

module.exports = {
  ensureTaxRatesTable,
  listTaxRates,
  getTaxRateById,
  findTaxRateByCodeOrName,
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
};
