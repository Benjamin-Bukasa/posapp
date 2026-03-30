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

const buildPurchaseOrderPdf = (order, currencySettings = {}, companyName) => {
  const total = (order.items || []).reduce(
    (sum, item) => sum + toNumber(item.quantity) * toNumber(item.unitPrice),
    0,
  );

  return createStyledPdf({
    title: "BON DE COMMANDE",
    reference: `BON N° : ${order.code || `PO-${String(order.id || "").slice(0, 8).toUpperCase()}`}`,
    companyName: companyName || "NEOPHARMA",
    subtitleLines: [
      `Date : ${formatDateTime(order.orderDate || order.createdAt)}`,
      `Statut : ${order.status || "-"}`,
      order.expectedDate ? `Livraison attendue : ${formatDateTime(order.expectedDate)}` : "",
    ],
    metaItems: [
      { label: "Fournisseur", value: order.supplier?.name || "-" },
      { label: "Boutique", value: order.store?.name || "-" },
      {
        label: "Commande par",
        value:
          [order.orderedBy?.firstName, order.orderedBy?.lastName]
            .filter(Boolean)
            .join(" ") || "-",
      },
      { label: "Demande source", value: order.purchaseRequest?.title || "-" },
      { label: "Observation", value: order.note || "-" },
    ],
    tableTitle: "Articles commandes",
    columns: [
      { label: "Code", width: 1.2, value: (row) => row.product?.sku || "-" },
      { label: "Article", width: 2.5, value: (row) => row.product?.name || "-" },
      { label: "Unite", width: 0.8, value: (row) => row.unit?.symbol || row.unit?.name || "-" },
      { label: "Qte", width: 0.7, value: (row) => row.quantity ?? 0 },
      {
        label: "PU",
        width: 1.1,
        value: (row) => formatMoney(row.unitPrice, row.currencyCode, currencySettings),
      },
      {
        label: "Montant HT",
        width: 1.2,
        value: (row) =>
          formatMoney(
            toNumber(row.quantity) * toNumber(row.unitPrice),
            row.currencyCode,
            currencySettings,
          ),
      },
    ],
    rows: order.items || [],
    totals: [
      {
        label: "Total H.T",
        value: formatMoney(total, currencySettings.primaryCurrencyCode, currencySettings),
        emphasis: true,
      },
    ],
    footerLeft: "Bon de commande fournisseur",
  });
};

module.exports = { buildPurchaseOrderPdf };
