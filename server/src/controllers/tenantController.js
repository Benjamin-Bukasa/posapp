const prisma = require("../config/prisma");

const normalizeTenantName = (value) => String(value || "").trim();

const serializeTenant = (tenant) => {
  if (!tenant) return null;
  return {
    id: tenant.id,
    name: tenant.name,
    ownerId: tenant.ownerId || null,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
};

const getCurrentTenant = async (req, res) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.user.tenantId },
  });

  if (!tenant) {
    return res.status(404).json({ message: "Tenant introuvable." });
  }

  return res.json(serializeTenant(tenant));
};

const updateCurrentTenant = async (req, res) => {
  const nextName = normalizeTenantName(req.body?.tenantName ?? req.body?.name);

  if (!nextName) {
    return res.status(400).json({
      message: "Le nom du tenant est obligatoire.",
    });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: req.user.tenantId },
  });

  if (!tenant) {
    return res.status(404).json({ message: "Tenant introuvable." });
  }

  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data: { name: nextName },
  });

  return res.json({
    message: "Les informations du tenant ont ete mises a jour.",
    tenant: serializeTenant(updated),
    tenantName: updated.name,
  });
};

module.exports = {
  getCurrentTenant,
  updateCurrentTenant,
};
