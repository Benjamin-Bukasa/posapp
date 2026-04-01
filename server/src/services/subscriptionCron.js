const cron = require("node-cron");
const { addDays, startOfDay, endOfDay } = require("date-fns");
const prisma = require("../config/prisma");
const { sendEmail, sendSms } = require("./notificationService");
const {
  buildSubscriptionExpiredEmail,
  buildSubscriptionWarningEmail,
  buildSubscriptionPostExpiredEmail,
} = require("../utils/emailTemplates");

const runSubscriptionAudit = async () => {
  const now = new Date();

  const expired = await prisma.subscription.findMany({
    where: {
      endsAt: { not: null, lt: now },
      status: { in: ["ACTIVE", "TRIAL"] },
    },
  });

  if (!expired.length) {
    return;
  }

  const tenantIds = expired.map((sub) => sub.tenantId);

  await prisma.subscription.updateMany({
    where: { tenantId: { in: tenantIds } },
    data: { status: "PAST_DUE" },
  });

  await prisma.user.updateMany({
    where: { tenantId: { in: tenantIds } },
    data: { isActive: false },
  });

  for (const sub of expired) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: sub.tenantId },
    });

    if (!tenant || !tenant.ownerId) {
      continue;
    }

    const owner = await prisma.user.findUnique({
      where: { id: tenant.ownerId },
    });

    if (!owner) {
      continue;
    }

    if (sub.remindersEnabled) {
      const emailPayload = buildSubscriptionExpiredEmail({
        tenantName: tenant.name,
        plan: sub.plan,
        endsAt: sub.endsAt,
      });

      if (owner.email) {
        await sendEmail({
          to: owner.email,
          subject: emailPayload.subject,
          text: emailPayload.text,
          html: emailPayload.html,
        });
      } else if (owner.phone) {
        await sendSms({ to: owner.phone, message: emailPayload.text });
      }
    }
  }
};

const runSubscriptionWarnings = async () => {
  const now = new Date();
  const warningConfig = [
    { days: 7, field: "warn7At" },
    { days: 3, field: "warn3At" },
    { days: 1, field: "warn1At" },
    { days: 0, field: "warn0At" },
  ];

  for (const config of warningConfig) {
    const targetDate = addDays(startOfDay(now), config.days);
    const rangeStart = startOfDay(targetDate);
    const rangeEnd = endOfDay(targetDate);

    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: { in: ["ACTIVE", "TRIAL"] },
        endsAt: { gte: rangeStart, lte: rangeEnd },
        [config.field]: null,
        remindersEnabled: true,
      },
    });

    for (const sub of subscriptions) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: sub.tenantId },
      });

      if (!tenant || !tenant.ownerId) {
        continue;
      }

      const owner = await prisma.user.findUnique({
        where: { id: tenant.ownerId },
      });

      if (!owner) {
        continue;
      }

      const emailPayload = buildSubscriptionWarningEmail({
        tenantName: tenant.name,
        plan: sub.plan,
        endsAt: sub.endsAt,
        daysLeft: config.days,
      });

      if (owner.email) {
        await sendEmail({
          to: owner.email,
          subject: emailPayload.subject,
          text: emailPayload.text,
          html: emailPayload.html,
        });
      } else if (owner.phone) {
        await sendSms({ to: owner.phone, message: emailPayload.text });
      }

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { [config.field]: new Date() },
      });
    }
  }
};

const runPostExpiryReminders = async () => {
  const now = new Date();
  const delayDays = Number(process.env.POST_EXPIRY_REMINDER_DAYS || 3);
  const targetDate = addDays(startOfDay(now), -delayDays);
  const rangeStart = startOfDay(targetDate);
  const rangeEnd = endOfDay(targetDate);

  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: "PAST_DUE",
      endsAt: { gte: rangeStart, lte: rangeEnd },
      postExpiredAt: null,
      remindersEnabled: true,
    },
  });

  for (const sub of subscriptions) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: sub.tenantId },
    });

    if (!tenant || !tenant.ownerId) {
      continue;
    }

    const owner = await prisma.user.findUnique({
      where: { id: tenant.ownerId },
    });

    if (!owner) {
      continue;
    }

    const emailPayload = buildSubscriptionPostExpiredEmail({
      tenantName: tenant.name,
      plan: sub.plan,
      endsAt: sub.endsAt,
    });

    if (owner.email) {
      await sendEmail({
        to: owner.email,
        subject: emailPayload.subject,
        text: emailPayload.text,
        html: emailPayload.html,
      });
    } else if (owner.phone) {
      await sendSms({ to: owner.phone, message: emailPayload.text });
    }

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { postExpiredAt: new Date() },
    });
  }
};

const startSubscriptionCron = () => {
  // Every day at 01:00
  cron.schedule("0 1 * * *", async () => {
    try {
      await runSubscriptionWarnings();
      await runSubscriptionAudit();
      await runPostExpiryReminders();
    } catch (error) {
      console.error("[subscription-cron]", error);
    }
  });
};

module.exports = {
  startSubscriptionCron,
  runSubscriptionAudit,
  runSubscriptionWarnings,
  runPostExpiryReminders,
};
