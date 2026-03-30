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

const buildReceiptHtml = ({
  order,
  amountReceived,
  cashierName,
  storeName,
  businessName,
}) => {
  const currencyCode =
    order?.currencyCode || order?.payments?.[0]?.currencyCode || "USD";
  const total = Number(order?.total || 0);
  const paid = Number(amountReceived ?? order?.payments?.[0]?.amount ?? total);
  const change = Math.max(0, paid - total);
  const itemsHtml = (order?.items || [])
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
    .join("");

  return `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Ticket ${escapeHtml(shortId(order?.id))}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          html, body {
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
            font-family: "Courier New", monospace;
            width: 80mm;
          }
          body { padding: 4mm; box-sizing: border-box; }
          .receipt { width: 100%; }
          .center { text-align: center; }
          .title { font-size: 16px; font-weight: 700; text-transform: uppercase; }
          .subtitle, .meta, .footer { font-size: 11px; line-height: 1.4; }
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
        </style>
      </head>
      <body>
        <section class="receipt">
          <div class="center">
            <div class="title">${escapeHtml(storeName || businessName || "NeoPharma")}</div>
            <div class="subtitle">${escapeHtml(businessName || "NeoPharma")}</div>
            <div class="meta">Ticket: ${escapeHtml(shortId(order?.id))}</div>
            <div class="meta">Date: ${escapeHtml(formatDateTime(order?.createdAt))}</div>
            <div class="meta">Caissier: ${escapeHtml(cashierName || "--")}</div>
            ${
              order?.customer
                ? `<div class="meta">Client: ${escapeHtml(
                    [order.customer.firstName, order.customer.lastName]
                      .filter(Boolean)
                      .join(" ") || order.customer.phone || "--",
                  )}</div>`
                : ""
            }
          </div>

          <div class="divider"></div>

          <table>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="divider"></div>

          <table class="totals">
            <tbody>
              <tr>
                <td>Sous-total</td>
                <td class="value">${escapeHtml(formatAmount(order?.subtotal ?? total, currencyCode))}</td>
              </tr>
              <tr>
                <td>Total</td>
                <td class="value">${escapeHtml(formatAmount(total, currencyCode))}</td>
              </tr>
              <tr>
                <td>Paiement</td>
                <td class="value">${escapeHtml(
                  methodLabels[order?.payments?.[0]?.method] || order?.payments?.[0]?.method || "--",
                )}</td>
              </tr>
              <tr>
                <td>Montant recu</td>
                <td class="value">${escapeHtml(formatAmount(paid, currencyCode))}</td>
              </tr>
              <tr class="grand-total">
                <td>Monnaie</td>
                <td class="value">${escapeHtml(formatAmount(change, currencyCode))}</td>
              </tr>
            </tbody>
          </table>

          ${
            Number(order?.loyaltyPoints || 0) > 0
              ? `
                <div class="divider"></div>
                <div class="meta">Points gagnes: ${escapeHtml(order.loyaltyPoints)}</div>
              `
              : ""
          }

          <div class="divider"></div>
          <div class="footer center">
            Merci pour votre achat
          </div>
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
}) => {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=420,height=720");
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
    }),
  );
  printWindow.document.close();
};

export default printSaleReceipt;
