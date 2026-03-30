const { createStyledPdf, formatDateTime } = require("./pdfTheme");

const buildSupplyRequestPdf = (request, companyName) => {
  const reference = request.code || `REQ-${String(request.id || "").slice(0, 8).toUpperCase()}`;

  return createStyledPdf({
    title: "REQUISITION",
    reference: `REQUISITION N° : ${reference}`,
    companyName: companyName || "NEOPHARMA",
    subtitleLines: [
      request.requestedBy
        ? `Demande faite ${[
            request.requestedBy.firstName,
            request.requestedBy.lastName,
          ]
            .filter(Boolean)
            .join(" ")}`
        : "",
      `Date : ${formatDateTime(request.createdAt)}`,
      `Statut : ${request.status || "Non valide"}`,
    ],
    metaItems: [
      { label: "Local", value: request.storageZone?.name || request.store?.name || "-" },
      { label: "Destinataire", value: request.destinationLabel || "-" },
      {
        label: "Demandeur",
        value:
          [request.requestedBy?.firstName, request.requestedBy?.lastName]
            .filter(Boolean)
            .join(" ") || "-",
      },
      { label: "Observation", value: request.note || "-" },
    ],
    tableTitle: "Articles demandes",
    columns: [
      { label: "Code", width: 1.2, value: (row) => row.product?.sku || "-" },
      { label: "Article", width: 2.6, value: (row) => row.product?.name || "-" },
      { label: "Unite", width: 0.9, value: (row) => row.unit?.symbol || row.unit?.name || "-" },
      { label: "Qte(loc)", width: 0.9, value: (row) => row.localQuantity ?? "-" },
      { label: "Qte(stk)", width: 0.9, value: (row) => row.stockQuantity ?? "-" },
      { label: "Qte Dem", width: 0.9, value: (row) => row.quantity ?? 0 },
      { label: "Note", width: 1.2, value: (row) => row.note || "-" },
    ],
    rows: request.items || [],
    footerLeft: "Kinshasa, Democratic Republic of the Congo",
  });
};

module.exports = { buildSupplyRequestPdf };
