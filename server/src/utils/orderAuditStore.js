const crypto = require("crypto");
const prisma = require("../config/prisma");

const createId = () => crypto.randomUUID();

let orderAuditTablesEnsured = false;

const ensureOrderAuditTables = async () => {
  if (orderAuditTablesEnsured) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "orderAuditLogs" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "orderId" TEXT NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
      "action" TEXT NOT NULL,
      "actorUserId" TEXT NULL REFERENCES "users"("id") ON DELETE SET NULL,
      "reason" TEXT NULL,
      "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "orderAuditLogs_order_created_idx"
    ON "orderAuditLogs" ("orderId", "createdAt" DESC)
  `);

  orderAuditTablesEnsured = true;
};

const recordOrderAudit = async (
  db,
  { tenantId, orderId, action, actorUserId = null, reason = null, details = {} },
) => {
  await ensureOrderAuditTables();
  const safeDb = db || prisma;
  const id = createId();
  await safeDb.$executeRawUnsafe(
    `
      INSERT INTO "orderAuditLogs" (
        "id",
        "tenantId",
        "orderId",
        "action",
        "actorUserId",
        "reason",
        "details",
        "createdAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, CAST($7 AS JSONB), NOW())
    `,
    id,
    tenantId,
    orderId,
    action,
    actorUserId,
    reason,
    JSON.stringify(details || {}),
  );
};

const listOrderAuditLogs = async ({ tenantId, orderId }) => {
  await ensureOrderAuditTables();
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT
        log."id" AS "id",
        log."action" AS "action",
        log."reason" AS "reason",
        log."details" AS "details",
        log."createdAt" AS "createdAt",
        log."actorUserId" AS "actorUserId",
        TRIM(COALESCE("user"."firstName", '') || ' ' || COALESCE("user"."lastName", '')) AS "actorName"
      FROM "orderAuditLogs" log
      LEFT JOIN "users" "user" ON "user"."id" = log."actorUserId"
      WHERE log."tenantId" = $1
        AND log."orderId" = $2
      ORDER BY log."createdAt" DESC, log."id" DESC
    `,
    tenantId,
    orderId,
  );

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    reason: row.reason || "",
    details:
      row.details && typeof row.details === "object"
        ? row.details
        : (() => {
            try {
              return JSON.parse(row.details || "{}");
            } catch (_error) {
              return {};
            }
          })(),
    createdAt: row.createdAt,
    actorUserId: row.actorUserId || null,
    actorName: row.actorName || "",
  }));
};

module.exports = {
  ensureOrderAuditTables,
  recordOrderAudit,
  listOrderAuditLogs,
};
