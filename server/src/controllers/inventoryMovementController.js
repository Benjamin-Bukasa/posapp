const prisma = require("../config/prisma");
const {
  parseListParams,
  buildOrderBy,
  contains,
  buildMeta,
  buildDateRangeFilter,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");

const listInventoryMovements = async (req, res) => {
  const { movementType, productId, storageZoneId, sourceType } = req.query || {};
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const searchFilter = search
    ? {
        OR: [
          { movementType: contains(search) },
          { sourceType: contains(search) },
          { product: { name: contains(search) } },
          { storageZone: { name: contains(search) } },
          { createdBy: { firstName: contains(search) } },
          { createdBy: { lastName: contains(search) } },
        ],
      }
    : {};

  const where = {
    tenantId: req.user.tenantId,
    ...(movementType ? { movementType } : {}),
    ...(productId ? { productId } : {}),
    ...(storageZoneId ? { storageZoneId } : {}),
    ...(sourceType ? { sourceType } : {}),
    ...createdAtFilter,
    ...searchFilter,
  };

  const orderBy =
    buildOrderBy(sortBy, sortDir, {
      createdAt: "createdAt",
      movementType: "movementType",
      quantity: "quantity",
    }) || { createdAt: "desc" };

  if (exportType) {
    const data = await prisma.inventoryMovement.findMany({
      where,
      include: {
        product: true,
        storageZone: { include: { store: true } },
        createdBy: true,
      },
      orderBy,
    });

    const rows = data.map((item) => ({
      id: item.id,
      movementType: item.movementType,
      sourceType: item.sourceType,
      product: item.product?.name || "",
      storageZone: item.storageZone?.name || "",
      store: item.storageZone?.store?.name || "",
      quantity: item.quantity,
      createdBy: [item.createdBy?.firstName, item.createdBy?.lastName]
        .filter(Boolean)
        .join(" "),
      createdAt: item.createdAt,
    }));

    return sendExport(res, rows, "inventory-movements", exportType);
  }

  if (!paginate) {
    const movements = await prisma.inventoryMovement.findMany({
      where,
      include: {
        product: true,
        storageZone: { include: { store: true } },
        createdBy: true,
      },
      orderBy,
    });

    return res.json(movements);
  }

  const [total, movements] = await prisma.$transaction([
    prisma.inventoryMovement.count({ where }),
    prisma.inventoryMovement.findMany({
      where,
      include: {
        product: true,
        storageZone: { include: { store: true } },
        createdBy: true,
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return res.json({
    data: movements,
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

module.exports = {
  listInventoryMovements,
};
