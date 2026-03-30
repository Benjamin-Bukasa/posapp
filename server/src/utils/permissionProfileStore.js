const crypto = require("crypto");
const prisma = require("../config/prisma");
const { PERMISSION_MODULES, PERMISSION_CODE_SET } = require("./permissionCatalog");

const PROFILE_ROLE_OPTIONS = ["ADMIN", "MANAGER", "USER"];

const parseJson = (value, fallback) => {
  if (!value) return fallback;
  if (Array.isArray(value) || typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const normalizePermissionCodes = (codes = []) =>
  Array.from(
    new Set(
      (Array.isArray(codes) ? codes : [])
        .map((code) => String(code || "").trim())
        .filter((code) => PERMISSION_CODE_SET.has(code)),
    ),
  );

const normalizeProfileRow = (row) => {
  if (!row) return null;

  const permissions = normalizePermissionCodes(parseJson(row.permissions_json, []));

  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    role: row.role,
    description: row.description || "",
    permissions,
    permissionCount: permissions.length,
    userCount: Number(row.user_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const ensurePermissionCatalog = async () => {
  const codes = PERMISSION_MODULES.flatMap((moduleItem) =>
    moduleItem.actions.map((action) => ({
      code: action.code,
      label: `${moduleItem.label} - ${action.label}`,
      description: moduleItem.description,
    })),
  );

  for (const item of codes) {
    // Upsert row by row to stay compatible with existing schema and avoid migrations.
    await prisma.permission.upsert({
      where: { code: item.code },
      update: {
        label: item.label,
        description: item.description,
      },
      create: item,
    });
  }
};

const ensurePermissionProfileTables = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS permission_profiles (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      description TEXT,
      permissions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT permission_profiles_role_check CHECK (role IN ('ADMIN', 'MANAGER', 'USER')),
      CONSTRAINT permission_profiles_tenant_name_unique UNIQUE (tenant_id, name),
      CONSTRAINT permission_profiles_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS user_permission_profiles (
      user_id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT user_permission_profiles_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT user_permission_profiles_profile_fk FOREIGN KEY (profile_id) REFERENCES permission_profiles(id) ON DELETE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_permission_profiles_tenant_id
    ON permission_profiles (tenant_id)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_user_permission_profiles_profile_id
    ON user_permission_profiles (profile_id)
  `);

  await ensurePermissionCatalog();
};

const listPermissionCatalog = () => PERMISSION_MODULES;

const listProfilesByTenant = async (tenantId) => {
  await ensurePermissionProfileTables();
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT
        p.*,
        COALESCE(COUNT(upp.user_id), 0) AS user_count
      FROM permission_profiles p
      LEFT JOIN user_permission_profiles upp ON upp.profile_id = p.id
      WHERE p.tenant_id = $1
      GROUP BY p.id
      ORDER BY p.created_at DESC, p.name ASC
    `,
    tenantId,
  );

  return rows.map(normalizeProfileRow);
};

const getProfileById = async (tenantId, profileId) => {
  await ensurePermissionProfileTables();
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT
        p.*,
        COALESCE(COUNT(upp.user_id), 0) AS user_count
      FROM permission_profiles p
      LEFT JOIN user_permission_profiles upp ON upp.profile_id = p.id
      WHERE p.tenant_id = $1 AND p.id = $2
      GROUP BY p.id
      LIMIT 1
    `,
    tenantId,
    profileId,
  );

  return normalizeProfileRow(rows[0] || null);
};

const syncUserPermissions = async (db, userId, permissionCodes = []) => {
  const permissionRecords = permissionCodes.length
    ? await db.permission.findMany({
        where: { code: { in: permissionCodes } },
      })
    : [];

  await db.userPermission.deleteMany({ where: { userId } });

  if (permissionRecords.length) {
    await db.userPermission.createMany({
      data: permissionRecords.map((permission) => ({
        userId,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }
};

const assignProfileToUser = async ({ tenantId, profileId, userId, db = prisma }) => {
  await ensurePermissionProfileTables();
  const user = await db.user.findFirst({
    where: { id: userId, tenantId },
    select: { id: true },
  });

  if (!user) {
    throw Object.assign(new Error("Utilisateur introuvable."), { status: 404 });
  }

  await db.$executeRawUnsafe(
    `DELETE FROM user_permission_profiles WHERE user_id = $1`,
    userId,
  );

  if (!profileId) {
    await syncUserPermissions(db, userId, []);
    return null;
  }

  const profile = await getProfileById(tenantId, profileId);
  if (!profile) {
    throw Object.assign(new Error("Profil de permissions introuvable."), {
      status: 404,
    });
  }

  await db.$executeRawUnsafe(
    `
      INSERT INTO user_permission_profiles (user_id, profile_id, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
    `,
    userId,
    profileId,
  );

  await syncUserPermissions(db, userId, profile.permissions);
  return profile;
};

const getAssignedProfileByUserId = async (tenantId, userId) => {
  await ensurePermissionProfileTables();
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT
        p.*,
        1 AS user_count
      FROM user_permission_profiles upp
      INNER JOIN permission_profiles p ON p.id = upp.profile_id
      WHERE upp.user_id = $1 AND p.tenant_id = $2
      LIMIT 1
    `,
    userId,
    tenantId,
  );

  return normalizeProfileRow(rows[0] || null);
};

const getAssignedProfilesMap = async (tenantId, userIds = []) => {
  await ensurePermissionProfileTables();
  if (!Array.isArray(userIds) || !userIds.length) {
    return new Map();
  }

  const placeholders = userIds.map((_, index) => `$${index + 2}`).join(", ");
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT
        upp.user_id,
        p.*,
        1 AS user_count
      FROM user_permission_profiles upp
      INNER JOIN permission_profiles p ON p.id = upp.profile_id
      WHERE p.tenant_id = $1
        AND upp.user_id IN (${placeholders})
    `,
    tenantId,
    ...userIds,
  );

  return new Map(
    rows.map((row) => [row.user_id, normalizeProfileRow(row)]),
  );
};

const createProfile = async ({ tenantId, name, role, description, permissions }) => {
  await ensurePermissionProfileTables();
  if (!name) {
    throw Object.assign(new Error("Le nom du profil est obligatoire."), {
      status: 400,
    });
  }

  if (!PROFILE_ROLE_OPTIONS.includes(role)) {
    throw Object.assign(new Error("Le role du profil est invalide."), {
      status: 400,
    });
  }

  const profileId = crypto.randomUUID();
  const permissionCodes = normalizePermissionCodes(permissions);

  try {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO permission_profiles (
          id,
          tenant_id,
          name,
          role,
          description,
          permissions_json,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())
      `,
      profileId,
      tenantId,
      name.trim(),
      role,
      description || null,
      JSON.stringify(permissionCodes),
    );
  } catch (error) {
    if (String(error?.message || "").includes("permission_profiles_tenant_name_unique")) {
      throw Object.assign(new Error("Un profil avec ce nom existe deja."), {
        status: 409,
      });
    }
    throw error;
  }

  return getProfileById(tenantId, profileId);
};

const updateProfile = async ({
  tenantId,
  profileId,
  name,
  role,
  description,
  permissions,
}) => {
  await ensurePermissionProfileTables();
  const currentProfile = await getProfileById(tenantId, profileId);
  if (!currentProfile) {
    throw Object.assign(new Error("Profil de permissions introuvable."), {
      status: 404,
    });
  }

  if (!name) {
    throw Object.assign(new Error("Le nom du profil est obligatoire."), {
      status: 400,
    });
  }

  if (!PROFILE_ROLE_OPTIONS.includes(role)) {
    throw Object.assign(new Error("Le role du profil est invalide."), {
      status: 400,
    });
  }

  const permissionCodes = normalizePermissionCodes(permissions);

  try {
    await prisma.$executeRawUnsafe(
      `
        UPDATE permission_profiles
        SET
          name = $3,
          role = $4,
          description = $5,
          permissions_json = $6::jsonb,
          updated_at = NOW()
        WHERE tenant_id = $1 AND id = $2
      `,
      tenantId,
      profileId,
      name.trim(),
      role,
      description || null,
      JSON.stringify(permissionCodes),
    );
  } catch (error) {
    if (String(error?.message || "").includes("permission_profiles_tenant_name_unique")) {
      throw Object.assign(new Error("Un profil avec ce nom existe deja."), {
        status: 409,
      });
    }
    throw error;
  }

  const userRows = await prisma.$queryRawUnsafe(
    `SELECT user_id FROM user_permission_profiles WHERE profile_id = $1`,
    profileId,
  );

  await prisma.$transaction(async (db) => {
    for (const row of userRows) {
      await syncUserPermissions(db, row.user_id, permissionCodes);
    }
  });

  return getProfileById(tenantId, profileId);
};

const deleteProfile = async (tenantId, profileId) => {
  await ensurePermissionProfileTables();
  const profile = await getProfileById(tenantId, profileId);
  if (!profile) {
    throw Object.assign(new Error("Profil de permissions introuvable."), {
      status: 404,
    });
  }

  if (profile.userCount > 0) {
    throw Object.assign(
      new Error("Ce profil est deja affecte a un ou plusieurs utilisateurs."),
      { status: 409 },
    );
  }

  await prisma.$executeRawUnsafe(
    `DELETE FROM permission_profiles WHERE tenant_id = $1 AND id = $2`,
    tenantId,
    profileId,
  );

  return profile;
};

module.exports = {
  PROFILE_ROLE_OPTIONS,
  ensurePermissionProfileTables,
  listPermissionCatalog,
  listProfilesByTenant,
  getProfileById,
  createProfile,
  updateProfile,
  deleteProfile,
  assignProfileToUser,
  getAssignedProfileByUserId,
  getAssignedProfilesMap,
  normalizePermissionCodes,
};
