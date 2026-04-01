const crypto = require("crypto");
const prisma = require("../config/prisma");
const {
  assignGeneratedDocumentCode,
  attachDocumentCodes,
} = require("./documentCodeStore");
const {
  ensureInventoryLotTables,
  listInventoryLots,
  materializeResidualUntrackedLot,
  setInventoryLotQuantity,
  synchronizeInventoryAggregate,
} = require("./inventoryLotStore");

const createId = () => crypto.randomUUID();

const escapeSqlValue = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replace(/'/g, "''")}'`;
};

const ACTIVE_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"];

const normalizeSession = (row) => {
  if (!row) return null;
  return ({
  id: row.id,
  tenantId: row.tenantId,
  storeId: row.storeId,
  storageZoneId: row.storageZoneId,
  requestedById: row.requestedById,
  closedById: row.closedById,
  status: row.status,
  note: row.note || "",
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  closedAt: row.closedAt || null,
  store: row.storeId
    ? {
        id: row.storeId,
        name: row.storeName || "",
      }
    : null,
  storageZone: row.storageZoneId
    ? {
        id: row.storageZoneId,
        name: row.storageZoneName || "",
      }
    : null,
  requestedBy: row.requestedById
    ? {
        id: row.requestedById,
        firstName: row.requestedByFirstName || "",
        lastName: row.requestedByLastName || "",
        email: row.requestedByEmail || "",
      }
    : null,
  closedBy: row.closedById
    ? {
        id: row.closedById,
        firstName: row.closedByFirstName || "",
        lastName: row.closedByLastName || "",
        email: row.closedByEmail || "",
      }
    : null,
  itemsCount: Number(row.itemsCount || 0),
  discrepancyCount: Number(row.discrepancyCount || 0),
  approvalsCount: Number(row.approvalsCount || 0),
  });
};

const normalizeItem = (row) => ({
  id: row.id,
  tenantId: row.tenantId,
  sessionId: row.sessionId,
  productId: row.productId,
  inventoryLotId: row.inventoryLotId || null,
  batchNumber: row.batchNumber || null,
  expiryDate: row.expiryDate || null,
  manufacturedAt: row.manufacturedAt || null,
  unitCost:
    row.unitCost === null || row.unitCost === undefined ? null : Number(row.unitCost),
  systemQuantity: Number(row.systemQuantity || 0),
  physicalQuantity:
    row.physicalQuantity === null || row.physicalQuantity === undefined
      ? null
      : Number(row.physicalQuantity),
  varianceQuantity:
    row.varianceQuantity === null || row.varianceQuantity === undefined
      ? null
      : Number(row.varianceQuantity),
  note: row.note || "",
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  product: {
    id: row.productId,
    sku: row.productSku || null,
    name: row.productName || "",
  },
});

const normalizeApproval = (row) => ({
  id: row.id,
  tenantId: row.tenantId,
  sessionId: row.sessionId,
  stepOrder: Number(row.stepOrder || 0),
  approverRole: row.approverRole || null,
  approverId: row.approverId || null,
  status: row.status,
  decidedAt: row.decidedAt || null,
  note: row.note || "",
  approver: row.approverId
    ? {
        id: row.approverId,
        firstName: row.approverFirstName || "",
        lastName: row.approverLastName || "",
        email: row.approverEmail || "",
      }
    : null,
});

const ensureInventorySessionTables = async () => {
  await ensureInventoryLotTables();
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "inventorySessions" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "storeId" TEXT NOT NULL,
      "storageZoneId" TEXT NOT NULL,
      "requestedById" TEXT NULL,
      "closedById" TEXT NULL,
      "status" TEXT NOT NULL DEFAULT 'DRAFT',
      "note" TEXT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "closedAt" TIMESTAMPTZ NULL,
      CONSTRAINT "inventorySessions_status_check" CHECK ("status" IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CLOSED')),
      CONSTRAINT "inventorySessions_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
      CONSTRAINT "inventorySessions_store_fk" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE,
      CONSTRAINT "inventorySessions_zone_fk" FOREIGN KEY ("storageZoneId") REFERENCES "storageZone"("id") ON DELETE CASCADE,
      CONSTRAINT "inventorySessions_requestedBy_fk" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL,
      CONSTRAINT "inventorySessions_closedBy_fk" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "inventorySessionItems" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "sessionId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "inventoryLotId" TEXT NULL,
      "batchNumber" TEXT NULL,
      "expiryDate" TIMESTAMPTZ NULL,
      "manufacturedAt" TIMESTAMPTZ NULL,
      "unitCost" DECIMAL(18, 4) NULL,
      "systemQuantity" DECIMAL(18, 4) NOT NULL DEFAULT 0,
      "physicalQuantity" DECIMAL(18, 4) NULL,
      "varianceQuantity" DECIMAL(18, 4) NULL,
      "note" TEXT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "inventorySessionItems_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
      CONSTRAINT "inventorySessionItems_session_fk" FOREIGN KEY ("sessionId") REFERENCES "inventorySessions"("id") ON DELETE CASCADE,
      CONSTRAINT "inventorySessionItems_product_fk" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "inventorySessionItems"
    DROP CONSTRAINT IF EXISTS "inventorySessionItems_unique"
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "inventorySessionItems"
    ADD COLUMN IF NOT EXISTS "inventoryLotId" TEXT NULL,
    ADD COLUMN IF NOT EXISTS "batchNumber" TEXT NULL,
    ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS "manufacturedAt" TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS "unitCost" DECIMAL(18, 4) NULL
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "inventorySessionApprovals" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "sessionId" TEXT NOT NULL,
      "stepOrder" INTEGER NOT NULL,
      "approverRole" TEXT NULL,
      "approverId" TEXT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "decidedAt" TIMESTAMPTZ NULL,
      "note" TEXT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "inventorySessionApprovals_status_check" CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED')),
      CONSTRAINT "inventorySessionApprovals_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
      CONSTRAINT "inventorySessionApprovals_session_fk" FOREIGN KEY ("sessionId") REFERENCES "inventorySessions"("id") ON DELETE CASCADE,
      CONSTRAINT "inventorySessionApprovals_approver_fk" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "inventorySessions_single_active_tenant"
    ON "inventorySessions" ("tenantId")
    WHERE "status" <> 'CLOSED'
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "inventorySessions_store_idx"
    ON "inventorySessions" ("storeId", "createdAt")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "inventorySessionItems_session_idx"
    ON "inventorySessionItems" ("sessionId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "inventorySessionItems_session_product_lot_idx"
    ON "inventorySessionItems" ("sessionId", "productId", "expiryDate")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "inventorySessionApprovals_session_idx"
    ON "inventorySessionApprovals" ("sessionId", "stepOrder")
  `);
};

const loadInventoryFlow = (tenantId) =>
  prisma.approvalFlow.findUnique({
    where: {
      tenantId_code: {
        tenantId,
        code: "INVENTORY",
      },
    },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

const attachCodes = async (records) =>
  attachDocumentCodes("inventorySessions", records);

const getSessionBaseQuery = (whereSql) => `
  SELECT
    session."id" AS "id",
    session."tenantId" AS "tenantId",
    session."storeId" AS "storeId",
    store."name" AS "storeName",
    session."storageZoneId" AS "storageZoneId",
    zone."name" AS "storageZoneName",
    session."requestedById" AS "requestedById",
    requester."firstName" AS "requestedByFirstName",
    requester."lastName" AS "requestedByLastName",
    requester."email" AS "requestedByEmail",
    session."closedById" AS "closedById",
    closer."firstName" AS "closedByFirstName",
    closer."lastName" AS "closedByLastName",
    closer."email" AS "closedByEmail",
    session."status" AS "status",
    session."note" AS "note",
    session."createdAt" AS "createdAt",
    session."updatedAt" AS "updatedAt",
    session."closedAt" AS "closedAt",
    COALESCE(item_stats."itemsCount", 0) AS "itemsCount",
    COALESCE(item_stats."discrepancyCount", 0) AS "discrepancyCount",
    COALESCE(approval_stats."approvalsCount", 0) AS "approvalsCount"
  FROM "inventorySessions" session
  INNER JOIN "stores" store ON store."id" = session."storeId"
  INNER JOIN "storageZone" zone ON zone."id" = session."storageZoneId"
  LEFT JOIN "users" requester ON requester."id" = session."requestedById"
  LEFT JOIN "users" closer ON closer."id" = session."closedById"
  LEFT JOIN (
    SELECT
      item."sessionId",
      COUNT(*)::int AS "itemsCount",
      COUNT(*) FILTER (
        WHERE item."physicalQuantity" IS NOT NULL
          AND COALESCE(item."varianceQuantity", 0) <> 0
      )::int AS "discrepancyCount"
    FROM "inventorySessionItems" item
    GROUP BY item."sessionId"
  ) item_stats ON item_stats."sessionId" = session."id"
  LEFT JOIN (
    SELECT
      approval."sessionId",
      COUNT(*)::int AS "approvalsCount"
    FROM "inventorySessionApprovals" approval
    GROUP BY approval."sessionId"
  ) approval_stats ON approval_stats."sessionId" = session."id"
  WHERE ${whereSql}
`;

const getInventorySessionById = async (tenantId, sessionId) => {
  await ensureInventorySessionTables();
  const rows = await prisma.$queryRawUnsafe(`
    ${getSessionBaseQuery(
      `session."tenantId" = ${escapeSqlValue(tenantId)} AND session."id" = ${escapeSqlValue(sessionId)}`
    )}
    ORDER BY session."createdAt" DESC
    LIMIT 1
  `);

  const record = normalizeSession(rows[0] || null);
  if (!record) return null;
  const [withCode] = await attachCodes([record]);
  return withCode || null;
};

const getCurrentActiveInventorySession = async (tenantId) => {
  await ensureInventorySessionTables();
  const rows = await prisma.$queryRawUnsafe(`
    ${getSessionBaseQuery(
      `session."tenantId" = ${escapeSqlValue(tenantId)} AND session."status" <> 'CLOSED'`
    )}
    ORDER BY session."createdAt" DESC
    LIMIT 1
  `);
  const record = normalizeSession(rows[0] || null);
  if (!record) return null;
  const [withCode] = await attachCodes([record]);
  return withCode || null;
};

const listInventorySessions = async ({
  tenantId,
  storeId = null,
  status = null,
  search = "",
  paginate = true,
  page = 1,
  pageSize = 20,
}) => {
  await ensureInventorySessionTables();
  const clauses = [`session."tenantId" = ${escapeSqlValue(tenantId)}`];
  if (storeId) clauses.push(`session."storeId" = ${escapeSqlValue(storeId)}`);
  if (status) clauses.push(`session."status" = ${escapeSqlValue(status)}`);
  if (search) {
    clauses.push(`(
      session."id" ILIKE ${escapeSqlValue(`%${search}%`)}
      OR store."name" ILIKE ${escapeSqlValue(`%${search}%`)}
      OR zone."name" ILIKE ${escapeSqlValue(`%${search}%`)}
    )`);
  }

  const whereSql = clauses.join(" AND ");
  const baseSql = `
    ${getSessionBaseQuery(whereSql)}
    ORDER BY session."createdAt" DESC
  `;

  if (!paginate) {
    const rows = await prisma.$queryRawUnsafe(baseSql);
    return attachCodes(rows.map(normalizeSession));
  }

  const [countRows, rows] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS "count"
      FROM "inventorySessions" session
      INNER JOIN "stores" store ON store."id" = session."storeId"
      INNER JOIN "storageZone" zone ON zone."id" = session."storageZoneId"
      WHERE ${whereSql}
    `),
    prisma.$queryRawUnsafe(`
      ${baseSql}
      LIMIT ${Number(pageSize)}
      OFFSET ${Number((page - 1) * pageSize)}
    `),
  ]);

  return {
    total: Number(countRows?.[0]?.count || 0),
    rows: await attachCodes(rows.map(normalizeSession)),
  };
};

const getInventorySessionItems = async (tenantId, sessionId) => {
  await ensureInventorySessionTables();
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      item."id" AS "id",
      item."tenantId" AS "tenantId",
      item."sessionId" AS "sessionId",
      item."productId" AS "productId",
      item."inventoryLotId" AS "inventoryLotId",
      item."batchNumber" AS "batchNumber",
      item."expiryDate" AS "expiryDate",
      item."manufacturedAt" AS "manufacturedAt",
      item."unitCost" AS "unitCost",
      item."systemQuantity" AS "systemQuantity",
      item."physicalQuantity" AS "physicalQuantity",
      item."varianceQuantity" AS "varianceQuantity",
      item."note" AS "note",
      item."createdAt" AS "createdAt",
      item."updatedAt" AS "updatedAt",
      product."name" AS "productName",
      product."sku" AS "productSku"
    FROM "inventorySessionItems" item
    INNER JOIN "products" product ON product."id" = item."productId"
    WHERE item."tenantId" = ${escapeSqlValue(tenantId)}
      AND item."sessionId" = ${escapeSqlValue(sessionId)}
    ORDER BY
      product."name" ASC,
      CASE WHEN item."expiryDate" IS NULL THEN 1 ELSE 0 END ASC,
      item."expiryDate" ASC,
      item."batchNumber" ASC
  `);

  return rows.map(normalizeItem);
};

const getInventorySessionApprovals = async (tenantId, sessionId) => {
  await ensureInventorySessionTables();
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      approval."id" AS "id",
      approval."tenantId" AS "tenantId",
      approval."sessionId" AS "sessionId",
      approval."stepOrder" AS "stepOrder",
      approval."approverRole" AS "approverRole",
      approval."approverId" AS "approverId",
      approval."status" AS "status",
      approval."decidedAt" AS "decidedAt",
      approval."note" AS "note",
      approver."firstName" AS "approverFirstName",
      approver."lastName" AS "approverLastName",
      approver."email" AS "approverEmail"
    FROM "inventorySessionApprovals" approval
    LEFT JOIN "users" approver ON approver."id" = approval."approverId"
    WHERE approval."tenantId" = ${escapeSqlValue(tenantId)}
      AND approval."sessionId" = ${escapeSqlValue(sessionId)}
    ORDER BY approval."stepOrder" ASC
  `);

  return rows.map(normalizeApproval);
};

const createInventorySession = async ({
  tenantId,
  storeId,
  storageZoneId,
  requestedById = null,
  note = null,
}) => {
  await ensureInventorySessionTables();
  const existing = await getCurrentActiveInventorySession(tenantId);
  if (existing) {
    throw Object.assign(
      new Error("Un inventaire actif existe deja. Cloturez-le avant d'en ouvrir un autre."),
      { status: 409 },
    );
  }

  const zone = await prisma.storageZone.findFirst({
    where: {
      id: storageZoneId,
      tenantId,
      storeId,
    },
    select: { id: true, storeId: true },
  });

  if (!zone) {
    throw Object.assign(new Error("Zone d'inventaire invalide."), { status: 400 });
  }

  const products = await prisma.product.findMany({
    where: {
      tenantId,
      kind: "COMPONENT",
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  await prisma.$transaction(async (tx) => {
    for (const product of products) {
      await materializeResidualUntrackedLot(tx, {
        tenantId,
        storeId,
        storageZoneId,
        productId: product.id,
      });
    }
  });

  const lotRows = await listInventoryLots({
    tenantId,
    storeId,
    storageZoneId,
    includeZero: true,
  });

  const lotSnapshotRows = lotRows.filter((row) => Number(row.quantity || 0) > 0);
  const lotProductIds = new Set(lotSnapshotRows.map((row) => row.productId));
  const zeroStockRows = products
    .filter((product) => !lotProductIds.has(product.id))
    .map((product) => ({
      productId: product.id,
      id: null,
      batchNumber: null,
      expiryDate: null,
      manufacturedAt: null,
      unitCost: null,
      quantity: 0,
    }));
  const sessionSnapshotRows = [...lotSnapshotRows, ...zeroStockRows];

  const sessionId = createId();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`
      INSERT INTO "inventorySessions" (
        "id", "tenantId", "storeId", "storageZoneId", "requestedById", "status", "note", "createdAt", "updatedAt"
      )
      VALUES (
        ${escapeSqlValue(sessionId)},
        ${escapeSqlValue(tenantId)},
        ${escapeSqlValue(storeId)},
        ${escapeSqlValue(storageZoneId)},
        ${escapeSqlValue(requestedById)},
        'DRAFT',
        ${escapeSqlValue(note)},
        NOW(),
        NOW()
      )
    `);

    for (const lotRow of sessionSnapshotRows) {
      await tx.$executeRawUnsafe(`
        INSERT INTO "inventorySessionItems" (
          "id", "tenantId", "sessionId", "productId", "inventoryLotId", "batchNumber", "expiryDate", "manufacturedAt", "unitCost", "systemQuantity", "physicalQuantity", "varianceQuantity", "createdAt", "updatedAt"
        )
        VALUES (
          ${escapeSqlValue(createId())},
          ${escapeSqlValue(tenantId)},
          ${escapeSqlValue(sessionId)},
          ${escapeSqlValue(lotRow.productId)},
          ${escapeSqlValue(lotRow.id)},
          ${escapeSqlValue(lotRow.batchNumber)},
          ${escapeSqlValue(lotRow.expiryDate)},
          ${escapeSqlValue(lotRow.manufacturedAt)},
          ${escapeSqlValue(lotRow.unitCost)},
          ${escapeSqlValue(lotRow.quantity || 0)},
          NULL,
          NULL,
          NOW(),
          NOW()
        )
      `);
    }
  });

  await assignGeneratedDocumentCode({
    tableName: "inventorySessions",
    tenantId,
    id: sessionId,
    prefix: "INV",
  });

  return getInventorySessionById(tenantId, sessionId);
};

const updateInventorySessionCounts = async ({ tenantId, sessionId, items = [] }) => {
  await ensureInventorySessionTables();
  const session = await getInventorySessionById(tenantId, sessionId);
  if (!session) {
    throw Object.assign(new Error("Inventaire introuvable."), { status: 404 });
  }
  if (!["DRAFT", "REJECTED"].includes(session.status)) {
    throw Object.assign(
      new Error("Les quantites physiques ne peuvent etre modifiees que sur un inventaire non soumis."),
      { status: 409 },
    );
  }

  const normalizedItems = (Array.isArray(items) ? items : [])
    .map((item) => ({
      itemId: String(item.itemId || item.id || "").trim(),
      physicalQuantity:
        item.physicalQuantity === "" || item.physicalQuantity === null || item.physicalQuantity === undefined
          ? null
          : Number(item.physicalQuantity),
      note: item.note ? String(item.note).trim() : null,
    }))
    .filter((item) => item.itemId);

  await prisma.$transaction(async (tx) => {
    for (const item of normalizedItems) {
      const existingRows = await tx.$queryRawUnsafe(`
        SELECT "systemQuantity"
        FROM "inventorySessionItems"
        WHERE "tenantId" = ${escapeSqlValue(tenantId)}
          AND "sessionId" = ${escapeSqlValue(sessionId)}
          AND "id" = ${escapeSqlValue(item.itemId)}
        LIMIT 1
      `);

      if (!existingRows.length) continue;
      const systemQuantity = Number(existingRows[0].systemQuantity || 0);
      const variance =
        item.physicalQuantity === null ? null : Number(item.physicalQuantity) - systemQuantity;

      await tx.$executeRawUnsafe(`
        UPDATE "inventorySessionItems"
        SET
          "physicalQuantity" = ${escapeSqlValue(item.physicalQuantity)},
          "varianceQuantity" = ${escapeSqlValue(variance)},
          "note" = ${escapeSqlValue(item.note)},
          "updatedAt" = NOW()
        WHERE "tenantId" = ${escapeSqlValue(tenantId)}
          AND "sessionId" = ${escapeSqlValue(sessionId)}
          AND "id" = ${escapeSqlValue(item.itemId)}
      `);
    }

    await tx.$executeRawUnsafe(`
      UPDATE "inventorySessions"
      SET "updatedAt" = NOW()
      WHERE "id" = ${escapeSqlValue(sessionId)}
    `);
  });

  return getInventorySessionById(tenantId, sessionId);
};

const ensureInventoryApprovals = async (tenantId, sessionId) => {
  await ensureInventorySessionTables();
  const existingRows = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS "count"
    FROM "inventorySessionApprovals"
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "sessionId" = ${escapeSqlValue(sessionId)}
  `);
  if (Number(existingRows?.[0]?.count || 0) > 0) {
    return Number(existingRows[0].count);
  }

  const flow = await loadInventoryFlow(tenantId);
  if (!flow?.steps?.length) {
    return 0;
  }

  for (const step of flow.steps) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "inventorySessionApprovals" (
        "id", "tenantId", "sessionId", "stepOrder", "approverRole", "approverId", "status", "createdAt"
      )
      VALUES (
        ${escapeSqlValue(createId())},
        ${escapeSqlValue(tenantId)},
        ${escapeSqlValue(sessionId)},
        ${escapeSqlValue(step.stepOrder)},
        ${escapeSqlValue(step.approverRole)},
        ${escapeSqlValue(step.approverUserId)},
        'PENDING',
        NOW()
      )
    `);
  }

  return flow.steps.length;
};

const syncInventorySessionStatus = async (tenantId, sessionId) => {
  const approvals = await getInventorySessionApprovals(tenantId, sessionId);
  if (!approvals.length) {
    await prisma.$executeRawUnsafe(`
      UPDATE "inventorySessions"
      SET "status" = 'APPROVED', "updatedAt" = NOW()
      WHERE "tenantId" = ${escapeSqlValue(tenantId)}
        AND "id" = ${escapeSqlValue(sessionId)}
    `);
    return "APPROVED";
  }

  const approvedCount = approvals.filter((item) => item.status === "APPROVED").length;
  const rejectedCount = approvals.filter((item) => item.status === "REJECTED").length;
  const nextStatus =
    rejectedCount > 0
      ? "REJECTED"
      : approvedCount === approvals.length
        ? "APPROVED"
        : approvedCount > 0
          ? "SUBMITTED"
          : "SUBMITTED";

  await prisma.$executeRawUnsafe(`
    UPDATE "inventorySessions"
    SET "status" = ${escapeSqlValue(nextStatus)}, "updatedAt" = NOW()
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "id" = ${escapeSqlValue(sessionId)}
  `);

  return nextStatus;
};

const submitInventorySession = async (tenantId, sessionId) => {
  await ensureInventorySessionTables();
  const session = await getInventorySessionById(tenantId, sessionId);
  if (!session) {
    throw Object.assign(new Error("Inventaire introuvable."), { status: 404 });
  }
  if (!["DRAFT", "REJECTED"].includes(session.status)) {
    throw Object.assign(new Error("Cet inventaire ne peut plus etre soumis."), {
      status: 409,
    });
  }

  const items = await getInventorySessionItems(tenantId, sessionId);
  const missingCounts = items.some((item) => item.physicalQuantity === null);
  if (missingCounts) {
    throw Object.assign(
      new Error("Toutes les quantites physiques doivent etre renseignees avant soumission."),
      { status: 400 },
    );
  }

  if (session.status === "REJECTED") {
    await prisma.$executeRawUnsafe(`
      UPDATE "inventorySessionApprovals"
      SET
        "status" = 'PENDING',
        "decidedAt" = NULL,
        "note" = NULL
      WHERE "tenantId" = ${escapeSqlValue(tenantId)}
        AND "sessionId" = ${escapeSqlValue(sessionId)}
    `);
  }

  const approvalCount = await ensureInventoryApprovals(tenantId, sessionId);
  if (approvalCount === 0) {
    await prisma.$executeRawUnsafe(`
      UPDATE "inventorySessions"
      SET "status" = 'APPROVED', "updatedAt" = NOW()
      WHERE "tenantId" = ${escapeSqlValue(tenantId)}
        AND "id" = ${escapeSqlValue(sessionId)}
    `);
  } else {
    await prisma.$executeRawUnsafe(`
      UPDATE "inventorySessions"
      SET "status" = 'SUBMITTED', "updatedAt" = NOW()
      WHERE "tenantId" = ${escapeSqlValue(tenantId)}
        AND "id" = ${escapeSqlValue(sessionId)}
    `);
  }

  return getInventorySessionById(tenantId, sessionId);
};

const decideInventorySessionApproval = async ({
  tenantId,
  sessionId,
  user,
  decision,
  note = null,
}) => {
  await ensureInventorySessionTables();
  const session = await getInventorySessionById(tenantId, sessionId);
  if (!session) {
    throw Object.assign(new Error("Inventaire introuvable."), { status: 404 });
  }
  if (!["SUBMITTED", "APPROVED"].includes(session.status)) {
    throw Object.assign(
      new Error("Cet inventaire n'est pas en attente de validation."),
      { status: 409 },
    );
  }

  const approvals = await getInventorySessionApprovals(tenantId, sessionId);
  if (!approvals.length) {
    throw Object.assign(new Error("Aucun niveau de validation configure."), {
      status: 400,
    });
  }

  const currentStep = approvals.find((item) => item.status === "PENDING");
  if (!currentStep) {
    throw Object.assign(new Error("Aucun niveau en attente."), { status: 400 });
  }

  const canDecide =
    (currentStep.approverId && currentStep.approverId === user.id) ||
    (currentStep.approverRole && currentStep.approverRole === user.role);

  if (!canDecide) {
    throw Object.assign(
      new Error("Vous n'etes pas autorise a traiter ce niveau de validation."),
      { status: 403 },
    );
  }

  await prisma.$executeRawUnsafe(`
    UPDATE "inventorySessionApprovals"
    SET
      "status" = ${escapeSqlValue(decision)},
      "decidedAt" = NOW(),
      "note" = ${escapeSqlValue(note)}
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "sessionId" = ${escapeSqlValue(sessionId)}
      AND "id" = ${escapeSqlValue(currentStep.id)}
  `);

  await syncInventorySessionStatus(tenantId, sessionId);
  return getInventorySessionById(tenantId, sessionId);
};

const closeInventorySession = async ({ tenantId, sessionId, closedById = null, note = null }) => {
  await ensureInventorySessionTables();
  const session = await getInventorySessionById(tenantId, sessionId);
  if (!session) {
    throw Object.assign(new Error("Inventaire introuvable."), { status: 404 });
  }
  if (session.status !== "APPROVED") {
    throw Object.assign(
      new Error("Seul un inventaire entierement valide peut etre cloture."),
      { status: 409 },
    );
  }

  const items = await getInventorySessionItems(tenantId, sessionId);
  await prisma.$transaction(async (tx) => {
    const touchedProducts = new Set();
    for (const item of items) {
      if (item.physicalQuantity === null) continue;
      const nextQuantity = Number(item.physicalQuantity || 0);
      const delta = Number(item.varianceQuantity || 0);
      touchedProducts.add(item.productId);

      await setInventoryLotQuantity(tx, {
        tenantId,
        storeId: session.storeId,
        storageZoneId: session.storageZoneId,
        productId: item.productId,
        inventoryLotId: item.inventoryLotId,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        manufacturedAt: item.manufacturedAt,
        unitCost: item.unitCost,
        quantity: nextQuantity,
      });

      if (delta !== 0) {
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            storageZoneId: session.storageZoneId,
            quantity: delta,
            movementType: "ADJUSTMENT",
            sourceType: "DIRECT",
            sourceId: sessionId,
            createdById: closedById,
          },
        });
      }
    }

    for (const productId of touchedProducts) {
      await synchronizeInventoryAggregate(tx, {
        tenantId,
        storeId: session.storeId,
        storageZoneId: session.storageZoneId,
        productId,
      });
    }

    await tx.$executeRawUnsafe(`
      UPDATE "inventorySessions"
      SET
        "status" = 'CLOSED',
        "closedById" = ${escapeSqlValue(closedById)},
        "closedAt" = NOW(),
        "note" = CASE
          WHEN ${escapeSqlValue(note)} IS NULL OR ${escapeSqlValue(note)} = '' THEN "note"
          WHEN "note" IS NULL OR "note" = '' THEN ${escapeSqlValue(note)}
          ELSE "note" || E'\\n' || ${escapeSqlValue(note)}
        END,
        "updatedAt" = NOW()
      WHERE "tenantId" = ${escapeSqlValue(tenantId)}
        AND "id" = ${escapeSqlValue(sessionId)}
    `);
  });

  return getInventorySessionById(tenantId, sessionId);
};

module.exports = {
  ACTIVE_STATUSES,
  ensureInventorySessionTables,
  listInventorySessions,
  getInventorySessionById,
  getCurrentActiveInventorySession,
  getInventorySessionItems,
  getInventorySessionApprovals,
  createInventorySession,
  updateInventorySessionCounts,
  submitInventorySession,
  decideInventorySessionApproval,
  closeInventorySession,
};
