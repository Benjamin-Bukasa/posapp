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
    : `bonus_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const ensureCustomerBonusProgramsTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "customerBonusPrograms" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "amountThreshold" DECIMAL(18, 2) NOT NULL DEFAULT 10,
      "pointsAwarded" INTEGER NOT NULL DEFAULT 1,
      "pointValueAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
      "quotaPoints" INTEGER NULL,
      "quotaPeriodDays" INTEGER NULL,
      "quotaRewardAmount" DECIMAL(18, 2) NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "customerBonusPrograms_tenantId_idx"
    ON "customerBonusPrograms" ("tenantId")
  `);
};

const normalizeProgram = (row) =>
  row
    ? {
        ...row,
        amountThreshold: Number(row.amountThreshold || 0),
        pointsAwarded: Number(row.pointsAwarded || 0),
        pointValueAmount: Number(row.pointValueAmount || 0),
        quotaPoints: row.quotaPoints == null ? null : Number(row.quotaPoints),
        quotaPeriodDays: row.quotaPeriodDays == null ? null : Number(row.quotaPeriodDays),
        quotaRewardAmount:
          row.quotaRewardAmount == null ? null : Number(row.quotaRewardAmount),
        isActive: Boolean(row.isActive),
      }
    : null;

const listCustomerBonusPrograms = async ({
  tenantId,
  search,
  paginate,
  page,
  pageSize,
  sortBy,
  sortDir,
}) => {
  await ensureCustomerBonusProgramsTable();
  const clauses = [`base."tenantId" = ${escapeSqlValue(tenantId)}`];
  if (search) {
    clauses.push(`(
      base."name" ILIKE ${escapeSqlValue(`%${search}%`)}
      OR CAST(base."pointsAwarded" AS TEXT) ILIKE ${escapeSqlValue(`%${search}%`)}
      OR CAST(base."quotaPoints" AS TEXT) ILIKE ${escapeSqlValue(`%${search}%`)}
    )`);
  }
  const whereSql = clauses.join(" AND ");
  const orderMap = {
    name: `base."name"`,
    amountThreshold: `base."amountThreshold"`,
    pointsAwarded: `base."pointsAwarded"`,
    pointValueAmount: `base."pointValueAmount"`,
    quotaPoints: `base."quotaPoints"`,
    quotaPeriodDays: `base."quotaPeriodDays"`,
    createdAt: `base."createdAt"`,
    isActive: `base."isActive"`,
  };
  const direction = String(sortDir).toLowerCase() === "asc" ? "ASC" : "DESC";
  const orderSql = `${orderMap[sortBy] || `base."createdAt"`} ${direction}, base."createdAt" DESC`;

  const selectSql = `
    SELECT
      base."id",
      base."tenantId",
      base."name",
      base."amountThreshold",
      base."pointsAwarded",
      base."pointValueAmount",
      base."quotaPoints",
      base."quotaPeriodDays",
      base."quotaRewardAmount",
      base."isActive",
      base."createdAt",
      base."updatedAt"
    FROM "customerBonusPrograms" base
    WHERE ${whereSql}
    ORDER BY ${orderSql}
  `;

  if (!paginate) {
    const rows = await prisma.$queryRawUnsafe(selectSql);
    return rows.map(normalizeProgram);
  }

  const [countRows, rows] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS "count"
      FROM "customerBonusPrograms" base
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
    rows: rows.map(normalizeProgram),
  };
};

const getCustomerBonusProgramById = async (tenantId, id) => {
  await ensureCustomerBonusProgramsTable();
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      base."id",
      base."tenantId",
      base."name",
      base."amountThreshold",
      base."pointsAwarded",
      base."pointValueAmount",
      base."quotaPoints",
      base."quotaPeriodDays",
      base."quotaRewardAmount",
      base."isActive",
      base."createdAt",
      base."updatedAt"
    FROM "customerBonusPrograms" base
    WHERE base."tenantId" = ${escapeSqlValue(tenantId)}
      AND base."id" = ${escapeSqlValue(id)}
    LIMIT 1
  `);
  return normalizeProgram(rows[0] || null);
};

const getCurrentCustomerBonusProgram = async (tenantId) => {
  await ensureCustomerBonusProgramsTable();
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      base."id",
      base."tenantId",
      base."name",
      base."amountThreshold",
      base."pointsAwarded",
      base."pointValueAmount",
      base."quotaPoints",
      base."quotaPeriodDays",
      base."quotaRewardAmount",
      base."isActive",
      base."createdAt",
      base."updatedAt"
    FROM "customerBonusPrograms" base
    WHERE base."tenantId" = ${escapeSqlValue(tenantId)}
      AND base."isActive" = TRUE
    ORDER BY base."updatedAt" DESC, base."createdAt" DESC
    LIMIT 1
  `);
  return normalizeProgram(rows[0] || null);
};

const deactivateOtherPrograms = async (tenantId, activeId) => {
  await prisma.$executeRawUnsafe(`
    UPDATE "customerBonusPrograms"
    SET "isActive" = FALSE, "updatedAt" = NOW()
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "id" <> ${escapeSqlValue(activeId)}
  `);
};

const createCustomerBonusProgram = async (tenantId, payload) => {
  await ensureCustomerBonusProgramsTable();
  const id = createId();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "customerBonusPrograms" (
      "id", "tenantId", "name", "amountThreshold", "pointsAwarded",
      "pointValueAmount", "quotaPoints", "quotaPeriodDays", "quotaRewardAmount", "isActive"
    )
    VALUES (
      ${escapeSqlValue(id)},
      ${escapeSqlValue(tenantId)},
      ${escapeSqlValue(payload.name)},
      ${escapeSqlValue(payload.amountThreshold)},
      ${escapeSqlValue(payload.pointsAwarded)},
      ${escapeSqlValue(payload.pointValueAmount)},
      ${escapeSqlValue(payload.quotaPoints)},
      ${escapeSqlValue(payload.quotaPeriodDays)},
      ${escapeSqlValue(payload.quotaRewardAmount)},
      ${escapeSqlValue(payload.isActive !== false)}
    )
  `);
  if (payload.isActive !== false) {
    await deactivateOtherPrograms(tenantId, id);
  }
  return getCustomerBonusProgramById(tenantId, id);
};

const updateCustomerBonusProgram = async (tenantId, id, payload) => {
  await ensureCustomerBonusProgramsTable();
  await prisma.$executeRawUnsafe(`
    UPDATE "customerBonusPrograms"
    SET
      "name" = ${escapeSqlValue(payload.name)},
      "amountThreshold" = ${escapeSqlValue(payload.amountThreshold)},
      "pointsAwarded" = ${escapeSqlValue(payload.pointsAwarded)},
      "pointValueAmount" = ${escapeSqlValue(payload.pointValueAmount)},
      "quotaPoints" = ${escapeSqlValue(payload.quotaPoints)},
      "quotaPeriodDays" = ${escapeSqlValue(payload.quotaPeriodDays)},
      "quotaRewardAmount" = ${escapeSqlValue(payload.quotaRewardAmount)},
      "isActive" = ${escapeSqlValue(payload.isActive !== false)},
      "updatedAt" = NOW()
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "id" = ${escapeSqlValue(id)}
  `);
  if (payload.isActive !== false) {
    await deactivateOtherPrograms(tenantId, id);
  }
  return getCustomerBonusProgramById(tenantId, id);
};

const setCurrentCustomerBonusProgram = async (tenantId, id) => {
  await ensureCustomerBonusProgramsTable();
  await prisma.$executeRawUnsafe(`
    UPDATE "customerBonusPrograms"
    SET
      "isActive" = CASE WHEN "id" = ${escapeSqlValue(id)} THEN TRUE ELSE FALSE END,
      "updatedAt" = NOW()
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
  `);
  return getCustomerBonusProgramById(tenantId, id);
};

const deleteCustomerBonusProgram = async (tenantId, id) => {
  await ensureCustomerBonusProgramsTable();
  await prisma.$executeRawUnsafe(`
    DELETE FROM "customerBonusPrograms"
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "id" = ${escapeSqlValue(id)}
  `);
};

module.exports = {
  ensureCustomerBonusProgramsTable,
  listCustomerBonusPrograms,
  getCustomerBonusProgramById,
  getCurrentCustomerBonusProgram,
  createCustomerBonusProgram,
  updateCustomerBonusProgram,
  setCurrentCustomerBonusProgram,
  deleteCustomerBonusProgram,
};
