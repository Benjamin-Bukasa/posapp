const prisma = require("../config/prisma");
const { ensureProductCategoryStructure } = require("./productCategoryHierarchyStore");

const FAMILY_KIND = Object.freeze({
  FAMILY: "FAMILY",
  SUB_FAMILY: "SUB_FAMILY",
});

const ensureProductFamilyStructure = async () => {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "productFamilies"
    ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'FAMILY'
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "productFamilies"
    ADD COLUMN IF NOT EXISTS "parentFamilyId" TEXT NULL
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "productFamilies_tenantId_kind_idx"
    ON "productFamilies" ("tenantId", "kind")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "productFamilies_parentFamilyId_idx"
    ON "productFamilies" ("parentFamilyId")
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "productFamilies"
    SET "kind" = 'FAMILY'
    WHERE "kind" IS NULL OR "kind" = ''
  `);
};

const mapFamilyRow = (row) => ({
  id: row.id,
  tenantId: row.tenantId,
  name: row.name,
  kind: row.kind || FAMILY_KIND.FAMILY,
  categoryId: row.categoryId || null,
  category: row.categoryId
    ? {
        id: row.categoryId,
        name: row.categoryName || null,
      }
    : null,
  parentFamilyId: row.parentFamilyId || null,
  parentFamily: row.parentFamilyId
    ? {
        id: row.parentFamilyId,
        name: row.parentFamilyName || null,
      }
    : null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const escapeSqlValue = (value) => {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (value instanceof Date) {
    return `'${value.toISOString().replace(/'/g, "''")}'`;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  return `'${String(value).replace(/'/g, "''")}'`;
};

const buildWhereSql = ({ tenantId, kind, search, createdFrom, createdTo }) => {
  const clauses = [
    `pf."tenantId" = ${escapeSqlValue(tenantId)}`,
    `pf."kind" = ${escapeSqlValue(kind)}`,
  ];

  if (search) {
    clauses.push(`pf."name" ILIKE ${escapeSqlValue(`%${search}%`)}`);
  }

  if (createdFrom) {
    clauses.push(`pf."createdAt" >= ${escapeSqlValue(createdFrom)}`);
  }

  if (createdTo) {
    clauses.push(`pf."createdAt" <= ${escapeSqlValue(createdTo)}`);
  }

  return clauses.join(" AND ");
};

const buildOrderSql = (sortBy, sortDir) => {
  const direction = String(sortDir).toLowerCase() === "asc" ? "ASC" : "DESC";
  const columns = {
    name: `pf."name" ${direction}`,
    createdAt: `pf."createdAt" ${direction}`,
    updatedAt: `pf."updatedAt" ${direction}`,
  };

  return columns[sortBy] || `pf."name" ASC`;
};

const listProductFamiliesByKind = async ({
  tenantId,
  kind,
  search,
  createdFrom,
  createdTo,
  page,
  pageSize,
  paginate,
  sortBy,
  sortDir,
}) => {
  await ensureProductFamilyStructure();
  await ensureProductCategoryStructure();

  const whereSql = buildWhereSql({
    tenantId,
    kind,
    search,
    createdFrom,
    createdTo,
  });
  const orderSql = buildOrderSql(sortBy, sortDir);

  if (!paginate) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        pf."id",
        pf."tenantId",
        pf."name",
        pf."kind",
        pf."categoryId",
        pf."parentFamilyId",
        pf."createdAt",
        pf."updatedAt",
        category."name" AS "categoryName",
        parent."name" AS "parentFamilyName"
      FROM "productFamilies" pf
      LEFT JOIN "productCategories" category ON category."id" = pf."categoryId"
      LEFT JOIN "productFamilies" parent ON parent."id" = pf."parentFamilyId"
      WHERE ${whereSql}
      ORDER BY ${orderSql}
    `);

    return {
      total: rows.length,
      rows: rows.map(mapFamilyRow),
    };
  }

  const [countResult, rows] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS "count"
      FROM "productFamilies" pf
      WHERE ${whereSql}
    `),
    prisma.$queryRawUnsafe(`
      SELECT
        pf."id",
        pf."tenantId",
        pf."name",
        pf."kind",
        pf."categoryId",
        pf."parentFamilyId",
        pf."createdAt",
        pf."updatedAt",
        category."name" AS "categoryName",
        parent."name" AS "parentFamilyName"
      FROM "productFamilies" pf
      LEFT JOIN "productCategories" category ON category."id" = pf."categoryId"
      LEFT JOIN "productFamilies" parent ON parent."id" = pf."parentFamilyId"
      WHERE ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ${Number(pageSize)}
      OFFSET ${Number((page - 1) * pageSize)}
    `),
  ]);

  return {
    total: countResult?.[0]?.count || 0,
    rows: rows.map(mapFamilyRow),
  };
};

const getProductFamilyByKind = async ({ tenantId, id, kind }) => {
  await ensureProductFamilyStructure();
  await ensureProductCategoryStructure();

  const rows = await prisma.$queryRaw`
    SELECT
      pf."id",
      pf."tenantId",
      pf."name",
      pf."kind",
      pf."categoryId",
      pf."parentFamilyId",
      pf."createdAt",
      pf."updatedAt",
      category."name" AS "categoryName",
      parent."name" AS "parentFamilyName"
    FROM "productFamilies" pf
    LEFT JOIN "productCategories" category ON category."id" = pf."categoryId"
    LEFT JOIN "productFamilies" parent ON parent."id" = pf."parentFamilyId"
    WHERE pf."id" = ${id}
      AND pf."tenantId" = ${tenantId}
      AND pf."kind" = ${kind}
    LIMIT 1
  `;

  return rows[0] ? mapFamilyRow(rows[0]) : null;
};

const validateParentFamily = async ({ tenantId, parentFamilyId }) => {
  if (!parentFamilyId) {
    return null;
  }

  const parent = await getProductFamilyByKind({
    tenantId,
    id: parentFamilyId,
    kind: FAMILY_KIND.FAMILY,
  });

  return parent;
};

const findProductFamilyByName = async ({ tenantId, name, kind }) => {
  await ensureProductFamilyStructure();

  const rows = await prisma.$queryRaw`
    SELECT
      pf."id",
      pf."tenantId",
      pf."name",
      pf."kind",
      pf."parentFamilyId",
      pf."createdAt",
      pf."updatedAt"
    FROM "productFamilies" pf
    WHERE pf."tenantId" = ${tenantId}
      AND pf."kind" = ${kind}
      AND LOWER(pf."name") = LOWER(${name})
    LIMIT 1
  `;

  return rows[0] ? mapFamilyRow(rows[0]) : null;
};

const createProductFamilyByKind = async ({
  tenantId,
  name,
  kind,
  categoryId = null,
  parentFamilyId = null,
}) => {
  await ensureProductFamilyStructure();
  await ensureProductCategoryStructure();

  const created = await prisma.productFamily.create({
    data: {
      tenantId,
      name,
    },
  });

  await prisma.$executeRaw`
    UPDATE "productFamilies"
    SET
      "kind" = ${kind},
      "categoryId" = ${kind === FAMILY_KIND.FAMILY ? categoryId : null},
      "parentFamilyId" = ${kind === FAMILY_KIND.SUB_FAMILY ? parentFamilyId : null}
    WHERE "id" = ${created.id}
  `;

  return getProductFamilyByKind({ tenantId, id: created.id, kind });
};

const updateProductFamilyByKind = async ({
  tenantId,
  id,
  name,
  kind,
  categoryId = null,
  parentFamilyId = null,
}) => {
  await ensureProductFamilyStructure();
  await ensureProductCategoryStructure();

  await prisma.$executeRaw`
    UPDATE "productFamilies"
    SET
      "name" = ${name},
      "kind" = ${kind},
      "categoryId" = ${kind === FAMILY_KIND.FAMILY ? categoryId : null},
      "parentFamilyId" = ${kind === FAMILY_KIND.SUB_FAMILY ? parentFamilyId : null},
      "updatedAt" = NOW()
    WHERE "id" = ${id}
      AND "tenantId" = ${tenantId}
  `;

  return getProductFamilyByKind({ tenantId, id, kind });
};

const deleteProductFamilyByKind = async ({ tenantId, id, kind }) => {
  await ensureProductFamilyStructure();

  const productCount = await prisma.product.count({
    where: { tenantId, familyId: id },
  });

  if (productCount > 0) {
    return { blocked: true, reason: "PRODUCTS" };
  }

  if (kind === FAMILY_KIND.FAMILY) {
    const subFamilyCountRows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS "count"
      FROM "productFamilies"
      WHERE "tenantId" = ${tenantId}
        AND "kind" = ${FAMILY_KIND.SUB_FAMILY}
        AND "parentFamilyId" = ${id}
    `;
    if ((subFamilyCountRows?.[0]?.count || 0) > 0) {
      return { blocked: true, reason: "SUB_FAMILIES" };
    }
  }

  await prisma.productFamily.delete({ where: { id } });
  return { blocked: false };
};

module.exports = {
  FAMILY_KIND,
  ensureProductFamilyStructure,
  listProductFamiliesByKind,
  getProductFamilyByKind,
  findProductFamilyByName,
  validateParentFamily,
  createProductFamilyByKind,
  updateProductFamilyByKind,
  deleteProductFamilyByKind,
};
