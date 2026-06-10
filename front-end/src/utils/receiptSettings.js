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
  closurePaperFormat: "80mm",
  closureHeaderText: "Rapport de cloture",
  closureFooterText: "Fin de cloture",
  showClosureHeaderText: true,
  showClosureFooterText: true,
  showClosureBusinessName: true,
  showClosureStoreName: true,
  showClosureCashier: true,
  showClosureDateTime: true,
  showClosureSummary: true,
  showClosureSalesTable: true,
  showClosureCanceledTable: true,
  showClosureGrandTotal: true,
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
  closurePaperFormat:
    payload?.closurePaperFormat || DEFAULT_RECEIPT_SETTINGS.closurePaperFormat,
  closureHeaderText:
    payload?.closureHeaderText === undefined
      ? DEFAULT_RECEIPT_SETTINGS.closureHeaderText
      : payload.closureHeaderText || "",
  closureFooterText:
    payload?.closureFooterText === undefined
      ? DEFAULT_RECEIPT_SETTINGS.closureFooterText
      : payload.closureFooterText || "",
  showClosureHeaderText:
    payload?.showClosureHeaderText === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showClosureHeaderText
      : Boolean(payload.showClosureHeaderText),
  showClosureFooterText:
    payload?.showClosureFooterText === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showClosureFooterText
      : Boolean(payload.showClosureFooterText),
  showClosureBusinessName:
    payload?.showClosureBusinessName === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showClosureBusinessName
      : Boolean(payload.showClosureBusinessName),
  showClosureStoreName:
    payload?.showClosureStoreName === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showClosureStoreName
      : Boolean(payload.showClosureStoreName),
  showClosureCashier:
    payload?.showClosureCashier === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showClosureCashier
      : Boolean(payload.showClosureCashier),
  showClosureDateTime:
    payload?.showClosureDateTime === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showClosureDateTime
      : Boolean(payload.showClosureDateTime),
  showClosureSummary:
    payload?.showClosureSummary === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showClosureSummary
      : Boolean(payload.showClosureSummary),
  showClosureSalesTable:
    payload?.showClosureSalesTable === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showClosureSalesTable
      : Boolean(payload.showClosureSalesTable),
  showClosureCanceledTable:
    payload?.showClosureCanceledTable === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showClosureCanceledTable
      : Boolean(payload.showClosureCanceledTable),
  showClosureGrandTotal:
    payload?.showClosureGrandTotal === undefined
      ? DEFAULT_RECEIPT_SETTINGS.showClosureGrandTotal
      : Boolean(payload.showClosureGrandTotal),
});
