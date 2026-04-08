import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const methodLabels = {
  CASH: "Cash",
  CARD: "Carte",
  MOBILE_MONEY: "Mobile money",
  TRANSFER: "Virement",
};

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "")
    .replace(/\s+/g, " ")
    .trim();

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

const wrapText = (font, text, size, maxWidth) => {
  const normalized = normalizeText(text);
  const words = normalized.split(" ");
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const testLine = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, size);
    if (width <= maxWidth) {
      current = testLine;
      return;
    }
    if (current) {
      lines.push(current);
    }
    current = word;
  });

  if (current) {
    lines.push(current);
  }

  return lines;
};

const drawText = (page, font, text, x, y, size = 9, align = "left") => {
  const textWidth = font.widthOfTextAtSize(text, size);
  let drawX = x;
  if (align === "center") {
    drawX = x - textWidth / 2;
  } else if (align === "right") {
    drawX = x - textWidth;
  }

  page.drawText(text, {
    x: drawX,
    y,
    size,
    font,
    color: rgb(0, 0, 0),
  });

  return y - size - 2;
};

const buildReceiptPdfBlob = async ({
  order,
  amountReceived,
  cashierName,
  storeName,
  businessName,
}) => {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([226.8, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();
  const contentWidth = width - 20;
  const centerX = width / 2;
  let y = height - 20;

  drawText(page, font, storeName || businessName || "POSapp", centerX, y, 12, "center");
  y -= 16;
  drawText(page, font, businessName || "POSapp", centerX, y, 10, "center");
  y -= 14;
  drawText(page, font, `Ticket: ${String(order?.id || "").slice(-8).toUpperCase()}`, 20, y, 9, "left");
  y -= 12;
  drawText(page, font, `Date: ${formatDate(order?.createdAt)}`, 20, y, 9, "left");
  y -= 12;
  drawText(page, font, `Caissier: ${cashierName || "--"}`, 20, y, 9, "left");
  y -= 12;

  if (order?.customer) {
    const customerName = normalizeText(
      [order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ") ||
        order.customer.phone ||
        "--",
    );
    drawText(page, font, `Client: ${customerName}`, 20, y, 9, "left");
    y -= 12;
  }

  y -= 2;
  drawText(page, font, "----------------------------------------", 20, y, 8, "left");
  y -= 14;

  const payment = order?.payments?.[0] || null;
  const currencyCode = order?.currencyCode || payment?.currencyCode || "USD";
  const total = Number(order?.total || 0);
  const paid = Number(amountReceived ?? payment?.amount ?? total);
  const originalPaid = Number(payment?.originalAmount ?? paid);
  const originalCurrencyCode = payment?.originalCurrencyCode || currencyCode;
  const showOriginalPayment =
    originalCurrencyCode !== currencyCode || Math.abs(originalPaid - paid) > 0.005;
  const change = Math.max(0, paid - total);

  (order?.items || []).forEach((item) => {
    if (y < 80) {
      page = pdfDoc.addPage([226.8, 842]);
      y = height - 20;
    }

    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const lineTotal = Number(item.total || quantity * unitPrice);
    const itemName = normalizeText(item.product?.name || item.name || "Article");
    const wrappedLines = wrapText(font, itemName, 9, contentWidth);

    wrappedLines.forEach((line) => {
      drawText(page, font, line, 20, y, 9, "left");
      y -= 12;
    });

    drawText(page, font, `${quantity} x ${formatAmount(unitPrice, currencyCode)}`, 20, y, 9, "left");
    drawText(page, font, formatAmount(lineTotal, currencyCode), width - 20, y, 9, "right");
    y -= 14;
  });

  drawText(page, font, "----------------------------------------", 20, y, 8, "left");
  y -= 14;

  const totals = [
    ["Sous-total", formatAmount(order?.subtotal ?? total, currencyCode)],
    ["Total", formatAmount(total, currencyCode)],
    ["Paiement", methodLabels[payment?.method] || payment?.method || "--"],
    ["Montant reçu", formatAmount(paid, currencyCode)],
    ...(showOriginalPayment
      ? [["Remis client", formatAmount(originalPaid, originalCurrencyCode)]]
      : []),
    ["Monnaie", formatAmount(change, currencyCode)],
  ];

  totals.forEach(([label, value]) => {
    drawText(page, font, label, 20, y, 9, "left");
    drawText(page, font, value, width - 20, y, 9, "right");
    y -= 12;
  });

  if (Number(order?.loyaltyPoints || 0) > 0) {
    y -= 12;
    drawText(page, font, "----------------------------------------", 20, y, 8, "left");
    y -= 14;
    drawText(page, font, `Points gagnés: ${order.loyaltyPoints}`, 20, y, 9, "left");
    y -= 14;
  }

  drawText(page, font, "----------------------------------------", 20, y, 8, "left");
  y -= 16;
  drawText(page, font, "Merci pour votre achat", centerX, y, 9, "center");

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
};

const openPdfWindow = (targetWindow) => {
  if (targetWindow) return targetWindow;
  const pdfWindow = window.open("", "_blank");
  if (!pdfWindow) {
    throw new Error("Le navigateur a bloque l'ouverture de l'onglet PDF.");
  }
  return pdfWindow;
};

export const printReceiptPdf = async ({ targetWindow, ...receiptData }) => {
  const pdfWindow = openPdfWindow(targetWindow);
  const blob = await buildReceiptPdfBlob(receiptData);
  const url = URL.createObjectURL(blob);
  pdfWindow.location.href = url;
  pdfWindow.focus();
  pdfWindow.onload = () => {
    try {
      pdfWindow.print();
    } catch (_error) {
      // Certains visionneuses PDF ne supportent pas print() depuis le script.
    }
  };
  return { blob, url, pdfWindow };
};

export default printReceiptPdf;
