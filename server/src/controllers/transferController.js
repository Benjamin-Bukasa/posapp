const prisma = require("../config/prisma");
const {
  parseListParams,
  buildOrderBy,
  contains,
  buildMeta,
  buildDateRangeFilter,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const { emitToStore } = require("../socket");
const { buildTransferPdf } = require("../services/transferPdf");
const {
  attachDocumentCodes,
  assignGeneratedDocumentCode,
} = require("../utils/documentCodeStore");

const includesSearch = (value, search) =>
  String(value || "")
    .toLowerCase()
    .includes(String(search || "").trim().toLowerCase());

const matchesTransferSearch = (item, search) => {
  if (!search) return true;
  return [
    item.code,
    item.status,
    item.fromStore?.name,
    item.toStore?.name,
    item.fromZone?.name,
    item.toZone?.name,
  ].some((value) => includesSearch(value, search));
};

const toNumber = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : NaN;
};

const buildTransferExecutionPlan = async ({ tenantId, items }) => {
  if (!Array.isArray(items) || !items.length) {
    throw Object.assign(new Error("items array required."), { status: 400 });
  }

  const normalizedItems = items.map((item, index) => {
    const quantity = toNumber(item?.quantity);
    if (!item?.productId || !Number.isFinite(quantity) || quantity <= 0) {
      throw Object.assign(
        new Error(`Ligne de transfert invalide ${index + 1}.`),
        { status: 400 },
      );
    }
    return {
      productId: item.productId,
      unitId: item.unitId || null,
      quantity,
    };
  });

  const productIds = [...new Set(normalizedItems.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: {
      tenantId,
      id: { in: productIds },
      isActive: true,
    },
    include: {
      components: {
        include: {
          componentProduct: {
            select: {
              id: true,
              name: true,
              kind: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  const productMap = new Map(products.map((product) => [product.id, product]));
  const executionMap = new Map();
  const labels = new Map();

  normalizedItems.forEach((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw Object.assign(new Error("Produit de transfert introuvable."), {
        status: 404,
      });
    }

    if (product.kind === "ARTICLE") {
      if (!Array.isArray(product.components) || product.components.length === 0) {
        throw Object.assign(
          new Error(`L'article ${product.name} ne peut pas etre transfere sans fiche technique.`),
          { status: 400 },
        );
      }

      product.components.forEach((component) => {
        if (!component.componentProductId || !component.componentProduct) {
          throw Object.assign(
            new Error(`Fiche technique incomplete pour ${product.name}.`),
            { status: 400 },
          );
        }

        if (component.componentProduct.kind !== "COMPONENT") {
          throw Object.assign(
            new Error(`La fiche technique de ${product.name} contient un produit invalide.`),
            { status: 400 },
          );
        }

        if (!component.componentProduct.isActive) {
          throw Object.assign(
            new Error(`Le composant ${component.componentProduct.name} est inactif.`),
            { status: 400 },
          );
        }

        const requiredQuantity = toNumber(component.quantity) * item.quantity;
        if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) {
          throw Object.assign(
            new Error(`Quantite composant invalide pour ${product.name}.`),
            { status: 400 },
          );
        }

        executionMap.set(
          component.componentProductId,
          (executionMap.get(component.componentProductId) || 0) + requiredQuantity,
        );
        labels.set(component.componentProductId, component.componentProduct.name);
      });
      return;
    }

    executionMap.set(
      product.id,
      (executionMap.get(product.id) || 0) + item.quantity,
    );
    labels.set(product.id, product.name);
  });

  return {
    normalizedItems,
    executionItems: [...executionMap.entries()].map(([productId, quantity]) => ({
      productId,
      quantity,
      label: labels.get(productId) || productId,
    })),
  };
};

const createTransfer = async (req, res) => {
  const {
    fromStoreId,
    toStoreId,
    fromZoneId,
    toZoneId,
    note,
    items,
  } = req.body || {};

  if (!fromStoreId || !toStoreId) {
    return res.status(400).json({ message: "fromStoreId and toStoreId required." });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "items array required." });
  }

  try {
    await buildTransferExecutionPlan({
      tenantId: req.user.tenantId,
      items,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Transfert invalide.",
    });
  }

  const transfer = await prisma.productTransfer.create({
    data: {
      tenantId: req.user.tenantId,
      fromStoreId,
      toStoreId,
      fromZoneId,
      toZoneId,
      requestedById: req.user.id,
      note,
      status: "DRAFT",
      items: {
        create: items.map((item) => ({
          tenantId: req.user.tenantId,
          productId: item.productId,
          unitId: item.unitId,
          quantity: item.quantity,
        })),
      },
    },
    include: { items: true },
  });

  const transferWithCode = await attachDocumentCodes("productTransferts", {
    ...transfer,
    code: await assignGeneratedDocumentCode({
      tableName: "productTransferts",
      tenantId: req.user.tenantId,
      id: transfer.id,
      prefix: "TRF",
      currentCode: transfer.code,
    }),
  });

  emitToStore(fromStoreId, "transfer:created", {
    id: transferWithCode.id,
    status: transferWithCode.status,
    fromStoreId,
    toStoreId,
  });
  if (toStoreId && toStoreId !== fromStoreId) {
    emitToStore(toStoreId, "transfer:created", {
      id: transfer.id,
      status: transferWithCode.status,
      fromStoreId,
      toStoreId,
    });
  }

  return res.status(201).json(transferWithCode);
};

const listTransfers = async (req, res) => {
  const { status, fromStoreId, toStoreId } = req.query || {};
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const where = {
    tenantId: req.user.tenantId,
    ...(status ? { status } : {}),
    ...(fromStoreId ? { fromStoreId } : {}),
    ...(toStoreId ? { toStoreId } : {}),
    ...createdAtFilter,
  };

  const orderBy =
    buildOrderBy(sortBy, sortDir, {
      createdAt: "createdAt",
      status: "status",
    }) || { createdAt: "desc" };

  if (exportType) {
    const data = await prisma.productTransfer.findMany({
      where,
      include: {
        fromStore: true,
        toStore: true,
        fromZone: true,
        toZone: true,
        items: true,
      },
      orderBy,
    });

    const hydratedData = (await attachDocumentCodes("productTransferts", data)).filter((item) =>
      matchesTransferSearch(item, search),
    );
    const rows = hydratedData.map((item) => ({
      id: item.id,
      code: item.code || "",
      status: item.status,
      fromStore: item.fromStore?.name || "",
      toStore: item.toStore?.name || "",
      fromZone: item.fromZone?.name || "",
      toZone: item.toZone?.name || "",
      itemsCount: item.items?.length || 0,
      createdAt: item.createdAt,
    }));

    return sendExport(res, rows, "transfers", exportType);
  }

  if (!paginate) {
    const transfers = await prisma.productTransfer.findMany({
      where,
      include: {
        items: { include: { product: true, unit: true } },
        fromStore: true,
        toStore: true,
        fromZone: true,
        toZone: true,
        requestedBy: true,
      },
      orderBy,
    });
    return res.json(
      (await attachDocumentCodes("productTransferts", transfers)).filter((item) =>
        matchesTransferSearch(item, search),
      ),
    );
  }

  const transfers = await prisma.productTransfer.findMany({
    where,
    include: {
      items: { include: { product: true, unit: true } },
      fromStore: true,
      toStore: true,
      fromZone: true,
      toZone: true,
      requestedBy: true,
    },
    orderBy,
  });
  const filteredTransfers = (await attachDocumentCodes("productTransferts", transfers)).filter(
    (item) => matchesTransferSearch(item, search),
  );
  const total = filteredTransfers.length;

  return res.json({
    data: filteredTransfers.slice((page - 1) * pageSize, page * pageSize),
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const getTransfer = async (req, res) => {
  const { id } = req.params;

  const transfer = await prisma.productTransfer.findFirst({
    where: { id, tenantId: req.user.tenantId },
    include: {
      items: { include: { product: true, unit: true } },
      fromStore: true,
      toStore: true,
      fromZone: true,
      toZone: true,
      requestedBy: true,
    },
  });

  if (!transfer) {
    return res.status(404).json({ message: "Transfer not found." });
  }

  return res.json(await attachDocumentCodes("productTransferts", transfer));
};

const updateTransfer = async (req, res) => {
  const { id } = req.params;
  const {
    fromStoreId,
    toStoreId,
    fromZoneId,
    toZoneId,
    note,
    items,
  } = req.body || {};

  const transfer = await prisma.productTransfer.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });

  if (!transfer) {
    return res.status(404).json({ message: "Transfer not found." });
  }

  if (transfer.status !== "DRAFT") {
    return res.status(400).json({ message: "Only draft transfers can be edited." });
  }

  if (!fromStoreId || !toStoreId) {
    return res.status(400).json({ message: "fromStoreId and toStoreId required." });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "items array required." });
  }

  try {
    await buildTransferExecutionPlan({
      tenantId: req.user.tenantId,
      items,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Transfert invalide.",
    });
  }

  await prisma.productTransferItem.deleteMany({
    where: { transferId: id },
  });

  const updated = await prisma.productTransfer.update({
    where: { id },
    data: {
      fromStoreId,
      toStoreId,
      fromZoneId,
      toZoneId,
      note,
      items: {
        create: items.map((item) => ({
          tenantId: req.user.tenantId,
          productId: item.productId,
          unitId: item.unitId,
          quantity: item.quantity,
        })),
      },
    },
    include: {
      items: { include: { product: true, unit: true } },
      fromStore: true,
      toStore: true,
      fromZone: true,
      toZone: true,
      requestedBy: true,
    },
  });

  return res.json(await attachDocumentCodes("productTransferts", updated));
};

const deleteTransfer = async (req, res) => {
  const { id } = req.params;

  const transfer = await prisma.productTransfer.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });

  if (!transfer) {
    return res.status(404).json({ message: "Transfer not found." });
  }

  if (transfer.status !== "DRAFT") {
    return res.status(400).json({ message: "Only draft transfers can be deleted." });
  }

  await prisma.productTransfer.delete({ where: { id } });
  return res.json({ message: "Transfer deleted." });
};

const completeTransfer = async (req, res) => {
  const { id } = req.params;

  const transfer = await prisma.productTransfer.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!transfer || transfer.tenantId !== req.user.tenantId) {
    return res.status(404).json({ message: "Transfer not found." });
  }

  if (transfer.status === "COMPLETED") {
    return res.status(400).json({ message: "Transfer already completed." });
  }

  if (!transfer.fromZoneId || !transfer.toZoneId) {
    return res.status(400).json({
      message: "Transfer must define both source and target zones.",
    });
  }

  let executionPlan;
  try {
    executionPlan = await buildTransferExecutionPlan({
      tenantId: transfer.tenantId,
      items: transfer.items,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de finaliser ce transfert.",
    });
  }

  for (const item of executionPlan.executionItems) {
    const quantity = Number(item.quantity || 0);
    const sourceInventory = await prisma.inventory.findUnique({
      where: {
        storageZoneId_productId: {
          storageZoneId: transfer.fromZoneId,
          productId: item.productId,
        },
      },
    });

    if (!sourceInventory || Number(sourceInventory.quantity || 0) < quantity) {
      return res.status(400).json({
        message: `Stock insuffisant pour ${item.label}.`,
      });
    }
  }

  await prisma.$transaction(
    executionPlan.executionItems.flatMap((item) => {
      const quantity = Number(item.quantity || 0);

      return [
        prisma.inventory.update({
          where: {
            storageZoneId_productId: {
              storageZoneId: transfer.fromZoneId,
              productId: item.productId,
            },
          },
          data: {
            quantity: { decrement: quantity },
          },
        }),
        prisma.inventory.upsert({
          where: {
            storageZoneId_productId: {
              storageZoneId: transfer.toZoneId,
              productId: item.productId,
            },
          },
          create: {
            tenantId: transfer.tenantId,
            storeId: transfer.toStoreId,
            storageZoneId: transfer.toZoneId,
            productId: item.productId,
            quantity,
          },
          update: {
            quantity: { increment: quantity },
          },
        }),
        prisma.inventoryMovement.create({
          data: {
            tenantId: transfer.tenantId,
            productId: item.productId,
            storageZoneId: transfer.fromZoneId,
            quantity,
            movementType: "TRANSFER_OUT",
            sourceType: "TRANSFER",
            sourceId: transfer.id,
            createdById: req.user.id,
          },
        }),
        prisma.inventoryMovement.create({
          data: {
            tenantId: transfer.tenantId,
            productId: item.productId,
            storageZoneId: transfer.toZoneId,
            quantity,
            movementType: "TRANSFER_IN",
            sourceType: "TRANSFER",
            sourceId: transfer.id,
            createdById: req.user.id,
          },
        }),
      ];
    })
  );

  const updated = await prisma.productTransfer.update({
    where: { id },
    data: { status: "COMPLETED" },
  });

  emitToStore(transfer.fromStoreId, "transfer:completed", {
    id: updated.id,
    status: updated.status,
    fromStoreId: transfer.fromStoreId,
    toStoreId: transfer.toStoreId,
  });
  if (transfer.toStoreId && transfer.toStoreId !== transfer.fromStoreId) {
    emitToStore(transfer.toStoreId, "transfer:completed", {
      id: updated.id,
      status: updated.status,
      fromStoreId: transfer.fromStoreId,
      toStoreId: transfer.toStoreId,
    });
  }

  return res.json(updated);
};

const getTransferPdf = async (req, res) => {
  const { id } = req.params;

  const transfer = await prisma.productTransfer.findFirst({
    where: { id, tenantId: req.user.tenantId },
    include: {
      items: { include: { product: true, unit: true } },
      fromStore: true,
      toStore: true,
      fromZone: true,
      toZone: true,
      requestedBy: true,
    },
  });

  if (!transfer) {
    return res.status(404).json({ message: "Transfer not found." });
  }

  const transferWithCode = await attachDocumentCodes("productTransferts", transfer);
  const pdfBuffer = await buildTransferPdf(transferWithCode, req.user.tenantName);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${transferWithCode.code || `transfer-${id}`}.pdf"`,
  );
  return res.send(pdfBuffer);
};

module.exports = {
  createTransfer,
  listTransfers,
  getTransfer,
  getTransferPdf,
  updateTransfer,
  deleteTransfer,
  completeTransfer,
};
