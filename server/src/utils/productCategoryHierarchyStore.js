const prisma = require("../config/prisma");

const ensureProductCategoryStructure = async () => {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "productCategories"
    ADD COLUMN IF NOT EXISTS "collectionId" TEXT NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "productFamilies"
    ADD COLUMN IF NOT EXISTS "categoryId" TEXT NULL
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "productCategories_collectionId_idx"
    ON "productCategories" ("collectionId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "productFamilies_categoryId_idx"
    ON "productFamilies" ("categoryId")
  `);
};

const ensureProductCollectionsTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "productCollections" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "productCollections_tenantId_idx"
    ON "productCollections" ("tenantId")
  `);
};

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
    : `col_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const buildFilterSql = ({ tenantId, search, createdFrom, createdTo, extra = [] }) => {
  const clauses = [`base."tenantId" = ${escapeSqlValue(tenantId)}`];

  if (search) {
    clauses.push(`base."name" ILIKE ${escapeSqlValue(`%${search}%`)}`);
  }
  if (createdFrom) {
    clauses.push(`base."createdAt" >= ${escapeSqlValue(createdFrom)}`);
  }
  if (createdTo) {
    clauses.push(`base."createdAt" <= ${escapeSqlValue(createdTo)}`);
  }
  extra.forEach((clause) => {
    if (clause) clauses.push(clause);
  });

  return clauses.join(" AND ");
};

const buildOrderSql = (sortBy, sortDir, allowed = {}, fallback) => {
  const direction = String(sortDir).toLowerCase() === "asc" ? "ASC" : "DESC";
  if (allowed[sortBy]) {
    return `${allowed[sortBy]} ${direction}`;
  }
  return fallback;
};

const listCollections = async ({
  tenantId,
  search,
  createdFrom,
  createdTo,
  paginate,
  page,
  pageSize,
  sortBy,
  sortDir,
}) => {
  await ensureProductCollectionsTable();
  const whereSql = buildFilterSql({ tenantId, search, createdFrom, createdTo });
  const orderSql = buildOrderSql(
    sortBy,
    sortDir,
    { name: `base."name"`, createdAt: `base."createdAt"` },
    `base."name" ASC`,
  );

  if (!paginate) {
    return prisma.$queryRawUnsafe(`
      SELECT
        base."id",
        base."tenantId",
        base."name",
        base."createdAt",
        base."updatedAt"
      FROM "productCollections" base
      WHERE ${whereSql}
      ORDER BY ${orderSql}
    `);
  }

  const [countRows, rows] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS "count"
      FROM "productCollections" base
      WHERE ${whereSql}
    `),
    prisma.$queryRawUnsafe(`
      SELECT
        base."id",
        base."tenantId",
        base."name",
        base."createdAt",
        base."updatedAt"
      FROM "productCollections" base
      WHERE ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ${Number(pageSize)}
      OFFSET ${Number((page - 1) * pageSize)}
    `),
  ]);

  return {
    total: countRows?.[0]?.count || 0,
    rows,
  };
};

const findCollectionById = async ({ tenantId, id }) => {
  await ensureProductCollectionsTable();
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      base."id",
      base."tenantId",
      base."name",
      base."createdAt",
      base."updatedAt"
    FROM "productCollections" base
    WHERE base."tenantId" = ${escapeSqlValue(tenantId)}
      AND base."id" = ${escapeSqlValue(id)}
    LIMIT 1
  `);
  return rows[0] || null;
};

const findCollectionByName = async ({ tenantId, name }) => {
  await ensureProductCollectionsTable();
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      base."id",
      base."tenantId",
      base."name",
      base."createdAt",
      base."updatedAt"
    FROM "productCollections" base
    WHERE base."tenantId" = ${escapeSqlValue(tenantId)}
      AND LOWER(base."name") = LOWER(${escapeSqlValue(name)})
    LIMIT 1
  `);
  return rows[0] || null;
};

const createCollection = async ({ tenantId, name }) => {
  await ensureProductCollectionsTable();
  const id = createId();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "productCollections" ("id", "tenantId", "name")
    VALUES (${escapeSqlValue(id)}, ${escapeSqlValue(tenantId)}, ${escapeSqlValue(name)})
  `);
  return findCollectionById({ tenantId, id });
};

const updateCollection = async ({ tenantId, id, name }) => {
  await ensureProductCollectionsTable();
  await prisma.$executeRawUnsafe(`
    UPDATE "productCollections"
    SET
      "name" = ${escapeSqlValue(name)},
      "updatedAt" = NOW()
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "id" = ${escapeSqlValue(id)}
  `);
  return findCollectionById({ tenantId, id });
};

const deleteCollection = async ({ id }) => {
  await ensureProductCollectionsTable();
  await prisma.$executeRawUnsafe(`
    DELETE FROM "productCollections"
    WHERE "id" = ${escapeSqlValue(id)}
  `);
};

module.exports = {
  ensureProductCategoryStructure,
  ensureProductCollectionsTable,
  listCollections,
  findCollectionById,
  findCollectionByName,
  createCollection,
  updateCollection,
  deleteCollection,
};
