const prisma = require("../config/prisma");
const { sendWorkbook, readSheetRows } = require("../utils/xlsxTemplates");
const { hashPassword } = require("../utils/password");
const { generateTempPassword } = require("../utils/tokens");
const { sendEmail, sendSms } = require("../services/notificationService");
const { buildAccountCreationEmail } = require("../utils/emailTemplates");
const {
  assignProfileToUser,
  getProfileById,
  getAssignedProfileByUserId,
  getAssignedProfilesMap,
} = require("../utils/permissionProfileStore");
const { hasPermission } = require("../utils/permissionAccess");
const {
  parseListParams,
  buildOrderBy,
  contains,
  buildMeta,
  buildDateRangeFilter,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");

const createUserRecord = async ({
  tenantId,
  email,
  phone,
  firstName,
  lastName,
  role,
  storeId,
  defaultStorageZoneId,
  sendVia,
  permissions,
  permissionProfileId,
}) => {
  if (!email && !phone) {
    throw Object.assign(new Error("Email ou telephone requis."), { status: 400 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
  });

  const userCount = await prisma.user.count({
    where: { tenantId },
  });

  if (subscription && userCount >= subscription.maxUsers) {
    throw Object.assign(
      new Error("Limite d'utilisateurs atteinte pour votre abonnement."),
      { status: 403 },
    );
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });
  if (existing) {
    throw Object.assign(new Error("Utilisateur deja existant."), { status: 409 });
  }

  if (permissionProfileId) {
    const profile = await getProfileById(tenantId, permissionProfileId);
    if (!profile) {
      throw Object.assign(new Error("Profil de permissions introuvable."), {
        status: 404,
      });
    }
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const user = await prisma.user.create({
    data: {
      tenantId,
      email,
      phone,
      firstName,
      lastName,
      role: role || "USER",
      storeId,
      defaultStorageZoneId,
      passwordHash,
      mustChangePassword: true,
    },
  });

  if (permissionProfileId) {
    await assignProfileToUser({
      tenantId,
      profileId: permissionProfileId,
      userId: user.id,
      db: prisma,
    });
  } else if (Array.isArray(permissions) && permissions.length) {
    const permissionRecords = await prisma.permission.findMany({
      where: { code: { in: permissions } },
    });

    await prisma.userPermission.createMany({
      data: permissionRecords.map((perm) => ({
        userId: user.id,
        permissionId: perm.id,
      })),
      skipDuplicates: true,
    });
  }

  const identifier = email || phone;
  const { subject, text, html } = buildAccountCreationEmail({
    tenantName: "NeoPharma",
    identifier,
    tempPassword,
  });

  if (sendVia === "sms" && phone) {
    await sendSms({ to: phone, message: text });
  } else if (email) {
    await sendEmail({
      to: email,
      subject,
      text,
      html,
    });
  }

  return user;
};

const createUser = async (req, res) => {
  const {
    email,
    phone,
    firstName,
    lastName,
    role,
    storeId,
    defaultStorageZoneId,
    sendVia,
    permissions,
    permissionProfileId,
  } = req.body || {};

  let user;
  try {
    user = await createUserRecord({
      tenantId: req.user.tenantId,
      email,
      phone,
      firstName,
      lastName,
      role,
      storeId,
      defaultStorageZoneId,
      sendVia,
      permissions,
      permissionProfileId,
    });
  } catch (error) {
    return res.status(error?.status || 500).json({ message: error.message });
  }

  return res.status(201).json({
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
  });
};

const downloadUsersTemplate = async (_req, res) =>
  sendWorkbook(res, "template-utilisateurs", [
    {
      name: "Users",
      rows: [
        {
          firstName: "Benjamin",
          lastName: "Bukasa",
          email: "benjamin@example.com",
          phone: "+243900000001",
          role: "ADMIN",
          storeName: "Pharma Centrale",
          defaultStorageZoneName: "Magasin",
          sendVia: "email",
        },
      ],
    },
  ]);

const importUsers = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Fichier Excel requis." });
  }

  try {
    const rows = readSheetRows(req.file.buffer, "Users");
    const stores = await prisma.store.findMany({
      where: { tenantId: req.user.tenantId },
      select: { id: true, name: true, code: true },
    });
    const zones = await prisma.storageZone.findMany({
      where: { tenantId: req.user.tenantId },
      select: { id: true, name: true, code: true },
    });
    const storeMap = new Map(
      stores.flatMap((store) => [
        [String(store.name || "").toLowerCase(), store],
        [String(store.code || "").toLowerCase(), store],
      ]),
    );
    const zoneMap = new Map(
      zones.flatMap((zone) => [
        [String(zone.name || "").toLowerCase(), zone],
        [String(zone.code || "").toLowerCase(), zone],
      ]),
    );

    let created = 0;
    const errors = [];

    for (const [index, row] of rows.entries()) {
      const email = String(row.email || row.Email || "").trim() || null;
      const phone = String(row.phone || row.Phone || "").trim() || null;
      const firstName = String(row.firstName || row.FirstName || "").trim() || null;
      const lastName = String(row.lastName || row.LastName || "").trim() || null;
      const role = String(row.role || row.Role || "USER").trim().toUpperCase() || "USER";
      const sendVia = String(row.sendVia || row.SendVia || "email").trim().toLowerCase() || "email";
      const storeKey = String(row.storeName || row.storeCode || row.Store || "").trim().toLowerCase();
      const zoneKey = String(
        row.defaultStorageZoneName || row.defaultStorageZoneCode || row.Zone || "",
      )
        .trim()
        .toLowerCase();

      if (!email && !phone) {
        continue;
      }

      const store = storeKey ? storeMap.get(storeKey) : null;
      const zone = zoneKey ? zoneMap.get(zoneKey) : null;

      try {
        await createUserRecord({
          tenantId: req.user.tenantId,
          email,
          phone,
          firstName,
          lastName,
          role,
          storeId: store?.id,
          defaultStorageZoneId: zone?.id,
          sendVia,
        });
        created += 1;
      } catch (error) {
        errors.push({
          line: index + 2,
          message: error.message,
          identifier: email || phone || `ligne-${index + 2}`,
        });
      }
    }

    return res.json({
      message: "Import utilisateurs termine.",
      created,
      failed: errors.length,
      errors,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Impossible d'importer les utilisateurs.",
    });
  }
};

const listUsers = async (req, res) => {
  const { role, storeId } = req.query || {};
  const isActive =
    req.query?.isActive === undefined
      ? undefined
      : String(req.query.isActive).toLowerCase() === "true";
  const { page, pageSize, paginate, sortBy, sortDir, search, exportType } =
    parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const searchFilter = search
    ? {
        OR: [
          { firstName: contains(search) },
          { lastName: contains(search) },
          { email: contains(search) },
          { phone: contains(search) },
          { role: contains(search) },
        ],
      }
    : {};

  const where = {
    tenantId: req.user.tenantId,
    ...(role ? { role } : {}),
    ...(storeId ? { storeId } : {}),
    ...(isActive === undefined ? {} : { isActive }),
    ...createdAtFilter,
    ...searchFilter,
  };

  const orderBy =
    buildOrderBy(sortBy, sortDir, {
      createdAt: "createdAt",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      role: "role",
    }) || { createdAt: "desc" };

  const selectFields = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    phone: true,
    role: true,
    isActive: true,
    storeId: true,
    store: {
      select: {
        id: true,
        name: true,
      },
    },
    defaultStorageZoneId: true,
    createdAt: true,
    permissions: {
      include: {
        permission: {
          select: {
            code: true,
            label: true,
          },
        },
      },
    },
  };

  const enrichUsersWithAccessData = async (users = []) => {
    const profileMap = await getAssignedProfilesMap(
      req.user.tenantId,
      users.map((user) => user.id),
    );

    return users.map((user) => ({
      ...user,
      permissions: (user.permissions || []).map((item) => item.permission.code),
      permissionProfile: profileMap.get(user.id) || null,
      permissionProfileId: profileMap.get(user.id)?.id || null,
    }));
  };

  if (exportType) {
    const data = await prisma.user.findMany({
      where,
      orderBy,
      select: selectFields,
    });
    const enriched = await enrichUsersWithAccessData(data);

    const rows = enriched.map((item) => ({
      id: item.id,
      firstName: item.firstName,
      lastName: item.lastName,
      email: item.email,
      phone: item.phone,
      role: item.role,
      isActive: item.isActive,
      storeId: item.storeId,
      storeName: item.store?.name || "",
      permissionProfileName: item.permissionProfile?.name || "",
      permissionCount: item.permissions?.length || 0,
      createdAt: item.createdAt,
    }));

    return sendExport(res, rows, "users", exportType);
  }

  if (!paginate) {
    const users = await prisma.user.findMany({
      where,
      orderBy,
      select: selectFields,
    });

    return res.json(await enrichUsersWithAccessData(users));
  }

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      select: selectFields,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return res.json({
    data: await enrichUsersWithAccessData(users),
    meta: buildMeta({ page, pageSize, total, sortBy, sortDir }),
  });
};

const getUser = async (req, res) => {
  const { id } = req.params;

  if (id !== req.user.id && !hasPermission(req.user, "users.read")) {
    return res.status(403).json({
      message: "Vous n'avez pas la permission de consulter cet utilisateur.",
    });
  }

  const user = await prisma.user.findFirst({
    where: { id, tenantId: req.user.tenantId },
    include: {
      store: true,
      permissions: {
        include: {
          permission: {
            select: {
              code: true,
              label: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const permissionProfile = await getAssignedProfileByUserId(req.user.tenantId, id);

  return res.json({
    ...user,
    permissions: (user.permissions || []).map((item) => item.permission.code),
    permissionProfile,
    permissionProfileId: permissionProfile?.id || null,
  });
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const {
    firstName,
    lastName,
    email,
    phone,
    role,
    storeId,
    defaultStorageZoneId,
    isActive,
    permissionProfileId,
    permissions,
  } = req.body || {};

  const user = await prisma.user.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      firstName,
      lastName,
      email,
      phone,
      role,
      storeId,
      defaultStorageZoneId,
      isActive,
    },
  });

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "permissionProfileId")) {
    await assignProfileToUser({
      tenantId: req.user.tenantId,
      profileId: permissionProfileId || null,
      userId: id,
      db: prisma,
    });
  } else if (Array.isArray(permissions)) {
    const permissionRecords = await prisma.permission.findMany({
      where: { code: { in: permissions } },
    });

    await prisma.userPermission.deleteMany({ where: { userId: id } });
    await prisma.$executeRawUnsafe(
      `DELETE FROM user_permission_profiles WHERE user_id = $1`,
      id,
    );
    if (permissionRecords.length) {
      await prisma.userPermission.createMany({
        data: permissionRecords.map((perm) => ({
          userId: id,
          permissionId: perm.id,
        })),
      });
    }
  }
  const permissionProfile = await getAssignedProfileByUserId(req.user.tenantId, id);

  return res.json({
    ...updated,
    permissions: Array.isArray(permissions) ? permissions : undefined,
    permissionProfile,
    permissionProfileId: permissionProfile?.id || null,
  });
};

const deactivateUser = async (req, res) => {
  const { id } = req.params;

  const user = await prisma.user.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  return res.json(updated);
};

const updateUserPermissions = async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body || {};

  if (!Array.isArray(permissions)) {
    return res.status(400).json({ message: "permissions array required." });
  }

  const user = await prisma.user.findFirst({
    where: { id, tenantId: req.user.tenantId },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const permissionRecords = await prisma.permission.findMany({
    where: { code: { in: permissions } },
  });

  await prisma.userPermission.deleteMany({ where: { userId: id } });
  await prisma.$executeRawUnsafe(
    `DELETE FROM user_permission_profiles WHERE user_id = $1`,
    id,
  );
  if (permissionRecords.length) {
    await prisma.userPermission.createMany({
      data: permissionRecords.map((perm) => ({
        userId: id,
        permissionId: perm.id,
      })),
    });
  }

  return res.json({ message: "Permissions updated." });
};

module.exports = {
  createUser,
  downloadUsersTemplate,
  importUsers,
  listUsers,
  getUser,
  updateUser,
  deactivateUser,
  updateUserPermissions,
};
