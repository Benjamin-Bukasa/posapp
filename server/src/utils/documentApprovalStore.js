const crypto = require("node:crypto");
const prisma = require("../config/prisma");

const createId = () => crypto.randomUUID();

const escapeSqlValue = (value) => {
  if (value === null || value === undefined || value === "") return "NULL";
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replace(/'/g, "''")}'`;
};

const normalizeApproval = (row) => ({
  id: row.id,
  tenantId: row.tenantId,
  documentType: row.documentType,
  documentId: row.documentId,
  flowCode: row.flowCode || null,
  stepOrder: Number(row.stepOrder || 0),
  approverRole: row.approverRole || null,
  approverId: row.approverId || null,
  status: row.status || "PENDING",
  note: row.note || null,
  decidedAt: row.decidedAt || null,
  createdAt: row.createdAt || null,
  approver: row.approverId
    ? {
        id: row.approverId,
        firstName: row.approverFirstName || "",
        lastName: row.approverLastName || "",
        email: row.approverEmail || "",
      }
    : null,
});

let ensurePromise = null;

const ensureDocumentApprovalTable = async () => {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "documentApprovals" (
        "id" TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "documentType" TEXT NOT NULL,
        "documentId" TEXT NOT NULL,
        "flowCode" TEXT NULL,
        "stepOrder" INTEGER NOT NULL,
        "approverRole" TEXT NULL,
        "approverId" TEXT NULL,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "note" TEXT NULL,
        "decidedAt" TIMESTAMPTZ NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "documentApprovals_status_check" CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED')),
        CONSTRAINT "documentApprovals_approver_fk" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "documentApprovals_tenant_document_idx"
      ON "documentApprovals" ("tenantId", "documentType", "documentId")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "documentApprovals_document_step_key"
      ON "documentApprovals" ("tenantId", "documentType", "documentId", "stepOrder")
    `);
  })();

  try {
    await ensurePromise;
  } catch (error) {
    ensurePromise = null;
    throw error;
  }
};

const loadApprovalFlow = async (tenantId, flowCodes = []) => {
  const normalizedCodes = [...new Set((Array.isArray(flowCodes) ? flowCodes : [flowCodes]).filter(Boolean))];
  for (const code of normalizedCodes) {
    const flow = await prisma.approvalFlow.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code,
        },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    if (flow) return flow;
  }
  return null;
};

const getDocumentApprovals = async (tenantId, documentType, documentId) => {
  await ensureDocumentApprovalTable();
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      approval."id" AS "id",
      approval."tenantId" AS "tenantId",
      approval."documentType" AS "documentType",
      approval."documentId" AS "documentId",
      approval."flowCode" AS "flowCode",
      approval."stepOrder" AS "stepOrder",
      approval."approverRole" AS "approverRole",
      approval."approverId" AS "approverId",
      approval."status" AS "status",
      approval."note" AS "note",
      approval."decidedAt" AS "decidedAt",
      approval."createdAt" AS "createdAt",
      approver."firstName" AS "approverFirstName",
      approver."lastName" AS "approverLastName",
      approver."email" AS "approverEmail"
    FROM "documentApprovals" approval
    LEFT JOIN "users" approver ON approver."id" = approval."approverId"
    WHERE approval."tenantId" = ${escapeSqlValue(tenantId)}
      AND approval."documentType" = ${escapeSqlValue(documentType)}
      AND approval."documentId" = ${escapeSqlValue(documentId)}
    ORDER BY approval."stepOrder" ASC
  `);

  return rows.map(normalizeApproval);
};

const getDocumentApprovalMap = async (tenantId, documentType, documentIds = []) => {
  await ensureDocumentApprovalTable();
  const ids = [...new Set((documentIds || []).filter(Boolean))];
  if (!ids.length) return new Map();

  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      approval."id" AS "id",
      approval."tenantId" AS "tenantId",
      approval."documentType" AS "documentType",
      approval."documentId" AS "documentId",
      approval."flowCode" AS "flowCode",
      approval."stepOrder" AS "stepOrder",
      approval."approverRole" AS "approverRole",
      approval."approverId" AS "approverId",
      approval."status" AS "status",
      approval."note" AS "note",
      approval."decidedAt" AS "decidedAt",
      approval."createdAt" AS "createdAt",
      approver."firstName" AS "approverFirstName",
      approver."lastName" AS "approverLastName",
      approver."email" AS "approverEmail"
    FROM "documentApprovals" approval
    LEFT JOIN "users" approver ON approver."id" = approval."approverId"
    WHERE approval."tenantId" = ${escapeSqlValue(tenantId)}
      AND approval."documentType" = ${escapeSqlValue(documentType)}
      AND approval."documentId" IN (${ids.map(escapeSqlValue).join(", ")})
    ORDER BY approval."stepOrder" ASC
  `);

  const map = new Map();
  rows.forEach((row) => {
    const key = row.documentId;
    const current = map.get(key) || [];
    current.push(normalizeApproval(row));
    map.set(key, current);
  });
  return map;
};

const deriveApprovalLifecycle = (approvals = []) => {
  if (!Array.isArray(approvals) || approvals.length === 0) return null;
  const approvedCount = approvals.filter((item) => item.status === "APPROVED").length;
  const rejectedCount = approvals.filter((item) => item.status === "REJECTED").length;
  if (rejectedCount > 0) return "REJECTED";
  if (approvedCount === approvals.length) return "APPROVED";
  return "SUBMITTED";
};

const prepareDocumentApprovals = async ({
  tenantId,
  documentType,
  documentId,
  flowCodes = [],
}) => {
  await ensureDocumentApprovalTable();
  let approvals = await getDocumentApprovals(tenantId, documentType, documentId);

  if (approvals.length) {
    if (approvals.some((item) => item.status === "REJECTED")) {
      await prisma.$executeRawUnsafe(`
        UPDATE "documentApprovals"
        SET
          "status" = 'PENDING',
          "decidedAt" = NULL,
          "note" = NULL
        WHERE "tenantId" = ${escapeSqlValue(tenantId)}
          AND "documentType" = ${escapeSqlValue(documentType)}
          AND "documentId" = ${escapeSqlValue(documentId)}
      `);
      approvals = await getDocumentApprovals(tenantId, documentType, documentId);
    }

    return {
      flowCode: approvals[0]?.flowCode || null,
      approvals,
      lifecycleStatus: deriveApprovalLifecycle(approvals),
    };
  }

  const flow = await loadApprovalFlow(tenantId, flowCodes);
  if (!flow?.steps?.length) {
    return {
      flowCode: null,
      approvals: [],
      lifecycleStatus: null,
    };
  }

  await prisma.$executeRawUnsafe(`
    INSERT INTO "documentApprovals" (
      "id", "tenantId", "documentType", "documentId", "flowCode", "stepOrder", "approverRole", "approverId", "status", "createdAt"
    ) VALUES
    ${flow.steps
      .map(
        (step) => `(
      ${escapeSqlValue(createId())},
      ${escapeSqlValue(tenantId)},
      ${escapeSqlValue(documentType)},
      ${escapeSqlValue(documentId)},
      ${escapeSqlValue(flow.code)},
      ${escapeSqlValue(step.stepOrder)},
      ${escapeSqlValue(step.approverRole)},
      ${escapeSqlValue(step.approverUserId)},
      'PENDING',
      NOW()
    )`,
      )
      .join(", ")}
  `);

  approvals = await getDocumentApprovals(tenantId, documentType, documentId);
  return {
    flowCode: flow.code,
    approvals,
    lifecycleStatus: deriveApprovalLifecycle(approvals),
  };
};

const decideDocumentApproval = async ({
  tenantId,
  documentType,
  documentId,
  user,
  decision,
  note = null,
}) => {
  await ensureDocumentApprovalTable();
  const normalizedDecision = String(decision || "").trim().toUpperCase();
  if (!["APPROVED", "REJECTED"].includes(normalizedDecision)) {
    throw Object.assign(new Error("Decision de validation invalide."), { status: 400 });
  }

  const approvals = await getDocumentApprovals(tenantId, documentType, documentId);
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
    UPDATE "documentApprovals"
    SET
      "status" = ${escapeSqlValue(normalizedDecision)},
      "decidedAt" = NOW(),
      "note" = ${escapeSqlValue(note)}
    WHERE "tenantId" = ${escapeSqlValue(tenantId)}
      AND "documentType" = ${escapeSqlValue(documentType)}
      AND "documentId" = ${escapeSqlValue(documentId)}
      AND "id" = ${escapeSqlValue(currentStep.id)}
  `);

  const updatedApprovals = await getDocumentApprovals(tenantId, documentType, documentId);
  return {
    approvals: updatedApprovals,
    lifecycleStatus: deriveApprovalLifecycle(updatedApprovals),
  };
};

module.exports = {
  ensureDocumentApprovalTable,
  loadApprovalFlow,
  getDocumentApprovals,
  getDocumentApprovalMap,
  deriveApprovalLifecycle,
  prepareDocumentApprovals,
  decideDocumentApproval,
};
