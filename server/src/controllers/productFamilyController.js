const prisma = require("../config/prisma");
const { sendWorkbook, readSheetRows } = require("../utils/xlsxTemplates");
const {
  parseListParams,
  buildMeta,
  buildDateRangeFilter,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const {
  FAMILY_KIND,
  listProductFamiliesByKind,
  getProductFamilyByKind,
  findProductFamilyByName,
  createProductFamilyByKind,
  updateProductFamilyByKind,
  deleteProductFamilyByKind,
} = require("../utils/productFamilyKindStore");
const { ensureProductCategoryStructure } = require("../utils/productCategoryHierarchyStore");

const createFamily = async (req, res) => {
  const { name, categoryId } = req.body || {};
  if (!name) {
    return res.status(400).json({ message: "Le nom est requis." });
  }

  await ensureProductCategoryStructure();
  if (categoryId) {
    const category = await prisma.$queryRawUnsafe(`
      SELECT "id"
      FROM "productCategories"
      WHERE "tenantId" = '${String(req.user.tenantId).replace(/'/g, "''")}'
        AND "id" = '${String(categoryId).replace(/'/g, "''")}'
      LIMIT 1
    `);
    if (!category[0]) {
      return res.status(400).json({ message: "La categorie selectionnee est invalide." });
    }
  }

  const family = await createProductFamilyByKind({
    tenantId: req.user.tenantId,
    name,
    kind: FAMILY_KIND.FAMILY,
    categoryId: categoryId || null,
  });

  return res.status(201).json(family);
};

const listFamilies = async (req, res) => {
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const { rows, total } = await listProductFamiliesByKind({
    tenantId: req.user.tenantId,
    kind: FAMILY_KIND.FAMILY,
    search,
    createdFrom: createdAtFilter.createdAt?.gte,
    createdTo: createdAtFilter.createdAt?.lte,
    page,
    pageSize,
    paginate,
    sortBy,
    sortDir,
  });

  if (exportType) {
    return sendExport(
      res,
      rows.map((item) => ({
        id: item.id,
        name: item.name,
        createdAt: item.createdAt,
      })),
      "product-families",
      exportType,
    );
  }

  if (!paginate) {
    return res.json(rows);
  }

  return res.json({
    data: rows,
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const updateFamily = async (req, res) => {
  const { id } = req.params;
  const { name, categoryId } = req.body || {};

  const family = await getProductFamilyByKind({
    tenantId: req.user.tenantId,
    id,
    kind: FAMILY_KIND.FAMILY,
  });
  if (!family) {
    return res.status(404).json({ message: "Famille introuvable." });
  }

  if (categoryId) {
    const category = await prisma.$queryRawUnsafe(`
      SELECT "id"
      FROM "productCategories"
      WHERE "tenantId" = '${String(req.user.tenantId).replace(/'/g, "''")}'
        AND "id" = '${String(categoryId).replace(/'/g, "''")}'
      LIMIT 1
    `);
    if (!category[0]) {
      return res.status(400).json({ message: "La categorie selectionnee est invalide." });
    }
  }

  const updated = await updateProductFamilyByKind({
    tenantId: req.user.tenantId,
    id,
    name: name || family.name,
    kind: FAMILY_KIND.FAMILY,
    categoryId:
      categoryId === undefined ? family.categoryId || null : categoryId || null,
  });

  return res.json(updated);
};

const deleteFamily = async (req, res) => {
  const { id } = req.params;

  const family = await getProductFamilyByKind({
    tenantId: req.user.tenantId,
    id,
    kind: FAMILY_KIND.FAMILY,
  });
  if (!family) {
    return res.status(404).json({ message: "Famille introuvable." });
  }

  const deletion = await deleteProductFamilyByKind({
    tenantId: req.user.tenantId,
    id,
    kind: FAMILY_KIND.FAMILY,
  });

  if (deletion.blocked && deletion.reason === "PRODUCTS") {
    return res.status(400).json({ message: "La famille est utilisee par des produits." });
  }

  if (deletion.blocked && deletion.reason === "SUB_FAMILIES") {
    return res.status(400).json({
      message: "La famille contient des sous-familles. Supprimez-les d'abord.",
    });
  }

  return res.json({ message: "Famille supprimee." });
};

const downloadFamiliesTemplate = async (_req, res) =>
  sendWorkbook(res, "template-familles", [
    {
      name: "Families",
      rows: [{ name: "Antalgiques", categoryName: "Medicaments" }],
    },
  ]);

const importFamilies = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Fichier Excel requis." });
  }

  try {
    const rows = readSheetRows(req.file.buffer, "Families");
    let created = 0;
    const errors = [];

    for (const [index, row] of rows.entries()) {
      const name = String(row.name || row.Name || "").trim();
      const categoryName = String(row.categoryName || row.CategoryName || "").trim();
      if (!name) {
        continue;
      }

      try {
        const existing = await findProductFamilyByName({
          tenantId: req.user.tenantId,
          name,
          kind: FAMILY_KIND.FAMILY,
        });

        if (!existing) {
          let categoryId = null;
          if (categoryName) {
            const categoryRows = await prisma.$queryRawUnsafe(`
              SELECT "id"
              FROM "productCategories"
              WHERE "tenantId" = '${String(req.user.tenantId).replace(/'/g, "''")}'
                AND LOWER("name") = LOWER('${String(categoryName).replace(/'/g, "''")}')
              LIMIT 1
            `);
            if (!categoryRows[0]) {
              throw new Error("Categorie introuvable.");
            }
            categoryId = categoryRows[0].id;
          }
          await createProductFamilyByKind({
            tenantId: req.user.tenantId,
            name,
            kind: FAMILY_KIND.FAMILY,
            categoryId,
          });
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
      message: "Import familles termine.",
      created,
      failed: errors.length,
      errors,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Impossible d'importer les familles.",
    });
  }
};

module.exports = {
  createFamily,
  downloadFamiliesTemplate,
  importFamilies,
  listFamilies,
  updateFamily,
  deleteFamily,
};
