const prisma = require("../config/prisma");

const ACTIVE_ASSIGNMENT_STATUSES = ["ASSIGNED", "IN_TRANSIT", "ARRIVED"];
const DRIVER_ASSIGNABLE_ROLES = ["DRIVER", "ADMIN", "SUPERADMIN"];

const toNullableNumber = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseCoordinate = (value, field) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw Object.assign(new Error(`${field} invalide.`), { status: 400 });
  }
  return parsed;
};

const buildCustomerName = (customer) => {
  const fullName = [customer?.firstName, customer?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || customer?.code || null;
};

const buildDeliveryAddress = (customer, store) =>
  [
    customer?.addressLine,
    customer?.commune,
    customer?.city,
    customer?.country,
    store?.name ? `Boutique: ${store.name}` : null,
  ]
    .filter(Boolean)
    .join(", ") || null;

const deliveryInclude = {
  store: {
    select: {
      id: true,
      name: true,
      code: true,
      city: true,
      commune: true,
      country: true,
    },
  },
  driver: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
    },
  },
  order: {
    include: {
      customer: {
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          addressLine: true,
          commune: true,
          city: true,
          country: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              scanCode: true,
            },
          },
        },
      },
    },
  },
};

const serializeDelivery = (delivery) => {
  if (!delivery) return null;

  const driverName = [delivery.driver?.firstName, delivery.driver?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    id: delivery.id,
    tenantId: delivery.tenantId,
    storeId: delivery.storeId,
    orderId: delivery.orderId,
    driverId: delivery.driverId,
    status: delivery.status,
    assignedAt: delivery.assignedAt,
    startedAt: delivery.startedAt,
    arrivedAt: delivery.arrivedAt,
    deliveredAt: delivery.deliveredAt,
    canceledAt: delivery.canceledAt,
    canceledReason: delivery.canceledReason,
    customerName: delivery.customerName,
    customerPhone: delivery.customerPhone,
    deliveryAddress: delivery.deliveryAddress,
    customerLatitude: toNullableNumber(delivery.customerLatitude),
    customerLongitude: toNullableNumber(delivery.customerLongitude),
    lastDriverLatitude: toNullableNumber(delivery.lastDriverLatitude),
    lastDriverLongitude: toNullableNumber(delivery.lastDriverLongitude),
    lastDriverAccuracy: toNullableNumber(delivery.lastDriverAccuracy),
    lastLocationAt: delivery.lastLocationAt,
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,
    driver: delivery.driver
      ? {
          id: delivery.driver.id,
          role: delivery.driver.role,
          email: delivery.driver.email,
          phone: delivery.driver.phone,
          fullName: driverName || delivery.driver.email || delivery.driver.phone || "Livreur",
        }
      : null,
    store: delivery.store
      ? {
          id: delivery.store.id,
          name: delivery.store.name,
          code: delivery.store.code,
          city: delivery.store.city,
          commune: delivery.store.commune,
          country: delivery.store.country,
        }
      : null,
    order: delivery.order
      ? {
          id: delivery.order.id,
          status: delivery.order.status,
          subtotal: Number(delivery.order.subtotal || 0),
          tax: Number(delivery.order.tax || 0),
          total: Number(delivery.order.total || 0),
          currencyCode: delivery.order.currencyCode,
          createdAt: delivery.order.createdAt,
          customerId: delivery.order.customerId,
          itemCount: delivery.order.items?.length || 0,
          items: (delivery.order.items || []).map((item) => ({
            id: item.id,
            productId: item.productId,
            productName: item.product?.name || null,
            sku: item.product?.sku || null,
            scanCode: item.product?.scanCode || null,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice || 0),
            total: Number(item.total || 0),
          })),
        }
      : null,
  };
};

const resolveDriverScope = (req) =>
  req.user.role === "DRIVER" ? { driverId: req.user.id } : {};

const getDeliveryByIdForActor = async (req, id) => {
  const delivery = await prisma.delivery.findFirst({
    where: {
      id,
      tenantId: req.user.tenantId,
      ...resolveDriverScope(req),
    },
    include: deliveryInclude,
  });

  if (!delivery) {
    throw Object.assign(new Error("Livraison introuvable."), { status: 404 });
  }

  return delivery;
};

const ensureAssignableDriver = async (tenantId, driverId) => {
  const driver = await prisma.user.findFirst({
    where: {
      id: driverId,
      tenantId,
      isActive: true,
      role: { in: DRIVER_ASSIGNABLE_ROLES },
    },
    select: {
      id: true,
      role: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  });

  if (!driver) {
    throw Object.assign(new Error("Livreur invalide."), { status: 404 });
  }

  return driver;
};

const buildDeliverySnapshotFromOrder = (order) => ({
  tenantId: order.tenantId,
  storeId: order.storeId || null,
  customerName: buildCustomerName(order.customer),
  customerPhone: order.customer?.phone || null,
  deliveryAddress: buildDeliveryAddress(order.customer, order.store),
});

const listAssignments = async (req, res) => {
  try {
    const statusList = String(req.query.status || "")
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    const deliveries = await prisma.delivery.findMany({
      where: {
        tenantId: req.user.tenantId,
        ...(statusList.length ? { status: { in: statusList } } : {}),
        ...(req.user.role === "DRIVER"
          ? { driverId: req.user.id }
          : req.query.driverId
            ? { driverId: String(req.query.driverId) }
            : {}),
      },
      include: deliveryInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    return res.json(deliveries.map(serializeDelivery));
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de charger les missions.",
    });
  }
};

const getCurrentAssignment = async (req, res) => {
  try {
    const delivery = await prisma.delivery.findFirst({
      where: {
        tenantId: req.user.tenantId,
        status: { in: ACTIVE_ASSIGNMENT_STATUSES },
        ...(req.user.role === "DRIVER"
          ? { driverId: req.user.id }
          : req.query.driverId
            ? { driverId: String(req.query.driverId) }
            : {}),
      },
      include: deliveryInclude,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });

    return res.json(serializeDelivery(delivery));
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de charger la mission courante.",
    });
  }
};

const createDeliveryFromOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { driverId } = req.body || {};

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId: req.user.tenantId,
      },
      include: {
        customer: true,
        store: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                scanCode: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Commande introuvable." });
    }

    if (driverId) {
      await ensureAssignableDriver(req.user.tenantId, driverId);
    }

    const snapshot = buildDeliverySnapshotFromOrder(order);
    const now = new Date();

    const delivery = await prisma.delivery.upsert({
      where: { orderId: order.id },
      update: {
        ...snapshot,
        driverId: driverId || undefined,
        status: driverId ? "ASSIGNED" : undefined,
        assignedAt: driverId ? now : undefined,
      },
      create: {
        ...snapshot,
        orderId: order.id,
        driverId: driverId || null,
        status: driverId ? "ASSIGNED" : "PENDING",
        assignedAt: driverId ? now : null,
      },
      include: deliveryInclude,
    });

    return res.status(201).json({
      message: "Livraison creee.",
      delivery: serializeDelivery(delivery),
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de creer la livraison.",
    });
  }
};

const assignDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId } = req.body || {};

    if (!driverId) {
      return res.status(400).json({ message: "driverId requis." });
    }

    await ensureAssignableDriver(req.user.tenantId, driverId);

    const delivery = await prisma.delivery.findFirst({
      where: {
        id,
        tenantId: req.user.tenantId,
      },
    });

    if (!delivery) {
      return res.status(404).json({ message: "Livraison introuvable." });
    }

    if (delivery.status === "DELIVERED" || delivery.status === "CANCELED") {
      return res.status(400).json({
        message: "Impossible d'assigner une livraison terminee.",
      });
    }

    const updated = await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        driverId,
        status: delivery.status === "PENDING" ? "ASSIGNED" : delivery.status,
        assignedAt: delivery.assignedAt || new Date(),
      },
      include: deliveryInclude,
    });

    return res.json({
      message: "Livraison assignee.",
      delivery: serializeDelivery(updated),
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible d'assigner la livraison.",
    });
  }
};

const postDriverLocation = async (req, res) => {
  try {
    const latitude = parseCoordinate(req.body?.latitude, "latitude");
    const longitude = parseCoordinate(req.body?.longitude, "longitude");
    const accuracy =
      req.body?.accuracy === null || req.body?.accuracy === undefined
        ? null
        : parseCoordinate(req.body?.accuracy, "accuracy");
    const deliveryId = req.body?.deliveryId ? String(req.body.deliveryId) : null;

    let delivery = null;
    if (deliveryId) {
      delivery = await getDeliveryByIdForActor(req, deliveryId);
    } else if (req.user.role === "DRIVER") {
      delivery = await prisma.delivery.findFirst({
        where: {
          tenantId: req.user.tenantId,
          driverId: req.user.id,
          status: { in: ACTIVE_ASSIGNMENT_STATUSES },
        },
      });
    }

    const location = await prisma.driverLocation.create({
      data: {
        tenantId: req.user.tenantId,
        driverId: req.user.id,
        deliveryId: delivery?.id || null,
        latitude,
        longitude,
        accuracy,
      },
    });

    if (delivery) {
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: {
          lastDriverLatitude: latitude,
          lastDriverLongitude: longitude,
          lastDriverAccuracy: accuracy,
          lastLocationAt: location.recordedAt,
        },
      });
    }

    return res.status(201).json({
      message: "Position enregistree.",
      location: {
        id: location.id,
        deliveryId: location.deliveryId,
        latitude: toNullableNumber(location.latitude),
        longitude: toNullableNumber(location.longitude),
        accuracy: toNullableNumber(location.accuracy),
        recordedAt: location.recordedAt,
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible d'enregistrer la position.",
    });
  }
};

const transitionDelivery = async ({ req, res, nextStatus, allowedStatuses, message, extraData = {} }) => {
  try {
    const delivery = await getDeliveryByIdForActor(req, req.params.id);

    if (!allowedStatuses.includes(delivery.status)) {
      return res.status(400).json({
        message: "Transition de livraison invalide.",
      });
    }

    const data = { ...extraData };
    const now = new Date();

    if (nextStatus === "ASSIGNED" && !delivery.assignedAt) {
      data.assignedAt = now;
    }
    if (nextStatus === "IN_TRANSIT") {
      data.startedAt = delivery.startedAt || now;
      data.assignedAt = delivery.assignedAt || now;
      if (!delivery.driverId && req.user.role === "DRIVER") {
        data.driverId = req.user.id;
      }
    }
    if (nextStatus === "ARRIVED") {
      data.arrivedAt = delivery.arrivedAt || now;
      data.startedAt = delivery.startedAt || now;
    }
    if (nextStatus === "DELIVERED") {
      data.deliveredAt = now;
      data.startedAt = delivery.startedAt || now;
    }
    if (nextStatus === "CANCELED") {
      data.canceledAt = now;
      data.canceledReason = String(req.body?.reason || "").trim() || null;
    }

    data.status = nextStatus;

    const updated = await prisma.delivery.update({
      where: { id: delivery.id },
      data,
      include: deliveryInclude,
    });

    return res.json({
      message,
      delivery: serializeDelivery(updated),
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de modifier cette livraison.",
    });
  }
};

const startDelivery = (req, res) =>
  transitionDelivery({
    req,
    res,
    nextStatus: "IN_TRANSIT",
    allowedStatuses: ["PENDING", "ASSIGNED"],
    message: "Livraison demarree.",
  });

const arriveDelivery = (req, res) =>
  transitionDelivery({
    req,
    res,
    nextStatus: "ARRIVED",
    allowedStatuses: ["IN_TRANSIT"],
    message: "Le livreur est arrive.",
  });

const completeDelivery = (req, res) =>
  transitionDelivery({
    req,
    res,
    nextStatus: "DELIVERED",
    allowedStatuses: ["ASSIGNED", "IN_TRANSIT", "ARRIVED"],
    message: "Livraison terminee.",
  });

const cancelDelivery = (req, res) =>
  transitionDelivery({
    req,
    res,
    nextStatus: "CANCELED",
    allowedStatuses: ["PENDING", "ASSIGNED", "IN_TRANSIT", "ARRIVED"],
    message: "Livraison annulee.",
  });

module.exports = {
  listAssignments,
  getCurrentAssignment,
  createDeliveryFromOrder,
  assignDelivery,
  postDriverLocation,
  startDelivery,
  arriveDelivery,
  completeDelivery,
  cancelDelivery,
};
