const xlsx = require("xlsx");
const { createStyledPdf } = require("../services/pdfTheme");

const DEFAULT_EXPORT_LABELS = {
  id: "ID",
  code: "Code",
  name: "Nom",
  title: "Titre",
  description: "Description",
  type: "Type",
  kind: "Nature",
  role: "Role",
  status: "Statut",
  method: "Mode",
  reference: "Reference",
  reason: "Motif",
  note: "Note",
  notes: "Notes",
  email: "Email",
  phone: "Telephone",
  address: "Adresse",
  addressLine: "Adresse",
  commune: "Commune",
  city: "Ville",
  country: "Pays",
  symbol: "Symbole",
  imageUrl: "Image URL",
  scanCode: "Code-barres",
  sku: "SKU",
  tva: "TVA",
  quantity: "Quantite",
  amount: "Montant",
  total: "Total",
  subtotal: "Sous-total",
  tax: "Taxe",
  unitPrice: "Prix unitaire",
  purchaseUnitPrice: "Prix d'achat unitaire",
  unitCost: "Cout unitaire",
  minLevel: "Stock minimum",
  points: "Points",
  customer: "Client",
  customerId: "ID client",
  customerName: "Client",
  supplier: "Fournisseur",
  supplierId: "ID fournisseur",
  store: "Boutique",
  storeId: "ID boutique",
  storeName: "Boutique",
  storageZone: "Zone de stockage",
  storageZoneId: "ID zone de stockage",
  zone: "Zone",
  zoneType: "Type de zone",
  product: "Article",
  productId: "ID article",
  productName: "Article",
  category: "Categorie",
  family: "Famille",
  subFamily: "Sous-famille",
  parentFamily: "Famille parente",
  collection: "Collection",
  orderId: "ID vente",
  orderDate: "Date de commande",
  orderCount: "Nombre de tickets",
  itemsCount: "Nombre d'articles",
  itemCount: "Nombre d'articles",
  batchNumber: "Numero de lot",
  expiryDate: "Date d'expiration",
  expiryStatus: "Statut d'expiration",
  lastPurchaseAt: "Dernier achat",
  createdAt: "Date de creation",
  updatedAt: "Date de mise a jour",
  approvedAt: "Date d'approbation",
  approvedBy: "Approuve par",
  approvedById: "ID approbateur",
  postedAt: "Date de validation",
  postedBy: "Valide par",
  receivedAt: "Date de reception",
  paidAt: "Date de paiement",
  openedAt: "Date d'ouverture",
  closedAt: "Date de fermeture",
  createdBy: "Cree par",
  createdById: "ID createur",
  requestedBy: "Demandeur",
  requestedById: "ID demandeur",
  firstName: "Prenom",
  lastName: "Nom",
  isActive: "Actif",
  permissionCount: "Nombre de permissions",
  permissionProfileName: "Profil de permission",
  permissions: "Permissions",
  userCount: "Nombre d'utilisateurs",
  stepsCount: "Nombre d'etapes",
  businessType: "Type metier",
  movementType: "Type de mouvement",
  sourceType: "Type de source",
  fromStore: "Boutique source",
  toStore: "Boutique destination",
  fromZone: "Zone source",
  toZone: "Zone destination",
  cashTheorique: "Cash theorique",
  cashCompte: "Cash compte",
  ventesCash: "Ventes cash",
  ventesNonCash: "Ventes non cash",
  fondsInitial: "Fonds initial",
  ecart: "Ecart",
  ouverteLe: "Ouverte le",
  clotureeLe: "Cloturee le",
  boutique: "Boutique",
  caissier: "Caissier",
  statut: "Statut",
};

const TOKEN_LABELS = {
  id: "ID",
  code: "code",
  name: "nom",
  title: "titre",
  description: "description",
  type: "type",
  kind: "nature",
  role: "role",
  status: "statut",
  method: "mode",
  reference: "reference",
  reason: "motif",
  note: "note",
  email: "email",
  phone: "telephone",
  address: "adresse",
  line: "ligne",
  commune: "commune",
  city: "ville",
  country: "pays",
  symbol: "symbole",
  image: "image",
  url: "URL",
  scan: "scan",
  sku: "SKU",
  tva: "TVA",
  quantity: "quantite",
  total: "total",
  amount: "montant",
  unit: "unitaire",
  price: "prix",
  payment: "paiement",
  currency: "devise",
  purchase: "achat",
  cost: "cout",
  min: "minimum",
  level: "niveau",
  points: "points",
  customer: "client",
  supplier: "fournisseur",
  store: "boutique",
  storage: "stockage",
  zone: "zone",
  product: "article",
  category: "categorie",
  family: "famille",
  sub: "sous",
  parent: "parente",
  collection: "collection",
  order: "commande",
  item: "article",
  items: "articles",
  count: "nombre",
  batch: "lot",
  number: "numero",
  expiry: "expiration",
  last: "dernier",
  purchaseat: "achat",
  created: "creation",
  updated: "mise a jour",
  approved: "approbation",
  posted: "validation",
  received: "reception",
  paid: "paiement",
  opened: "ouverture",
  closed: "fermeture",
  by: "par",
  requested: "demande",
  first: "prenom",
  active: "actif",
  permission: "permission",
  permissions: "permissions",
  profile: "profil",
  user: "utilisateur",
  users: "utilisateurs",
  steps: "etapes",
  business: "metier",
  movement: "mouvement",
  source: "source",
  from: "source",
  to: "destination",
  cash: "cash",
  non: "non",
  initial: "initial",
  variance: "ecart",
};

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

const splitHeaderTokens = (value) =>
  String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const capitalizeLabel = (value) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const humanizeHeader = (header) => {
  const normalizedHeader = String(header || "").trim();
  if (!normalizedHeader) return "Colonne";

  if (DEFAULT_EXPORT_LABELS[normalizedHeader]) {
    return DEFAULT_EXPORT_LABELS[normalizedHeader];
  }

  if (normalizedHeader.endsWith("Name") && normalizedHeader.length > 4) {
    return humanizeHeader(normalizedHeader.slice(0, -4));
  }

  if (normalizedHeader.endsWith("Count") && normalizedHeader.length > 5) {
    return `Nombre de ${humanizeHeader(normalizedHeader.slice(0, -5)).toLowerCase()}`;
  }

  if (normalizedHeader.endsWith("At") && normalizedHeader.length > 2) {
    return `Date de ${humanizeHeader(normalizedHeader.slice(0, -2)).toLowerCase()}`;
  }

  if (normalizedHeader.endsWith("Id") && normalizedHeader.length > 2) {
    return `ID ${humanizeHeader(normalizedHeader.slice(0, -2)).toLowerCase()}`;
  }

  const tokens = splitHeaderTokens(normalizedHeader).map((token) => {
    const normalizedToken = String(token).toLowerCase();
    return TOKEN_LABELS[normalizedToken] || normalizedToken;
  });

  return capitalizeLabel(tokens.join(" "));
};

const resolveColumns = (rows, options = {}) => {
  if (Array.isArray(options.columns) && options.columns.length) {
    return options.columns.map((column) => ({
      key: column.key,
      label: column.label || column.key,
      width: column.width,
      value:
        typeof column.value === "function"
          ? column.value
          : (row) => row?.[column.key] ?? "",
    }));
  }

  const headers = rows.length ? Object.keys(rows[0]) : ["Ligne"];
  return headers.map((header) => ({
    key: header,
    label: options.headerMap?.[header] || humanizeHeader(header),
    width: Math.max(
      1,
      String(options.headerMap?.[header] || humanizeHeader(header)).length / 8
    ),
    value: (row) => row?.[header] ?? "",
  }));
};

const toSheetRows = (rows, columns) =>
  rows.map((row) =>
    columns.reduce((accumulator, column) => {
      accumulator[column.label] = column.value(row);
      return accumulator;
    }, {})
  );

const toCsv = (rows, columns) => {
  if (!rows.length || !columns.length) {
    return "";
  }
  const headerLine = columns.map((column) => escapeCsv(column.label)).join(",");
  const lines = rows.map((row) =>
    columns.map((column) => escapeCsv(column.value(row))).join(",")
  );
  return [headerLine, ...lines].join("\n");
};

const sendExport = async (res, rows, filename, type = "csv", options = {}) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const columns = resolveColumns(safeRows, options);

  if (type === "pdf") {
    const pdfBuffer = await createStyledPdf({
      title: filename.replace(/-/g, " ").toUpperCase(),
      reference: `EXPORT : ${filename.toUpperCase()}`,
      companyName: options.companyName || res.locals?.tenantName || "POSapp",
      subtitleLines: ["Export systeme"],
      metaItems: [
        { label: "Nombre de lignes", value: String(safeRows.length) },
      ],
      tableTitle: "Donnees exportees",
      columns: columns.map((column) => ({
        label: column.label,
        width: column.width || Math.max(1, String(column.label).length / 8),
        value: column.value,
      })),
      rows: safeRows,
      footerLeft: "Document genere automatiquement",
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
    return res.send(pdfBuffer);
  }

  if (type === "xlsx") {
    const worksheet = xlsx.utils.json_to_sheet(toSheetRows(safeRows, columns));
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

  const csvContent = toCsv(safeRows, columns);
  const bom = "\ufeff";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
  return res.send(bom + csvContent);
};

module.exports = {
  sendExport,
};
