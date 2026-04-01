const prisma = require("../config/prisma");
const {
  getSubscriptionPrice,
  getSubscriptionEndDate,
  BILLING_CYCLE,
} = require("../services/subscriptionService");
const {
  buildSubscriptionRenewedEmail,
} = require("../utils/emailTemplates");
const { sendEmail, sendSms } = require("../services/notificationService");

const renewSubscription = async (req, res) => {
  const { billingCycle } = req.body || {};

  const subscription = await prisma.subscription.findUnique({
    where: { tenantId: req.user.tenantId },
  });

  if (!subscription) {
    return res.status(404).json({ message: "Subscription not found." });
  }

  const cycle = billingCycle || subscription.billingCycle || BILLING_CYCLE.MONTHLY;
  const price = getSubscriptionPrice(subscription.plan, cycle);
  const baseDate =
    subscription.endsAt && subscription.endsAt > new Date()
      ? subscription.endsAt
      : new Date();
  const endsAt = getSubscriptionEndDate(baseDate, cycle);

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      billingCycle: cycle,
      price,
      startedAt: new Date(),
      endsAt,
      status: "ACTIVE",
      warn7At: null,
      warn3At: null,
      warn1At: null,
      warn0At: null,
      postExpiredAt: null,
    },
  });

  await prisma.user.updateMany({
    where: { tenantId: req.user.tenantId },
    data: { isActive: true },
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id: req.user.tenantId },
  });
  const owner = tenant?.ownerId
    ? await prisma.user.findUnique({ where: { id: tenant.ownerId } })
    : null;

  if (owner) {
    const emailPayload = buildSubscriptionRenewedEmail({
<<<<<<< HEAD
      tenantName: tenant?.name || "POSapp",
=======
      tenantName: tenant?.name || "NeoPharma",
>>>>>>> aed4c876093dd2e186d658b809f50bca4071b79d
      plan: updated.plan,
      billingCycle: updated.billingCycle,
      price: updated.price,
      endsAt: updated.endsAt,
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

  return res.json({
    message: "Subscription renewed.",
    subscription: updated,
  });
};

const updateReminders = async (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ message: "enabled must be boolean." });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { tenantId: req.user.tenantId },
  });

  if (!subscription) {
    return res.status(404).json({ message: "Subscription not found." });
  }

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: { remindersEnabled: enabled },
  });

  return res.json({
    message: "Reminders updated.",
    remindersEnabled: updated.remindersEnabled,
  });
};

module.exports = {
  renewSubscription,
  updateReminders,
};
