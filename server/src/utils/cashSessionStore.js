const crypto = require("crypto");
const prisma = require("../config/prisma");

const createId = () => crypto.randomUUID();

const escapeSqlValue = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replace(/'/g, "''")}'`;
};

const normalizeCashSession = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenantId,
    storeId: row.storeId,
    storeName: row.storeName || "",
    userId: row.userId,
    userName: row.userName || "",
    storageZoneId: row.storageZoneId || null,
    storageZoneName: row.storageZoneName || "",
    status: row.status,
    openingFloat: Number(row.openingFloat || 0),
    openingNote: row.openingNote || "",
    totalCashSales: Number(row.totalCashSales || 0),
    totalNonCashSales: Number(row.totalNonCashSales || 0),
    totalCashIn: Number(row.totalCashIn || 0),
    totalCashOut: Number(row.totalCashOut || 0),
    expectedCash: Number(row.expectedCash || 0),
    closingCounted: row.closingCounted == null ? null : Number(row.closingCounted),
    closingNote: row.closingNote || "",
    variance: row.variance == null ? null : Number(row.variance),
    openedAt: row.openedAt,
    closedAt: row.closedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    paymentCount: Number(row.paymentCount || 0),
    orderCount: Number(row.orderCount || 0),
  };
};

const normalizeCashSessionStockRow = (row) => ({
  id: row.id,
  tenantId: row.tenantId,
  cashSessionId: row.cashSessionId,
  stage: row.stage,
  productId: row.productId,
  productName: row.productName || "",
  sku: row.sku || "",
  theoreticalQuantity: Number(row.theoreticalQuantity || 0),
  countedQuantity:
    row.countedQuantity == null ? null : Number(row.countedQuantity),
  varianceQuantity:
    row.varianceQuantity == null ? null : Number(row.varianceQuantity),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const ensureCashSessionTables = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "cashSessions" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "storeId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "storageZoneId" TEXT NULL,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "openingFloat" DECIMAL(18, 2) NOT NULL DEFAULT 0,
      "openingNote" TEXT NULL,
      "totalCashSales" DECIMAL(18, 2) NOT NULL DEFAULT 0,
      "totalNonCashSales" DECIMAL(18, 2) NOT NULL DEFAULT 0,
      "totalCashIn" DECIMAL(18, 2) NOT NULL DEFAULT 0,
      "totalCashOut" DECIMAL(18, 2) NOT NULL DEFAULT 0,
      "expectedCash" DECIMAL(18, 2) NULL,
      "closingCounted" DECIMAL(18, 2) NULL,
      "closingNote" TEXT NULL,
      "variance" DECIMAL(18, 2) NULL,
      "openedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "closedAt" TIMESTAMPTZ NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "cashSessions_status_check" CHECK ("status" IN ('OPEN', 'CLOSED')),
      CONSTRAINT "cashSessions_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
      CONSTRAINT "cashSessions_store_fk" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE,
      CONSTRAINT "cashSessions_user_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
      CONSTRAINT "cashSessions_zone_fk" FOREIGN KEY ("storageZoneId") REFERENCES "storageZone"("id") ON DELETE SET NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "cashSessionPayments" (
      "paymentId" TEXT PRIMARY KEY,
      "cashSessionId" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "cashSessionPayments_payment_fk" FOREIGN KEY ("paymentId") REFERENCES "payements"("id") ON DELETE CASCADE,
      CONSTRAINT "cashSessionPayments_session_fk" FOREIGN KEY ("cashSessionId") REFERENCES "cashSessions"("id") ON DELETE CASCADE,
      CONSTRAINT "cashSessionPayments_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "cashMovements" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "cashSessionId" TEXT NOT NULL,
      "createdById" TEXT NULL,
      "type" TEXT NOT NULL,
      "amount" DECIMAL(18, 2) NOT NULL,
      "reason" TEXT NOT NULL,
      "note" TEXT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "cashMovements_type_check" CHECK ("type" IN ('IN', 'OUT')),
      CONSTRAINT "cashMovements_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
      CONSTRAINT "cashMovements_session_fk" FOREIGN KEY ("cashSessionId") REFERENCES "cashSessions"("id") ON DELETE CASCADE,
      CONSTRAINT "cashMovements_created_by_fk" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "cashSessions_tenant_status_idx"
    ON "cashSessions" ("tenantId", "status", "openedAt")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "cashSessions_open_user_unique"
    ON "cashSessions" ("tenantId", "userId")
    WHERE "status" = 'OPEN'
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "cashMovements_session_idx"
    ON "cashMovements" ("cashSessionId", "createdAt")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "cashSessionPayments_session_idx"
    ON "cashSessionPayments" ("cashSessionId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "cashSessionStockItems" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "cashSessionId" TEXT NOT NULL,
      "stage" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "productName" TEXT NOT NULL,
      "sku" TEXT NULL,
      "theoreticalQuantity" DECIMAL(18, 2) NOT NULL DEFAULT 0,
      "countedQuantity" DECIMAL(18, 2) NULL,
      "varianceQuantity" DECIMAL(18, 2) NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "cashSessionStockItems_stage_check" CHECK ("stage" IN ('OPENING', 'CLOSING')),
      CONSTRAINT "cashSessionStockItems_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
      CONSTRAINT "cashSessionStockItems_session_fk" FOREIGN KEY ("cashSessionId") REFERENCES "cashSessions"("id") ON DELETE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "cashSessionStockItems_session_stage_product_unique"
    ON "cashSessionStockItems" ("cashSessionId", "stage", "productId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "cashSessionStockItems_session_stage_idx"
    ON "cashSessionStockItems" ("cashSessionId", "stage", "productName")
  `);
};

const getCashSessionSelect = () => `
  SELECT
    session."id" AS "id",
    session."tenantId" AS "tenantId",
    session."storeId" AS "storeId",
    store."name" AS "storeName",
    session."userId" AS "userId",
    TRIM(COALESCE("user"."firstName", '') || ' ' || COALESCE("user"."lastName", '')) AS "userName",
    session."storageZoneId" AS "storageZoneId",
    zone."name" AS "storageZoneName",
    session."status" AS "status",
    session."openingFloat" AS "openingFloat",
    session."openingNote" AS "openingNote",
    session."totalCashSales" AS "totalCashSales",
    session."totalNonCashSales" AS "totalNonCashSales",
    session."totalCashIn" AS "totalCashIn",
    session."totalCashOut" AS "totalCashOut",
    COALESCE(
      session."expectedCash",
      session."openingFloat" + session."totalCashSales" + session."totalCashIn" - session."totalCashOut"
    ) AS "expectedCash",
    session."closingCounted" AS "closingCounted",
    session."closingNote" AS "closingNote",
    session."variance" AS "variance",
    session."openedAt" AS "openedAt",
    session."closedAt" AS "closedAt",
    session."createdAt" AS "createdAt",
    session."updatedAt" AS "updatedAt",
    COALESCE(payment_stats."paymentCount", 0) AS "paymentCount",
    COALESCE(payment_stats."orderCount", 0) AS "orderCount"
  FROM "cashSessions" session
  INNER JOIN "stores" store ON store."id" = session."storeId"
  INNER JOIN "users" "user" ON "user"."id" = session."userId"
  LEFT JOIN "storageZone" zone ON zone."id" = session."storageZoneId"
  LEFT JOIN (
    SELECT
      link."cashSessionId" AS "cashSessionId",
      COUNT(link."paymentId")::int AS "paymentCount",
      COUNT(DISTINCT payment."orderId")::int AS "orderCount"
    FROM "cashSessionPayments" link
    INNER JOIN "payements" payment ON payment."id" = link."paymentId"
    GROUP BY link."cashSessionId"
  ) payment_stats ON payment_stats."cashSessionId" = session."id"
`;

const getCurrentCashSession = async ({ tenantId, userId, storeId = null }) => {
  await ensureCashSessionTables();
  const rows = await prisma.$queryRawUnsafe(`
    ${getCashSessionSelect()}
    WHERE session."tenantId" = ${escapeSqlValue(tenantId)}
      AND session."userId" = ${escapeSqlValue(userId)}
      ${storeId ? `AND session."storeId" = ${escapeSqlValue(storeId)}` : ""}
      AND session."status" = 'OPEN'
    ORDER BY session."openedAt" DESC
    LIMIT 1
  `);

  return normalizeCashSession(rows[0] || null);
};

const getCashSessionById = async ({ tenantId, sessionId }) => {
  await ensureCashSessionTables();
  const rows = await prisma.$queryRawUnsafe(`
    ${getCashSessionSelect()}
    WHERE session."tenantId" = ${escapeSqlValue(tenantId)}
      AND session."id" = ${escapeSqlValue(sessionId)}
    LIMIT 1
  `);

  return normalizeCashSession(rows[0] || null);
};

const getCashSessionByPaymentId = async ({ tenantId, paymentId }) => {
  await ensureCashSessionTables();
  const rows = await prisma.$queryRawUnsafe(`
    ${getCashSessionSelect()}
    INNER JOIN "cashSessionPayments" link ON link."cashSessionId" = session."id"
    WHERE session."tenantId" = ${escapeSqlValue(tenantId)}
      AND link."paymentId" = ${escapeSqlValue(paymentId)}
    LIMIT 1
  `);

  return normalizeCashSession(rows[0] || null);
};

const createCashSession = async ({
  tenantId,
  storeId,
  userId,
  storageZoneId = null,
  openingFloat = 0,
  openingNote = null,
}) => {
  await ensureCashSessionTables();
  const existing = await getCurrentCashSession({ tenantId, userId, storeId });
  if (existing) {
    throw Object.assign(new Error("Une caisse est deja ouverte pour cet utilisateur."), {
      status: 409,
    });
  }

  const sessionId = createId();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "cashSessions" (
      "id",
      "tenantId",
      "storeId",
      "userId",
      "storageZoneId",
      "status",
      "openingFloat",
      "openingNote",
      "totalCashSales",
      "totalNonCashSales",
      "totalCashIn",
      "totalCashOut",
      "openedAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${escapeSqlValue(sessionId)},
      ${escapeSqlValue(tenantId)},
      ${escapeSqlValue(storeId)},
      ${escapeSqlValue(userId)},
      ${escapeSqlValue(storageZoneId)},
      'OPEN',
      ${escapeSqlValue(openingFloat)},
      ${escapeSqlValue(openingNote)},
      0,
      0,
      0,
      0,
      NOW(),
      NOW(),
      NOW()
    )
  `);

  return getCashSessionById({ tenantId, sessionId });
};

const linkPaymentToCashSession = async (
  db,
  { tenantId, cashSessionId, paymentId, amount, method },
) => {
  await ensureCashSessionTables();
  const safeDb = db || prisma;
  await safeDb.$executeRawUnsafe(`
    INSERT INTO "cashSessionPayments" (
      "paymentId",
      "cashSessionId",
      "tenantId",
      "createdAt"
    )
    VALUES (
      ${escapeSqlValue(paymentId)},
      ${escapeSqlValue(cashSessionId)},
      ${escapeSqlValue(tenantId)},
      NOW()
    )
    ON CONFLICT ("paymentId") DO NOTHING
  `);

  const isCash = String(method || "").toUpperCase() === "CASH";
  await safeDb.$executeRawUnsafe(`
    UPDATE "cashSessions"
    SET
      "totalCashSales" = "totalCashSales" + ${escapeSqlValue(isCash ? amount : 0)},
      "totalNonCashSales" = "totalNonCashSales" + ${escapeSqlValue(isCash ? 0 : amount)},
      "updatedAt" = NOW()
    WHERE "id" = ${escapeSqlValue(cashSessionId)}
  `);
};

const adjustLinkedPaymentCashTotals = async (
  db,
  { tenantId, paymentId, previousAmount = 0, previousMethod, nextAmount = 0, nextMethod },
) => {
  await ensureCashSessionTables();
  const safeDb = db || prisma;
  const rows = await safeDb.$queryRawUnsafe(
    `
      SELECT link."cashSessionId" AS "cashSessionId"
      FROM "cashSessionPayments" link
      INNER JOIN "cashSessions" session ON session."id" = link."cashSessionId"
      WHERE link."paymentId" = $1
        AND session."tenantId" = $2
      LIMIT 1
    `,
    paymentId,
    tenantId,
  );

  const cashSessionId = rows?.[0]?.cashSessionId;
  if (!cashSessionId) {
    return null;
  }

  const previousIsCash = String(previousMethod || "").toUpperCase() === "CASH";
  const nextIsCash = String(nextMethod || "").toUpperCase() === "CASH";
  const cashDelta =
    Number(nextIsCash ? nextAmount : 0) - Number(previousIsCash ? previousAmount : 0);
  const nonCashDelta =
    Number(nextIsCash ? 0 : nextAmount) - Number(previousIsCash ? 0 : previousAmount);

  await safeDb.$executeRawUnsafe(
    `
      UPDATE "cashSessions"
      SET
        "totalCashSales" = "totalCashSales" + $1,
        "totalNonCashSales" = "totalNonCashSales" + $2,
        "updatedAt" = NOW()
      WHERE "id" = $3
    `,
    cashDelta,
    nonCashDelta,
    cashSessionId,
  );

  return cashSessionId;
};

const recordCashMovement = async ({
  tenantId,
  sessionId,
  createdById = null,
  type,
  amount,
  reason,
  note = null,
}) => {
  await ensureCashSessionTables();
  const session = await getCashSessionById({ tenantId, sessionId });
  if (!session) {
    throw Object.assign(new Error("Session de caisse introuvable."), { status: 404 });
  }
  if (session.status !== "OPEN") {
    throw Object.assign(new Error("La caisse est deja cloturee."), { status: 409 });
  }

  const movementId = createId();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "cashMovements" (
      "id",
      "tenantId",
      "cashSessionId",
      "createdById",
      "type",
      "amount",
      "reason",
      "note",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${escapeSqlValue(movementId)},
      ${escapeSqlValue(tenantId)},
      ${escapeSqlValue(sessionId)},
      ${escapeSqlValue(createdById)},
      ${escapeSqlValue(type)},
      ${escapeSqlValue(amount)},
      ${escapeSqlValue(reason)},
      ${escapeSqlValue(note)},
      NOW(),
      NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "cashSessions"
    SET
      "totalCashIn" = "totalCashIn" + ${escapeSqlValue(type === "IN" ? amount : 0)},
      "totalCashOut" = "totalCashOut" + ${escapeSqlValue(type === "OUT" ? amount : 0)},
      "updatedAt" = NOW()
    WHERE "id" = ${escapeSqlValue(sessionId)}
  `);

  return getCashSessionById({ tenantId, sessionId });
};

const closeCashSession = async ({
  tenantId,
  sessionId,
  countedCash,
  closingNote = null,
}) => {
  await ensureCashSessionTables();
  const session = await getCashSessionById({ tenantId, sessionId });
  if (!session) {
    throw Object.assign(new Error("Session de caisse introuvable."), { status: 404 });
  }
  if (session.status !== "OPEN") {
    throw Object.assign(new Error("La caisse est deja cloturee."), { status: 409 });
  }

  const expectedCash =
    Number(session.openingFloat || 0) +
    Number(session.totalCashSales || 0) +
    Number(session.totalCashIn || 0) -
    Number(session.totalCashOut || 0);
  const variance = Number(countedCash || 0) - expectedCash;

  await prisma.$executeRawUnsafe(`
    UPDATE "cashSessions"
    SET
      "status" = 'CLOSED',
      "expectedCash" = ${escapeSqlValue(expectedCash)},
      "closingCounted" = ${escapeSqlValue(countedCash)},
      "closingNote" = ${escapeSqlValue(closingNote)},
      "variance" = ${escapeSqlValue(variance)},
      "closedAt" = NOW(),
      "updatedAt" = NOW()
    WHERE "id" = ${escapeSqlValue(sessionId)}
  `);

  return getCashSessionById({ tenantId, sessionId });
};

const replaceCashSessionStockSnapshot = async ({
  tenantId,
  sessionId,
  stage,
  items = [],
}) => {
  await ensureCashSessionTables();
  const normalizedStage = String(stage || "").trim().toUpperCase();
  if (!["OPENING", "CLOSING"].includes(normalizedStage)) {
    throw Object.assign(new Error("Etape de stock invalide."), { status: 400 });
  }

  await prisma.$executeRawUnsafe(
    `
      DELETE FROM "cashSessionStockItems"
      WHERE "tenantId" = $1 AND "cashSessionId" = $2 AND "stage" = $3
    `,
    tenantId,
    sessionId,
    normalizedStage,
  );

  for (const item of items) {
    const theoreticalQuantity = Number(item?.theoreticalQuantity || 0);
    const countedQuantity =
      item?.countedQuantity === undefined || item?.countedQuantity === null
        ? normalizedStage === "OPENING"
          ? theoreticalQuantity
          : null
        : Number(item.countedQuantity);
    const varianceQuantity =
      countedQuantity == null ? null : countedQuantity - theoreticalQuantity;

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "cashSessionStockItems" (
          "id",
          "tenantId",
          "cashSessionId",
          "stage",
          "productId",
          "productName",
          "sku",
          "theoreticalQuantity",
          "countedQuantity",
          "varianceQuantity",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      `,
      createId(),
      tenantId,
      sessionId,
      normalizedStage,
      String(item?.productId || ""),
      String(item?.productName || "Article"),
      item?.sku ? String(item.sku) : null,
      theoreticalQuantity,
      countedQuantity,
      varianceQuantity,
    );
  }

  return true;
};

const listCashSessionStockSnapshot = async ({
  tenantId,
  sessionId,
  stage,
}) => {
  await ensureCashSessionTables();
  const normalizedStage = String(stage || "").trim().toUpperCase();
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT
        "id",
        "tenantId",
        "cashSessionId",
        "stage",
        "productId",
        "productName",
        "sku",
        "theoreticalQuantity",
        "countedQuantity",
        "varianceQuantity",
        "createdAt",
        "updatedAt"
      FROM "cashSessionStockItems"
      WHERE "tenantId" = $1
        AND "cashSessionId" = $2
        AND "stage" = $3
      ORDER BY "productName" ASC, "createdAt" ASC
    `,
    tenantId,
    sessionId,
    normalizedStage,
  );

  return rows.map(normalizeCashSessionStockRow);
};

const getCashSessionStockAudit = async ({ tenantId, sessionId }) => {
  const [openingItems, closingItems] = await Promise.all([
    listCashSessionStockSnapshot({
      tenantId,
      sessionId,
      stage: "OPENING",
    }),
    listCashSessionStockSnapshot({
      tenantId,
      sessionId,
      stage: "CLOSING",
    }),
  ]);

  const summarize = (items = []) => ({
    itemCount: items.length,
    theoreticalTotalQuantity: items.reduce(
      (sum, item) => sum + Number(item.theoreticalQuantity || 0),
      0,
    ),
    countedTotalQuantity: items.reduce(
      (sum, item) => sum + Number(item.countedQuantity || 0),
      0,
    ),
    varianceTotalQuantity: items.reduce(
      (sum, item) => sum + Number(item.varianceQuantity || 0),
      0,
    ),
    nonZeroVarianceCount: items.filter(
      (item) => Math.abs(Number(item.varianceQuantity || 0)) > 0.0001,
    ).length,
  });

  return {
    opening: {
      items: openingItems,
      summary: summarize(openingItems),
    },
    closing: {
      items: closingItems,
      summary: summarize(closingItems),
    },
  };
};

const listCashSessionMovements = async ({ tenantId, sessionId }) => {
  await ensureCashSessionTables();
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      movement."id" AS "id",
      movement."tenantId" AS "tenantId",
      movement."cashSessionId" AS "cashSessionId",
      movement."createdById" AS "createdById",
      movement."type" AS "type",
      movement."amount" AS "amount",
      movement."reason" AS "reason",
      movement."note" AS "note",
      movement."createdAt" AS "createdAt",
      movement."updatedAt" AS "updatedAt",
      TRIM(COALESCE("user"."firstName", '') || ' ' || COALESCE("user"."lastName", '')) AS "createdByName"
    FROM "cashMovements" movement
    LEFT JOIN "users" "user" ON "user"."id" = movement."createdById"
    WHERE movement."tenantId" = ${escapeSqlValue(tenantId)}
      AND movement."cashSessionId" = ${escapeSqlValue(sessionId)}
    ORDER BY movement."createdAt" DESC, movement."id" DESC
  `);

  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenantId,
    cashSessionId: row.cashSessionId,
    createdById: row.createdById,
    createdByName: row.createdByName || "",
    type: row.type,
    amount: Number(row.amount || 0),
    reason: row.reason || "",
    note: row.note || "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
};

const listCashSessions = async ({
  tenantId,
  userId = null,
  storeId = null,
  status = null,
  search = "",
  page = 1,
  pageSize = 20,
  paginate = true,
}) => {
  await ensureCashSessionTables();
  const clauses = [`session."tenantId" = ${escapeSqlValue(tenantId)}`];

  if (userId) {
    clauses.push(`session."userId" = ${escapeSqlValue(userId)}`);
  }
  if (storeId) {
    clauses.push(`session."storeId" = ${escapeSqlValue(storeId)}`);
  }
  if (status) {
    clauses.push(`session."status" = ${escapeSqlValue(status)}`);
  }
  if (search) {
    clauses.push(`(
      session."id" ILIKE ${escapeSqlValue(`%${search}%`)}
      OR store."name" ILIKE ${escapeSqlValue(`%${search}%`)}
      OR TRIM(COALESCE("user"."firstName", '') || ' ' || COALESCE("user"."lastName", '')) ILIKE ${escapeSqlValue(`%${search}%`)}
    )`);
  }

  const baseSql = `
    ${getCashSessionSelect()}
    WHERE ${clauses.join(" AND ")}
    ORDER BY session."openedAt" DESC, session."createdAt" DESC
  `;

  if (!paginate) {
    const rows = await prisma.$queryRawUnsafe(baseSql);
    return rows.map(normalizeCashSession);
  }

  const [countRows, rows] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS "count"
      FROM "cashSessions" session
      INNER JOIN "stores" store ON store."id" = session."storeId"
      INNER JOIN "users" "user" ON "user"."id" = session."userId"
      WHERE ${clauses.join(" AND ")}
    `),
    prisma.$queryRawUnsafe(`
      ${baseSql}
      LIMIT ${Number(pageSize)}
      OFFSET ${Number((page - 1) * pageSize)}
    `),
  ]);

  return {
    total: Number(countRows?.[0]?.count || 0),
    rows: rows.map(normalizeCashSession),
  };
};

module.exports = {
  ensureCashSessionTables,
  getCurrentCashSession,
  getCashSessionById,
  getCashSessionByPaymentId,
  createCashSession,
  closeCashSession,
  listCashSessions,
  listCashSessionMovements,
  recordCashMovement,
  linkPaymentToCashSession,
  adjustLinkedPaymentCashTotals,
  replaceCashSessionStockSnapshot,
  listCashSessionStockSnapshot,
  getCashSessionStockAudit,
};
