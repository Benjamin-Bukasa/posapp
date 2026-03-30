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
  validateParentFamily,
  createProductFamilyByKind,
  updateProductFamilyByKind,
  deleteProductFamilyByKind,
} = require("../utils/productFamilyKindStore");

const createSubFamily = async (req, res) => {
  const { name, parentFamilyId } = req.body || {};
  if (!name) {
    return res.status(400).json({ message: "Le nom est requis." });
  }

  if (parentFamilyId) {
    const parentFamily = await validateParentFamily({
      tenantId: req.user.tenantId,
      parentFamilyId,
    });
    if (!parentFamily) {
      return res.status(400).json({ message: "La famille parente est introuvable." });
    }
  }

  const subFamily = await createProductFamilyByKind({
    tenantId: req.user.tenantId,
    name,
    kind: FAMILY_KIND.SUB_FAMILY,
    parentFamilyId: parentFamilyId || null,
  });

  return res.status(201).json(subFamily);
};

const listSubFamilies = async (req, res) => {
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const { rows, total } = await listProductFamiliesByKind({
    tenantId: req.user.tenantId,
    kind: FAMILY_KIND.SUB_FAMILY,
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
        parentFamily: item.parentFamily?.name || "",
        createdAt: item.createdAt,
      })),
      "product-subfamilies",
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

const updateSubFamily = async (req, res) => {
  const { id } = req.params;
  const { name, parentFamilyId } = req.body || {};

  const subFamily = await getProductFamilyByKind({
    tenantId: req.user.tenantId,
    id,
    kind: FAMILY_KIND.SUB_FAMILY,
  });
  if (!subFamily) {
    return res.status(404).json({ message: "Sous-famille introuvable." });
  }

  const resolvedParentFamilyId =
    parentFamilyId === undefined ? subFamily.parentFamilyId : parentFamilyId || null;

  if (resolvedParentFamilyId) {
    const parentFamily = await validateParentFamily({
      tenantId: req.user.tenantId,
      parentFamilyId: resolvedParentFamilyId,
    });
    if (!parentFamily) {
      return res.status(400).json({ message: "La famille parente est introuvable." });
    }
  }

  const updated = await updateProductFamilyByKind({
    tenantId: req.user.tenantId,
    id,
    name: name || subFamily.name,
    kind: FAMILY_KIND.SUB_FAMILY,
    parentFamilyId: resolvedParentFamilyId,
  });

  return res.json(updated);
};

const deleteSubFamily = async (req, res) => {
  const { id } = req.params;

  const subFamily = await getProductFamilyByKind({
    tenantId: req.user.tenantId,
    id,
    kind: FAMILY_KIND.SUB_FAMILY,
  });
  if (!subFamily) {
    return res.status(404).json({ message: "Sous-famille introuvable." });
  }

  const deletion = await deleteProductFamilyByKind({
    tenantId: req.user.tenantId,
    id,
    kind: FAMILY_KIND.SUB_FAMILY,
  });

  if (deletion.blocked) {
    return res.status(400).json({
      message: "La sous-famille est utilisee par des produits et ne peut pas etre supprimee.",
    });
  }

  return res.json({ message: "Sous-famille supprimee." });
};

const downloadSubFamiliesTemplate = async (_req, res) =>
  sendWorkbook(res, "template-sous-familles", [
    {
      name: "SubFamilies",
      rows: [{ name: "Antalgiques majeurs", parentFamilyName: "Antalgiques" }],
    },
  ]);

const importSubFamilies = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Fichier Excel requis." });
  }

  try {
    const rows = readSheetRows(req.file.buffer, "SubFamilies");
    let created = 0;
    const errors = [];

    for (const [index, row] of rows.entries()) {
      const name = String(row.name || row.Name || "").trim();
      const parentFamilyName = String(
        row.parentFamilyName || row.ParentFamilyName || row.familyName || "",
      ).trim();

      if (!name) {
        continue;
      }

      try {
        const existing = await findProductFamilyByName({
          tenantId: req.user.tenantId,
          name,
          kind: FAMILY_KIND.SUB_FAMILY,
        });

        if (existing) {
          continue;
        }

        let parentFamilyId = null;
        if (parentFamilyName) {
          const parentFamily = await findProductFamilyByName({
            tenantId: req.user.tenantId,
            name: parentFamilyName,
            kind: FAMILY_KIND.FAMILY,
          });

          if (!parentFamily) {
            throw new Error("Famille parente introuvable.");
          }

          parentFamilyId = parentFamily.id;
        }

        await createProductFamilyByKind({
          tenantId: req.user.tenantId,
          name,
          kind: FAMILY_KIND.SUB_FAMILY,
          parentFamilyId,
        });
        created += 1;
      } catch (error) {
        errors.push({
          line: index + 2,
          message: error.message,
          identifier: name,
        });
      }
    }

    return res.json({
      message: "Import sous-familles termine.",
      created,
      failed: errors.length,
      errors,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Impossible d'importer les sous-familles.",
    });
  }
};

module.exports = {
  createSubFamily,
  listSubFamilies,
  updateSubFamily,
  deleteSubFamily,
  downloadSubFamiliesTemplate,
  importSubFamilies,
};
