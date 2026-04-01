const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        tenant: {
          select: {
            name: true,
          },
        },
        permissions: { include: { permission: true } },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = {
      id: user.id,
      tenantId: user.tenantId,
      tenantName: user.tenant?.name || null,
      role: user.role,
      storeId: user.storeId,
      defaultStorageZoneId: user.defaultStorageZoneId,
      permissions: user.permissions.map((item) => item.permission.code),
    };
    res.locals.tenantName = user.tenant?.name || null;

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = auth;
