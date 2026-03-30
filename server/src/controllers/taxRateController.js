const { parseListParams, buildMeta } = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const {
  listTaxRates,
  getTaxRateById,
  findTaxRateByCodeOrName,
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
} = require("../utils/taxRateStore");

const sanitizePayload = (body = {}) => {
  const code = String(body.code || "").trim();
  const name = String(body.name || "").trim() || null;
  const rate = Number(body.rate);
  const isActive = body.isActive !== false;

  if (!code) return { error: "Tax code required." };
  if (!Number.isFinite(rate) || rate < 0) {
    return { error: "Tax rate must be zero or greater." };
  }

  return {
    payload: {
      code,
      name,
      rate,
      isActive,
    },
  };
};

const listAll = async (req, res) => {
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const result = await listTaxRates({
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
        code: item.code,
        name: item.name || "",
        rate: item.rate,
        status: item.status,
        createdAt: item.createdAt,
      })),
      "tax-rates",
      exportType,
    );
  }

  if (!paginate) return res.json(result);
  return res.json({
    data: result.rows,
    meta: buildMeta({ page, pageSize, total: result.total, sortBy, sortDir }),
  });
};

const getOne = async (req, res) => {
  const item = await getTaxRateById(req.user.tenantId, req.params.id);
  if (!item) return res.status(404).json({ message: "Tax rate not found." });
  return res.json(item);
};

const createOne = async (req, res) => {
  const { payload, error } = sanitizePayload(req.body || {});
  if (error) return res.status(400).json({ message: error });

  const existing = await findTaxRateByCodeOrName(req.user.tenantId, payload.code);
  if (existing) {
    return res.status(400).json({ message: "Tax rate already exists." });
  }

  const created = await createTaxRate({ tenantId: req.user.tenantId, ...payload });
  return res.status(201).json(created);
};

const updateOne = async (req, res) => {
  const existing = await getTaxRateById(req.user.tenantId, req.params.id);
  if (!existing) return res.status(404).json({ message: "Tax rate not found." });

  const { payload, error } = sanitizePayload(req.body || {});
  if (error) return res.status(400).json({ message: error });

  const duplicate = await findTaxRateByCodeOrName(req.user.tenantId, payload.code);
  if (duplicate && duplicate.id !== req.params.id) {
    return res.status(400).json({ message: "Tax rate already exists." });
  }

  return res.json(
    await updateTaxRate({ tenantId: req.user.tenantId, id: req.params.id, ...payload }),
  );
};

const deleteOne = async (req, res) => {
  const existing = await getTaxRateById(req.user.tenantId, req.params.id);
  if (!existing) return res.status(404).json({ message: "Tax rate not found." });
  await deleteTaxRate({ tenantId: req.user.tenantId, id: req.params.id });
  return res.json({ message: "Tax rate deleted." });
};

module.exports = {
  listAll,
  getOne,
  createOne,
  updateOne,
  deleteOne,
};
