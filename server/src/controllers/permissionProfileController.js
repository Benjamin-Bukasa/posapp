const {
  PROFILE_ROLE_OPTIONS,
  listPermissionCatalog,
  listProfilesByTenant,
  getProfileById,
  createProfile,
  updateProfile,
  deleteProfile,
} = require("../utils/permissionProfileStore");
const {
  parseListParams,
  buildMeta,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");

const compareValues = (left, right) =>
  String(left || "").localeCompare(String(right || ""), "fr", {
    sensitivity: "base",
    numeric: true,
  });

const listCatalog = async (_req, res) => {
  return res.json({
    roles: PROFILE_ROLE_OPTIONS,
    modules: listPermissionCatalog(),
  });
};

const listProfiles = async (req, res) => {
  const { page, pageSize, paginate, search, exportType } = parseListParams(req.query);
  const rows = await listProfilesByTenant(req.user.tenantId);

  const filtered = search
    ? rows.filter((row) =>
        [row.name, row.role, row.description]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(String(search).toLowerCase()),
          ),
      )
    : rows;

  const sorted = [...filtered].sort((left, right) => {
    const roleCompare = compareValues(left.role, right.role);
    if (roleCompare !== 0) return roleCompare;
    return compareValues(left.name, right.name);
  });

  if (exportType) {
    const exportRows = sorted.map((item) => ({
      id: item.id,
      name: item.name,
      role: item.role,
      description: item.description,
      permissionCount: item.permissionCount,
      userCount: item.userCount,
      permissions: item.permissions.join(", "),
      createdAt: item.createdAt,
    }));

    return sendExport(res, exportRows, "permission-profiles", exportType);
  }

  if (!paginate) {
    return res.json(sorted);
  }

  const startIndex = (page - 1) * pageSize;
  const paginated = sorted.slice(startIndex, startIndex + pageSize);

  return res.json({
    data: paginated,
    meta: buildMeta({
      page,
      pageSize,
      total: sorted.length,
    }),
  });
};

const getProfile = async (req, res) => {
  const profile = await getProfileById(req.user.tenantId, req.params.id);
  if (!profile) {
    return res.status(404).json({ message: "Profil de permissions introuvable." });
  }

  return res.json(profile);
};

const createProfileHandler = async (req, res) => {
  try {
    const profile = await createProfile({
      tenantId: req.user.tenantId,
      name: req.body?.name,
      role: String(req.body?.role || "").toUpperCase(),
      description: req.body?.description,
      permissions: req.body?.permissions,
    });

    return res.status(201).json(profile);
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de creer ce profil de permissions.",
    });
  }
};

const updateProfileHandler = async (req, res) => {
  try {
    const profile = await updateProfile({
      tenantId: req.user.tenantId,
      profileId: req.params.id,
      name: req.body?.name,
      role: String(req.body?.role || "").toUpperCase(),
      description: req.body?.description,
      permissions: req.body?.permissions,
    });

    return res.json(profile);
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de modifier ce profil de permissions.",
    });
  }
};

const deleteProfileHandler = async (req, res) => {
  try {
    const deleted = await deleteProfile(req.user.tenantId, req.params.id);
    return res.json({
      message: "Profil de permissions supprime.",
      id: deleted.id,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de supprimer ce profil de permissions.",
    });
  }
};

module.exports = {
  listCatalog,
  listProfiles,
  getProfile,
  createProfile: createProfileHandler,
  updateProfile: updateProfileHandler,
  deleteProfile: deleteProfileHandler,
};
