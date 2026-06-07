const { addMinutes } = require("date-fns");
const prisma = require("../config/prisma");
const {
  signAccessToken,
  signRefreshToken,
  hashToken,
} = require("../utils/tokens");

const SUPPORT_MODES = Object.freeze({
  FULL_ACCESS: {
    code: "FULL_ACCESS",
    label: "Acces complet",
    maxDurationMinutes: 480,
    defaultDurationMinutes: 240,
  },
  ELEVATED: {
    code: "ELEVATED",
    label: "Support securise",
    maxDurationMinutes: 120,
    defaultDurationMinutes: 30,
  },
});

const clampDuration = (modeConfig, value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return modeConfig.defaultDurationMinutes;
  }

  return Math.max(5, Math.min(modeConfig.maxDurationMinutes, Math.round(parsed)));
};

const normalizeMode = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return SUPPORT_MODES[normalized] || null;
};

const buildSupportContext = ({
  actor,
  sourceTenantId,
  sourceTenantName,
  targetTenant,
  mode,
  reason,
  durationMinutes,
  startedAt,
}) => ({
  mode: mode.code,
  modeLabel: mode.label,
  sourceTenantId,
  sourceTenantName,
  targetTenantId: targetTenant.id,
  targetTenantName: targetTenant.name,
  actualRole: actor.role,
  effectiveRole: "SUPERADMIN",
  reason,
  startedAt: startedAt.toISOString(),
  expiresAt: addMinutes(startedAt, durationMinutes).toISOString(),
});

const buildSupportUser = ({ actor, targetTenant, supportContext }) => ({
  id: actor.id,
  tenantId: targetTenant.id,
  tenantName: targetTenant.name,
  role: supportContext.effectiveRole,
  actualRole: actor.role,
  email: actor.email,
  phone: actor.phone,
  firstName: actor.firstName,
  lastName: actor.lastName,
  storeId: null,
  storeName: null,
  defaultStorageZoneId: null,
  permissions: [],
  supportContext,
});

const logSupportAudit = async ({
  tenantId,
  userId,
  action,
  entityId,
  meta,
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action,
        entity: "support_session",
        entityId,
        meta,
      },
    });
  } catch (error) {
    console.error("[SUPPORT_AUDIT_ERROR]", {
      action,
      tenantId,
      userId,
      message: error?.message || "Unknown error",
    });
  }
};

const listTenants = async (req, res) => {
  const search = String(req.query?.q || "").trim();

  const tenants = await prisma.tenant.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { users: { some: { email: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      subscription: true,
      users: {
        where: { id: { equals: undefined } },
      },
    },
  });

  const ownerIds = tenants.map((tenant) => tenant.ownerId).filter(Boolean);
  const owners = ownerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      })
    : [];

  const ownerMap = new Map(owners.map((owner) => [owner.id, owner]));

  const rows = tenants.map((tenant) => {
    const owner = tenant.ownerId ? ownerMap.get(tenant.ownerId) : null;
    return {
      id: tenant.id,
      name: tenant.name,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      subscription: tenant.subscription
        ? {
            plan: tenant.subscription.plan,
            status: tenant.subscription.status,
            billingCycle: tenant.subscription.billingCycle,
            endsAt: tenant.subscription.endsAt,
          }
        : null,
      owner: owner
        ? {
            id: owner.id,
            name:
              [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim() ||
              owner.email ||
              owner.phone ||
              "Proprietaire",
            email: owner.email,
            phone: owner.phone,
          }
        : null,
      isHomeTenant: tenant.id === req.user.tenantId,
    };
  });

  return res.json(rows);
};

const startSupportSession = async (req, res) => {
  if (req.user.supportContext) {
    return res.status(409).json({
      message: "Une session support est deja active. Quittez-la avant d'en ouvrir une autre.",
    });
  }

  const targetTenantId = String(req.body?.targetTenantId || "").trim();
  const reason = String(req.body?.reason || "").trim();
  const mode = normalizeMode(req.body?.mode);

  if (!targetTenantId || !mode) {
    return res.status(400).json({
      message: "Tenant cible et mode de support obligatoires.",
    });
  }

  if (!reason) {
    return res.status(400).json({
      message: "Le motif de prise en charge est obligatoire.",
    });
  }

  const actor = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      tenantId: true,
      role: true,
      isActive: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!actor || !actor.isActive || actor.role !== "TECHNICIAN") {
    return res.status(403).json({
      message: "Seuls les techniciens actifs peuvent ouvrir une session support.",
    });
  }

  const targetTenant = await prisma.tenant.findUnique({
    where: { id: targetTenantId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!targetTenant) {
    return res.status(404).json({ message: "Tenant introuvable." });
  }

  const sourceTenant = await prisma.tenant.findUnique({
    where: { id: actor.tenantId },
    select: { id: true, name: true },
  });

  const durationMinutes = clampDuration(mode, req.body?.durationMinutes);
  const startedAt = new Date();
  const expiresAt = addMinutes(startedAt, durationMinutes);
  const supportContext = buildSupportContext({
    actor,
    sourceTenantId: actor.tenantId,
    sourceTenantName: sourceTenant?.name || req.user.tenantName || null,
    targetTenant,
    mode,
    reason,
    durationMinutes,
    startedAt,
  });

  const accessToken = signAccessToken(
    {
      sub: actor.id,
      tenantId: targetTenant.id,
      role: supportContext.effectiveRole,
      supportContext,
    },
    "15m",
  );

  const refreshToken = signRefreshToken(
    {
      sub: actor.id,
      clientType: "adminpanel",
      supportContext,
    },
    `${durationMinutes}m`,
  );

  await prisma.authSession.create({
    data: {
      userId: actor.id,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt,
    },
  });

  await logSupportAudit({
    tenantId: targetTenant.id,
    userId: actor.id,
    action: "SUPPORT_SESSION_STARTED",
    entityId: actor.id,
    meta: {
      mode: supportContext.mode,
      reason: supportContext.reason,
      sourceTenantId: supportContext.sourceTenantId,
      sourceTenantName: supportContext.sourceTenantName,
      targetTenantId: supportContext.targetTenantId,
      targetTenantName: supportContext.targetTenantName,
      expiresAt: supportContext.expiresAt,
    },
  });

  return res.status(201).json({
    accessToken,
    refreshToken,
    user: buildSupportUser({ actor, targetTenant, supportContext }),
  });
};

module.exports = {
  SUPPORT_MODES,
  listTenants,
  startSupportSession,
  logSupportAudit,
};
