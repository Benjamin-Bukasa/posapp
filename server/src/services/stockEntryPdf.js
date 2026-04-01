const {
  DEFAULT_PRIMARY_CURRENCY,
  convertAmount,
  normalizeCurrencyCode,
} = require("../utils/currencySettings");
const { createStyledPdf, formatDateTime } = require("./pdfTheme");

const toNumber = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const formatMoney = (
  value,
  sourceCurrencyCode = DEFAULT_PRIMARY_CURRENCY,
  settings = {},
) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: normalizeCurrencyCode(
      settings.primaryCurrencyCode,
      DEFAULT_PRIMARY_CURRENCY,
    ),
  }).format(
    toNumber(
      convertAmount(
        value,
        sourceCurrencyCode,
        normalizeCurrencyCode(
          settings.primaryCurrencyCode,
          DEFAULT_PRIMARY_CURRENCY,
        ),
        settings,
      ),
    ),
  );

const buildStockEntryPdf = (entry, currencySettings = {}, companyName) =>
  createStyledPdf({
    title: "ENTREE EN STOCK",
    reference: `ENTREE N° : SE-${String(entry.id || "").slice(0, 8).toUpperCase()}`,
    companyName: companyName || "POSapp",
    subtitleLines: [
      `Date : ${formatDateTime(entry.createdAt)}`,
      `Statut : ${entry.status || "-"}`,
      entry.receiptNumber ? `Bon de reception : ${entry.receiptNumber}` : "",
    ],
    metaItems: [
      { label: "Type source", value: entry.sourceType || "-" },
      { label: "Zone", value: entry.storageZone?.name || "-" },
      {
        label: "Cree par",
        value:
          [entry.createdBy?.firstName, entry.createdBy?.lastName]
            .filter(Boolean)
            .join(" ") || "-",
      },
      {
        label: "Valide par",
        value:
          [entry.approvedBy?.firstName, entry.approvedBy?.lastName]
            .filter(Boolean)
            .join(" ") || "-",
      },
      { label: "Observation", value: entry.note || "-" },
    ],
    tableTitle: "Lignes recues",
    columns: [
      { label: "Code", width: 1.2, value: (row) => row.product?.sku || "-" },
      { label: "Article", width: 2.6, value: (row) => row.product?.name || "-" },
      { label: "Lot", width: 1.2, value: (row) => row.batchNumber || "Sans lot" },
      {
        label: "Expiration",
        width: 1.2,
        value: (row) =>
          row.expiryDate ? formatDateTime(row.expiryDate).split(",")[0] : "-",
      },
      { label: "Unite", width: 0.8, value: (row) => row.unit?.symbol || row.unit?.name || "-" },
      { label: "Qte", width: 0.8, value: (row) => row.quantity ?? 0 },
      {
        label: "Cout unitaire",
        width: 1.2,
        value: (row) => formatMoney(row.unitCost, row.currencyCode, currencySettings),
      },
    ],
    rows: entry.items || [],
    footerLeft: "Bon d'entree en stock",
  });

module.exports = { buildStockEntryPdf };
