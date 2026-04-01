const prisma = require("../config/prisma");
const {
  parseListParams,
  buildOrderBy,
  contains,
  buildMeta,
  buildDateRangeFilter,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");

const createSupplier = async (req, res) => {
  const { name, email, phone, addressLine, city, country } = req.body || {};

  if (!name) {
    return res.status(400).json({ message: "name is required." });
  }

  const supplier = await prisma.supplier.create({
    data: {
      tenantId: req.user.tenantId,
      name,
      email,
      phone,
      addressLine,
      city,
      country,
    },
  });

  return res.status(201).json(supplier);
};

const listSuppliers = async (req, res) => {
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const searchFilter = search
    ? {
        OR: [
          { name: contains(search) },
          { email: contains(search) },
          { phone: contains(search) },
          { city: contains(search) },
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
      name: "name",
      createdAt: "createdAt",
    }) || { name: "asc" };

  if (exportType) {
    const data = await prisma.supplier.findMany({ where, orderBy });
    const rows = data.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      phone: item.phone,
      city: item.city,
      country: item.country,
      createdAt: item.createdAt,
    }));
    return sendExport(res, rows, "suppliers", exportType);
  }

  if (!paginate) {
    const suppliers = await prisma.supplier.findMany({ where, orderBy });
    return res.json(suppliers);
  }

  const [total, suppliers] = await prisma.$transaction([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return res.json({
    data: suppliers,
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

module.exports = {
  createSupplier,
  listSuppliers,
};
