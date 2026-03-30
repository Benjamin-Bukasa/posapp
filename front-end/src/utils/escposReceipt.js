const encoder = new TextEncoder();

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
}) => {
  const bytes = [];
  const currencyCode =
    order?.currencyCode || order?.payments?.[0]?.currencyCode || "USD";
  const total = Number(order?.total || 0);
  const paid = Number(amountReceived ?? order?.payments?.[0]?.amount ?? total);
  const change = Math.max(0, paid - total);
  const width = 42;

  bytes.push(ESC, 0x40);
  bytes.push(ESC, 0x61, 0x01);
  bytes.push(ESC, 0x45, 0x01);
  bytes.push(GS, 0x21, 0x11);
  pushText(bytes, `${storeName || businessName || "NEOPHARMA"}\n`);
  bytes.push(GS, 0x21, 0x00);
  bytes.push(ESC, 0x45, 0x00);
  pushText(bytes, `${businessName || "NEOPHARMA"}\n`);
  pushText(bytes, `Ticket ${shortId(order?.id)}\n`);
  pushText(bytes, `${formatDate(order?.createdAt)}\n`);
  pushText(bytes, `Caissier: ${cashierName || "--"}\n`);
  if (order?.customer) {
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
  (order?.items || []).forEach((item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const lineTotal = Number(item.total || quantity * unitPrice);
    const amountText = formatAmount(lineTotal, currencyCode);

    wrapText(item.product?.name || item.name || "Article", 28).forEach((line, index) => {
      const right = index === 0 ? amountText : "";
      pushText(bytes, `${padRight(line, 28)}${padLeft(right, 14)}\n`);
    });
    pushText(
      bytes,
      `${padRight(`${quantity} x ${formatAmount(unitPrice, currencyCode)}`, width)}\n`,
    );
  });

  pushText(bytes, `${"-".repeat(width)}\n`);

  const totals = [
    ["Sous-total", formatAmount(order?.subtotal ?? total, currencyCode)],
    ["Total", formatAmount(total, currencyCode)],
    [
      "Paiement",
      methodLabels[order?.payments?.[0]?.method] || order?.payments?.[0]?.method || "--",
    ],
    ["Montant recu", formatAmount(paid, currencyCode)],
    ["Monnaie", formatAmount(change, currencyCode)],
  ];

  totals.forEach(([label, value]) => {
    pushText(bytes, `${padRight(label, 24)}${padLeft(value, 18)}\n`);
  });

  if (Number(order?.loyaltyPoints || 0) > 0) {
    pushText(bytes, `${"-".repeat(width)}\n`);
    pushText(bytes, `Points gagnes: ${order.loyaltyPoints}\n`);
  }

  pushText(bytes, `${"-".repeat(width)}\n`);
  bytes.push(ESC, 0x61, 0x01);
  pushText(bytes, "Merci pour votre achat\n");
  pushText(bytes, "\n\n");
  bytes.push(GS, 0x56, 0x41, 0x00);

  return new Uint8Array(bytes);
};

export default buildEscPosReceipt;
