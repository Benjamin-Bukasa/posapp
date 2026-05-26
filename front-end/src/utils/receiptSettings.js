export const DEFAULT_RECEIPT_SETTINGS = {
  paperFormat: "80mm",
  logoUrl: "",
  showLogo: false,
  logoMonochrome: true,
  headerText: "",
  footerText: "Merci pour votre achat",
  showHeaderText: true,
  showFooterText: true,
  showBusinessName: true,
  showStoreName: true,
  showTicketNumber: true,
  showDateTime: true,
  showCashier: true,
  showCustomer: true,
  showItems: true,
  showSubtotal: true,
  showTotal: true,
  showPaymentMethod: true,
  showAmountReceived: true,
  showOriginalAmount: true,
  showChange: true,
  showLoyaltyPoints: true,
};

export const normalizeReceiptSettings = (payload = {}) => ({
  ...DEFAULT_RECEIPT_SETTINGS,
  ...(payload || {}),
  showLogo:
    payload?.showLogo === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showLogo
      : Boolean(payload.showLogo),
  logoMonochrome:
    payload?.logoMonochrome === undefined
      ? DEFAULT_RECEIPT_SETTINGS.logoMonochrome
      : Boolean(payload.logoMonochrome),
  showHeaderText:
    payload?.showHeaderText === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showHeaderText
      : Boolean(payload.showHeaderText),
  showFooterText:
    payload?.showFooterText === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showFooterText
      : Boolean(payload.showFooterText),
  showBusinessName:
    payload?.showBusinessName === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showBusinessName
      : Boolean(payload.showBusinessName),
  showStoreName:
    payload?.showStoreName === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showStoreName
      : Boolean(payload.showStoreName),
  showTicketNumber:
    payload?.showTicketNumber === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showTicketNumber
      : Boolean(payload.showTicketNumber),
  showDateTime:
    payload?.showDateTime === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showDateTime
      : Boolean(payload.showDateTime),
  showCashier:
    payload?.showCashier === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showCashier
      : Boolean(payload.showCashier),
  showCustomer:
    payload?.showCustomer === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showCustomer
      : Boolean(payload.showCustomer),
  showItems:
    payload?.showItems === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showItems
      : Boolean(payload.showItems),
  showSubtotal:
    payload?.showSubtotal === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showSubtotal
      : Boolean(payload.showSubtotal),
  showTotal:
    payload?.showTotal === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showTotal
      : Boolean(payload.showTotal),
  showPaymentMethod:
    payload?.showPaymentMethod === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showPaymentMethod
      : Boolean(payload.showPaymentMethod),
  showAmountReceived:
    payload?.showAmountReceived === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showAmountReceived
      : Boolean(payload.showAmountReceived),
  showOriginalAmount:
    payload?.showOriginalAmount === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showOriginalAmount
      : Boolean(payload.showOriginalAmount),
  showChange:
    payload?.showChange === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showChange
      : Boolean(payload.showChange),
  showLoyaltyPoints:
    payload?.showLoyaltyPoints === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showLoyaltyPoints
      : Boolean(payload.showLoyaltyPoints),
});
