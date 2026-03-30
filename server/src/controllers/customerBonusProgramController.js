const { parseListParams, buildMeta } = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const {
  listCustomerBonusPrograms,
  getCustomerBonusProgramById,
  getCurrentCustomerBonusProgram,
  createCustomerBonusProgram,
  updateCustomerBonusProgram,
  setCurrentCustomerBonusProgram,
  deleteCustomerBonusProgram,
} = require("../utils/customerBonusProgramStore");

const sanitizePayload = (body = {}) => {
  const amountThreshold = Number(body.amountThreshold);
  const pointsAwarded = Number(body.pointsAwarded);
  const pointValueAmount = Number(body.pointValueAmount || 0);
  const quotaPoints =
    body.quotaPoints === "" || body.quotaPoints === undefined || body.quotaPoints === null
      ? null
      : Number(body.quotaPoints);
  const quotaPeriodDays =
    body.quotaPeriodDays === "" ||
    body.quotaPeriodDays === undefined ||
    body.quotaPeriodDays === null
      ? null
      : Number(body.quotaPeriodDays);
  const quotaRewardAmount =
    body.quotaRewardAmount === "" ||
    body.quotaRewardAmount === undefined ||
    body.quotaRewardAmount === null
      ? null
      : Number(body.quotaRewardAmount);

  if (!String(body.name || "").trim()) return { error: "name required." };
  if (!Number.isFinite(amountThreshold) || amountThreshold <= 0) {
    return { error: "amountThreshold must be greater than zero." };
  }
  if (!Number.isFinite(pointsAwarded) || pointsAwarded < 0) {
    return { error: "pointsAwarded must be zero or greater." };
  }
  if (!Number.isFinite(pointValueAmount) || pointValueAmount < 0) {
    return { error: "pointValueAmount must be zero or greater." };
  }
  if ((quotaPoints === null) !== (quotaPeriodDays === null)) {
    return { error: "quotaPoints and quotaPeriodDays must be provided together." };
  }
  if (quotaPoints !== null && (!Number.isFinite(quotaPoints) || quotaPoints <= 0)) {
    return { error: "quotaPoints must be greater than zero." };
  }
  if (
    quotaPeriodDays !== null &&
    (!Number.isFinite(quotaPeriodDays) || quotaPeriodDays <= 0)
  ) {
    return { error: "quotaPeriodDays must be greater than zero." };
  }
  if (
    quotaRewardAmount !== null &&
    (!Number.isFinite(quotaRewardAmount) || quotaRewardAmount < 0)
  ) {
    return { error: "quotaRewardAmount must be zero or greater." };
  }

  return {
    payload: {
      name: String(body.name).trim(),
      amountThreshold,
      pointsAwarded: Math.trunc(pointsAwarded),
      pointValueAmount,
      quotaPoints: quotaPoints === null ? null : Math.trunc(quotaPoints),
      quotaPeriodDays: quotaPeriodDays === null ? null : Math.trunc(quotaPeriodDays),
      quotaRewardAmount,
      isActive: body.isActive !== false,
    },
  };
};

const listPrograms = async (req, res) => {
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);

  const result = await listCustomerBonusPrograms({
    tenantId: req.user.tenantId,
    search,
    paginate,
    page,
    pageSize,
    sortBy,
    sortDir,
  });

  if (exportType) {
    const rows = Array.isArray(result) ? result : result.rows;
    return sendExport(
      res,
      rows.map((item) => ({
        name: item.name,
        amountThreshold: item.amountThreshold,
        pointsAwarded: item.pointsAwarded,
        pointValueAmount: item.pointValueAmount,
        quotaPoints: item.quotaPoints ?? "",
        quotaPeriodDays: item.quotaPeriodDays ?? "",
        quotaRewardAmount: item.quotaRewardAmount ?? "",
        isActive: item.isActive ? "Oui" : "Non",
        createdAt: item.createdAt,
      })),
      "customer-bonus-programs",
      exportType,
    );
  }

  if (!paginate) {
    return res.json(result);
  }

  return res.json({
    data: result.rows,
    meta: buildMeta({ page, pageSize, total: result.total, sortBy, sortDir }),
  });
};

const getProgram = async (req, res) => {
  const program = await getCustomerBonusProgramById(req.user.tenantId, req.params.id);
  if (!program) {
    return res.status(404).json({ message: "Customer bonus program not found." });
  }
  return res.json(program);
};

const getCurrentProgram = async (req, res) => {
  return res.json(await getCurrentCustomerBonusProgram(req.user.tenantId));
};

const createProgram = async (req, res) => {
  const { payload, error } = sanitizePayload(req.body || {});
  if (error) return res.status(400).json({ message: error });
  return res.status(201).json(
    await createCustomerBonusProgram(req.user.tenantId, payload),
  );
};

const updateProgram = async (req, res) => {
  const existing = await getCustomerBonusProgramById(req.user.tenantId, req.params.id);
  if (!existing) {
    return res.status(404).json({ message: "Customer bonus program not found." });
  }
  const { payload, error } = sanitizePayload(req.body || {});
  if (error) return res.status(400).json({ message: error });
  return res.json(await updateCustomerBonusProgram(req.user.tenantId, req.params.id, payload));
};

const setCurrentProgram = async (req, res) => {
  const existing = await getCustomerBonusProgramById(req.user.tenantId, req.params.id);
  if (!existing) {
    return res.status(404).json({ message: "Customer bonus program not found." });
  }
  return res.json(await setCurrentCustomerBonusProgram(req.user.tenantId, req.params.id));
};

const deleteProgram = async (req, res) => {
  const existing = await getCustomerBonusProgramById(req.user.tenantId, req.params.id);
  if (!existing) {
    return res.status(404).json({ message: "Customer bonus program not found." });
  }
  if (existing.isActive) {
    return res
      .status(400)
      .json({ message: "Active customer bonus program cannot be deleted." });
  }
  await deleteCustomerBonusProgram(req.user.tenantId, req.params.id);
  return res.json({ message: "Customer bonus program deleted." });
};

module.exports = {
  listPrograms,
  getProgram,
  getCurrentProgram,
  createProgram,
  updateProgram,
  setCurrentProgram,
  deleteProgram,
};
