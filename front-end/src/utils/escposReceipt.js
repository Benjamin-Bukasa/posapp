const encoder = new TextEncoder();

import {
  DEFAULT_RECEIPT_SETTINGS,
  normalizeReceiptSettings,
} from "./receiptSettings";

const ESC = 0x1b;
const GS = 0x1d;

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

const formatDate = (value) => {
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

export const buildEscPosReceipt = ({
  order,
  amountReceived,
  cashierName,
  storeName,
  businessName,
  receiptSettings = DEFAULT_RECEIPT_SETTINGS,
}) => {
  const settings = normalizeReceiptSettings(receiptSettings);
  const bytes = [];
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
  const width = settings.paperFormat === "58mm" ? 32 : 42;

  bytes.push(ESC, 0x40);
  bytes.push(ESC, 0x61, 0x01);
  bytes.push(ESC, 0x45, 0x01);
  bytes.push(GS, 0x21, 0x11);
  if (settings.showStoreName) {
    pushText(bytes, `${storeName || businessName || "POSapp"}\n`);
  }
  bytes.push(GS, 0x21, 0x00);
  bytes.push(ESC, 0x45, 0x00);
  if (settings.showBusinessName) {
    pushText(bytes, `${businessName || "POSapp"}\n`);
  }
  if (settings.showHeaderText && settings.headerText) {
    wrapText(settings.headerText, width).forEach((line) => pushText(bytes, `${line}\n`));
  }
  if (settings.showTicketNumber) {
    pushText(bytes, `Ticket ${shortId(order?.id)}\n`);
  }
  if (settings.showDateTime) {
    pushText(bytes, `${formatDate(order?.createdAt)}\n`);
  }
  if (settings.showCashier) {
    pushText(bytes, `Caissier: ${cashierName || "--"}\n`);
  }
  if (settings.showCustomer && order?.customer) {
    pushText(
      bytes,
      `Client: ${
        [order.customer.firstName, order.customer.lastName]
          .filter(Boolean)
          .join(" ") ||
        order.customer.phone ||
        "--"
      }\n`,
    );
  }
  pushText(bytes, `${"-".repeat(width)}\n`);

  bytes.push(ESC, 0x61, 0x00);
  if (settings.showItems) {
    (order?.items || []).forEach((item) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      const lineTotal = Number(item.total || quantity * unitPrice);
      const amountText = item.isGift ? "Offert" : formatAmount(lineTotal, currencyCode);
      const labelWidth = width > 32 ? 28 : 20;
      const valueWidth = width - labelWidth;
      const giftLabel = item.isGift
        ? item.giftReasonNote?.trim()
          ? `Offert - ${item.giftReasonNote.trim()}`
          : item.giftReasonType === "BONUS_POINTS"
            ? "Offert - points bonus"
            : item.giftReasonType === "THRESHOLD_PURCHASE"
              ? item.giftThresholdAmount
                ? `Offert - seuil ${formatAmount(item.giftThresholdAmount, currencyCode)}`
                : "Offert - seuil d'achat"
              : "Offert"
        : "";

      wrapText(item.product?.name || item.name || "Article", labelWidth).forEach((line, index) => {
        const right = index === 0 ? amountText : "";
        pushText(bytes, `${padRight(line, labelWidth)}${padLeft(right, valueWidth)}\n`);
      });
      pushText(
        bytes,
        `${padRight(`${quantity} x ${formatAmount(unitPrice, currencyCode)}`, width)}\n`,
      );
      if (giftLabel) {
        wrapText(giftLabel, width).forEach((line) => pushText(bytes, `${line}\n`));
      }
    });

    pushText(bytes, `${"-".repeat(width)}\n`);
  }

  const totals = [];
  if (settings.showSubtotal) {
    totals.push(["Sous-total", formatAmount(order?.subtotal ?? total, currencyCode)]);
  }
  if (settings.showTotal) {
    totals.push(["Total", formatAmount(total, currencyCode)]);
  }
  if (settings.showPaymentMethod) {
    totals.push(["Paiement", methodLabels[payment?.method] || payment?.method || "--"]);
  }
  if (settings.showAmountReceived) {
    totals.push(["Montant recu", formatAmount(paid, currencyCode)]);
  }
  if (settings.showOriginalAmount && showOriginalPayment) {
    totals.push(["Remis client", formatAmount(originalPaid, originalCurrencyCode)]);
  }
  if (settings.showChange) {
    totals.push(["Monnaie", formatAmount(change, currencyCode)]);
  }

  const totalsLabelWidth = width > 32 ? 24 : 16;
  const totalsValueWidth = width - totalsLabelWidth;
  totals.forEach(([label, value]) => {
    pushText(bytes, `${padRight(label, totalsLabelWidth)}${padLeft(value, totalsValueWidth)}\n`);
  });

  if (settings.showLoyaltyPoints && Number(order?.loyaltyPoints || 0) > 0) {
    pushText(bytes, `${"-".repeat(width)}\n`);
    pushText(bytes, `Points gagnes: ${order.loyaltyPoints}\n`);
  }

  pushText(bytes, `${"-".repeat(width)}\n`);
  bytes.push(ESC, 0x61, 0x01);
  if (settings.showFooterText) {
    wrapText(settings.footerText || "Merci pour votre achat", width).forEach((line) =>
      pushText(bytes, `${line}\n`),
    );
  }
  pushText(bytes, "\n\n");
  bytes.push(GS, 0x56, 0x41, 0x00);

  return new Uint8Array(bytes);
};

export default buildEscPosReceipt;
