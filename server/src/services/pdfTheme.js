const PDFDocument = require("pdfkit");

const colors = {
  dark: "#0F172A",
  muted: "#64748B",
  line: "#CBD5E1",
  accent: "#0F766E",
  accentSoft: "#CCFBF1",
  light: "#F8FAFC",
  white: "#FFFFFF",
};

const page = {
  margin: 36,
  width: 595,
  height: 842,
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
};

const formatDate = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(date);
};

const drawText = (doc, text, x, y, options = {}) => {
  doc.fillColor(options.color || colors.dark);
  doc.fontSize(options.size || 9);
  doc.text(text || "", x, y, {
    width: options.width,
    align: options.align,
    continued: false,
    underline: options.underline,
  });
};

const drawHeader = (doc, {
  title,
  reference,
<<<<<<< HEAD
  companyName = "POSapp",
=======
  companyName = "NEOPHARMA",
>>>>>>> aed4c876093dd2e186d658b809f50bca4071b79d
  subtitleLines = [],
}) => {
  doc
    .roundedRect(page.margin, page.margin, page.width - page.margin * 2, 78, 16)
    .fill(colors.light);

  drawText(doc, companyName, page.margin + 16, page.margin + 14, {
    size: 16,
    color: colors.accent,
  });
  drawText(doc, title, page.margin + 16, page.margin + 36, {
    size: 18,
    color: colors.dark,
    width: 260,
  });

  drawText(doc, reference, page.width - page.margin - 180, page.margin + 16, {
    size: 12,
    align: "right",
    width: 164,
  });

  let subtitleY = page.margin + 40;
  subtitleLines.filter(Boolean).forEach((line) => {
    drawText(doc, line, page.width - page.margin - 180, subtitleY, {
      size: 8,
      color: colors.muted,
      align: "right",
      width: 164,
    });
    subtitleY += 12;
  });

  return page.margin + 94;
};

const drawMetaGrid = (doc, startY, items = []) => {
  const filtered = items.filter((item) => item?.label);
  if (!filtered.length) return startY;

  const boxWidth = (page.width - page.margin * 2 - 12) / 2;
  let y = startY;

  for (let i = 0; i < filtered.length; i += 2) {
    const rowItems = filtered.slice(i, i + 2);
    rowItems.forEach((item, columnIndex) => {
      const x = page.margin + columnIndex * (boxWidth + 12);
      doc
        .roundedRect(x, y, boxWidth, 42, 10)
        .fill(columnIndex === 0 ? colors.white : colors.light);
      drawText(doc, item.label, x + 12, y + 8, {
        size: 8,
        color: colors.muted,
        width: boxWidth - 24,
      });
      drawText(doc, item.value || "-", x + 12, y + 20, {
        size: 10,
        color: colors.dark,
        width: boxWidth - 24,
      });
    });
    y += 50;
  }

  return y + 4;
};

const drawSectionTitle = (doc, title, y) => {
  drawText(doc, title, page.margin, y, {
    size: 12,
    color: colors.dark,
  });
  doc
    .moveTo(page.margin, y + 18)
    .lineTo(page.width - page.margin, y + 18)
    .strokeColor(colors.line)
    .lineWidth(1)
    .stroke();
  return y + 26;
};

const renderTable = (doc, startY, columns, rows, options = {}) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const rowHeight = options.rowHeight || 20;
  const headerHeight = options.headerHeight || 24;
  const tableWidth = page.width - page.margin * 2;
  const totalWeight = columns.reduce((sum, column) => sum + (column.width || 1), 0);

  const colWidths = columns.map((column) => (tableWidth * (column.width || 1)) / totalWeight);

  let y = startY;
  let pageNumber = 1;

  const drawHeaderRow = () => {
    let x = page.margin;
    columns.forEach((column, index) => {
      doc
        .rect(x, y, colWidths[index], headerHeight)
        .fill(index % 2 === 0 ? colors.accent : colors.dark);
      drawText(doc, column.label, x + 6, y + 7, {
        size: 8,
        color: colors.white,
        width: colWidths[index] - 12,
      });
      x += colWidths[index];
    });
    y += headerHeight;
  };

  const ensureSpace = () => {
    if (y + rowHeight > page.height - page.margin - 56) {
      doc.addPage({ size: "A4", margin: page.margin });
      pageNumber += 1;
      y = page.margin;
      drawHeaderRow();
    }
  };

  drawHeaderRow();

  if (!safeRows.length) {
    doc.rect(page.margin, y, tableWidth, rowHeight).strokeColor(colors.line).stroke();
    drawText(doc, options.emptyMessage || "Aucune ligne.", page.margin + 8, y + 6, {
      size: 9,
      color: colors.muted,
      width: tableWidth - 16,
      align: "center",
    });
    y += rowHeight;
  } else {
    safeRows.forEach((row, rowIndex) => {
      ensureSpace();
      let x = page.margin;
      columns.forEach((column, colIndex) => {
        doc
          .rect(x, y, colWidths[colIndex], rowHeight)
          .fill(rowIndex % 2 === 0 ? colors.white : "#F1F5F9");
        drawText(
          doc,
          String(
            typeof column.value === "function"
              ? column.value(row)
              : row?.[column.value] ?? "",
          ),
          x + 6,
          y + 6,
          {
            size: 8,
            width: colWidths[colIndex] - 12,
            color: colors.dark,
          },
        );
        x += colWidths[colIndex];
      });
      y += rowHeight;
    });
  }

  return { y, pageNumber };
};

const drawTotals = (doc, y, totals = []) => {
  const filtered = totals.filter((item) => item?.label);
  if (!filtered.length) return y;

  let currentY = y + 8;
  filtered.forEach((item) => {
    doc
      .roundedRect(page.width - page.margin - 180, currentY, 180, 22, 10)
      .fill(item.emphasis ? colors.accentSoft : colors.light);
    drawText(doc, item.label, page.width - page.margin - 168, currentY + 6, {
      size: 8,
      color: colors.muted,
      width: 90,
    });
    drawText(doc, item.value || "-", page.width - page.margin - 86, currentY + 6, {
      size: 9,
      color: colors.dark,
      width: 70,
      align: "right",
    });
    currentY += 28;
  });

  return currentY;
};

const drawFooter = (doc, {
  signatures = ["Chef de service", "Controleur", "DG"],
  footerLeft,
}) => {
  const baseY = page.height - page.margin - 42;

  if (footerLeft) {
    drawText(doc, footerLeft, page.margin, baseY + 22, {
      size: 7,
      color: colors.muted,
      width: 240,
    });
  }

  const blockWidth = 140;
  signatures.forEach((label, index) => {
    const x = page.margin + index * ((page.width - page.margin * 2 - blockWidth) / 2);
    doc.moveTo(x, baseY).lineTo(x + blockWidth, baseY).strokeColor(colors.line).stroke();
    drawText(doc, label, x, baseY + 6, {
      size: 8,
      color: colors.muted,
      width: blockWidth,
      align: "center",
    });
  });
};

const createStyledPdf = ({
  title,
  reference,
  subtitleLines,
  companyName,
  metaItems,
  tableTitle,
  columns,
  rows,
  totals,
  footerLeft,
}) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: page.margin });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const headerBottom = drawHeader(doc, {
        title,
        reference,
        companyName,
        subtitleLines,
      });
      const metaBottom = drawMetaGrid(doc, headerBottom, metaItems);
      const tableStart = drawSectionTitle(doc, tableTitle, metaBottom);
      const result = renderTable(doc, tableStart, columns, rows);
      const totalsBottom = drawTotals(doc, result.y, totals);
      drawFooter(doc, {
        footerLeft,
      });

      drawText(
        doc,
        `Date d'edition : ${formatDateTime(new Date())}`,
        page.margin,
        page.height - page.margin - 64,
        {
          size: 7,
          color: colors.muted,
          width: 220,
        },
      );
      drawText(
        doc,
        `Page 1 / 1`,
        page.width - page.margin - 80,
        page.height - page.margin - 64,
        {
          size: 7,
          color: colors.muted,
          width: 80,
          align: "right",
        },
      );

      void totalsBottom;
      doc.end();
    } catch (error) {
      reject(error);
    }
  });

module.exports = {
  colors,
  formatDate,
  formatDateTime,
  createStyledPdf,
};
