const MANAGEMENT_STORAGE_TYPES = new Set(["SALE", "STOCK"]);

const escapeSqlValue = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
};

let normalizationPromise = null;

const updateReferenceColumn = async (prisma, tableName, columnName, fromId, toId) =>
  prisma.$executeRawUnsafe(`
    UPDATE "${tableName}"
    SET "${columnName}" = ${escapeSqlValue(toId)}
    WHERE "${columnName}" = ${escapeSqlValue(fromId)}
  `);

const normalizeManagementUnits = async (prisma) => {
  if (normalizationPromise) {
    return normalizationPromise;
  }

  normalizationPromise = (async () => {
    const units = await prisma.unitOfMeasure.findMany({
      where: { type: { in: ["SALE", "STOCK"] } },
      orderBy: [{ tenantId: "asc" }, { createdAt: "asc" }],
    });

    const groups = new Map();
    units.forEach((unit) => {
      const key = [
        unit.tenantId,
        String(unit.name || "").trim().toLowerCase(),
        String(unit.symbol || "").trim().toLowerCase(),
      ].join("::");
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(unit);
    });

    const remap = new Map();
    const canonicalIds = new Set();

    groups.forEach((group) => {
      const canonical = group.find((item) => item.type === "SALE") || group[0];
      canonicalIds.add(canonical.id);
      group.forEach((item) => {
        if (item.id !== canonical.id) {
          remap.set(item.id, canonical.id);
        }
      });
    });

    if (!units.length) {
      return {
        mergedUnits: 0,
        normalizedProducts: 0,
      };
    }

    await prisma.unitOfMeasure.updateMany({
      where: { type: "STOCK" },
      data: { type: "SALE" },
    });

    for (const [fromId, toId] of remap.entries()) {
      await updateReferenceColumn(prisma, "products", "saleUnitId", fromId, toId);
      await updateReferenceColumn(prisma, "products", "stockUnitId", fromId, toId);
      await updateReferenceColumn(prisma, "products", "dosageUnitId", fromId, toId);
      await updateReferenceColumn(prisma, "productComponents", "dosageUnitId", fromId, toId);
      await updateReferenceColumn(prisma, "supplyRequestItems", "unitId", fromId, toId);
      await updateReferenceColumn(prisma, "productTransferItems", "unitId", fromId, toId);
      await updateReferenceColumn(prisma, "purchaseRequestItems", "unitId", fromId, toId);
      await updateReferenceColumn(prisma, "purchaseOrderItems", "unitId", fromId, toId);
      await updateReferenceColumn(prisma, "deliveryNoteItems", "unitId", fromId, toId);
      await updateReferenceColumn(prisma, "stockEntryItems", "unitId", fromId, toId);
    }

    const products = await prisma.product.findMany({
      select: { id: true, saleUnitId: true, stockUnitId: true },
    });

    let normalizedProducts = 0;
    for (const product of products) {
      const saleUnitId = remap.get(product.saleUnitId) || product.saleUnitId || null;
      const stockUnitId = remap.get(product.stockUnitId) || product.stockUnitId || null;
      const managementUnitId = saleUnitId || stockUnitId || null;

      if (
        managementUnitId &&
        (saleUnitId !== managementUnitId || stockUnitId !== managementUnitId)
      ) {
        await prisma.product.update({
          where: { id: product.id },
          data: {
            saleUnitId: managementUnitId,
            stockUnitId: managementUnitId,
          },
        });
        normalizedProducts += 1;
      }
    }

    const conversions = await prisma.productUnitConversion.findMany({
      orderBy: { createdAt: "asc" },
    });

    if (conversions.length) {
      await prisma.productUnitConversion.deleteMany({});

      const seen = new Set();
      const rebuilt = [];

      conversions.forEach((item) => {
        const fromUnitId = remap.get(item.fromUnitId) || item.fromUnitId;
        const toUnitId = remap.get(item.toUnitId) || item.toUnitId;
        if (!fromUnitId || !toUnitId || fromUnitId === toUnitId) {
          return;
        }

        const key = `${item.productId}:${fromUnitId}:${toUnitId}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        rebuilt.push({
          tenantId: item.tenantId,
          productId: item.productId,
          fromUnitId,
          toUnitId,
          factor: item.factor,
        });
      });

      if (rebuilt.length) {
        await prisma.productUnitConversion.createMany({
          data: rebuilt,
          skipDuplicates: true,
        });
      }
    }

    for (const duplicateId of remap.keys()) {
      await prisma.unitOfMeasure.deleteMany({ where: { id: duplicateId } });
    }

    return {
      mergedUnits: remap.size,
      normalizedProducts,
    };
  })().catch((error) => {
    normalizationPromise = null;
    throw error;
  });

  return normalizationPromise;
};

module.exports = {
  normalizeManagementUnits,
  MANAGEMENT_STORAGE_TYPES,
};
