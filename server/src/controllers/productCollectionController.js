const { sendWorkbook, readSheetRows } = require("../utils/xlsxTemplates");
const { parseListParams, buildMeta, buildDateRangeFilter } = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const {
  ensureProductCollectionsTable,
  listCollections,
  findCollectionById,
  findCollectionByName,
  createCollection,
  updateCollection,
  deleteCollection,
} = require("../utils/productCategoryHierarchyStore");
const prisma = require("../config/prisma");

const createProductCollection = async (req, res) => {
  const { name } = req.body || {};
  if (!name) {
    return res.status(400).json({ message: "Le nom est requis." });
  }

  const collection = await createCollection({
    tenantId: req.user.tenantId,
    name,
  });

  return res.status(201).json(collection);
};

const listProductCollections = async (req, res) => {
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const result = await listCollections({
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
    const rows = Array.isArray(result)
      ? result
      : result.rows;
    return sendExport(res, rows, "product-collections", exportType);
  }

  if (!paginate) {
    return res.json(result);
  }

  return res.json({
    data: result.rows,
    meta: buildMeta({
      page,
      pageSize,
      total: result.total,
      sortBy,
      sortDir,
    }),
  });
};

const updateProductCollection = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body || {};

  await ensureProductCollectionsTable();
  const collection = await findCollectionById({
    tenantId: req.user.tenantId,
    id,
  });
  if (!collection) {
    return res.status(404).json({ message: "Collection introuvable." });
  }

  const updated = await updateCollection({
    tenantId: req.user.tenantId,
    id,
    name: name || collection.name,
  });

  return res.json(updated);
};

const deleteProductCollection = async (req, res) => {
  const { id } = req.params;

  await ensureProductCollectionsTable();
  const collection = await findCollectionById({
    tenantId: req.user.tenantId,
    id,
  });
  if (!collection) {
    return res.status(404).json({ message: "Collection introuvable." });
  }

  const categoryRows = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS "count"
    FROM "productCategories"
    WHERE "tenantId" = '${String(req.user.tenantId).replace(/'/g, "''")}'
      AND "collectionId" = '${String(id).replace(/'/g, "''")}'
  `);

  if ((categoryRows?.[0]?.count || 0) > 0) {
    return res.status(400).json({
      message: "La collection contient des categories. Supprimez-les d'abord.",
    });
  }

  await deleteCollection({ id });
  return res.json({ message: "Collection supprimee." });
};

const downloadCollectionsTemplate = async (_req, res) =>
  sendWorkbook(res, "template-collections", [
    {
      name: "Collections",
      rows: [{ name: "Pharmacie" }],
    },
  ]);

const importCollections = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Fichier Excel requis." });
  }

  try {
    const rows = readSheetRows(req.file.buffer, "Collections");
    let created = 0;
    const errors = [];

    for (const [index, row] of rows.entries()) {
      const name = String(row.name || row.Name || "").trim();
      if (!name) continue;

      try {
        const existing = await findCollectionByName({
          tenantId: req.user.tenantId,
          name,
        });
        if (!existing) {
          await createCollection({ tenantId: req.user.tenantId, name });
          created += 1;
        }
      } catch (error) {
        errors.push({
          line: index + 2,
          identifier: name,
          message: error.message,
        });
      }
    }

    return res.json({
      message: "Import collections termine.",
      created,
      failed: errors.length,
      errors,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Impossible d'importer les collections.",
    });
  }
};

module.exports = {
  createProductCollection,
  listProductCollections,
  updateProductCollection,
  deleteProductCollection,
  downloadCollectionsTemplate,
  importCollections,
};
