const prisma = require("../config/prisma");
const {
  parseListParams,
  buildOrderBy,
  contains,
  buildMeta,
  buildDateRangeFilter,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");

const createStorageZone = async (req, res) => {
  const { name, code, storeId, zoneType, note } = req.body || {};

  if (!name || !storeId) {
    return res.status(400).json({ message: "name and storeId required." });
  }

  const zone = await prisma.storageZone.create({
    data: {
      tenantId: req.user.tenantId,
      name,
      code,
      storeId,
      zoneType,
      note,
    },
  });

  return res.status(201).json(zone);
};

const listStorageZones = async (req, res) => {
  const { storeId, zoneType } = req.query || {};
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const searchFilter = search
    ? {
        OR: [
          { name: contains(search) },
          { code: contains(search) },
          { zoneType: contains(search) },
          { store: { name: contains(search) } },
        ],
      }
    : {};

  const where = {
    tenantId: req.user.tenantId,
    ...(storeId ? { storeId } : {}),
    ...(zoneType ? { zoneType } : {}),
    ...createdAtFilter,
    ...searchFilter,
  };

  const orderBy =
    buildOrderBy(sortBy, sortDir, {
      createdAt: "createdAt",
      name: "name",
      zoneType: "zoneType",
    }) || { createdAt: "desc" };

  if (exportType) {
    const data = await prisma.storageZone.findMany({
      where,
      include: { store: true },
      orderBy,
    });

    const rows = data.map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      zoneType: item.zoneType,
      store: item.store?.name || "",
      createdAt: item.createdAt,
    }));

    return sendExport(res, rows, "storage-zones", exportType);
  }

  if (!paginate) {
    const zones = await prisma.storageZone.findMany({
      where,
      include: { store: true },
      orderBy,
    });

    return res.json(zones);
  }

  const [total, zones] = await prisma.$transaction([
    prisma.storageZone.count({ where }),
    prisma.storageZone.findMany({
      where,
      include: { store: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return res.json({
    data: zones,
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const updateStorageZone = async (req, res) => {
  const { id } = req.params;
  const { name, code, storeId, zoneType, note } = req.body || {};

  const zone = await prisma.storageZone.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });
  if (!zone) {
    return res.status(404).json({ message: "Storage zone not found." });
  }

  const updated = await prisma.storageZone.update({
    where: { id },
    data: { name, code, storeId, zoneType, note },
  });

  return res.json(updated);
};

const deleteStorageZone = async (req, res) => {
  const { id } = req.params;

  const zone = await prisma.storageZone.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });
  if (!zone) {
    return res.status(404).json({ message: "Storage zone not found." });
  }

  const inventoryCount = await prisma.inventory.count({
    where: { storageZoneId: id },
  });

  if (inventoryCount > 0) {
    return res.status(400).json({ message: "Storage zone has inventory." });
  }

  await prisma.storageZone.delete({ where: { id } });

  return res.json({ message: "Storage zone deleted." });
};

module.exports = {
  createStorageZone,
  listStorageZones,
  updateStorageZone,
  deleteStorageZone,
};
