const prisma = require("../config/prisma");
const {
  parseListParams,
  buildOrderBy,
  contains,
  buildMeta,
  buildDateRangeFilter,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");

const mapCustomer = (customer) => ({
  ...customer,
  lastPurchaseAt: customer.orders?.[0]?.createdAt || null,
});

const listCustomers = async (req, res) => {
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const searchFilter = search
    ? {
        OR: [
          { code: contains(search) },
          { firstName: contains(search) },
          { lastName: contains(search) },
          { email: contains(search) },
          { phone: contains(search) },
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
      firstName: "firstName",
      lastName: "lastName",
      points: "points",
    }) || { createdAt: "desc" };

  const include = {
    orders: {
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1,
    },
  };

  if (exportType) {
    const data = await prisma.customer.findMany({
      where,
      include,
      orderBy,
    });

    const rows = data.map((item) => ({
      id: item.id,
      code: item.code || "",
      name: [item.firstName, item.lastName].filter(Boolean).join(" "),
      phone: item.phone || "",
      email: item.email || "",
      points: item.points,
      lastPurchaseAt: item.orders?.[0]?.createdAt || "",
      createdAt: item.createdAt,
    }));

    return sendExport(res, rows, "customers", exportType);
  }

  if (!paginate) {
    const customers = await prisma.customer.findMany({
      where,
      include,
      orderBy,
    });
    return res.json(customers.map(mapCustomer));
  }

  const [total, customers] = await prisma.$transaction([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return res.json({
    data: customers.map(mapCustomer),
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const getCustomer = async (req, res) => {
  const { id } = req.params;
  const customer = await prisma.customer.findFirst({
    where: { id, tenantId: req.user.tenantId },
    include: {
      orders: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!customer) {
    return res.status(404).json({ message: "Customer not found." });
  }

  return res.json(mapCustomer(customer));
};

const createCustomer = async (req, res) => {
  const {
    code,
    firstName,
    lastName,
    phone,
    email,
    addressLine,
    commune,
    city,
    country,
  } = req.body || {};

  if (!firstName || !lastName || (!phone && !email)) {
    return res
      .status(400)
      .json({ message: "firstName, lastName and phone or email required." });
  }

  const customer = await prisma.customer.create({
    data: {
      tenantId: req.user.tenantId,
      code,
      firstName,
      lastName,
      phone,
      email,
      addressLine,
      commune,
      city,
      country,
    },
  });

  return res.status(201).json(customer);
};

const updateCustomer = async (req, res) => {
  const { id } = req.params;
  const {
    code,
    firstName,
    lastName,
    phone,
    email,
    addressLine,
    commune,
    city,
    country,
    points,
  } = req.body || {};

  const existing = await prisma.customer.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });
  if (!existing) {
    return res.status(404).json({ message: "Customer not found." });
  }

  const updated = await prisma.customer.update({
    where: { id },
    data: {
      code,
      firstName,
      lastName,
      phone,
      email,
      addressLine,
      commune,
      city,
      country,
      points: points === undefined ? undefined : Number(points),
    },
  });

  return res.json(updated);
};

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
};
