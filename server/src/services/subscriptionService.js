const { addMonths, addYears } = require("date-fns");

const PLAN_CONFIG = {
  STARTER: {
    price: 24.9,
    maxStores: 1,
    maxUsers: 5,
  },
  BASIC: {
    price: 49.9,
    maxStores: 5,
    maxUsers: 15,
  },
  PREMIUM: {
    price: 99.9,
    maxStores: 10,
    maxUsers: 45,
  },
};

const BILLING_CYCLE = {
  MONTHLY: "MONTHLY",
  ANNUAL: "ANNUAL",
};

const getPlanConfig = (plan) => {
  return PLAN_CONFIG[plan] || null;
};

const getSubscriptionPrice = (plan, billingCycle = BILLING_CYCLE.MONTHLY) => {
  const config = getPlanConfig(plan);
  if (!config) {
    return null;
  }

  if (billingCycle === BILLING_CYCLE.ANNUAL) {
    const annualPrice = config.price * 12 * 0.8;
    return Number(annualPrice.toFixed(2));
  }

  return config.price;
};

const getSubscriptionEndDate = (startDate = new Date(), billingCycle = BILLING_CYCLE.MONTHLY) => {
  if (billingCycle === BILLING_CYCLE.ANNUAL) {
    return addYears(startDate, 1);
  }
  return addMonths(startDate, 1);
};

module.exports = {
  PLAN_CONFIG,
  BILLING_CYCLE,
  getPlanConfig,
  getSubscriptionPrice,
  getSubscriptionEndDate,
};
