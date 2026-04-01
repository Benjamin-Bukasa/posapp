const prisma = require("../config/prisma");
const {
  parseListParams,
  buildOrderBy,
  contains,
  buildMeta,
  buildDateRangeFilter,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const {
  APPROVAL_FLOW_CATALOG,
  APPROVAL_FLOW_CODE_SET,
  normalizeApprovalFlowCode,
  findApprovalFlowCatalogEntry,
} = require("../utils/approvalFlowCatalog");

const listCatalog = async (_req, res) => res.json(APPROVAL_FLOW_CATALOG);

const createFlow = async (req, res) => {
  const { code, name, steps } = req.body || {};
  const normalizedCode = normalizeApprovalFlowCode(code);
  const catalogEntry = findApprovalFlowCatalogEntry(normalizedCode);

  if (!normalizedCode) {
    return res.status(400).json({ message: "Le code du niveau de validation est requis." });
  }

  if (!APPROVAL_FLOW_CODE_SET.has(normalizedCode)) {
    return res.status(400).json({ message: "Code de niveau de validation invalide." });
  }

  const flow = await prisma.approvalFlow.create({
    data: {
      tenantId: req.user.tenantId,
      code: normalizedCode,
      name: String(name || catalogEntry?.name || "").trim() || catalogEntry.name,
      steps: Array.isArray(steps)
        ? {
            create: steps.map((step) => ({
              tenantId: req.user.tenantId,
              stepOrder: step.stepOrder,
              approverRole: step.approverRole,
              approverUserId: step.approverUserId,
            })),
          }
        : undefined,
    },
    include: { steps: true },
  });

  return res.status(201).json(flow);
};

const listFlows = async (req, res) => {
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const searchFilter = search
    ? {
        OR: [{ code: contains(search) }, { name: contains(search) }],
      }
    : {};

  const where = {
    tenantId: req.user.tenantId,
    ...createdAtFilter,
    ...searchFilter,
  };

  const orderBy =
    buildOrderBy(sortBy, sortDir, {
      createdAt: "createdAt",
      code: "code",
      name: "name",
    }) || { createdAt: "desc" };

  if (exportType) {
    const data = await prisma.approvalFlow.findMany({
      where,
      include: { steps: true },
      orderBy,
    });

    const rows = data.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      stepsCount: item.steps?.length || 0,
      createdAt: item.createdAt,
    }));

    return sendExport(res, rows, "approval-flows", exportType);
  }

  if (!paginate) {
    const flows = await prisma.approvalFlow.findMany({
      where,
      include: { steps: true },
      orderBy,
    });
    return res.json(flows);
  }

  const [total, flows] = await prisma.$transaction([
    prisma.approvalFlow.count({ where }),
    prisma.approvalFlow.findMany({
      where,
      include: { steps: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return res.json({
    data: flows,
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const updateFlow = async (req, res) => {
  const { id } = req.params;
  const { code, name, steps } = req.body || {};
  const normalizedCode = normalizeApprovalFlowCode(code);
  const catalogEntry = findApprovalFlowCatalogEntry(normalizedCode);

  const flow = await prisma.approvalFlow.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });

  if (!flow) {
    return res.status(404).json({ message: "Approval flow not found." });
  }

  if (!normalizedCode) {
    return res.status(400).json({ message: "Le code du niveau de validation est requis." });
  }

  if (!APPROVAL_FLOW_CODE_SET.has(normalizedCode)) {
    return res.status(400).json({ message: "Code de niveau de validation invalide." });
  }

  await prisma.approvalFlowStep.deleteMany({
    where: { flowId: id },
  });

  const updated = await prisma.approvalFlow.update({
    where: { id },
    data: {
      code: normalizedCode,
      name: String(name || catalogEntry?.name || flow.name || "").trim() || catalogEntry.name,
      steps: Array.isArray(steps)
        ? {
            create: steps.map((step) => ({
              tenantId: req.user.tenantId,
              stepOrder: step.stepOrder,
              approverRole: step.approverRole,
              approverUserId: step.approverUserId,
            })),
          }
        : undefined,
    },
    include: { steps: true },
  });

  return res.json(updated);
};

const deleteFlow = async (req, res) => {
  const { id } = req.params;

  const flow = await prisma.approvalFlow.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });

  if (!flow) {
    return res.status(404).json({ message: "Approval flow not found." });
  }

  await prisma.approvalFlow.delete({ where: { id } });
  return res.json({ message: "Approval flow deleted." });
};

module.exports = {
  listCatalog,
  createFlow,
  listFlows,
  updateFlow,
  deleteFlow,
};
