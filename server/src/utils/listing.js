const parseListParams = (query = {}) => {
  const page = Number.parseInt(query.page, 10);
  const pageSize = Number.parseInt(query.pageSize, 10);
  const paginate = Number.isFinite(page) || Number.isFinite(pageSize);
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 20;
  const sortBy = query.sortBy ? String(query.sortBy) : null;
  const sortDir = String(query.sortDir).toLowerCase() === "asc" ? "asc" : "desc";
  const search = query.search ? String(query.search).trim() : "";
  const exportType = query.export && ["csv", "xlsx", "pdf"].includes(query.export)
    ? query.export
    : null;

  return {
    page: safePage,
    pageSize: safePageSize,
    paginate,
    sortBy,
    sortDir,
    search: search || null,
    exportType,
  };
};

const parseDateValue = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildDateRangeFilter = (
  query = {},
  field = "createdAt",
  fromKey = "createdFrom",
  toKey = "createdTo"
) => {
  const from = parseDateValue(query[fromKey]);
  const to = parseDateValue(query[toKey]);
  if (!from && !to) {
    return {};
  }
  return {
    [field]: {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    },
  };
};

const buildOrderBy = (sortBy, sortDir, allowed = {}) => {
  if (!sortBy) {
    return null;
  }
  const entry = allowed[sortBy];
  if (!entry) {
    return null;
  }
  if (typeof entry === "string") {
    return { [entry]: sortDir };
  }
  if (typeof entry === "function") {
    return entry(sortDir);
  }
  return entry;
};

const contains = (value) => ({ contains: value, mode: "insensitive" });

const buildMeta = ({ page, pageSize, total, sortBy, sortDir }) => {
  const totalPages = pageSize ? Math.ceil(total / pageSize) : 1;
  return { page, pageSize, total, totalPages, sortBy, sortDir };
};

module.exports = {
  parseListParams,
  buildOrderBy,
  contains,
  buildMeta,
  buildDateRangeFilter,
};
