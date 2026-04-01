const { createStyledPdf, formatDateTime } = require("./pdfTheme");

const buildTransferPdf = (transfer, companyName) =>
  createStyledPdf({
    title: "TRANSFERT DE STOCK",
    reference: `TRANSFERT N° : ${transfer.code || `TRF-${String(transfer.id || "").slice(0, 8).toUpperCase()}`}`,
<<<<<<< HEAD
    companyName: companyName || "POSapp",
=======
    companyName: companyName || "NEOPHARMA",
>>>>>>> aed4c876093dd2e186d658b809f50bca4071b79d
    subtitleLines: [
      `Date : ${formatDateTime(transfer.createdAt)}`,
      `Statut : ${transfer.status || "-"}`,
    ],
    metaItems: [
      { label: "Boutique source", value: transfer.fromStore?.name || "-" },
      { label: "Boutique cible", value: transfer.toStore?.name || "-" },
      { label: "Zone source", value: transfer.fromZone?.name || "-" },
      { label: "Zone cible", value: transfer.toZone?.name || "-" },
      {
        label: "Demandeur",
        value:
          [transfer.requestedBy?.firstName, transfer.requestedBy?.lastName]
            .filter(Boolean)
            .join(" ") || "-",
      },
      { label: "Observation", value: transfer.note || "-" },
    ],
    tableTitle: "Lignes de transfert",
    columns: [
      { label: "Code", width: 1.2, value: (row) => row.product?.sku || "-" },
      { label: "Produit", width: 2.8, value: (row) => row.product?.name || "-" },
      { label: "Type", width: 0.9, value: (row) => row.product?.kind || "-" },
      { label: "Unite", width: 0.8, value: (row) => row.unit?.symbol || row.unit?.name || "-" },
      { label: "Quantite", width: 0.9, value: (row) => row.quantity ?? 0 },
    ],
    rows: transfer.items || [],
    footerLeft: "Document de transfert de stock",
  });

module.exports = { buildTransferPdf };
