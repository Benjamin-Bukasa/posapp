const prisma = require("../config/prisma");

const escapeSqlValue = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replace(/'/g, "''")}'`;
};

let ensurePromise = null;

const normalizeOfferRow = (row) =>
  row
    ? {
        orderItemId: row.orderItemId,
        reasonType: row.reasonType || "MANUAL",
        reasonNote: row.reasonNote || "",
        thresholdAmount:
          row.thresholdAmount == null ? null : Number(row.thresholdAmount),
        bonusPointsUsed:
          row.bonusPointsUsed == null ? 0 : Number(row.bonusPointsUsed),
      }
    : null;

const ensureOrderItemOfferTable = async () => {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "orderItemOffers" (
          "id" TEXT PRIMARY KEY,
          "tenantId" TEXT NOT NULL,
          "orderId" TEXT NOT NULL,
          "orderItemId" TEXT NOT NULL UNIQUE,
          "reasonType" TEXT NOT NULL,
          "reasonNote" TEXT NULL,
          "thresholdAmount" DECIMAL(18, 2) NULL,
          "bonusPointsUsed" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "orderItemOffers_tenant_order_idx"
        ON "orderItemOffers" ("tenantId", "orderId")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "orderItemOffers_item_idx"
        ON "orderItemOffers" ("orderItemId")
      `);
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  return ensurePromise;
};

const listOrderItemOffersMap = async (tenantId, orderItemIds = []) => {
  await ensureOrderItemOfferTable();
  const uniqueIds = [...new Set((orderItemIds || []).filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map();
  }

  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      "orderItemId",
      "reasonType",
      "reasonNote",
      "thresholdAmount",
      "bonusPointsUsed"
    FROM "orderItemOffers"
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "orderItemId" IN (${uniqueIds.map(escapeSqlValue).join(", ")})
  `);

  return new Map(
    rows.map((row) => [row.orderItemId, normalizeOfferRow(row)]),
  );
};

const replaceOrderItemOffers = async (
  tx,
  {
    tenantId,
    orderId,
    createdItems = [],
    sourceItems = [],
  },
) => {
  await ensureOrderItemOfferTable();

  await tx.$executeRawUnsafe(
    `
      DELETE FROM "orderItemOffers"
      WHERE "tenantId" = $1 AND "orderId" = $2
    `,
    tenantId,
    orderId,
  );

  for (let index = 0; index < createdItems.length; index += 1) {
    const createdItem = createdItems[index];
    const sourceItem = sourceItems[index];
    if (!createdItem?.id || !sourceItem?.isGift) {
      continue;
    }

    await tx.$executeRawUnsafe(
      `
        INSERT INTO "orderItemOffers" (
          "id",
          "tenantId",
          "orderId",
          "orderItemId",
          "reasonType",
          "reasonNote",
          "thresholdAmount",
          "bonusPointsUsed",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      `,
      `offer_${createdItem.id}`,
      tenantId,
      orderId,
      createdItem.id,
      sourceItem.giftReasonType || "MANUAL",
      sourceItem.giftReasonNote || null,
      sourceItem.giftThresholdAmount ?? null,
      Number(sourceItem.giftBonusPointsUsed || 0),
    );
  }
};

const listGiftHistoryByCashSession = async ({ tenantId, cashSessionId }) => {
  await ensureOrderItemOfferTable();
  if (!tenantId || !cashSessionId) {
    return [];
  }

  const rows = await prisma.$queryRaw`
      SELECT
        offer."orderId" AS "orderId",
        offer."orderItemId" AS "orderItemId",
        offer."reasonType" AS "reasonType",
        offer."reasonNote" AS "reasonNote",
        offer."thresholdAmount" AS "thresholdAmount",
        offer."bonusPointsUsed" AS "bonusPointsUsed",
        item."quantity" AS "quantity",
        item."unitPrice" AS "unitPrice",
        item."total" AS "total",
        "order"."createdAt" AS "createdAt",
        product."name" AS "productName",
        product."sku" AS "productSku",
        TRIM(COALESCE("user"."firstName", '') || ' ' || COALESCE("user"."lastName", '')) AS "cashierName",
        customer."firstName" AS "customerFirstName",
        customer."lastName" AS "customerLastName"
      FROM "orderItemOffers" offer
      INNER JOIN "order_items" item ON item."id" = offer."orderItemId"
      INNER JOIN "orders" "order" ON "order"."id" = offer."orderId"
      LEFT JOIN "products" product ON product."id" = item."productId"
      LEFT JOIN "users" "user" ON "user"."id" = "order"."createdById"
      LEFT JOIN "customers" customer ON customer."id" = "order"."customerId"
      WHERE offer."tenantId" = ${tenantId}
        AND EXISTS (
          SELECT 1
          FROM "cashSessionPayments" link
          INNER JOIN "payements" payment ON payment."id" = link."paymentId"
          WHERE link."cashSessionId" = ${cashSessionId}
            AND payment."orderId" = "order"."id"
        )
      ORDER BY "order"."createdAt" DESC, offer."orderItemId" DESC
  `;

  return rows.map((row) => ({
    orderId: row.orderId,
    orderItemId: row.orderItemId,
    reasonType: row.reasonType || "MANUAL",
    reasonNote: row.reasonNote || "",
    thresholdAmount:
      row.thresholdAmount == null ? null : Number(row.thresholdAmount),
    bonusPointsUsed:
      row.bonusPointsUsed == null ? 0 : Number(row.bonusPointsUsed),
    quantity: Number(row.quantity || 0),
    unitPrice: Number(row.unitPrice || 0),
    total: Number(row.total || 0),
    grossLineTotal: Number(row.quantity || 0) * Number(row.unitPrice || 0),
    createdAt: row.createdAt,
    productName: row.productName || "Article",
    productSku: row.productSku || "",
    cashierName: row.cashierName || "",
    customerName:
      [row.customerFirstName, row.customerLastName].filter(Boolean).join(" ") || "",
  }));
};

module.exports = {
  ensureOrderItemOfferTable,
  listOrderItemOffersMap,
  replaceOrderItemOffers,
  listGiftHistoryByCashSession,
};
