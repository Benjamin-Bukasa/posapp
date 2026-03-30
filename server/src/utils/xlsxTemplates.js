const xlsx = require("xlsx");

const buildWorkbookBuffer = (sheets = []) => {
  const workbook = xlsx.utils.book_new();

  sheets.forEach((sheet) => {
    const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
    const worksheet = xlsx.utils.json_to_sheet(rows);
    xlsx.utils.book_append_sheet(workbook, worksheet, sheet.name || "Template");
  });

  return xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
};

const sendWorkbook = (res, filename, sheets) => {
  const buffer = buildWorkbookBuffer(sheets);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}.xlsx"`,
  );
  return res.send(buffer);
};

const readSheetRows = (fileBuffer, sheetName = null) => {
  const workbook = xlsx.read(fileBuffer, { type: "buffer" });
  const targetSheetName = sheetName || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[targetSheetName];

  if (!worksheet) {
    return [];
  }

  return xlsx.utils.sheet_to_json(worksheet, { defval: "" });
};

module.exports = {
  buildWorkbookBuffer,
  sendWorkbook,
  readSheetRows,
};
