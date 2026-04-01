const prisma = require("../config/prisma");
const {
  parseListParams,
  buildOrderBy,
  contains,
  buildMeta,
  buildDateRangeFilter,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");

const createStore = async (req, res) => {
  const { name, code, addressLine, commune, city, country } = req.body || {};
  if (!name) {
    return res.status(400).json({ message: "Store name required." });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { tenantId: req.user.tenantId },
  });

  const storeCount = await prisma.store.count({
    where: { tenantId: req.user.tenantId },
  });

  if (subscription && storeCount >= subscription.maxStores) {
    return res.status(403).json({
      message: "Store limit reached for your subscription.",
    });
  }

  const store = await prisma.store.create({
    data: {
      tenantId: req.user.tenantId,
      name,
      code,
      addressLine,
      commune,
      city,
      country,
    },
  });

  return res.status(201).json(store);
};

const listStores = async (req, res) => {
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const searchFilter = search
    ? {
        OR: [
          { name: contains(search) },
          { code: contains(search) },
          { city: contains(search) },
          { commune: contains(search) },
          { country: contains(search) },
        ],
      }
    : {};

  const where = {
    tenantId: req.user.tenantId,
    ...createdAtFilter,
    ...searchFilter,
  };

  const orderBy =
    buildOrderBy(sortBy, sortDir, {
      createdAt: "createdAt",
      name: "name",
      city: "city",
      country: "country",
    }) || { createdAt: "desc" };

  if (exportType) {
    const data = await prisma.store.findMany({ where, orderBy });
    const rows = data.map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      commune: item.commune,
      city: item.city,
      country: item.country,
      createdAt: item.createdAt,
    }));
    return sendExport(res, rows, "stores", exportType);
  }

  if (!paginate) {
    const stores = await prisma.store.findMany({ where, orderBy });
    return res.json(stores);
  }

  const [total, stores] = await prisma.$transaction([
    prisma.store.count({ where }),
    prisma.store.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return res.json({
    data: stores,
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const updateStore = async (req, res) => {
  const { id } = req.params;
  const { name, code, addressLine, commune, city, country } = req.body || {};

  const store = await prisma.store.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });
  if (!store) {
    return res.status(404).json({ message: "Store not found." });
  }

  const updated = await prisma.store.update({
    where: { id },
    data: { name, code, addressLine, commune, city, country },
  });

  return res.json(updated);
};

const deleteStore = async (req, res) => {
  const { id } = req.params;

  const store = await prisma.store.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });
  if (!store) {
    return res.status(404).json({ message: "Store not found." });
  }

  const [zoneCount, userCount, inventoryCount] = await prisma.$transaction([
    prisma.storageZone.count({ where: { storeId: id } }),
    prisma.user.count({ where: { storeId: id } }),
    prisma.inventory.count({ where: { storeId: id } }),
  ]);

  if (zoneCount > 0 || userCount > 0 || inventoryCount > 0) {
    return res.status(400).json({
      message: "Store cannot be deleted while it has linked zones, users or inventory.",
    });
  }

  await prisma.store.delete({ where: { id } });
  return res.json({ message: "Store deleted." });
};

module.exports = {
  listStores,
  createStore,
  updateStore,
  deleteStore,
};
