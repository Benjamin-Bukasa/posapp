const xlsx = require("xlsx");
const { createStyledPdf } = require("../services/pdfTheme");

const escapeCsv = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const toCsv = (rows) => {
  if (!rows.length) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(escapeCsv).join(",");
  const lines = rows.map((row) =>
    headers.map((key) => escapeCsv(row[key])).join(",")
  );
  return [headerLine, ...lines].join("\n");
};

const sendExport = async (res, rows, filename, type = "csv", options = {}) => {
  if (type === "pdf") {
    const safeRows = Array.isArray(rows) ? rows : [];
    const headers = safeRows.length ? Object.keys(safeRows[0]) : ["Ligne"];
    const pdfBuffer = await createStyledPdf({
      title: filename.replace(/-/g, " ").toUpperCase(),
      reference: `EXPORT : ${filename.toUpperCase()}`,
      companyName: options.companyName || res.locals?.tenantName || "NEOPHARMA",
      subtitleLines: ["Export systeme"],
      metaItems: [
        { label: "Nombre de lignes", value: String(safeRows.length) },
      ],
      tableTitle: "Donnees exportees",
      columns: headers.map((header) => ({
        label: header,
        width: Math.max(1, header.length / 8),
        value: (row) => row?.[header] ?? "",
      })),
      rows: safeRows,
      footerLeft: "Document genere automatiquement",
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
    return res.send(pdfBuffer);
  }

  if (type === "xlsx") {
    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Export");
    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}.xlsx"`
    );
    return res.send(buffer);
  }

  const csvContent = toCsv(rows);
  const bom = "\ufeff";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
  return res.send(bom + csvContent);
};

module.exports = {
  sendExport,
};
