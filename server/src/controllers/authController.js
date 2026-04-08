const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const { addDays, addMinutes } = require("date-fns");
const prisma = require("../config/prisma");
const { hashPassword, comparePassword } = require("../utils/password");
const {
  signAccessToken,
  signRefreshToken,
  hashToken,
  generateRandomToken,
  generateTempPassword,
} = require("../utils/tokens");
const {
  sendEmail,
  sendSms,
  isEmailConfigured,
} = require("../services/notificationService");
const { verifyGoogleIdToken } = require("../services/googleService");
const { getPlanConfig } = require("../services/subscriptionService");

const getClientType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "adminpanel") return "adminpanel";
  if (normalized === "frontend") return "frontend";
  return "frontend";
};

const getAccessTokenTtlByClient = (clientType) => {
  return getClientType(clientType) === "adminpanel" ? "60m" : "480m";
};

const queueForgotPasswordNotification = ({ user, sendVia, resetToken }) => {
  const identifier = user?.email || user?.phone || user?.id || "unknown-user";
  const message = `Reinitialisation du mot de passe: ${resetToken}.`;

  Promise.resolve()
    .then(async () => {
      if (sendVia === "sms" && user?.phone) {
        await sendSms({ to: user.phone, message });
        return;
      }

      if (user?.email) {
        const result = await sendEmail({
          to: user.email,
          subject: "Reinitialisation du mot de passe",
          message,
        });
        if (result?.skipped) {
          throw new Error("SMTP non configure.");
        }
        return;
      }

      if (user?.phone) {
        await sendSms({ to: user.phone, message });
      }
    })
    .catch((error) => {
      console.error("[FORGOT_PASSWORD_NOTIFICATION_ERROR]", {
        identifier,
        message: error?.message || "Notification failed.",
      });
    });
};

const register = async (req, res) => {
  const { tenantName, email, phone, plan, sendVia, firstName, lastName } =
    req.body || {};

  if (!tenantName || !plan || (!email && !phone)) {
    return res.status(400).json({
      message: "le nom de la Vendeur, le plan, email et phone sont obligatoire.",
    });
  }

  const planConfig = getPlanConfig(plan);
  if (!planConfig) {
    return res.status(400).json({ message: "Plan d'abonnement invalide." });
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { phone }],
    },
  });
  if (existing) {
    return res.status(409).json({ message: "L'utilisateur existe déjà." });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const tenant = await prisma.tenant.create({
    data: { name: tenantName },
  });

  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      plan,
      price: planConfig.price,
      maxStores: planConfig.maxStores,
      maxUsers: planConfig.maxUsers,
    },
  });

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email,
      phone,
      firstName,
      lastName,
      role: "SUPERADMIN",
      passwordHash,
      mustChangePassword: true,
    },
  });

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { ownerId: user.id },
  });

  const message = `Votre compte pour la Vendeur ${tenantName} est créé. Identifiant: ${
    email || phone
  }. Mot de passe temporaire: ${tempPassword}. Veuillez le changer à la première connexion.`;

  if (sendVia === "sms" && phone) {
    await sendSms({ to: phone, message });
  } else if (email) {
    await sendEmail({
      to: email,
      subject: "Création de compte POSapp",
      message,
    });
  }

  return res.status(201).json({
    tenantId: tenant.id,
    userId: user.id,
    message: "Account created. Temporary credentials sent.",
  });
};

const login = async (req, res) => {
  const { identifier, password, rememberMe, twoFactorCode, clientType } =
    req.body || {};

  if (!identifier || !password) {
    return res.status(400).json({ message: "Identifier and password required." });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { phone: identifier }],
    },
    include: { store: true, tenant: true },
  });

  if (!user || !user.passwordHash) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  const validPassword = await comparePassword(password, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  if (user.twoFactorEnabled) {
    if (!twoFactorCode) {
      return res.status(401).json({
        message: "Two-factor code required.",
        requiresTwoFactor: true,
      });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: twoFactorCode,
    });

    if (!verified) {
      return res.status(401).json({ message: "Invalid two-factor code." });
    }
  }

  if (user.mustChangePassword) {
    return res.status(403).json({
      message: "Password change required.",
      requirePasswordChange: true,
    });
  }

  const normalizedClientType = getClientType(clientType);
  const accessToken = signAccessToken(
    {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
    },
    getAccessTokenTtlByClient(normalizedClientType),
  );

  const refreshDays = rememberMe ? 30 : Number(process.env.JWT_REFRESH_DAYS || 7);
  const refreshToken = signRefreshToken(
    { sub: user.id, clientType: normalizedClientType },
    refreshDays,
  );

  await prisma.authSession.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: addDays(new Date(), refreshDays),
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      tenantName: user.tenant?.name || null,
      role: user.role,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      storeId: user.storeId,
      storeName: user.store?.name || null,
      defaultStorageZoneId: user.defaultStorageZoneId || null,
    },
  });
};

const refresh = async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token required." });
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const session = await prisma.authSession.findFirst({
      where: {
        userId: payload.sub,
        refreshTokenHash: hashToken(refreshToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            tenant: true,
            store: true,
          },
        },
      },
    });

    if (!session) {
      return res.status(401).json({ message: "Invalid refresh token." });
    }

    const normalizedClientType = getClientType(payload.clientType);
    const accessToken = signAccessToken(
      {
        sub: session.user.id,
        tenantId: session.user.tenantId,
        role: session.user.role,
      },
      getAccessTokenTtlByClient(normalizedClientType),
    );

    const now = new Date();
    const remainingMs = session.expiresAt.getTime() - now.getTime();
    const refreshDays = Math.max(1, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
    const newRefreshToken = signRefreshToken(
      { sub: session.user.id, clientType: normalizedClientType },
      refreshDays,
    );

    await prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: hashToken(newRefreshToken),
        expiresAt: addDays(now, refreshDays),
        lastUsedAt: now,
      },
    });

    return res.json({
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: session.user.id,
        tenantId: session.user.tenantId,
        tenantName: session.user.tenant?.name || null,
        role: session.user.role,
        email: session.user.email,
        phone: session.user.phone,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        storeId: session.user.storeId,
        storeName: session.user.store?.name || null,
        defaultStorageZoneId: session.user.defaultStorageZoneId || null,
      },
    });
  } catch (error) {
    return res.status(401).json({ message: "Invalid refresh token." });
  }
};

const logout = async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token required." });
  }

  await prisma.authSession.updateMany({
    where: { refreshTokenHash: hashToken(refreshToken) },
    data: { revokedAt: new Date() },
  });

  return res.json({ message: "Logged out." });
};

const forgotPassword = async (req, res) => {
  const { identifier, sendVia } = req.body || {};
  if (!identifier) {
    return res.status(400).json({ message: "Identifier required." });
  }

  const channel = String(sendVia || "email").trim().toLowerCase() === "sms" ? "sms" : "email";

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { phone: identifier }],
    },
  });

  if (!user) {
    return res.json({ message: "If the user exists, a reset will be sent." });
  }

  if (channel === "email") {
    if (!user.email) {
      return res.status(400).json({
        message: "Aucune adresse email n'est associee a ce compte.",
      });
    }

    if (!isEmailConfigured()) {
      return res.status(503).json({
        message: "Le service email n'est pas configure sur le serveur.",
      });
    }
  }

  if (channel === "sms" && !user.phone) {
    return res.status(400).json({
      message: "Aucun numero de telephone n'est associe a ce compte.",
    });
  }

  const resetToken = generateRandomToken(24);
  const resetHash = hashToken(resetToken);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetPasswordToken: resetHash,
      resetPasswordExpiresAt: addMinutes(new Date(), 30),
    },
  });

  queueForgotPasswordNotification({
    user,
    sendVia: channel,
    resetToken,
  });

  return res.json({ message: "Reset instructions sent." });
};

const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ message: "Token and new password required." });
  }

  const tokenHash = hashToken(token);
  const user = await prisma.user.findFirst({
    where: {
      resetPasswordToken: tokenHash,
      resetPasswordExpiresAt: { gt: new Date() },
    },
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired token." });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
      resetPasswordToken: null,
      resetPasswordExpiresAt: null,
    },
  });

  return res.json({ message: "Password reset successful." });
};

const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: "Old and new passwords required." });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const valid = await comparePassword(oldPassword, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Invalid current password." });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  return res.json({ message: "Password updated." });
};

const firstLoginChangePassword = async (req, res) => {
  const { identifier, tempPassword, newPassword } = req.body || {};
  if (!identifier || !tempPassword || !newPassword) {
    return res.status(400).json({ message: "Missing fields." });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { phone: identifier }],
    },
  });

  if (!user || !user.passwordHash) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  const valid = await comparePassword(tempPassword, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  return res.json({ message: "Password updated." });
};

const setup2fa = async (req, res) => {
  const secret = speakeasy.generateSecret({
    name: "POSapp",
  });

  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      twoFactorSecret: secret.base32,
      twoFactorEnabled: false,
    },
  });

  return res.json({
    base32: secret.base32,
    otpauthUrl: secret.otpauth_url,
  });
};

const verify2fa = async (req, res) => {
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ message: "Token required." });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: "base32",
    token,
  });

  if (!verified) {
    return res.status(401).json({ message: "Invalid token." });
  }

  await prisma.user.update({
    where: { id: req.user.id },
    data: { twoFactorEnabled: true },
  });

  return res.json({ message: "2FA enabled." });
};

const disable2fa = async (req, res) => {
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ message: "Token required." });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: "base32",
    token,
  });

  if (!verified) {
    return res.status(401).json({ message: "Invalid token." });
  }

  await prisma.user.update({
    where: { id: req.user.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });

  return res.json({ message: "2FA disabled." });
};

const googleLogin = async (req, res) => {
  try {
    const { idToken, tenantName, plan, clientType } = req.body || {};
    if (!idToken) {
      return res.status(400).json({ message: "idToken required." });
    }

    const profile = await verifyGoogleIdToken(idToken);
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId: profile.sub }, { email: profile.email }],
      },
      include: { store: true, tenant: true },
    });

    if (!user) {
      if (!tenantName || !plan) {
        return res.status(400).json({
          message: "tenantName and plan required for first Google login.",
        });
      }

      const planConfig = getPlanConfig(plan);
      if (!planConfig) {
        return res.status(400).json({ message: "Invalid subscription plan." });
      }

      const tenant = await prisma.tenant.create({
        data: { name: tenantName },
      });

      await prisma.subscription.create({
        data: {
          tenantId: tenant.id,
          plan,
          price: planConfig.price,
          maxStores: planConfig.maxStores,
          maxUsers: planConfig.maxUsers,
        },
      });

      user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: profile.email,
          firstName: profile.givenName,
          lastName: profile.familyName,
          role: "SUPERADMIN",
          googleId: profile.sub,
          mustChangePassword: false,
        },
        include: {
          tenant: true,
        },
      });

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { ownerId: user.id },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.sub },
        include: { store: true, tenant: true },
      });
    }

    if (user.twoFactorEnabled) {
      return res.status(401).json({
        message: "Two-factor enabled. Use normal login flow.",
        requiresTwoFactor: true,
      });
    }

    const normalizedClientType = getClientType(clientType);
    const accessToken = signAccessToken(
      {
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
      },
      getAccessTokenTtlByClient(normalizedClientType),
    );

    const refreshDays = Number(process.env.JWT_REFRESH_DAYS || 7);
    const refreshToken = signRefreshToken(
      { sub: user.id, clientType: normalizedClientType },
      refreshDays,
    );

    await prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: addDays(new Date(), refreshDays),
      },
    });

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        tenantName: user.tenant?.name || null,
        role: user.role,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        storeId: user.storeId,
        storeName: user.store?.name || null,
        defaultStorageZoneId: user.defaultStorageZoneId || null,
      },
    });
  } catch (error) {
    if (error.message === "GOOGLE_CLIENT_ID not configured.") {
      return res.status(500).json({ message: error.message });
    }

    return res.status(401).json({ message: "Invalid Google token." });
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  firstLoginChangePassword,
  setup2fa,
  verify2fa,
  disable2fa,
  googleLogin,
};
