const prisma = require("../config/prisma");

const toNumber = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : NaN;
};

const buildLineKey = (item) =>
  JSON.stringify({
    productId: item.productId || null,
    unitId: item.unitId || null,
    note: item.note || null,
    unitCost: item.unitCost ?? null,
    batchNumber: item.batchNumber || null,
    expiryDate: item.expiryDate || null,
    manufacturedAt: item.manufacturedAt || null,
  });

const buildExpandedLine = ({ item, productId, unitId, quantity }) => ({
  ...item,
  productId,
  unitId: unitId || null,
  quantity,
});

const expandArticleItems = async ({ tenantId, items = [] }) => {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  const productIds = [...new Set(items.map((item) => item?.productId).filter(Boolean))];
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
              stockUnitId: true,
              saleUnitId: true,
            },
          },
        },
      },
    },
  });

  const productMap = new Map(products.map((product) => [product.id, product]));
  const expanded = [];

  for (const item of items) {
    const quantity = toNumber(item?.quantity);
    if (!item?.productId || !Number.isFinite(quantity) || quantity <= 0) {
      throw Object.assign(new Error("Ligne de stock invalide."), { status: 400 });
    }

    const product = productMap.get(item.productId);
    if (!product) {
      throw Object.assign(new Error("Produit introuvable ou inactif."), { status: 404 });
    }

    if (product.kind !== "ARTICLE") {
      expanded.push(
        buildExpandedLine({
          item,
          productId: product.id,
          unitId: item.unitId || product.stockUnitId || product.saleUnitId || null,
          quantity,
        }),
      );
      continue;
    }

    if (!Array.isArray(product.components) || !product.components.length) {
      throw Object.assign(
        new Error(`L'article ${product.name} ne peut pas etre traite sans fiche technique.`),
        { status: 400 },
      );
    }

    for (const component of product.components) {
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

      const requiredQuantity = toNumber(component.quantity) * quantity;
      if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) {
        throw Object.assign(
          new Error(`Quantite composant invalide pour ${product.name}.`),
          { status: 400 },
        );
      }

      expanded.push(
        buildExpandedLine({
          item,
          productId: component.componentProductId,
          unitId:
            component.componentProduct.stockUnitId ||
            component.componentProduct.saleUnitId ||
            null,
          quantity: requiredQuantity,
        }),
      );
    }
  }

  const aggregated = new Map();
  expanded.forEach((item) => {
    const key = buildLineKey(item);
    if (!aggregated.has(key)) {
      aggregated.set(key, { ...item });
      return;
    }

    const current = aggregated.get(key);
    aggregated.set(key, {
      ...current,
      quantity: Number(current.quantity || 0) + Number(item.quantity || 0),
    });
  });

  return [...aggregated.values()];
};

const ensureComponentItems = async ({
  tenantId,
  items = [],
  message = "Les mouvements de stock doivent utiliser des produits physiques.",
}) => {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  const productIds = [...new Set(items.map((item) => item?.productId).filter(Boolean))];
  const products = await prisma.product.findMany({
    where: {
      tenantId,
      id: { in: productIds },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      kind: true,
    },
  });

  const productMap = new Map(products.map((product) => [product.id, product]));

  for (const item of items) {
    if (!item?.productId) {
      throw Object.assign(new Error("Ligne de stock invalide."), { status: 400 });
    }

    const product = productMap.get(item.productId);
    if (!product) {
      throw Object.assign(new Error("Produit introuvable ou inactif."), { status: 404 });
    }

    if (product.kind !== "COMPONENT") {
      throw Object.assign(new Error(message), { status: 400 });
    }
  }

  return items;
};

module.exports = {
  expandArticleItems,
  ensureComponentItems,
};
