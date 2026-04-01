const prisma = require("../config/prisma");
const { sendWorkbook, readSheetRows } = require("../utils/xlsxTemplates");
const {
  parseListParams,
  buildOrderBy,
  contains,
  buildMeta,
  buildDateRangeFilter,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const { normalizeManagementUnits } = require("../utils/normalizeManagementUnits");

const BUSINESS_UNIT_TYPES = Object.freeze({
  MANAGEMENT: "GESTION",
  DOSAGE: "DOSAGE",
});

const mapBusinessTypeToStorageType = (type) => {
  const normalized = String(type || "").trim().toUpperCase();
  if (normalized === BUSINESS_UNIT_TYPES.MANAGEMENT) return "SALE";
  if (normalized === BUSINESS_UNIT_TYPES.DOSAGE) return "DOSAGE";
  if (["SALE", "STOCK", "DOSAGE"].includes(normalized)) return normalized;
  return null;
};

const mapStorageTypeToBusinessType = (type) =>
  type === "DOSAGE" ? BUSINESS_UNIT_TYPES.DOSAGE : BUSINESS_UNIT_TYPES.MANAGEMENT;

const attachBusinessType = (unit) => ({
  ...unit,
  storageType: unit?.type,
  type: mapStorageTypeToBusinessType(unit?.type),
  businessType: mapStorageTypeToBusinessType(unit?.type),
});

const createUnit = async (req, res) => {
  await normalizeManagementUnits(prisma);
  const { name, type, symbol } = req.body || {};
  const normalizedType = mapBusinessTypeToStorageType(type);

  if (!name || !normalizedType) {
    return res.status(400).json({ message: "Le nom et le type sont requis." });
  }

  const unit = await prisma.unitOfMeasure.create({
    data: {
      tenantId: req.user.tenantId,
      name,
      type: normalizedType,
      symbol,
    },
  });

  return res.status(201).json(attachBusinessType(unit));
};

const listUnits = async (req, res) => {
  await normalizeManagementUnits(prisma);
  const { type } = req.query || {};
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const searchFilter = search
    ? {
        OR: [
          { name: contains(search) },
          { symbol: contains(search) },
          { type: contains(search) },
        ],
      }
    : {};

  const where = {
    tenantId: req.user.tenantId,
    ...(type
      ? String(type).toUpperCase() === BUSINESS_UNIT_TYPES.MANAGEMENT
        ? { type: { in: ["SALE", "STOCK"] } }
        : { type: mapBusinessTypeToStorageType(type) || String(type).toUpperCase() }
      : {}),
    ...createdAtFilter,
    ...searchFilter,
  };

  const orderBy =
    buildOrderBy(sortBy, sortDir, {
      name: "name",
      type: "type",
      createdAt: "createdAt",
    }) || { name: "asc" };

  if (exportType) {
    const data = await prisma.unitOfMeasure.findMany({ where, orderBy });
    const rows = data.map((item) => ({
      id: item.id,
      name: item.name,
      type: mapStorageTypeToBusinessType(item.type),
      businessType: mapStorageTypeToBusinessType(item.type),
      symbol: item.symbol,
      createdAt: item.createdAt,
    }));
    return sendExport(res, rows, "units", exportType);
  }

  if (!paginate) {
    const units = await prisma.unitOfMeasure.findMany({ where, orderBy });
    return res.json(units.map(attachBusinessType));
  }

  const [total, units] = await prisma.$transaction([
    prisma.unitOfMeasure.count({ where }),
    prisma.unitOfMeasure.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return res.json({
    data: units.map(attachBusinessType),
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const updateUnit = async (req, res) => {
  await normalizeManagementUnits(prisma);
  const { id } = req.params;
  const { name, type, symbol } = req.body || {};
  const normalizedType = type === undefined ? undefined : mapBusinessTypeToStorageType(type);

  const unit = await prisma.unitOfMeasure.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });

  if (!unit) {
    return res.status(404).json({ message: "Unit not found." });
  }

  if (type !== undefined && !normalizedType) {
    return res.status(400).json({ message: "Le type doit etre GESTION ou DOSAGE." });
  }

  const updated = await prisma.unitOfMeasure.update({
    where: { id },
    data: { name, type: normalizedType, symbol },
  });

  return res.json(attachBusinessType(updated));
};

const deleteUnit = async (req, res) => {
  await normalizeManagementUnits(prisma);
  const { id } = req.params;

  const unit = await prisma.unitOfMeasure.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });

  if (!unit) {
    return res.status(404).json({ message: "Unit not found." });
  }

  const [productCount, purchaseRequestCount, supplyRequestCount] = await prisma.$transaction([
    prisma.product.count({
      where: {
        OR: [{ saleUnitId: id }, { stockUnitId: id }, { dosageUnitId: id }],
      },
    }),
    prisma.purchaseRequestItem.count({ where: { unitId: id } }),
    prisma.supplyRequestItem.count({ where: { unitId: id } }),
  ]);

  if (productCount > 0 || purchaseRequestCount > 0 || supplyRequestCount > 0) {
    return res.status(400).json({
      message: "Unit cannot be deleted while it is referenced.",
    });
  }

  await prisma.unitOfMeasure.delete({ where: { id } });
  return res.json({ message: "Unit deleted." });
};

const downloadUnitsTemplate = async (_req, res) =>
  sendWorkbook(res, "template-unites", [
    {
      name: "Units",
      rows: [{ name: "Plaquette", type: "GESTION", symbol: "plq" }],
    },
  ]);

const importUnits = async (req, res) => {
  await normalizeManagementUnits(prisma);
  if (!req.file) {
    return res.status(400).json({ message: "Fichier Excel requis." });
  }

  try {
    const rows = readSheetRows(req.file.buffer, "Units");
    let created = 0;
    const errors = [];

    for (const [index, row] of rows.entries()) {
      const name = String(row.name || row.Name || "").trim();
      const type = mapBusinessTypeToStorageType(
        String(row.type || row.Type || "").trim().toUpperCase(),
      );
      const symbol = String(row.symbol || row.Symbol || "").trim() || null;

      if (!name || !type) {
        continue;
      }

      if (!["SALE", "STOCK", "DOSAGE"].includes(type)) {
        errors.push({
          line: index + 2,
          message: "Le type doit etre GESTION ou DOSAGE.",
          identifier: name,
        });
        continue;
      }

      try {
        const existing = await prisma.unitOfMeasure.findFirst({
          where: { tenantId: req.user.tenantId, name, type },
        });

        if (!existing) {
          await prisma.unitOfMeasure.create({
            data: {
              tenantId: req.user.tenantId,
              name,
              type,
              symbol,
            },
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
      message: "Import unites termine.",
      created,
      failed: errors.length,
      errors,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Impossible d'importer les unites.",
    });
  }
};

module.exports = {
  createUnit,
  downloadUnitsTemplate,
  importUnits,
  listUnits,
  updateUnit,
  deleteUnit,
};
