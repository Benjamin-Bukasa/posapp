const crypto = require("node:crypto");
const prisma = require("../config/prisma");

const createId = () => crypto.randomUUID();
const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token || "")).digest("hex");

const escapeSqlValue = (value) => {
  if (value === null || value === undefined || value === "") return "NULL";
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replace(/'/g, "''")}'`;
};

let ensurePromise = null;

const ensureApprovalActionTokenTable = async () => {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "approvalActionTokens" (
        "id" TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "documentType" TEXT NOT NULL,
        "documentId" TEXT NOT NULL,
        "stepOrder" INTEGER NOT NULL,
        "approverUserId" TEXT NOT NULL,
        "recipientEmail" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "tokenHash" TEXT NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "usedAt" TIMESTAMPTZ NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "approvalActionTokens_action_check"
          CHECK ("action" IN ('APPROVED', 'REJECTED')),
        CONSTRAINT "approvalActionTokens_user_fk"
          FOREIGN KEY ("approverUserId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "approvalActionTokens_token_hash_key"
      ON "approvalActionTokens" ("tokenHash")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "approvalActionTokens_document_step_idx"
      ON "approvalActionTokens" ("tenantId", "documentType", "documentId", "stepOrder")
    `);
  })();

  try {
    await ensurePromise;
  } catch (error) {
    ensurePromise = null;
    throw error;
  }
};

const createApprovalActionToken = async ({
  tenantId,
  documentType,
  documentId,
  stepOrder,
  approverUserId,
  recipientEmail,
  action,
  expiresAt,
}) => {
  await ensureApprovalActionTokenTable();

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);

  await prisma.$executeRawUnsafe(`
    DELETE FROM "approvalActionTokens"
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "documentType" = ${escapeSqlValue(documentType)}
      AND "documentId" = ${escapeSqlValue(documentId)}
      AND "stepOrder" = ${escapeSqlValue(stepOrder)}
      AND "approverUserId" = ${escapeSqlValue(approverUserId)}
      AND "action" = ${escapeSqlValue(action)}
      AND "usedAt" IS NULL
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "approvalActionTokens" (
      "id",
      "tenantId",
      "documentType",
      "documentId",
      "stepOrder",
      "approverUserId",
      "recipientEmail",
      "action",
      "tokenHash",
      "expiresAt",
      "createdAt"
    ) VALUES (
      ${escapeSqlValue(createId())},
      ${escapeSqlValue(tenantId)},
      ${escapeSqlValue(documentType)},
      ${escapeSqlValue(documentId)},
      ${escapeSqlValue(stepOrder)},
      ${escapeSqlValue(approverUserId)},
      ${escapeSqlValue(recipientEmail)},
      ${escapeSqlValue(action)},
      ${escapeSqlValue(tokenHash)},
      ${escapeSqlValue(expiresAt)},
      NOW()
    )
  `);

  return rawToken;
};

const getApprovalActionToken = async (rawToken) => {
  await ensureApprovalActionTokenTable();
  const tokenHash = hashToken(rawToken);

  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      token."id" AS "id",
      token."tenantId" AS "tenantId",
      token."documentType" AS "documentType",
      token."documentId" AS "documentId",
      token."stepOrder" AS "stepOrder",
      token."approverUserId" AS "approverUserId",
      token."recipientEmail" AS "recipientEmail",
      token."action" AS "action",
      token."expiresAt" AS "expiresAt",
      token."usedAt" AS "usedAt",
      user_row."firstName" AS "approverFirstName",
      user_row."lastName" AS "approverLastName",
      user_row."email" AS "approverEmail",
      user_row."role" AS "approverRole",
      user_row."tenantId" AS "approverTenantId"
    FROM "approvalActionTokens" token
    INNER JOIN "users" user_row ON user_row."id" = token."approverUserId"
    WHERE token."tokenHash" = ${escapeSqlValue(tokenHash)}
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenantId,
    documentType: row.documentType,
    documentId: row.documentId,
    stepOrder: Number(row.stepOrder || 0),
    approverUserId: row.approverUserId,
    recipientEmail: row.recipientEmail,
    action: row.action,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
    approver: {
      id: row.approverUserId,
      tenantId: row.approverTenantId,
      firstName: row.approverFirstName || "",
      lastName: row.approverLastName || "",
      email: row.approverEmail || "",
      role: row.approverRole || "",
    },
  };
};

const markApprovalActionTokenUsed = async (tokenRecord) => {
  await ensureApprovalActionTokenTable();
  if (!tokenRecord?.id) return;

  await prisma.$executeRawUnsafe(`
    UPDATE "approvalActionTokens"
    SET "usedAt" = NOW()
    WHERE "tenantId" = ${escapeSqlValue(tokenRecord.tenantId)}
      AND "documentType" = ${escapeSqlValue(tokenRecord.documentType)}
      AND "documentId" = ${escapeSqlValue(tokenRecord.documentId)}
      AND "stepOrder" = ${escapeSqlValue(tokenRecord.stepOrder)}
      AND "usedAt" IS NULL
  `);
};

module.exports = {
  ensureApprovalActionTokenTable,
  createApprovalActionToken,
  getApprovalActionToken,
  markApprovalActionTokenUsed,
};
