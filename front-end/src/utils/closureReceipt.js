import {
  DEFAULT_RECEIPT_SETTINGS,
  normalizeReceiptSettings,
} from "./receiptSettings";

const encoder = new TextEncoder();
const ESC = 0x1b;
const GS = 0x1d;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "");

const toBytes = (text) => Array.from(encoder.encode(normalizeText(text)));

const pushText = (target, text = "") => {
  target.push(...toBytes(text));
};

const padRight = (value, width) => {
  const text = normalizeText(value);
  if (text.length >= width) return text.slice(0, width);
  return text + " ".repeat(width - text.length);
};

const padLeft = (value, width) => {
  const text = normalizeText(value);
  if (text.length >= width) return text.slice(text.length - width);
  return " ".repeat(width - text.length) + text;
};

const wrapText = (value, width) => {
  const text = normalizeText(value).trim();
  if (!text) return [""];

  const words = text.split(/\s+/);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
      return;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    if (word.length <= width) {
      current = word;
      return;
    }

    for (let index = 0; index < word.length; index += width) {
      lines.push(word.slice(index, index + width));
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines;
};

const formatAmount = (value, currencyCode = "USD") =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDateTime = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "--";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const resolveClosureSettings = (receiptSettings = DEFAULT_RECEIPT_SETTINGS) =>
  normalizeReceiptSettings(receiptSettings);

const getSummaryRows = (report = {}, currencyCode = "USD") => {
  const summary = report.summary || {};

  return [
    ["Sessions", String(report.sessionCount || 0)],
    ["Ventes", String(report.soldOrderCount || 0)],
    ["Annulees", String(report.canceledOrderCount || 0)],
    ["Fonds initial", formatAmount(summary.openingFloat || 0, currencyCode)],
    ["Ventes cash", formatAmount(summary.totalCashSales || 0, currencyCode)],
    ["Ventes non cash", formatAmount(summary.totalNonCashSales || 0, currencyCode)],
    ["Entrees", formatAmount(summary.totalCashIn || 0, currencyCode)],
    ["Sorties", formatAmount(summary.totalCashOut || 0, currencyCode)],
    ["Cash theorique", formatAmount(summary.expectedCash || 0, currencyCode)],
    ["Cash compte", formatAmount(summary.closingCounted || 0, currencyCode)],
    ["Ecart", formatAmount(summary.variance || 0, currencyCode)],
  ];
};

const buildItemsTableHtml = ({
  title,
  items = [],
  total,
  currencyCode,
  totalLabel,
}) => `
  <section class="section">
    <div class="section-title">${escapeHtml(title)}</div>
    <table>
      <thead>
        <tr>
          <th>Produit</th>
          <th class="num">Qte</th>
          <th class="num">P.U</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>
        ${
          items.length
            ? items
                .map(
                  (item) => `
                    <tr>
                      <td>${escapeHtml(item.productName || "Article")}</td>
                      <td class="num">${escapeHtml(item.quantity)}</td>
                      <td class="num">${escapeHtml(
                        formatAmount(item.unitPrice || 0, currencyCode),
                      )}</td>
                      <td class="num">${escapeHtml(
                        formatAmount(item.total || 0, currencyCode),
                      )}</td>
                    </tr>
                  `,
                )
                .join("")
            : `<tr><td colspan="4" class="empty">Aucune ligne.</td></tr>`
        }
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3">${escapeHtml(totalLabel)}</td>
          <td class="num">${escapeHtml(formatAmount(total || 0, currencyCode))}</td>
        </tr>
      </tfoot>
    </table>
  </section>
`;

export const buildClosureEscPosReceipt = ({
  report,
  receiptSettings = DEFAULT_RECEIPT_SETTINGS,
}) => {
  const settings = resolveClosureSettings(receiptSettings);
  const width = settings.closurePaperFormat === "58mm" ? 32 : 42;
  const bytes = [];
  const currencyCode = report?.currencyCode || "USD";
  const qtyWidth = width === 32 ? 6 : 8;
  const unitWidth = width === 32 ? 10 : 14;
  const totalWidth = width - qtyWidth - unitWidth;

  const pushKeyValueLine = (label, value) => {
    const labelWidth = width === 32 ? 16 : 24;
    const valueWidth = width - labelWidth;
    pushText(bytes, `${padRight(label, labelWidth)}${padLeft(value, valueWidth)}\n`);
  };

  const printItemsSection = (title, items = [], total = 0, totalLabel = "Total") => {
    pushText(bytes, `${title}\n`);
    pushText(
      bytes,
      `${padRight("Qte", qtyWidth)}${padRight("P.U", unitWidth)}${padLeft("Total", totalWidth)}\n`,
    );

    if (!items.length) {
      pushText(bytes, "Aucune ligne\n");
    }

    items.forEach((item) => {
      wrapText(item.productName || "Article", width).forEach((line) =>
        pushText(bytes, `${line}\n`),
      );
      pushText(
        bytes,
        `${padRight(item.quantity, qtyWidth)}${padRight(
          formatAmount(item.unitPrice || 0, currencyCode),
          unitWidth,
        )}${padLeft(formatAmount(item.total || 0, currencyCode), totalWidth)}\n`,
      );
    });

    if (settings.showClosureGrandTotal) {
      pushText(bytes, `${"-".repeat(width)}\n`);
      pushKeyValueLine(totalLabel, formatAmount(total || 0, currencyCode));
    }

    pushText(bytes, `${"-".repeat(width)}\n`);
  };

  bytes.push(ESC, 0x40);
  bytes.push(ESC, 0x61, 0x01);
  bytes.push(ESC, 0x45, 0x01);
  if (settings.showClosureStoreName) {
    pushText(bytes, `${report?.storeName || "Boutique"}\n`);
  }
  bytes.push(ESC, 0x45, 0x00);
  if (settings.showClosureBusinessName) {
    pushText(bytes, `${report?.businessName || "POSapp"}\n`);
  }
  if (settings.showClosureHeaderText && settings.closureHeaderText) {
    wrapText(settings.closureHeaderText, width).forEach((line) =>
      pushText(bytes, `${line}\n`),
    );
  }
  wrapText(report?.title || "Cloture", width).forEach((line) => pushText(bytes, `${line}\n`));
  if (settings.showClosureDateTime) {
    pushText(bytes, `${formatDateTime(report?.generatedAt)}\n`);
  }
  if (settings.showClosureCashier && report?.cashierName) {
    pushText(bytes, `Caissier: ${report.cashierName}\n`);
  }
  if (report?.generatedByName && report.generatedByName !== report.cashierName) {
    pushText(bytes, `Genere par: ${report.generatedByName}\n`);
  }
  pushText(bytes, `${"-".repeat(width)}\n`);

  bytes.push(ESC, 0x61, 0x00);
  if (settings.showClosureSummary) {
    getSummaryRows(report, currencyCode).forEach(([label, value]) => {
      pushKeyValueLine(label, value);
    });
    pushText(bytes, `${"-".repeat(width)}\n`);
  }

  if (settings.showClosureSalesTable) {
    printItemsSection(
      "Produits vendus",
      report?.soldItems || [],
      report?.summary?.soldGrandTotal || 0,
      "Total general",
    );
  }

  if (settings.showClosureCanceledTable) {
    printItemsSection(
      "Ventes annulees",
      report?.canceledItems || [],
      report?.summary?.canceledGrandTotal || 0,
      "Total annule",
    );
  }

  bytes.push(ESC, 0x61, 0x01);
  if (settings.showClosureFooterText && settings.closureFooterText) {
    wrapText(settings.closureFooterText, width).forEach((line) =>
      pushText(bytes, `${line}\n`),
    );
  }
  pushText(bytes, "\n\n");
  bytes.push(GS, 0x56, 0x41, 0x00);

  return new Uint8Array(bytes);
};

export const buildClosureReceiptHtml = ({
  report,
  receiptSettings = DEFAULT_RECEIPT_SETTINGS,
}) => {
  const settings = resolveClosureSettings(receiptSettings);
  const paperWidth = settings.closurePaperFormat === "58mm" ? "58mm" : "80mm";
  const currencyCode = report?.currencyCode || "USD";

  return `<!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(report?.title || "Cloture")}</title>
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
          .summary td, table td, table th {
            font-size: 11px;
            padding: 3px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th {
            border-bottom: 1px dashed #000;
            text-align: left;
            padding-bottom: 4px;
          }
          .num {
            text-align: right;
            white-space: nowrap;
          }
          tfoot td {
            border-top: 1px dashed #000;
            font-weight: 700;
            padding-top: 4px;
          }
          .section {
            margin-top: 10px;
          }
          .section-title {
            margin-bottom: 4px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .empty {
            text-align: center;
            color: #444;
          }
        </style>
      </head>
      <body>
        <section class="receipt">
          <div class="center">
            ${
              settings.showClosureStoreName
                ? `<div class="title">${escapeHtml(report?.storeName || "Boutique")}</div>`
                : ""
            }
            ${
              settings.showClosureBusinessName
                ? `<div class="subtitle">${escapeHtml(report?.businessName || "POSapp")}</div>`
                : ""
            }
            ${
              settings.showClosureHeaderText && settings.closureHeaderText
                ? `<div class="header-note">${escapeHtml(settings.closureHeaderText)}</div>`
                : ""
            }
            <div class="meta">${escapeHtml(report?.title || "Cloture")}</div>
            ${
              settings.showClosureDateTime
                ? `<div class="meta">Date: ${escapeHtml(formatDateTime(report?.generatedAt))}</div>`
                : ""
            }
            ${
              settings.showClosureCashier && report?.cashierName
                ? `<div class="meta">Caissier: ${escapeHtml(report.cashierName)}</div>`
                : ""
            }
            ${
              report?.generatedByName && report.generatedByName !== report.cashierName
                ? `<div class="meta">Genere par: ${escapeHtml(report.generatedByName)}</div>`
                : ""
            }
          </div>

          ${
            settings.showClosureSummary
              ? `<div class="divider"></div>
                 <table class="summary"><tbody>
                   ${getSummaryRows(report, currencyCode)
                     .map(
                       ([label, value]) => `
                         <tr>
                           <td>${escapeHtml(label)}</td>
                           <td class="num">${escapeHtml(value)}</td>
                         </tr>
                       `,
                     )
                     .join("")}
                 </tbody></table>`
              : ""
          }

          ${
            settings.showClosureSalesTable
              ? `<div class="divider"></div>${buildItemsTableHtml({
                  title: "Produits vendus",
                  items: report?.soldItems || [],
                  total: report?.summary?.soldGrandTotal || 0,
                  currencyCode,
                  totalLabel: "Total general",
                })}`
              : ""
          }

          ${
            settings.showClosureCanceledTable
              ? `<div class="divider"></div>${buildItemsTableHtml({
                  title: "Ventes annulees",
                  items: report?.canceledItems || [],
                  total: report?.summary?.canceledGrandTotal || 0,
                  currencyCode,
                  totalLabel: "Total annule",
                })}`
              : ""
          }

          <div class="divider"></div>
          ${
            settings.showClosureFooterText
              ? `<div class="footer center">${escapeHtml(
                  settings.closureFooterText || "Fin de cloture",
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
    </html>`;
};

export const printClosureReceipt = ({
  report,
  receiptSettings = DEFAULT_RECEIPT_SETTINGS,
  targetWindow,
}) => {
  const printWindow = targetWindow || window.open("", "_blank");
  if (!printWindow) {
    throw new Error(
      "Le navigateur a bloque l'ouverture du ticket. Autorise les popups pour cette application.",
    );
  }

  printWindow.document.open();
  printWindow.document.write(
    buildClosureReceiptHtml({
      report,
      receiptSettings,
    }),
  );
  printWindow.document.close();
};

export default printClosureReceipt;
