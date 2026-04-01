const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const prisma = require("../config/prisma");
const xlsx = require("xlsx");
const { sendWorkbook, readSheetRows } = require("../utils/xlsxTemplates");
const {
  loadTenantCurrencySettings,
  normalizeCurrencyCode,
} = require("../utils/currencySettings");
const {
  attachCurrencyCodes,
  getCurrencyCodeMap,
  setCurrencyCode,
} = require("../utils/moneyCurrency");
const {
  parseListParams,
  buildOrderBy,
  contains,
  buildMeta,
  buildDateRangeFilter,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const {
  FAMILY_KIND,
  getProductFamilyByKind,
  findProductFamilyByName,
  createProductFamilyByKind,
} = require("../utils/productFamilyKindStore");
const {
  ensureProductCategoryStructure,
  findCollectionByName,
  createCollection,
} = require("../utils/productCategoryHierarchyStore");
const { normalizeManagementUnits } = require("../utils/normalizeManagementUnits");
const { ensureTaxRatesTable, findTaxRateByCodeOrName, createTaxRate } = require("../utils/taxRateStore");

const escapeSqlValue = (value) => `'${String(value).replace(/'/g, "''")}'`;

const findCategoryById = async (tenantId, id) => {
  if (!id) return null;
  await ensureProductCategoryStructure();
  const rows = await prisma.$queryRawUnsafe(`
    SELECT "id", "name", "collectionId"
    FROM "productCategories"
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "id" = ${escapeSqlValue(id)}
    LIMIT 1
  `);
  return rows[0] || null;
};

const PRODUCT_KINDS = new Set(["ARTICLE", "COMPONENT"]);
const PRODUCT_SKU_PREFIX = {
  ARTICLE: "ART",
  COMPONENT: "PROD",
};
const PRODUCT_IMAGE_MIME_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const pickRowValue = (row, aliases = []) => {
  for (const alias of aliases) {
    if (row?.[alias] !== undefined && row?.[alias] !== null && row?.[alias] !== "") {
      return row[alias];
    }
  }
  return "";
};

const ensureProductExtendedFields = async () => {
  await ensureTaxRatesTable();
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "purchaseUnitPrice" DECIMAL(10, 2) NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "tvaId" TEXT NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "subFamilyId" TEXT NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "minLevel" DECIMAL(10, 2) NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "maxLevel" DECIMAL(10, 2) NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "imageUrl" TEXT NULL
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "products_tvaId_idx"
    ON "products" ("tvaId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "products_subFamilyId_idx"
    ON "products" ("subFamilyId")
  `);
};

const getProductExtendedFieldMap = async (productIds = []) => {
  await ensureProductExtendedFields();
  const ids = [...new Set((productIds || []).filter(Boolean))];
  if (!ids.length) return new Map();

  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      product."id",
      product."purchaseUnitPrice",
      product."tvaId",
      product."subFamilyId",
      product."minLevel",
      product."maxLevel",
      product."imageUrl",
      tax."code" AS "tvaCode",
      tax."name" AS "tvaName",
      tax."rate" AS "tvaRate",
      subfamily."name" AS "subFamilyName"
    FROM "products" product
    LEFT JOIN "taxRates" tax ON tax."id" = product."tvaId"
    LEFT JOIN "productFamilies" subfamily ON subfamily."id" = product."subFamilyId"
    WHERE product."id" IN (${ids.map(escapeSqlValue).join(", ")})
  `);

  return new Map(
    rows.map((row) => [
      row.id,
      {
        purchaseUnitPrice:
          row.purchaseUnitPrice === null || row.purchaseUnitPrice === undefined
            ? null
            : Number(row.purchaseUnitPrice),
        tvaId: row.tvaId || null,
        tva: row.tvaId
          ? {
              id: row.tvaId,
              code: row.tvaCode || null,
              name: row.tvaName || null,
              rate:
                row.tvaRate === null || row.tvaRate === undefined ? null : Number(row.tvaRate),
            }
          : null,
        subFamilyId: row.subFamilyId || null,
        subFamily: row.subFamilyId
          ? {
              id: row.subFamilyId,
              name: row.subFamilyName || null,
            }
          : null,
        minLevel:
          row.minLevel === null || row.minLevel === undefined ? null : Number(row.minLevel),
        maxLevel:
          row.maxLevel === null || row.maxLevel === undefined ? null : Number(row.maxLevel),
        imageUrl: row.imageUrl || null,
      },
    ]),
  );
};

const getCategoryCollectionMap = async (categoryIds = []) => {
  await ensureProductCategoryStructure();
  const ids = [...new Set((categoryIds || []).filter(Boolean))];
  if (!ids.length) return new Map();

  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      category."id" AS "categoryId",
      category."collectionId",
      collection."name" AS "collectionName"
    FROM "productCategories" category
    LEFT JOIN "productCollections" collection ON collection."id" = category."collectionId"
    WHERE category."id" IN (${ids.map(escapeSqlValue).join(", ")})
  `);

  return new Map(
    rows.map((row) => [
      row.categoryId,
      row.collectionId
        ? {
            id: row.collectionId,
            name: row.collectionName || null,
          }
        : null,
    ]),
  );
};

const setProductExtendedFields = async (
  productId,
  { purchaseUnitPrice, tvaId, subFamilyId, minLevel, maxLevel, imageUrl },
) => {
  await ensureProductExtendedFields();
  await prisma.$executeRawUnsafe(`
    UPDATE "products"
    SET
      "purchaseUnitPrice" = ${
        purchaseUnitPrice === undefined ? `"purchaseUnitPrice"` : purchaseUnitPrice === null ? "NULL" : Number(purchaseUnitPrice)
      },
      "tvaId" = ${
        tvaId === undefined ? `"tvaId"` : tvaId ? escapeSqlValue(tvaId) : "NULL"
      },
      "subFamilyId" = ${
        subFamilyId === undefined
          ? `"subFamilyId"`
          : subFamilyId
            ? escapeSqlValue(subFamilyId)
            : "NULL"
      },
      "minLevel" = ${
        minLevel === undefined ? `"minLevel"` : minLevel === null ? "NULL" : Number(minLevel)
      },
      "maxLevel" = ${
        maxLevel === undefined ? `"maxLevel"` : maxLevel === null ? "NULL" : Number(maxLevel)
      },
      "imageUrl" = ${
        imageUrl === undefined ? `"imageUrl"` : imageUrl ? escapeSqlValue(imageUrl) : "NULL"
      }
    WHERE "id" = ${escapeSqlValue(productId)}
  `);
};

const productListInclude = ({ includeComponents = false } = {}) => ({
  category: true,
  family: true,
  saleUnit: true,
  stockUnit: true,
  dosageUnit: true,
  ...(includeComponents
    ? {
        components: {
          include: {
            dosageUnit: true,
            componentProduct: {
              select: {
                id: true,
                name: true,
                sku: true,
                kind: true,
                isActive: true,
              },
            },
          },
        },
      }
    : {}),
});

const normalizeKind = (value, fallback = "ARTICLE") => {
  const normalized = String(value || fallback).trim().toUpperCase();
  return PRODUCT_KINDS.has(normalized) ? normalized : null;
};

const toNumber = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : NaN;
};

const formatGeneratedSku = (prefix, nextValue) =>
  `${prefix}${String(nextValue).padStart(4, "0")}`;

const isSkuUniqueConstraintError = (error) =>
  error?.code === "P2002" &&
  Array.isArray(error?.meta?.target) &&
  error.meta.target.includes("sku");

const generateNextProductSku = async (kind) => {
  const prefix = PRODUCT_SKU_PREFIX[kind] || PRODUCT_SKU_PREFIX.ARTICLE;
  const rows = await prisma.$queryRawUnsafe(`
    SELECT COALESCE(
      MAX(CAST(SUBSTRING("sku" FROM ${escapeSqlValue(`^${prefix}([0-9]+)$`)}) AS INTEGER)),
      0
    ) AS "lastNumber"
    FROM "products"
    WHERE "sku" ~ ${escapeSqlValue(`^${prefix}[0-9]+$`)}
  `);

  const lastNumber = Number(rows?.[0]?.lastNumber || 0);
  return formatGeneratedSku(prefix, lastNumber + 1);
};

const createProductWithAutoSku = async ({ data, kind, explicitSku }) => {
  if (explicitSku) {
    return prisma.product.create({ data });
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const generatedSku = await generateNextProductSku(kind);
      return await prisma.product.create({
        data: {
          ...data,
          sku: generatedSku,
        },
      });
    } catch (error) {
      if (isSkuUniqueConstraintError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw Object.assign(
    new Error("Impossible de generer automatiquement un code produit unique."),
    { status: 500 },
  );
};

const findOrCreateUnitByNameType = async (tenantId, name, type) => {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;

  const existing = await prisma.unitOfMeasure.findFirst({
    where: { tenantId, name: trimmed, type },
  });

  if (existing) {
    return existing;
  }

  return prisma.unitOfMeasure.create({
    data: {
      tenantId,
      name: trimmed,
      type,
    },
  });
};

const hydrateProductsWithCurrencyCodes = async (records) => {
  const list = Array.isArray(records)
    ? records.filter(Boolean)
    : records
      ? [records]
      : [];

  if (!list.length) {
    return Array.isArray(records) ? [] : records;
  }

  const currencyMap = await getCurrencyCodeMap(
    prisma,
    "products",
    list.map((item) => item.id),
  );
  const extendedMap = await getProductExtendedFieldMap(list.map((item) => item.id));
  const categoryCollectionMap = await getCategoryCollectionMap(
    list.map((item) => item.categoryId || item.category?.id).filter(Boolean),
  );
  const hydrated = attachCurrencyCodes(list, currencyMap).map((item) => ({
    ...item,
    managementUnitId: item.saleUnitId || item.stockUnitId || null,
    managementUnit: item.saleUnit || item.stockUnit || null,
    category: item.category
      ? {
          ...item.category,
          collection: categoryCollectionMap.get(item.category.id) || null,
        }
      : null,
    ...(extendedMap.get(item.id) || {
      purchaseUnitPrice: null,
      tvaId: null,
      tva: null,
      subFamilyId: null,
      subFamily: null,
      minLevel: null,
      maxLevel: null,
      imageUrl: null,
    }),
  }));
  return Array.isArray(records) ? hydrated : hydrated[0];
};

const ensureProductImageDirectory = async () => {
  const directory = path.join(__dirname, "..", "..", "uploads", "products");
  await fs.mkdir(directory, { recursive: true });
  return directory;
};

const uploadProductImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Image requise." });
  }

  const extension =
    PRODUCT_IMAGE_MIME_TYPES[req.file.mimetype] ||
    path.extname(req.file.originalname || "").toLowerCase();

  if (!extension || !Object.values(PRODUCT_IMAGE_MIME_TYPES).includes(extension)) {
    return res.status(400).json({
      message: "Format d'image non supporte. Utilisez JPG, PNG, WEBP ou GIF.",
    });
  }

  const uploadsDirectory = await ensureProductImageDirectory();
  const filename = `${req.user.tenantId}-${Date.now()}-${randomUUID()}${extension}`;
  const filePath = path.join(uploadsDirectory, filename);

  await fs.writeFile(filePath, req.file.buffer);

  return res.status(201).json({
    message: "Image telechargee.",
    imageUrl: `/uploads/products/${filename}`,
  });
};

const sanitizeComponentRows = async ({
  tenantId,
  productId,
  components = [],
  requireArticleParent = true,
}) => {
  if (!Array.isArray(components) || !components.length) {
    throw Object.assign(new Error("components array required."), { status: 400 });
  }

  const componentProductIds = [
    ...new Set(
      components
        .map((item) => item?.componentProductId)
        .filter(Boolean),
    ),
  ];

  const componentProducts = componentProductIds.length
    ? await prisma.product.findMany({
        where: {
          tenantId,
          id: { in: componentProductIds },
        },
        select: {
          id: true,
          name: true,
          sku: true,
          kind: true,
        },
      })
    : [];

  const productMap = new Map(componentProducts.map((item) => [item.id, item]));

  const rows = components.map((item, index) => {
    const quantity = toNumber(item?.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw Object.assign(
        new Error(`Component quantity invalid on line ${index + 1}.`),
        { status: 400 },
      );
    }

    if (!item?.componentProductId && !item?.componentName) {
      throw Object.assign(
        new Error(`componentProductId or componentName required on line ${index + 1}.`),
        { status: 400 },
      );
    }

    if (item?.componentProductId) {
      const componentProduct = productMap.get(item.componentProductId);
      if (!componentProduct) {
        throw Object.assign(
          new Error(`Component product not found on line ${index + 1}.`),
          { status: 404 },
        );
      }

      if (requireArticleParent && productId && componentProduct.id === productId) {
        throw Object.assign(
          new Error("An article cannot include itself as a component."),
          { status: 400 },
        );
      }

      if (componentProduct.kind !== "COMPONENT") {
        throw Object.assign(
          new Error(
            `Only COMPONENT products can be used in a technical sheet. Invalid line ${index + 1}.`,
          ),
          { status: 400 },
        );
      }

      return {
        tenantId,
        productId,
        componentProductId: componentProduct.id,
        componentName: item.componentName || componentProduct.name,
        dosageUnitId: item.dosageUnitId || null,
        quantity,
      };
    }

    return {
      tenantId,
      productId,
      componentProductId: null,
      componentName: item.componentName,
      dosageUnitId: item.dosageUnitId || null,
      quantity,
    };
  });

  return rows;
};

const groupTechnicalSheetRows = (rows = []) => {
  const groups = new Map();

  rows.forEach((row, index) => {
    const articleKey =
      row.articleSku ||
      row.ArticleSku ||
      row.articleName ||
      row.ArticleName ||
      row.article ||
      row.Article ||
      "";
    const trimmedArticleKey = String(articleKey).trim();
    if (!trimmedArticleKey) {
      return;
    }

    if (!groups.has(trimmedArticleKey)) {
      groups.set(trimmedArticleKey, []);
    }

    groups.get(trimmedArticleKey).push({
      row,
      line: index + 2,
    });
  });

  return groups;
};

const downloadTechnicalSheetTemplate = async (req, res) => {
  const selectedArticleId = String(req.query?.articleId || "").trim();

  if (selectedArticleId) {
    const article = await prisma.product.findFirst({
      where: {
        id: selectedArticleId,
        tenantId: req.user.tenantId,
        kind: "ARTICLE",
      },
      select: { id: true, sku: true, name: true },
    });

    if (!article) {
      return res.status(404).json({ message: "Article introuvable." });
    }

    return sendWorkbook(res, "template-fiche-technique-article", [
      {
        name: "TechnicalSheets",
        rows: [
          {
            componentSku: "COMP-ALERGE",
            componentName: "Alerge",
            dosageUnit: "g",
            quantity: 2,
          },
          {
            componentSku: "COMP-FURININE",
            componentName: "Furinine",
            dosageUnit: "g",
            quantity: 4,
          },
        ],
      },
    ]);
  }

  return sendWorkbook(res, "template-fiches-techniques", [
    {
      name: "TechnicalSheets",
      rows: [
        {
          articleSku: "ART-001",
          articleName: "Alfuri",
          componentSku: "COMP-ALERGE",
          componentName: "Alerge",
          dosageUnit: "g",
          quantity: 2,
        },
        {
          articleSku: "ART-001",
          articleName: "Alfuri",
          componentSku: "COMP-FURININE",
          componentName: "Furinine",
          dosageUnit: "g",
          quantity: 4,
        },
      ],
    },
  ]);
};

const importTechnicalSheets = async (req, res) => {
  await normalizeManagementUnits(prisma);
  if (!req.file) {
    return res.status(400).json({ message: "Fichier Excel requis." });
  }

  try {
    const rows = readSheetRows(req.file.buffer, "TechnicalSheets");
    const selectedArticleId = String(req.body?.articleId || "").trim();
    let selectedArticle = null;

    if (selectedArticleId) {
      selectedArticle = await prisma.product.findFirst({
        where: {
          id: selectedArticleId,
          tenantId: req.user.tenantId,
          kind: "ARTICLE",
        },
        select: { id: true, sku: true, name: true, kind: true },
      });

      if (!selectedArticle) {
        return res.status(404).json({ message: "Article introuvable." });
      }
    }

    const groupedRows = selectedArticle
      ? new Map([
          [
            selectedArticle.id,
            rows.map((row, index) => ({
              row,
              line: index + 2,
            })),
          ],
        ])
      : groupTechnicalSheetRows(rows);
    const articleKeys = selectedArticle ? [selectedArticle.id] : [...groupedRows.keys()];

    if (!articleKeys.length) {
      return res.status(400).json({
        message: "Le fichier ne contient aucune fiche technique exploitable.",
      });
    }

    const articles = selectedArticle
      ? [selectedArticle]
      : await prisma.product.findMany({
          where: {
            tenantId: req.user.tenantId,
            kind: "ARTICLE",
            OR: articleKeys.flatMap((key) => [{ sku: key }, { name: key }]),
          },
          select: { id: true, sku: true, name: true, kind: true },
        });

    const articleMap = new Map();
    articles.forEach((article) => {
      if (article.sku) articleMap.set(String(article.sku).trim(), article);
      articleMap.set(String(article.name).trim(), article);
    });

    let updated = 0;
    const errors = [];

    for (const [articleKey, lines] of groupedRows.entries()) {
      const article = selectedArticle || articleMap.get(articleKey);
      if (!article) {
        errors.push({
          line: lines[0]?.line || "--",
          identifier: articleKey,
          message: "Article introuvable.",
        });
        continue;
      }

      try {
        const components = [];
        for (const { row, line } of lines) {
          const componentKey =
            row.componentSku ||
            row.ComponentSku ||
            row.componentName ||
            row.ComponentName ||
            row.component ||
            row.Component ||
            "";
          const dosageUnitName = row.dosageUnit || row.DosageUnit || "";
          const quantity = toNumber(row.quantity || row.Quantity);

          if (!String(componentKey).trim()) {
            throw Object.assign(
              new Error(`Composant manquant a la ligne ${line}.`),
              { status: 400 },
            );
          }

          const componentProduct = await prisma.product.findFirst({
            where: {
              tenantId: req.user.tenantId,
              kind: "COMPONENT",
              OR: [
                { sku: String(componentKey).trim() },
                { name: String(componentKey).trim() },
              ],
            },
            select: { id: true, name: true, kind: true },
          });

          if (!componentProduct) {
            throw Object.assign(
              new Error(`Produit composant introuvable a la ligne ${line}.`),
              { status: 404 },
            );
          }

          const dosageUnit = await findOrCreateUnitByNameType(
            req.user.tenantId,
            dosageUnitName,
            "DOSAGE",
          );

          components.push({
            componentProductId: componentProduct.id,
            componentName: componentProduct.name,
            dosageUnitId: dosageUnit?.id || null,
            quantity,
          });
        }

        const sanitizedComponents = await sanitizeComponentRows({
          tenantId: req.user.tenantId,
          productId: article.id,
          components,
        });

        await prisma.$transaction(async (tx) => {
          await tx.productComponent.deleteMany({
            where: { productId: article.id, tenantId: req.user.tenantId },
          });
          await tx.productComponent.createMany({
            data: sanitizedComponents,
          });
        });

        updated += 1;
      } catch (error) {
        errors.push({
          line: lines[0]?.line || "--",
          identifier: article?.name || articleKey,
          message: error.message || "Impossible d'importer cette fiche technique.",
        });
      }
    }

    return res.json({
      message: "Import fiches techniques termine.",
      created: updated,
      failed: errors.length,
      errors,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Impossible d'importer les fiches techniques.",
    });
  }
};

const ensureTechnicalSheetParent = async (tenantId, productId) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    select: { id: true, kind: true },
  });

  if (!product) {
    throw Object.assign(new Error("Product not found."), { status: 404 });
  }

  if (product.kind !== "ARTICLE") {
    throw Object.assign(
      new Error("Only ARTICLE products can have a technical sheet."),
      { status: 400 },
    );
  }

  return product;
};

const createProduct = async (req, res) => {
  await normalizeManagementUnits(prisma);
  const {
    name,
    sku,
    description,
    imageUrl,
    currencyCode,
    unitPrice,
    purchaseUnitPrice,
    minLevel,
    maxLevel,
    categoryId,
    familyId,
    subFamilyId,
    tvaId,
    managementUnitId,
    saleUnitId,
    stockUnitId,
    dosageUnitId,
    conversions,
    components,
    kind,
  } = req.body || {};

  const normalizedKind = normalizeKind(kind, "ARTICLE");
  if (!normalizedKind) {
    return res.status(400).json({ message: "Invalid product kind." });
  }

  if (!name || unitPrice === undefined) {
    return res.status(400).json({ message: "name and unitPrice are required." });
  }

  if (normalizedKind !== "ARTICLE" && Array.isArray(components) && components.length) {
    return res.status(400).json({
      message: "Only ARTICLE products can be created with technical sheet components.",
    });
  }

  try {
    await ensureProductExtendedFields();
    const resolvedManagementUnitId = managementUnitId || saleUnitId || stockUnitId || null;
    const category = await findCategoryById(req.user.tenantId, categoryId);
    if (categoryId && !category) {
      return res.status(400).json({ message: "La categorie selectionnee est invalide." });
    }

    if (familyId) {
      const family = await getProductFamilyByKind({
        tenantId: req.user.tenantId,
        id: familyId,
        kind: FAMILY_KIND.FAMILY,
      });
      if (!family) {
        return res.status(400).json({ message: "La famille selectionnee est invalide." });
      }
      if (!categoryId) {
        return res.status(400).json({
          message: "Choisissez d'abord une categorie avant de selectionner une famille.",
        });
      }
      if (family.categoryId && family.categoryId !== categoryId) {
        return res.status(400).json({
          message: "La famille selectionnee n'appartient pas a cette categorie.",
        });
      }
    }

    let subFamily = null;
    if (subFamilyId) {
      subFamily = await getProductFamilyByKind({
        tenantId: req.user.tenantId,
        id: subFamilyId,
        kind: FAMILY_KIND.SUB_FAMILY,
      });
      if (!subFamily) {
        return res.status(400).json({ message: "La sous-famille selectionnee est invalide." });
      }
      if (!familyId) {
        return res.status(400).json({
          message: "Choisissez d'abord une famille avant de selectionner une sous-famille.",
        });
      }
      if (subFamily.parentFamilyId && subFamily.parentFamilyId !== familyId) {
        return res.status(400).json({
          message: "La sous-famille selectionnee n'appartient pas a cette famille.",
        });
      }
    }

    if (tvaId) {
      const taxRate = await prisma.$queryRawUnsafe(`
        SELECT "id" FROM "taxRates"
        WHERE "id" = ${escapeSqlValue(tvaId)}
          AND "tenantId" = ${escapeSqlValue(req.user.tenantId)}
        LIMIT 1
      `);
      if (!taxRate?.[0]) {
        return res.status(400).json({ message: "La TVA selectionnee est invalide." });
      }
    }

    const currencySettings = await loadTenantCurrencySettings(
      prisma,
      req.user.tenantId,
    );
    const resolvedCurrencyCode = normalizeCurrencyCode(
      currencyCode,
      currencySettings.primaryCurrencyCode,
    );
    const product = await createProductWithAutoSku({
      kind: normalizedKind,
      explicitSku: sku,
      data: {
        tenantId: req.user.tenantId,
        kind: normalizedKind,
        name,
        sku,
        description,
        unitPrice,
        categoryId,
        familyId,
        saleUnitId: resolvedManagementUnitId,
        stockUnitId: resolvedManagementUnitId,
        dosageUnitId,
      },
    });
    await setCurrencyCode(
      prisma,
      "products",
      product.id,
      resolvedCurrencyCode,
    );
    await setProductExtendedFields(product.id, {
      purchaseUnitPrice:
        purchaseUnitPrice === undefined ? undefined : Number(purchaseUnitPrice || 0),
      tvaId: tvaId === undefined ? undefined : tvaId || null,
      subFamilyId: subFamilyId === undefined ? undefined : subFamilyId || null,
      minLevel: minLevel === undefined ? undefined : minLevel === null || minLevel === "" ? null : Number(minLevel),
      maxLevel: maxLevel === undefined ? undefined : maxLevel === null || maxLevel === "" ? null : Number(maxLevel),
      imageUrl: imageUrl === undefined ? undefined : imageUrl || null,
    });

    if (Array.isArray(conversions) && conversions.length) {
      await prisma.productUnitConversion.createMany({
        data: conversions.map((item) => ({
          tenantId: req.user.tenantId,
          productId: product.id,
          fromUnitId: item.fromUnitId,
          toUnitId: item.toUnitId,
          factor: item.factor,
        })),
        skipDuplicates: true,
      });
    }

    if (Array.isArray(components) && components.length) {
      const sanitizedComponents = await sanitizeComponentRows({
        tenantId: req.user.tenantId,
        productId: product.id,
        components,
      });

      await prisma.productComponent.createMany({ data: sanitizedComponents });
    }

    const created = await prisma.product.findUnique({
      where: { id: product.id },
      include: productListInclude({ includeComponents: true }),
    });

    return res.status(201).json(
      await hydrateProductsWithCurrencyCodes({
        ...(created || {}),
        currencyCode: currencySettings.primaryCurrencyCode,
      }),
    );
  } catch (error) {
    const status = error?.status || 500;
    return res.status(status).json({ message: error.message || "Unable to create product." });
  }
};

const listProducts = async (req, res) => {
  await normalizeManagementUnits(prisma);
  const { categoryId, familyId, isActive, kind, includeComponents } = req.query || {};
  const activeFilter =
    isActive === undefined ? undefined : String(isActive).toLowerCase() === "true";
  const normalizedKind = kind ? normalizeKind(kind) : undefined;
  if (kind && !normalizedKind) {
    return res.status(400).json({ message: "Invalid product kind." });
  }

  const shouldIncludeComponents = String(includeComponents || "").toLowerCase() === "true";
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const searchFilter = search
    ? {
        OR: [
          { name: contains(search) },
          { sku: contains(search) },
          { description: contains(search) },
          { category: { name: contains(search) } },
          { family: { name: contains(search) } },
        ],
      }
    : {};

  const where = {
    tenantId: req.user.tenantId,
    ...(categoryId ? { categoryId } : {}),
    ...(familyId ? { familyId } : {}),
    ...(normalizedKind ? { kind: normalizedKind } : {}),
    ...(activeFilter === undefined ? {} : { isActive: activeFilter }),
    ...createdAtFilter,
    ...searchFilter,
  };

  const orderBy =
    buildOrderBy(sortBy, sortDir, {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      name: "name",
      sku: "sku",
      unitPrice: "unitPrice",
      kind: "kind",
    }) || { createdAt: "desc" };

  if (exportType) {
    const data = await prisma.product.findMany({
      where,
      include: { category: true, family: true },
      orderBy,
    });
    const hydratedData = await hydrateProductsWithCurrencyCodes(data);

    const rows = hydratedData.map((item) => ({
      id: item.id,
      kind: item.kind,
      name: item.name,
      sku: item.sku,
      imageUrl: item.imageUrl || "",
      purchaseUnitPrice: item.purchaseUnitPrice ?? "",
      unitPrice: item.unitPrice,
      category: item.category?.name || "",
      family: item.family?.name || "",
      subFamily: item.subFamily?.name || "",
      tva: item.tva?.code || item.tva?.name || "",
      isActive: item.isActive,
      createdAt: item.createdAt,
    }));

    return sendExport(res, rows, "products", exportType);
  }

  const include = productListInclude({ includeComponents: shouldIncludeComponents });

  if (!paginate) {
    const products = await prisma.product.findMany({
      where,
      include,
      orderBy,
    });

    return res.json(await hydrateProductsWithCurrencyCodes(products));
  }

  const [total, products] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return res.json({
    data: await hydrateProductsWithCurrencyCodes(products),
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const getProduct = async (req, res) => {
  await normalizeManagementUnits(prisma);
  const { id } = req.params;

  const product = await prisma.product.findFirst({
    where: { id, tenantId: req.user.tenantId },
    include: {
      ...productListInclude(),
      components: {
        include: {
          dosageUnit: true,
          componentProduct: {
            include: {
              category: true,
              family: true,
              saleUnit: true,
              stockUnit: true,
              dosageUnit: true,
            },
          },
        },
      },
      unitConversions: {
        include: {
          fromUnit: true,
          toUnit: true,
        },
      },
    },
  });

  if (!product) {
    return res.status(404).json({ message: "Product not found." });
  }

  return res.json(await hydrateProductsWithCurrencyCodes(product));
};

const updateProduct = async (req, res) => {
  await normalizeManagementUnits(prisma);
  const { id } = req.params;
  const {
    name,
    sku,
    description,
    imageUrl,
    currencyCode,
    unitPrice,
    purchaseUnitPrice,
    minLevel,
    maxLevel,
    categoryId,
    familyId,
    subFamilyId,
    tvaId,
    managementUnitId,
    saleUnitId,
    stockUnitId,
    dosageUnitId,
    isActive,
    kind,
  } = req.body || {};

  const product = await prisma.product.findFirst({
    where: { id, tenantId: req.user.tenantId },
    include: {
      components: { select: { id: true } },
    },
  });
  if (!product) {
    return res.status(404).json({ message: "Product not found." });
  }

  const nextKind = kind === undefined ? product.kind : normalizeKind(kind);
  if (!nextKind) {
    return res.status(400).json({ message: "Invalid product kind." });
  }

  if (nextKind === "COMPONENT" && product.components.length > 0) {
    return res.status(400).json({
      message: "Remove the technical sheet before converting this ARTICLE into a COMPONENT.",
    });
  }

  const resolvedManagementUnitId =
    managementUnitId || saleUnitId || stockUnitId || null;
  await ensureProductExtendedFields();
  const category = await findCategoryById(req.user.tenantId, categoryId);
  if (categoryId && !category) {
    return res.status(400).json({ message: "La categorie selectionnee est invalide." });
  }

  if (familyId) {
    const family = await getProductFamilyByKind({
      tenantId: req.user.tenantId,
      id: familyId,
      kind: FAMILY_KIND.FAMILY,
    });
    if (!family) {
      return res.status(400).json({ message: "La famille selectionnee est invalide." });
    }
    if (!categoryId) {
      return res.status(400).json({
        message: "Choisissez d'abord une categorie avant de selectionner une famille.",
      });
    }
    if (family.categoryId && family.categoryId !== categoryId) {
      return res.status(400).json({
        message: "La famille selectionnee n'appartient pas a cette categorie.",
      });
    }
  }

  if (subFamilyId) {
    const subFamily = await getProductFamilyByKind({
      tenantId: req.user.tenantId,
      id: subFamilyId,
      kind: FAMILY_KIND.SUB_FAMILY,
    });
    if (!subFamily) {
      return res.status(400).json({ message: "La sous-famille selectionnee est invalide." });
    }
    if (!familyId) {
      return res.status(400).json({
        message: "Choisissez d'abord une famille avant de selectionner une sous-famille.",
      });
    }
    if (subFamily.parentFamilyId && subFamily.parentFamilyId !== familyId) {
      return res.status(400).json({
        message: "La sous-famille selectionnee n'appartient pas a cette famille.",
      });
    }
  }

  if (tvaId) {
    const taxRate = await prisma.$queryRawUnsafe(`
      SELECT "id" FROM "taxRates"
      WHERE "id" = ${escapeSqlValue(tvaId)}
        AND "tenantId" = ${escapeSqlValue(req.user.tenantId)}
      LIMIT 1
    `);
    if (!taxRate?.[0]) {
      return res.status(400).json({ message: "La TVA selectionnee est invalide." });
    }
  }

  const updated = await prisma.product.update({
    where: { id },
    data: {
      kind: nextKind,
      name,
      sku,
      description,
      unitPrice,
      categoryId,
      familyId,
      saleUnitId: resolvedManagementUnitId,
      stockUnitId: resolvedManagementUnitId,
      dosageUnitId,
      isActive,
    },
    include: productListInclude({ includeComponents: true }),
  });

  await setProductExtendedFields(updated.id, {
    purchaseUnitPrice:
      purchaseUnitPrice === undefined ? undefined : Number(purchaseUnitPrice || 0),
    tvaId: tvaId === undefined ? undefined : tvaId || null,
    subFamilyId: subFamilyId === undefined ? undefined : subFamilyId || null,
    minLevel: minLevel === undefined ? undefined : minLevel === null || minLevel === "" ? null : Number(minLevel),
    maxLevel: maxLevel === undefined ? undefined : maxLevel === null || maxLevel === "" ? null : Number(maxLevel),
    imageUrl: imageUrl === undefined ? undefined : imageUrl || null,
  });

  if (currencyCode !== undefined) {
    const currencySettings = await loadTenantCurrencySettings(
      prisma,
      req.user.tenantId,
    );
    await setCurrencyCode(
      prisma,
      "products",
      updated.id,
      normalizeCurrencyCode(currencyCode, currencySettings.primaryCurrencyCode),
    );
  }

  return res.json(await hydrateProductsWithCurrencyCodes(updated));
};

const deleteProduct = async (req, res) => {
  const { id } = req.params;

  const product = await prisma.product.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });
  if (!product) {
    return res.status(404).json({ message: "Product not found." });
  }

  const updated = await prisma.product.update({
    where: { id },
    data: { isActive: false },
  });

  return res.json(updated);
};

const getHardDeleteUsage = async (tenantId, productId) => {
  const [
    usedInComponents,
    inventoryCount,
    inventoryWithStock,
    orderItems,
    supplyRequestItems,
    purchaseRequestItems,
    purchaseOrderItems,
    deliveryNoteItems,
    stockEntryItems,
    inventoryMovements,
    productTransferItems,
  ] = await prisma.$transaction([
    prisma.productComponent.count({
      where: { tenantId, componentProductId: productId },
    }),
    prisma.inventory.count({
      where: { tenantId, productId },
    }),
    prisma.inventory.count({
      where: { tenantId, productId, quantity: { not: 0 } },
    }),
    prisma.orderItem.count({
      where: { order: { tenantId }, productId },
    }),
    prisma.supplyRequestItem.count({
      where: { tenantId, productId },
    }),
    prisma.purchaseRequestItem.count({
      where: { tenantId, productId },
    }),
    prisma.purchaseOrderItem.count({
      where: { tenantId, productId },
    }),
    prisma.deliveryNoteItem.count({
      where: { tenantId, productId },
    }),
    prisma.stockEntryItem.count({
      where: { tenantId, productId },
    }),
    prisma.inventoryMovement.count({
      where: { tenantId, productId },
    }),
    prisma.productTransferItem.count({
      where: { tenantId, productId },
    }),
  ]);

  return {
    usedInComponents,
    inventoryCount,
    inventoryWithStock,
    orderItems,
    supplyRequestItems,
    purchaseRequestItems,
    purchaseOrderItems,
    deliveryNoteItems,
    stockEntryItems,
    inventoryMovements,
    productTransferItems,
  };
};

const buildHardDeleteBlockers = (usage) => {
  const blockers = [];

  if (usage.usedInComponents > 0) {
    blockers.push("fiche(s) technique(s)");
  }

  if (usage.inventoryWithStock > 0) {
    blockers.push("stock disponible");
  }

  if (usage.inventoryMovements > 0) {
    blockers.push("historique de mouvements");
  }

  if (usage.orderItems > 0) {
    blockers.push("vente(s)");
  }

  if (usage.supplyRequestItems > 0) {
    blockers.push("requisition(s)");
  }

  if (usage.purchaseRequestItems > 0) {
    blockers.push("demande(s) d'achat");
  }

  if (usage.purchaseOrderItems > 0) {
    blockers.push("commande(s) fournisseur");
  }

  if (usage.deliveryNoteItems > 0) {
    blockers.push("bon(s) de reception");
  }

  if (usage.stockEntryItems > 0) {
    blockers.push("entree(s) de stock");
  }

  if (usage.productTransferItems > 0) {
    blockers.push("transfert(s)");
  }

  return blockers;
};

const hardDeleteProduct = async (req, res) => {
  const { id } = req.params;

  const product = await prisma.product.findFirst({
    where: { id, tenantId: req.user.tenantId },
    select: { id: true, name: true, sku: true, kind: true },
  });
  if (!product) {
    return res.status(404).json({ message: "Product not found." });
  }

  const usage = await getHardDeleteUsage(req.user.tenantId, id);
  const blockers = buildHardDeleteBlockers(usage);

  if (blockers.length) {
    return res.status(409).json({
      message: `Suppression definitive impossible pour ${product.name}. References detectees : ${blockers.join(", ")}.`,
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (usage.inventoryCount > 0) {
        await tx.inventory.deleteMany({
          where: { tenantId: req.user.tenantId, productId: id },
        });
      }

      await tx.product.delete({
        where: { id },
      });
    });

    return res.json({
      id,
      message: "Product permanently deleted.",
    });
  } catch (error) {
    if (error?.code === "P2003") {
      return res.status(409).json({
        message:
          "Suppression definitive impossible car le produit est encore reference dans des donnees liees.",
      });
    }

    return res.status(500).json({
      message: "Unable to permanently delete product.",
    });
  }
};

const addProductComponents = async (req, res) => {
  const { id } = req.params;
  const { components } = req.body || {};

  try {
    await ensureTechnicalSheetParent(req.user.tenantId, id);
    const sanitizedComponents = await sanitizeComponentRows({
      tenantId: req.user.tenantId,
      productId: id,
      components,
    });

    await prisma.productComponent.createMany({ data: sanitizedComponents });

    return res.json({ message: "Components added." });
  } catch (error) {
    const status = error?.status || 500;
    return res.status(status).json({ message: error.message || "Unable to add components." });
  }
};

const replaceProductComponents = async (req, res) => {
  const { id } = req.params;
  const { components } = req.body || {};

  try {
    await ensureTechnicalSheetParent(req.user.tenantId, id);
    const sanitizedComponents = await sanitizeComponentRows({
      tenantId: req.user.tenantId,
      productId: id,
      components,
    });

    const product = await prisma.$transaction(async (tx) => {
      await tx.productComponent.deleteMany({ where: { productId: id } });
      await tx.productComponent.createMany({ data: sanitizedComponents });

      return tx.product.findUnique({
        where: { id },
        include: {
          ...productListInclude(),
          components: {
            include: {
              dosageUnit: true,
              componentProduct: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  kind: true,
                  isActive: true,
                },
              },
            },
          },
        },
      });
    });

    return res.json(product);
  } catch (error) {
    const status = error?.status || 500;
    return res.status(status).json({ message: error.message || "Unable to replace components." });
  }
};

const deleteAllProductComponents = async (req, res) => {
  const { id } = req.params;

  try {
    await ensureTechnicalSheetParent(req.user.tenantId, id);
    await prisma.productComponent.deleteMany({
      where: { productId: id, tenantId: req.user.tenantId },
    });

    return res.json({ message: "Technical sheet cleared." });
  } catch (error) {
    const status = error?.status || 500;
    return res.status(status).json({ message: error.message || "Unable to clear technical sheet." });
  }
};

const listProductComponents = async (req, res) => {
  const { id } = req.params;
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const searchFilter = search
    ? {
        OR: [
          { componentName: contains(search) },
          { componentProduct: { name: contains(search) } },
          { dosageUnit: { name: contains(search) } },
        ],
      }
    : {};

  const where = {
    productId: id,
    tenantId: req.user.tenantId,
    ...createdAtFilter,
    ...searchFilter,
  };

  const orderBy =
    buildOrderBy(sortBy, sortDir, {
      createdAt: "createdAt",
      componentName: "componentName",
      quantity: "quantity",
    }) || { createdAt: "asc" };

  if (exportType) {
    const data = await prisma.productComponent.findMany({
      where,
      include: { dosageUnit: true, componentProduct: true },
      orderBy,
    });

    const rows = data.map((item) => ({
      id: item.id,
      componentName: item.componentName,
      componentProduct: item.componentProduct?.name || "",
      dosageUnit: item.dosageUnit?.name || "",
      quantity: item.quantity,
      createdAt: item.createdAt,
    }));

    return sendExport(res, rows, "product-components", exportType);
  }

  if (!paginate) {
    const items = await prisma.productComponent.findMany({
      where,
      include: { dosageUnit: true, componentProduct: true },
      orderBy,
    });

    return res.json(items);
  }

  const [total, items] = await prisma.$transaction([
    prisma.productComponent.count({ where }),
    prisma.productComponent.findMany({
      where,
      include: { dosageUnit: true, componentProduct: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return res.json({
    data: items,
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const updateProductComponent = async (req, res) => {
  const { id, componentId } = req.params;
  const { componentProductId, componentName, dosageUnitId, quantity } = req.body || {};

  try {
    await ensureTechnicalSheetParent(req.user.tenantId, id);

    const component = await prisma.productComponent.findFirst({
      where: { id: componentId, productId: id, tenantId: req.user.tenantId },
    });
    if (!component) {
      return res.status(404).json({ message: "Component not found." });
    }

    const [sanitized] = await sanitizeComponentRows({
      tenantId: req.user.tenantId,
      productId: id,
      components: [
        {
          componentProductId,
          componentName,
          dosageUnitId,
          quantity,
        },
      ],
    });

    const updated = await prisma.productComponent.update({
      where: { id: componentId },
      data: {
        componentProductId: sanitized.componentProductId,
        componentName: sanitized.componentName,
        dosageUnitId: sanitized.dosageUnitId,
        quantity: sanitized.quantity,
      },
      include: {
        dosageUnit: true,
        componentProduct: true,
      },
    });

    return res.json(updated);
  } catch (error) {
    const status = error?.status || 500;
    return res.status(status).json({ message: error.message || "Unable to update component." });
  }
};

const deleteProductComponent = async (req, res) => {
  const { id, componentId } = req.params;

  const component = await prisma.productComponent.findFirst({
    where: { id: componentId, productId: id, tenantId: req.user.tenantId },
  });
  if (!component) {
    return res.status(404).json({ message: "Component not found." });
  }

  await prisma.productComponent.delete({ where: { id: componentId } });

  return res.json({ message: "Component deleted." });
};

const addProductConversions = async (req, res) => {
  const { id } = req.params;
  const { conversions } = req.body || {};

  if (!Array.isArray(conversions) || !conversions.length) {
    return res.status(400).json({ message: "conversions array required." });
  }

  const product = await prisma.product.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });
  if (!product) {
    return res.status(404).json({ message: "Product not found." });
  }

  await prisma.productUnitConversion.createMany({
    data: conversions.map((item) => ({
      tenantId: req.user.tenantId,
      productId: id,
      fromUnitId: item.fromUnitId,
      toUnitId: item.toUnitId,
      factor: item.factor,
    })),
    skipDuplicates: true,
  });

  return res.json({ message: "Conversions added." });
};

const listProductConversions = async (req, res) => {
  const { id } = req.params;
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const searchFilter = search
    ? {
        OR: [
          { fromUnit: { name: contains(search) } },
          { toUnit: { name: contains(search) } },
        ],
      }
    : {};

  const where = {
    productId: id,
    tenantId: req.user.tenantId,
    ...createdAtFilter,
    ...searchFilter,
  };

  const orderBy =
    buildOrderBy(sortBy, sortDir, {
      createdAt: "createdAt",
      factor: "factor",
    }) || { createdAt: "asc" };

  if (exportType) {
    const data = await prisma.productUnitConversion.findMany({
      where,
      include: { fromUnit: true, toUnit: true },
      orderBy,
    });

    const rows = data.map((item) => ({
      id: item.id,
      fromUnit: item.fromUnit?.name || "",
      toUnit: item.toUnit?.name || "",
      factor: item.factor,
      createdAt: item.createdAt,
    }));

    return sendExport(res, rows, "product-conversions", exportType);
  }

  if (!paginate) {
    const conversions = await prisma.productUnitConversion.findMany({
      where,
      include: { fromUnit: true, toUnit: true },
      orderBy,
    });

    return res.json(conversions);
  }

  const [total, conversions] = await prisma.$transaction([
    prisma.productUnitConversion.count({ where }),
    prisma.productUnitConversion.findMany({
      where,
      include: { fromUnit: true, toUnit: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return res.json({
    data: conversions,
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const updateProductConversion = async (req, res) => {
  const { id, conversionId } = req.params;
  const { fromUnitId, toUnitId, factor } = req.body || {};

  const conversion = await prisma.productUnitConversion.findFirst({
    where: { id: conversionId, productId: id, tenantId: req.user.tenantId },
  });
  if (!conversion) {
    return res.status(404).json({ message: "Conversion not found." });
  }

  const updated = await prisma.productUnitConversion.update({
    where: { id: conversionId },
    data: { fromUnitId, toUnitId, factor },
  });

  return res.json(updated);
};

const deleteProductConversion = async (req, res) => {
  const { id, conversionId } = req.params;

  const conversion = await prisma.productUnitConversion.findFirst({
    where: { id: conversionId, productId: id, tenantId: req.user.tenantId },
  });
  if (!conversion) {
    return res.status(404).json({ message: "Conversion not found." });
  }

  await prisma.productUnitConversion.delete({ where: { id: conversionId } });

  return res.json({ message: "Conversion deleted." });
};

const downloadProductTemplate = async (req, res) => {
  const forcedKind = normalizeKind(req.query?.kind || "ARTICLE", "ARTICLE") || "ARTICLE";
  const sheetName = forcedKind === "COMPONENT" ? "Produits" : "Articles";
  const sampleRow =
    forcedKind === "COMPONENT"
      ? {
          name: "Blister",
          sku: "PROD0001",
          description: "Composant de conditionnement",
          unitPrice: 0,
          currency: "CDF",
          category: "Conditionnement",
          family: "Composants",
          managementUnit: "Piece",
          dosageUnit: "",
        }
      : {
          Article: "Paracetamol 500mg",
          "Code article": "ART0001",
          Collection: "Pharmacie generale",
          Categorie: "Medicaments",
          Famille: "Antalgiques",
          "Sous famille": "Antalgiques legers",
          TVA: "A renseigner",
          "Prix achat unitaire": 1.8,
          "Prix de vente unitaire": 2.5,
          Devise: "CDF",
          "Unité gestion": "Plaquette",
          "Unité dosage": "mg",
          Description: "Article vendu au client",
        };

  return sendWorkbook(
    res,
    forcedKind === "COMPONENT" ? "template-produits" : "template-articles",
    [{ name: sheetName, rows: [sampleRow] }],
  );
};

const importProducts = async (req, res) => {
  await normalizeManagementUnits(prisma);
  await ensureProductExtendedFields();
  if (!req.file) {
    return res.status(400).json({ message: "Excel file required." });
  }

  const forcedKind = normalizeKind(req.query?.kind || "", "");

  const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
  const productsSheet = workbook.Sheets["Products"] || workbook.Sheets[workbook.SheetNames[0]];
  const componentsSheet = workbook.Sheets["Components"];

  const productsRows = xlsx.utils.sheet_to_json(productsSheet, { defval: "" });
  const componentsRows = componentsSheet
    ? xlsx.utils.sheet_to_json(componentsSheet, { defval: "" })
    : [];

  const findOrCreateCategory = async (name) => {
    if (!name) return null;
    const existing = await prisma.productCategory.findFirst({
      where: { tenantId: req.user.tenantId, name },
    });
    return existing
      ? existing
      : prisma.productCategory.create({
          data: { tenantId: req.user.tenantId, name },
        });
  };

  const findOrCreateCollection = async (name) => {
    if (!name) return null;
    const existing = await findCollectionByName({ tenantId: req.user.tenantId, name });
    return existing || createCollection({ tenantId: req.user.tenantId, name });
  };

  const findOrCreateFamily = async (name, categoryId = null) => {
    if (!name) return null;
    const existing = await findProductFamilyByName({
      tenantId: req.user.tenantId,
      name,
      kind: FAMILY_KIND.FAMILY,
    });
    if (existing) {
      if (categoryId && existing.categoryId && existing.categoryId !== categoryId) {
        throw new Error("La famille importee n'appartient pas a la categorie selectionnee.");
      }
      return existing;
    }
    return createProductFamilyByKind({
          tenantId: req.user.tenantId,
          name,
          kind: FAMILY_KIND.FAMILY,
          categoryId,
        });
  };

  const findOrCreateSubFamily = async (name, parentFamilyId = null) => {
    if (!name) return null;
    const existing = await findProductFamilyByName({
      tenantId: req.user.tenantId,
      name,
      kind: FAMILY_KIND.SUB_FAMILY,
    });
    if (existing) {
      return existing;
    }
    return createProductFamilyByKind({
      tenantId: req.user.tenantId,
      name,
      kind: FAMILY_KIND.SUB_FAMILY,
      parentFamilyId,
    });
  };

  const findOrCreateTaxRate = async (label) => {
    const value = String(label || "").trim();
    if (!value) return null;
    const existing = await findTaxRateByCodeOrName(req.user.tenantId, value);
    return (
      existing ||
      createTaxRate({
        tenantId: req.user.tenantId,
        code: value,
        name: value,
        rate: 0,
        isActive: true,
      })
    );
  };

  const findOrCreateUnit = async (name, type) => {
    if (!name) return null;
    const existing = await prisma.unitOfMeasure.findFirst({
      where: { tenantId: req.user.tenantId, name, type },
    });
    return existing
      ? existing
      : prisma.unitOfMeasure.create({
          data: { tenantId: req.user.tenantId, name, type },
        });
  };

  const productsBySku = {};
  const created = [];
  const currencySettings = await loadTenantCurrencySettings(
    prisma,
    req.user.tenantId,
  );

  for (const row of productsRows) {
    const name = pickRowValue(row, [
      "Article",
      "article",
      "Name",
      "name",
      "Produit",
      "produit",
      "Product",
      "product",
      "Designation",
      "designation",
    ]);
    if (!name) {
      continue;
    }

    const sku = pickRowValue(row, [
      "Code article",
      "code article",
      "sku",
      "SKU",
      "code",
      "Code",
    ]) || null;
    const description = pickRowValue(row, ["Description", "description"]) || null;
    const unitPrice = Number(
      pickRowValue(row, [
        "Prix de vente unitaire",
        "prix de vente unitaire",
        "unitPrice",
        "UnitPrice",
        "price",
        "Price",
      ]) || 0,
    );
    const rowCurrencyCode = pickRowValue(row, [
      "Devise",
      "devise",
      "Currency",
      "currency",
      "CurrencyCode",
      "currencyCode",
    ]);
    const rowKind =
      forcedKind ||
      normalizeKind(
        pickRowValue(row, ["kind", "Kind", "type", "Type"]),
        "ARTICLE",
      );

    const collectionName = pickRowValue(row, ["Collection", "collection"]);
    const categoryName = pickRowValue(row, ["Categorie", "categorie", "Category", "category"]);
    const familyName = pickRowValue(row, ["Famille", "famille", "Family", "family"]);
    const subFamilyName = pickRowValue(row, [
      "Sous famille",
      "Sous-famille",
      "sous famille",
      "sous-famille",
      "SubFamily",
      "subFamily",
    ]);
    const purchaseUnitPrice = Number(
      pickRowValue(row, [
        "Prix achat unitaire",
        "prix achat unitaire",
        "purchaseUnitPrice",
        "PurchaseUnitPrice",
      ]) || 0,
    );
    const taxLabel = pickRowValue(row, ["TVA", "tva", "Taxe", "taxe"]);
    const managementUnitName = pickRowValue(row, [
      "Unité gestion",
      "Unite gestion",
      "unité gestion",
      "unite gestion",
      "managementUnit",
      "ManagementUnit",
      "saleUnit",
      "SaleUnit",
      "stockUnit",
      "StockUnit",
    ]);
    const dosageUnitName = pickRowValue(row, [
      "Unité dosage",
      "Unite dosage",
      "unité dosage",
      "unite dosage",
      "dosageUnit",
      "DosageUnit",
    ]);

    const collection = await findOrCreateCollection(collectionName);
    let category = await findOrCreateCategory(categoryName);
    if (category && collection?.id && category.collectionId !== collection.id) {
      await prisma.$executeRawUnsafe(`
        UPDATE "productCategories"
        SET "collectionId" = ${escapeSqlValue(collection.id)}
        WHERE "id" = ${escapeSqlValue(category.id)}
      `);
      category = await findCategoryById(req.user.tenantId, category.id);
    }
    const family = await findOrCreateFamily(familyName, category?.id || null);
    const subFamily = await findOrCreateSubFamily(subFamilyName, family?.id || null);
    const taxRate = await findOrCreateTaxRate(taxLabel);
    const managementUnit = await findOrCreateUnit(managementUnitName, "SALE");
    const dosageUnit = await findOrCreateUnit(dosageUnitName, "DOSAGE");

    let product = await prisma.product.findFirst({
      where: {
        tenantId: req.user.tenantId,
        ...(sku ? { sku } : { name }),
      },
    });

    if (!product) {
      product = await createProductWithAutoSku({
        kind: rowKind || "ARTICLE",
        explicitSku: sku,
        data: {
          tenantId: req.user.tenantId,
          kind: rowKind || "ARTICLE",
          name,
          sku,
          description,
          unitPrice,
          categoryId: category?.id,
          familyId: family?.id,
          saleUnitId: managementUnit?.id,
          stockUnitId: managementUnit?.id,
          dosageUnitId: dosageUnit?.id,
        },
      });
      await setCurrencyCode(
        prisma,
        "products",
        product.id,
        normalizeCurrencyCode(
          rowCurrencyCode,
          currencySettings.primaryCurrencyCode,
        ),
      );
      created.push(product);
    } else if (rowKind && product.kind !== rowKind) {
      product = await prisma.product.update({
        where: { id: product.id },
        data: { kind: rowKind },
      });
    }

    if (rowCurrencyCode) {
      await setCurrencyCode(
        prisma,
        "products",
        product.id,
        normalizeCurrencyCode(rowCurrencyCode, currencySettings.primaryCurrencyCode),
      );
    }

    await setProductExtendedFields(product.id, {
      purchaseUnitPrice: Number.isFinite(purchaseUnitPrice) ? purchaseUnitPrice : 0,
      tvaId: taxRate?.id || null,
      subFamilyId: subFamily?.id || null,
    });

    productsBySku[sku || name] = product;

    const convFrom = row.conversionFromUnit || row.ConversionFromUnit || row.fromUnit;
    const convTo = row.conversionToUnit || row.ConversionToUnit || row.toUnit;
    const factor = row.conversionFactor || row.ConversionFactor || row.factor;

    if (convFrom && convTo && factor) {
      const fromUnit = await findOrCreateUnit(convFrom, "STOCK");
      const toUnit = await findOrCreateUnit(convTo, "SALE");

      if (fromUnit && toUnit) {
        await prisma.productUnitConversion.upsert({
          where: {
            productId_fromUnitId_toUnitId: {
              productId: product.id,
              fromUnitId: fromUnit.id,
              toUnitId: toUnit.id,
            },
          },
          update: { factor: Number(factor) },
          create: {
            tenantId: req.user.tenantId,
            productId: product.id,
            fromUnitId: fromUnit.id,
            toUnitId: toUnit.id,
            factor: Number(factor),
          },
        });
      }
    }
  }

  if (componentsRows.length && forcedKind !== "COMPONENT") {
    for (const row of componentsRows) {
      const productKey =
        row.productSku ||
        row.ProductSku ||
        row.product ||
        row.Product ||
        row.productName ||
        row.ProductName;

      if (!productKey) {
        continue;
      }

      let product =
        productsBySku[productKey] ||
        (await prisma.product.findFirst({
          where: {
            tenantId: req.user.tenantId,
            OR: [{ sku: productKey }, { name: productKey }],
          },
        }));

      if (!product) {
        continue;
      }

      if (product.kind !== "ARTICLE") {
        product = await prisma.product.update({
          where: { id: product.id },
          data: { kind: "ARTICLE" },
        });
      }

      const componentSku = row.componentSku || row.ComponentSku || null;
      const componentName =
        row.componentName || row.ComponentName || row.component || row.Component || null;
      const dosageUnitName = row.dosageUnit || row.DosageUnit || null;
      const quantity = Number(row.quantity || row.Quantity || 0);

      let componentProduct = componentSku
        ? await prisma.product.findFirst({
            where: { tenantId: req.user.tenantId, sku: componentSku },
          })
        : null;

      if (componentProduct && componentProduct.kind !== "COMPONENT") {
        componentProduct = await prisma.product.update({
          where: { id: componentProduct.id },
          data: { kind: "COMPONENT" },
        });
      }

      const dosageUnit = await findOrCreateUnit(dosageUnitName, "DOSAGE");

      if (quantity > 0) {
        await prisma.productComponent.create({
          data: {
            tenantId: req.user.tenantId,
            productId: product.id,
            componentProductId: componentProduct?.id,
            componentName,
            dosageUnitId: dosageUnit?.id,
            quantity,
          },
        });
      }
    }
  }

  return res.json({
    message: "Import completed.",
    created: created.length,
  });
};

module.exports = {
  createProduct,
  uploadProductImage,
  downloadProductTemplate,
  downloadTechnicalSheetTemplate,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  hardDeleteProduct,
  addProductComponents,
  replaceProductComponents,
  deleteAllProductComponents,
  listProductComponents,
  updateProductComponent,
  deleteProductComponent,
  addProductConversions,
  listProductConversions,
  updateProductConversion,
  deleteProductConversion,
  importProducts,
  importTechnicalSheets,
};

