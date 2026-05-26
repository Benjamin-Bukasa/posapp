const {
  getReceiptSettings,
  upsertReceiptSettings,
} = require("../utils/receiptSettingsStore");

const normalizeText = (value, maxLength = 500) => {
  if (!value) return "";
  return String(value).trim().slice(0, maxLength);
};

const getCurrentReceiptSettings = async (req, res) => {
  const settings = await getReceiptSettings({ tenantId: req.user.tenantId });
  return res.json(settings);
};

const updateCurrentReceiptSettings = async (req, res) => {
  const body = req.body || {};
  const allowedFormats = new Set(["58mm", "80mm"]);
  const settings = {
    paperFormat: allowedFormats.has(String(body.paperFormat || "").trim())
      ? String(body.paperFormat).trim()
      : "80mm",
    logoUrl: normalizeText(body.logoUrl, 1000),
    showLogo: Boolean(body.showLogo),
    logoMonochrome: body.logoMonochrome === undefined ? true : Boolean(body.logoMonochrome),
    headerText: normalizeText(body.headerText, 300),
    footerText: normalizeText(body.footerText, 300),
    showHeaderText: body.showHeaderText === undefined ? true : Boolean(body.showHeaderText),
    showFooterText: body.showFooterText === undefined ? true : Boolean(body.showFooterText),
    showBusinessName: body.showBusinessName === undefined ? true : Boolean(body.showBusinessName),
    showStoreName: body.showStoreName === undefined ? true : Boolean(body.showStoreName),
    showTicketNumber: body.showTicketNumber === undefined ? true : Boolean(body.showTicketNumber),
    showDateTime: body.showDateTime === undefined ? true : Boolean(body.showDateTime),
    showCashier: body.showCashier === undefined ? true : Boolean(body.showCashier),
    showCustomer: body.showCustomer === undefined ? true : Boolean(body.showCustomer),
    showItems: body.showItems === undefined ? true : Boolean(body.showItems),
    showSubtotal: body.showSubtotal === undefined ? true : Boolean(body.showSubtotal),
    showTotal: body.showTotal === undefined ? true : Boolean(body.showTotal),
    showPaymentMethod:
      body.showPaymentMethod === undefined ? true : Boolean(body.showPaymentMethod),
    showAmountReceived:
      body.showAmountReceived === undefined ? true : Boolean(body.showAmountReceived),
    showOriginalAmount:
      body.showOriginalAmount === undefined ? true : Boolean(body.showOriginalAmount),
    showChange: body.showChange === undefined ? true : Boolean(body.showChange),
    showLoyaltyPoints:
      body.showLoyaltyPoints === undefined ? true : Boolean(body.showLoyaltyPoints),
  };

  const updated = await upsertReceiptSettings({
    tenantId: req.user.tenantId,
    settings,
  });

  return res.json(updated);
};

module.exports = {
  getCurrentReceiptSettings,
  updateCurrentReceiptSettings,
};
