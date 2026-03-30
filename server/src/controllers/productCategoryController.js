const prisma = require("../config/prisma");
const { sendWorkbook, readSheetRows } = require("../utils/xlsxTemplates");
const { parseListParams, buildMeta, buildDateRangeFilter } = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const {
  ensureProductCategoryStructure,
  findCollectionById,
  findCollectionByName,
} = require("../utils/productCategoryHierarchyStore");

const escapeSqlValue = (value) => `'${String(value).replace(/'/g, "''")}'`;

const mapCategory = (row) => ({
  id: row.id,
  tenantId: row.tenantId,
  name: row.name,
  collectionId: row.collectionId || null,
  collection: row.collectionId
    ? { id: row.collectionId, name: row.collectionName || null }
    : null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const listCategoryRows = async ({
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
  await ensureProductCategoryStructure();

  const clauses = [`base."tenantId" = ${escapeSqlValue(tenantId)}`];
  if (search) clauses.push(`base."name" ILIKE ${escapeSqlValue(`%${search}%`)}`);
  if (createdFrom) clauses.push(`base."createdAt" >= ${escapeSqlValue(createdFrom.toISOString())}`);
  if (createdTo) clauses.push(`base."createdAt" <= ${escapeSqlValue(createdTo.toISOString())}`);
  const whereSql = clauses.join(" AND ");
  const orderMap = {
    name: `base."name"`,
    createdAt: `base."createdAt"`,
  };
  const orderSql = `${orderMap[sortBy] || `base."name"`} ${
    String(sortDir).toLowerCase() === "asc" ? "ASC" : "DESC"
  }`;

  if (!paginate) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        base."id",
        base."tenantId",
        base."name",
        base."collectionId",
        base."createdAt",
        base."updatedAt",
        collection."name" AS "collectionName"
      FROM "productCategories" base
      LEFT JOIN "productCollections" collection ON collection."id" = base."collectionId"
      WHERE ${whereSql}
      ORDER BY ${orderSql}
    `);
    return { total: rows.length, rows: rows.map(mapCategory) };
  }

  const [countRows, rows] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS "count"
      FROM "productCategories" base
      WHERE ${whereSql}
    `),
    prisma.$queryRawUnsafe(`
      SELECT
        base."id",
        base."tenantId",
        base."name",
        base."collectionId",
        base."createdAt",
        base."updatedAt",
        collection."name" AS "collectionName"
      FROM "productCategories" base
      LEFT JOIN "productCollections" collection ON collection."id" = base."collectionId"
      WHERE ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ${Number(pageSize)}
      OFFSET ${Number((page - 1) * pageSize)}
    `),
  ]);

  return {
    total: countRows?.[0]?.count || 0,
    rows: rows.map(mapCategory),
  };
};

const getCategoryById = async ({ tenantId, id }) => {
  await ensureProductCategoryStructure();
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      base."id",
      base."tenantId",
      base."name",
      base."collectionId",
      base."createdAt",
      base."updatedAt",
      collection."name" AS "collectionName"
    FROM "productCategories" base
    LEFT JOIN "productCollections" collection ON collection."id" = base."collectionId"
    WHERE base."tenantId" = ${escapeSqlValue(tenantId)}
      AND base."id" = ${escapeSqlValue(id)}
    LIMIT 1
  `);
  return rows[0] ? mapCategory(rows[0]) : null;
};

const createCategory = async (req, res) => {
  const { name, collectionId } = req.body || {};
  if (!name) {
    return res.status(400).json({ message: "Le nom est requis." });
  }

  await ensureProductCategoryStructure();

  if (collectionId) {
    const collection = await findCollectionById({
      tenantId: req.user.tenantId,
      id: collectionId,
    });
    if (!collection) {
      return res.status(400).json({ message: "La collection selectionnee est invalide." });
    }
  }

  const category = await prisma.productCategory.create({
    data: { tenantId: req.user.tenantId, name },
  });

  await prisma.$executeRawUnsafe(`
    UPDATE "productCategories"
    SET "collectionId" = ${collectionId ? escapeSqlValue(collectionId) : "NULL"}
    WHERE "id" = ${escapeSqlValue(category.id)}
  `);

  return res.status(201).json(await getCategoryById({
    tenantId: req.user.tenantId,
    id: category.id,
  }));
};

const listCategories = async (req, res) => {
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const result = await listCategoryRows({
    tenantId: req.user.tenantId,
    search,
    createdFrom: createdAtFilter.createdAt?.gte,
    createdTo: createdAtFilter.createdAt?.lte,
    paginate,
    page,
    pageSize,
    sortBy,
    sortDir,
  });

  if (exportType) {
    return sendExport(
      res,
      result.rows.map((item) => ({
        id: item.id,
        name: item.name,
        collection: item.collection?.name || "",
        createdAt: item.createdAt,
      })),
      "product-categories",
      exportType,
    );
  }

  if (!paginate) {
    return res.json(result.rows);
  }

  return res.json({
    data: result.rows,
    meta: buildMeta({ page, pageSize, total: result.total, sortBy, sortDir }),
  });
};

const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, collectionId } = req.body || {};

  const category = await getCategoryById({
    tenantId: req.user.tenantId,
    id,
  });
  if (!category) {
    return res.status(404).json({ message: "Categorie introuvable." });
  }

  if (collectionId) {
    const collection = await findCollectionById({
      tenantId: req.user.tenantId,
      id: collectionId,
    });
    if (!collection) {
      return res.status(400).json({ message: "La collection selectionnee est invalide." });
    }
  }

  await prisma.productCategory.update({
    where: { id },
    data: { name: name || category.name },
  });

  await prisma.$executeRawUnsafe(`
    UPDATE "productCategories"
    SET
      "collectionId" = ${
        collectionId === undefined
          ? category.collectionId
            ? escapeSqlValue(category.collectionId)
            : "NULL"
          : collectionId
          ? escapeSqlValue(collectionId)
          : "NULL"
      }
    WHERE "id" = ${escapeSqlValue(id)}
  `);

  return res.json(await getCategoryById({ tenantId: req.user.tenantId, id }));
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;

  const category = await getCategoryById({
    tenantId: req.user.tenantId,
    id,
  });
  if (!category) {
    return res.status(404).json({ message: "Categorie introuvable." });
  }

  const familyRows = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS "count"
    FROM "productFamilies"
    WHERE "tenantId" = ${escapeSqlValue(req.user.tenantId)}
      AND "categoryId" = ${escapeSqlValue(id)}
  `);
  if ((familyRows?.[0]?.count || 0) > 0) {
    return res.status(400).json({
      message: "La categorie contient des familles. Supprimez-les d'abord.",
    });
  }

  const productCount = await prisma.product.count({
    where: { categoryId: id },
  });
  if (productCount > 0) {
    return res.status(400).json({ message: "La categorie est utilisee par des produits." });
  }

  await prisma.productCategory.delete({ where: { id } });
  return res.json({ message: "Categorie supprimee." });
};

const downloadCategoriesTemplate = async (_req, res) =>
  sendWorkbook(res, "template-categories", [
    {
      name: "Categories",
      rows: [{ name: "Medicaments", collectionName: "Pharmacie" }],
    },
  ]);

const importCategories = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Fichier Excel requis." });
  }

  try {
    const rows = readSheetRows(req.file.buffer, "Categories");
    let created = 0;
    const errors = [];

    for (const [index, row] of rows.entries()) {
      const name = String(row.name || row.Name || "").trim();
      const collectionName = String(
        row.collectionName || row.CollectionName || "",
      ).trim();
      if (!name) continue;

      try {
        const existing = await prisma.productCategory.findFirst({
          where: { tenantId: req.user.tenantId, name },
        });

        if (!existing) {
          let collectionId = null;
          if (collectionName) {
            const collection = await findCollectionByName({
              tenantId: req.user.tenantId,
              name: collectionName,
            });
            if (!collection) {
              throw new Error("Collection introuvable.");
            }
            collectionId = collection.id;
          }

          const category = await prisma.productCategory.create({
            data: { tenantId: req.user.tenantId, name },
          });

          await prisma.$executeRawUnsafe(`
            UPDATE "productCategories"
            SET "collectionId" = ${collectionId ? escapeSqlValue(collectionId) : "NULL"}
            WHERE "id" = ${escapeSqlValue(category.id)}
          `);

          created += 1;
        }
      } catch (error) {
        errors.push({
          line: index + 2,
          message: error.message,
          identifier: name,
        });
      }
    }

    return res.json({
      message: "Import categories termine.",
      created,
      failed: errors.length,
      errors,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Impossible d'importer les categories.",
    });
  }
};

module.exports = {
  createCategory,
  downloadCategoriesTemplate,
  importCategories,
  listCategories,
  updateCategory,
  deleteCategory,
};
