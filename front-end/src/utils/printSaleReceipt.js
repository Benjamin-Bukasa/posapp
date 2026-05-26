import {
  DEFAULT_RECEIPT_SETTINGS,
  normalizeReceiptSettings,
} from "./receiptSettings";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const shortId = (value) => String(value || "").slice(-8).toUpperCase();

const formatAmount = (value, currencyCode = "USD") => {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDateTime = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "--";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const methodLabels = {
  CASH: "Cash",
  CARD: "Carte",
  MOBILE_MONEY: "Mobile money",
  TRANSFER: "Virement",
};

const buildReceiptLineItems = ({ order, currencyCode, settings }) =>
  settings.showItems
    ? (order?.items || [])
        .map((item) => {
          const quantity = Number(item.quantity || 0);
          const unitPrice = Number(item.unitPrice || 0);
          const lineTotal = Number(item.total || quantity * unitPrice);

          return `
            <tr>
              <td class="item-name">
                <div class="item-title">${escapeHtml(item.product?.name || item.name || "Article")}</div>
                <div class="item-meta">${quantity} x ${escapeHtml(formatAmount(unitPrice, currencyCode))}</div>
              </td>
              <td class="item-total">${escapeHtml(formatAmount(lineTotal, currencyCode))}</td>
            </tr>
          `;
        })
        .join("")
    : "";

const buildTotalsRows = ({
  order,
  payment,
  currencyCode,
  total,
  paid,
  originalPaid,
  originalCurrencyCode,
  showOriginalPayment,
  change,
  settings,
}) => {
  const rows = [];
  if (settings.showSubtotal) {
    rows.push(["Sous-total", formatAmount(order?.subtotal ?? total, currencyCode), false]);
  }
  if (settings.showTotal) {
    rows.push(["Total", formatAmount(total, currencyCode), true]);
  }
  if (settings.showPaymentMethod) {
    rows.push([
      "Paiement",
      methodLabels[payment?.method] || payment?.method || "--",
      false,
    ]);
  }
  if (settings.showAmountReceived) {
    rows.push(["Montant recu", formatAmount(paid, currencyCode), false]);
  }
  if (settings.showOriginalAmount && showOriginalPayment) {
    rows.push(["Remis client", formatAmount(originalPaid, originalCurrencyCode), false]);
  }
  if (settings.showChange) {
    rows.push(["Monnaie", formatAmount(change, currencyCode), true]);
  }

  return rows
    .map(
      ([label, value, strong]) => `
        <tr class="${strong ? "grand-total" : ""}">
          <td>${escapeHtml(label)}</td>
          <td class="value">${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join("");
};

const buildReceiptHtml = ({
  order,
  amountReceived,
  cashierName,
  storeName,
  businessName,
  receiptSettings = DEFAULT_RECEIPT_SETTINGS,
}) => {
  const settings = normalizeReceiptSettings(receiptSettings);
  const payment = order?.payments?.[0] || null;
  const currencyCode = order?.currencyCode || payment?.currencyCode || "USD";
  const total = Number(order?.total || 0);
  const paid = Number(amountReceived ?? payment?.amount ?? total);
  const originalPaid = Number(payment?.originalAmount ?? paid);
  const originalCurrencyCode = payment?.originalCurrencyCode || currencyCode;
  const showOriginalPayment =
    originalCurrencyCode !== currencyCode ||
    Math.abs(originalPaid - paid) > 0.005;
  const change = Math.max(0, paid - total);
  const paperWidth = settings.paperFormat === "58mm" ? "58mm" : "80mm";
  const lineItemsHtml = buildReceiptLineItems({ order, currencyCode, settings });
  const totalsRows = buildTotalsRows({
    order,
    payment,
    currencyCode,
    total,
    paid,
    originalPaid,
    originalCurrencyCode,
    showOriginalPayment,
    change,
    settings,
  });

  return `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Ticket ${escapeHtml(shortId(order?.id))}</title>
        <style>
          @page { size: ${paperWidth} auto; margin: 0; }
          html, body {
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
            font-family: "Courier New", monospace;
            width: ${paperWidth};
          }
          body { padding: 4mm; box-sizing: border-box; }
          .receipt { width: 100%; }
          .center { text-align: center; }
          .title { font-size: 16px; font-weight: 700; text-transform: uppercase; }
          .subtitle, .meta, .footer, .header-note { font-size: 11px; line-height: 1.4; }
          .header-note, .footer { white-space: pre-wrap; }
          .divider {
            margin: 8px 0;
            border-top: 1px dashed #000;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          td {
            vertical-align: top;
            padding: 2px 0;
          }
          .item-name {
            width: 70%;
            padding-right: 8px;
          }
          .item-title { font-weight: 700; }
          .item-meta { font-size: 10px; }
          .item-total, .value { text-align: right; white-space: nowrap; }
          .totals td {
            padding: 3px 0;
          }
          .grand-total td {
            font-size: 13px;
            font-weight: 700;
          }
          .logo-wrap {
            margin-bottom: 8px;
          }
          .logo {
            max-width: 52mm;
            max-height: 48px;
            object-fit: contain;
            ${settings.logoMonochrome ? "filter: grayscale(1) contrast(1.15);" : ""}
          }
        </style>
      </head>
      <body>
        <section class="receipt">
          <div class="center">
            ${
              settings.showLogo && settings.logoUrl
                ? `<div class="logo-wrap"><img class="logo" src="${escapeHtml(settings.logoUrl)}" alt="Logo" /></div>`
                : ""
            }
            ${
              settings.showStoreName
                ? `<div class="title">${escapeHtml(storeName || businessName || "POSapp")}</div>`
                : ""
            }
            ${
              settings.showBusinessName
                ? `<div class="subtitle">${escapeHtml(businessName || "POSapp")}</div>`
                : ""
            }
            ${
              settings.showHeaderText && settings.headerText
                ? `<div class="header-note">${escapeHtml(settings.headerText)}</div>`
                : ""
            }
            ${
              settings.showTicketNumber
                ? `<div class="meta">Ticket: ${escapeHtml(shortId(order?.id))}</div>`
                : ""
            }
            ${
              settings.showDateTime
                ? `<div class="meta">Date: ${escapeHtml(formatDateTime(order?.createdAt))}</div>`
                : ""
            }
            ${
              settings.showCashier
                ? `<div class="meta">Caissier: ${escapeHtml(cashierName || "--")}</div>`
                : ""
            }
            ${
              settings.showCustomer && order?.customer
                ? `<div class="meta">Client: ${escapeHtml(
                    [order.customer.firstName, order.customer.lastName]
                      .filter(Boolean)
                      .join(" ") || order.customer.phone || "--",
                  )}</div>`
                : ""
            }
          </div>

          <div class="divider"></div>

          ${
            settings.showItems
              ? `<table><tbody>${lineItemsHtml}</tbody></table><div class="divider"></div>`
              : ""
          }

          <table class="totals">
            <tbody>
              ${totalsRows}
            </tbody>
          </table>

          ${
            settings.showLoyaltyPoints && Number(order?.loyaltyPoints || 0) > 0
              ? `
                <div class="divider"></div>
                <div class="meta">Points gagnes: ${escapeHtml(order.loyaltyPoints)}</div>
              `
              : ""
          }

          <div class="divider"></div>
          ${
            settings.showFooterText
              ? `<div class="footer center">${escapeHtml(
                  settings.footerText || "Merci pour votre achat",
                )}</div>`
              : ""
          }
        </section>
        <script>
          window.onload = function () {
            setTimeout(function () {
              window.focus();
              window.print();
            }, 200);
          };
          window.onafterprint = function () {
            window.close();
          };
        </script>
      </body>
    </html>
  `;
};

export const printSaleReceipt = ({
  order,
  amountReceived,
  cashierName,
  storeName,
  businessName,
  receiptSettings,
  targetWindow,
}) => {
  const printWindow =
    targetWindow ||
    window.open("", "_blank", "noopener,noreferrer,width=420,height=720");

  if (!printWindow) {
    throw new Error("Le navigateur a bloque l'ouverture du ticket d'impression.");
  }

  printWindow.document.open();
  printWindow.document.write(
    buildReceiptHtml({
      order,
      amountReceived,
      cashierName,
      storeName,
      businessName,
      receiptSettings,
    }),
  );
  printWindow.document.close();

  if (!targetWindow) {
    printWindow.focus();
  }
};

export default printSaleReceipt;
