const { createStyledPdf, formatDateTime } = require("./pdfTheme");

const buildPurchaseRequestPdf = (request, companyName) =>
  createStyledPdf({
    title: "DEMANDE D'ACHAT",
    reference: `DEMANDE N° : ${request.code || `DA-${String(request.id || "").slice(0, 8).toUpperCase()}`}`,
    companyName: companyName || "POSapp",
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
      { label: "Titre", value: request.title || "-" },
      { label: "Boutique", value: request.store?.name || "-" },
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
      { label: "Article", width: 2.8, value: (row) => row.product?.name || "-" },
      { label: "Unite", width: 1, value: (row) => row.unit?.symbol || row.unit?.name || "-" },
      { label: "Quantite", width: 1, value: (row) => row.quantity ?? 0 },
      { label: "Note", width: 1.6, value: (row) => row.note || "-" },
    ],
    rows: request.items || [],
    footerLeft: "Document d'approvisionnement interne",
  });

module.exports = { buildPurchaseRequestPdf };
