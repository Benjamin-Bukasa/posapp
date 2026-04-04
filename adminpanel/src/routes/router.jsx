import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRightLeft,
  ArrowUpFromLine,
  BadgeDollarSign,
  Boxes,
  ClipboardList,
  FileBadge,
  FileCog,
  FilePlus2,
  FileSearch,
  FolderTree,
  Gift,
  LayoutDashboard,
  ListChecks,
  AlertTriangle,
  Palette,
  Package,
  PackageCheck,
  PackageOpen,
  Pill,
  ReceiptText,
  RotateCcw,
  Scale,
  ScanSearch,
  ScrollText,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tags,
  TestTube2,
  Undo2,
  Users,
  UserPlus,
  WalletCards,
  Warehouse
} from "lucide-react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { API_URL } from "../api/client";
import MainLayout from "../layouts/MainLayout";
import Dashboard from "../pages/Dashboard";
import AdminResourcePage from "../pages/AdminResourcePage";
import AdminCreatePage from "../pages/AdminCreatePage";
import AdminDetailPage from "../pages/AdminDetailPage";
import AdminInventoryCountPage from "../pages/AdminInventoryCountPage";
import SettingsPage from "../pages/SettingsPage";
import Login from "../pages/Login";
import ProtectedRoute from "./ProtectedRoute";
import { formatMoney } from "../utils/currencyDisplay";

const leaf = ({
  id,
  name,
  path,
  link,
  icon,
  summary,
  sectionLabel,
  parentLabel,
  parentPath,
  requiredPermissions,
}) => ({
  id,
  name,
  path,
  link,
  icon,
  summary,
  sectionLabel,
  requiredPermissions,
  breadcrumbs: parentLabel
    ? [
        { label: parentLabel, path: parentPath },
        { label: name, path },
      ]
    : [{ label: name, path }],
});

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatPerson = (person) =>
  [person?.firstName, person?.lastName].filter(Boolean).join(" ") ||
  person?.email ||
  "--";

const formatBoolean = (value) => (value ? "Oui" : "Non");
const formatCount = (items) => (Array.isArray(items) ? items.length : 0);
const pickRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};
const pickPreferredTargetZone = (zones = []) =>
  zones.find((zone) => zone?.zoneType === "STORE") ||
  zones.find((zone) => zone?.zoneType === "COUNTER") ||
  zones[0] ||
  null;
const statusLabels = {
  DRAFT: "Non valide",
  SUBMITTED: "En cours",
  APPROVED: "Valide",
  SENT: "Valide",
  ORDERED: "Commande creee",
};

const pillTone = (value = "") => {
  const normalized = String(value).toUpperCase();

  if (
    [
      "APPROVED",
      "PAID",
      "RECEIVED",
      "POSTED",
      "COMPLETED",
      "ACTIVE",
      "TRUE",
    ].includes(normalized)
  ) {
    return "bg-success/10 text-success";
  }

  if (["PENDING", "DRAFT", "SUBMITTED", "SENT"].includes(normalized)) {
    return "bg-warning/10 text-warning";
  }

  if (["REJECTED", "INACTIVE", "FALSE"].includes(normalized)) {
    return "bg-danger/10 text-danger";
  }

  return "bg-header/20 text-text-secondary";
};

const renderPill = (value) => (
  <span
    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${pillTone(
      value,
    )}`}
  >
    {statusLabels[value] || value || "--"}
  </span>
);

const column = (header, accessor, options = {}) => ({
  header,
  accessor,
  key: options.key || String(header),
  render: options.render,
  sortBy: options.sortBy,
  className: options.className,
  headerClassName: options.headerClassName,
});

const createResource = ({
  endpoint,
  columns,
  defaultQuery,
  tableTitle,
  tableDescription,
  emptyMessage,
  description,
  staticRows,
  searchEnabled,
  pageSize,
  transformRows,
  rowActions,
  importConfig,
  exportFileBaseName,
  ...rest
}) => ({
  endpoint,
  columns,
  defaultQuery,
  tableTitle,
  tableDescription,
  emptyMessage,
  description,
  staticRows,
  searchEnabled,
  pageSize,
  transformRows,
  rowActions,
  importConfig,
  exportFileBaseName,
  ...rest,
});

const compactValue = (value) =>
  value === "" || value === null || value === undefined ? undefined : value;

const upperCodeValue = (value) => {
  const compacted = compactValue(value);
  return typeof compacted === "string" ? compacted.trim().toUpperCase() : compacted;
};

const formatDateOnly = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(date);
};

const formatExpiryStatus = (value) => {
  switch (String(value || "").toUpperCase()) {
    case "EXPIRE":
      return <span className="inline-flex rounded-full bg-danger/10 px-3 py-1 text-xs font-medium text-danger">Expire</span>;
    case "EXPIRE_BIENTOT":
      return <span className="inline-flex rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">Expire bientot</span>;
    case "OK":
      return <span className="inline-flex rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">Valide</span>;
    default:
      return <span className="inline-flex rounded-full bg-header/20 px-3 py-1 text-xs font-medium text-text-secondary">Sans date</span>;
  }
};

const resolveAssetUrl = (value) => {
  if (!value) return "";
  if (
    String(value).startsWith("http://") ||
    String(value).startsWith("https://") ||
    String(value).startsWith("blob:") ||
    String(value).startsWith("data:")
  ) {
    return value;
  }
  return value.startsWith("/")
    ? `${API_URL}${value}`
    : `${API_URL}/${String(value).replace(/^\/+/, "")}`;
};

const renderProductThumbnail = (row) => {
  if (!row?.imageUrl) return "--";
  const source = resolveAssetUrl(row.imageUrl);
  return (
    <img
      src={source}
      alt={row?.name || "Produit"}
      className="h-10 w-10 rounded-xl object-cover"
    />
  );
};

const numericValue = (value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : undefined;
};

const mapItems = (items = [], mapper) =>
  items
    .map((item, index) => mapper(item, index))
    .filter((item) => item && Object.values(item).some((value) => value !== undefined));

const repeaterRow = (fields = [], index = 0) =>
  fields.reduce((accumulator, field) => {
    const value =
      typeof field.initialValue === "function"
        ? field.initialValue(index)
        : field.initialValue;

    return {
      ...accumulator,
      [field.name]:
        value !== undefined ? value : field.type === "checkbox" ? false : "",
    };
  }, {});

const createForm = ({
  createPath,
  title,
  description,
  endpoint,
  method,
  fields,
  repeaters,
  buildRequest,
  buildRequests,
  submitLabel,
  successMessage,
  unavailableMessage,
  ...rest
}) => ({
  createPath,
  title,
  description,
  endpoint,
  method,
  fields,
  repeaters,
  buildRequest,
  buildRequests,
  submitLabel,
  successMessage,
  unavailableMessage,
  ...rest,
});

export const dashboardMeta = leaf({
  id: "dashboard",
  name: "Dashboard",
  path: "/dashboard",
  link: "dashboard",
  icon: LayoutDashboard,
  summary: "Pilotage global de l'administration centrale.",
  sectionLabel: "Exploitation",
});

export const settingsMeta = leaf({
  id: "settings",
  name: "Parametres",
  path: "/settings",
  link: "settings",
  icon: Settings2,
  summary: "Personnalisation de l'apparence de l'adminpanel.",
  sectionLabel: "Administration",
});

export const sidebarSections = [
  {
    id: "exploitation",
    title: "Exploitation",
    items: [
      dashboardMeta,
      {
        id: "commande",
        name: "Commande",
        path: "/commande",
        link: "commande",
        icon: ShoppingCart,
        children: [
          leaf({
            id: "commande-demande-achat",
            name: "Demande d'achat",
            path: "/commande/demande-achat",
            link: "commande-demande-achat",
            icon: FilePlus2,
            summary: "Preparation et validation des demandes d'achat.",
            sectionLabel: "Commande",
            parentLabel: "Commande",
            parentPath: "/commande",
          }),
          leaf({
            id: "commande-requisitions",
            name: "Requisitions",
            path: "/commande/requisitions",
            link: "commande-requisitions",
            icon: ClipboardList,
            summary: "Suivi des demandes des boutiques et des services.",
            sectionLabel: "Commande",
            parentLabel: "Commande",
            parentPath: "/commande",
          }),
          leaf({
            id: "commande-commande",
            name: "Commande",
            path: "/commande/commande",
            link: "commande-commande",
            icon: ReceiptText,
            summary: "Creation et approbation des commandes fournisseur.",
            sectionLabel: "Commande",
            parentLabel: "Commande",
            parentPath: "/commande",
          }),
          leaf({
            id: "commande-liste-commande",
            name: "Liste de commande",
            path: "/commande/liste-commande",
            link: "commande-liste-commande",
            icon: ListChecks,
            summary: "Journal central de toutes les commandes emises.",
            sectionLabel: "Commande",
            parentLabel: "Commande",
            parentPath: "/commande",
          }),
        ],
      },
      {
        id: "mouvement",
        name: "Mouvement",
        path: "/mouvement",
        link: "mouvement",
        icon: ArrowLeftRight,
        children: [
          leaf({
            id: "mouvement-entree-stock",
            name: "Entree stock",
            path: "/mouvement/entree-stock",
            link: "mouvement-entree-stock",
            icon: ArrowDownToLine,
            summary: "Enregistrement des receptions et integrations au stock.",
            sectionLabel: "Mouvement",
            parentLabel: "Mouvement",
            parentPath: "/mouvement",
          }),
          leaf({
            id: "mouvement-sortie-stock",
            name: "Sortie stock",
            path: "/mouvement/sortie-stock",
            link: "mouvement-sortie-stock",
            icon: ArrowUpFromLine,
            summary: "Suivi des sorties vers boutiques, services ou pertes.",
            sectionLabel: "Mouvement",
            parentLabel: "Mouvement",
            parentPath: "/mouvement",
          }),
          leaf({
            id: "mouvement-retour-stock",
            name: "Retour stock",
            path: "/mouvement/retour-stock",
            link: "mouvement-retour-stock",
            icon: Undo2,
            summary: "Retour interne des articles vers la zone de stockage.",
            sectionLabel: "Mouvement",
            parentLabel: "Mouvement",
            parentPath: "/mouvement",
          }),
          leaf({
            id: "mouvement-transfert",
            name: "Transfert",
            path: "/mouvement/transfert",
            link: "mouvement-transfert",
            icon: ArrowRightLeft,
            summary: "Transfert de stock entre zones et points de vente.",
            sectionLabel: "Mouvement",
            parentLabel: "Mouvement",
            parentPath: "/mouvement",
          }),
          leaf({
            id: "mouvement-retour-fournisseur",
            name: "Retour fournisseur",
            path: "/mouvement/retour-fournisseur",
            link: "mouvement-retour-fournisseur",
            icon: RotateCcw,
            summary: "Gestion des retours sur lots defectueux ou non conformes.",
            sectionLabel: "Mouvement",
            parentLabel: "Mouvement",
            parentPath: "/mouvement",
          }),
          leaf({
            id: "mouvement-historique-mouvements",
            name: "Historique de mouvements",
            path: "/mouvement/historique-mouvements",
            link: "mouvement-historique-mouvements",
            icon: ScrollText,
            summary: "Trace complete des mouvements de stock et ajustements.",
            sectionLabel: "Mouvement",
            parentLabel: "Mouvement",
            parentPath: "/mouvement",
          }),
          leaf({
            id: "mouvement-historique-caisse",
            name: "Historique caisse",
            path: "/mouvement/historique-caisse",
            link: "mouvement-historique-caisse",
            icon: WalletCards,
            summary: "Ouvertures, clotures et ecarts des sessions de caisse.",
            sectionLabel: "Mouvement",
            parentLabel: "Mouvement",
            parentPath: "/mouvement",
          }),
        ],
      },
      leaf({
        id: "etat-stock",
        name: "Etat de stock",
        path: "/etat-stock",
        link: "etat-stock",
        icon: ScanSearch,
        summary: "Niveau, couverture et alertes sur les quantites disponibles.",
        sectionLabel: "Exploitation",
      }),
      leaf({
        id: "lots-peremptions",
        name: "Lots / Peremptions",
        path: "/lots-peremptions",
        link: "lots-peremptions",
        icon: AlertTriangle,
        summary: "Suivi des lots expires ou expirant bientot par boutique et zone.",
        sectionLabel: "Exploitation",
      }),
      leaf({
        id: "etat-consommation",
        name: "Etat de consommation",
        path: "/etat-consommation",
        link: "etat-consommation",
        icon: BadgeDollarSign,
        summary: "Analyse des sorties et tendances de consommation.",
        sectionLabel: "Exploitation",
      }),
      {
        id: "inventaire",
        name: "Inventaire",
        path: "/inventaire",
        link: "inventaire",
        icon: Boxes,
        children: [
          leaf({
            id: "inventaire-inventaire",
            name: "Inventaire",
            path: "/inventaire/inventaire",
            link: "inventaire-inventaire",
            icon: PackageOpen,
            summary: "Preparation et execution des campagnes d'inventaire.",
            sectionLabel: "Inventaire",
            parentLabel: "Inventaire",
            parentPath: "/inventaire",
          }),
          leaf({
            id: "inventaire-etat",
            name: "Etat d'inventaire",
            path: "/inventaire/etat-inventaire",
            link: "inventaire-etat-inventaire",
            icon: Scale,
            summary: "Ecarts, valorisation et statut des inventaires en cours.",
            sectionLabel: "Inventaire",
            parentLabel: "Inventaire",
            parentPath: "/inventaire",
          }),
        ],
      },
    ],
  },
  {
    id: "configurations",
    title: "Configurations",
    items: [
      {
        id: "articles",
        name: "Articles",
        path: "/configurations/articles",
        link: "articles",
        icon: Pill,
        children: [
          leaf({
            id: "articles-produits",
            name: "Produits",
            path: "/configurations/articles/produits",
            link: "articles-produits",
            icon: Package,
            summary: "Catalogue principal des produits stockes.",
            sectionLabel: "Configurations",
            parentLabel: "Articles",
            parentPath: "/configurations/articles",
          }),
          leaf({
            id: "articles-articles",
            name: "Articles",
            path: "/configurations/articles/articles",
            link: "articles-articles",
            icon: FileSearch,
            summary: "Referentiel des articles et references internes.",
            sectionLabel: "Configurations",
            parentLabel: "Articles",
            parentPath: "/configurations/articles",
          }),
          leaf({
            id: "articles-collections",
            name: "Collections",
            path: "/configurations/articles/collections",
            link: "articles-collections",
            icon: FolderTree,
            summary: "Collections principales des categories produits.",
            sectionLabel: "Configurations",
            parentLabel: "Articles",
            parentPath: "/configurations/articles",
          }),
          leaf({
            id: "articles-familles",
            name: "Familles",
            path: "/configurations/articles/familles",
            link: "articles-familles",
            icon: FolderTree,
            summary: "Structuration des familles d'articles.",
            sectionLabel: "Configurations",
            parentLabel: "Articles",
            parentPath: "/configurations/articles",
          }),
          leaf({
            id: "articles-sous-familles",
            name: "Sous-familles",
            path: "/configurations/articles/sous-familles",
            link: "articles-sous-familles",
            icon: FolderTree,
            summary: "Decoupage detaille des sous-familles.",
            sectionLabel: "Configurations",
            parentLabel: "Articles",
            parentPath: "/configurations/articles",
          }),
          leaf({
            id: "articles-fiche-technique",
            name: "Fiche technique",
            path: "/configurations/articles/fiche-technique",
            link: "articles-fiche-technique",
            icon: FileCog,
            summary: "Informations techniques, dosage, forme et conditions.",
            sectionLabel: "Configurations",
            parentLabel: "Articles",
            parentPath: "/configurations/articles",
          }),
          leaf({
            id: "articles-categorie",
            name: "Categorie",
            path: "/configurations/articles/categorie",
            link: "articles-categorie",
            icon: Tags,
            summary: "Categories operationnelles et analytiques des produits.",
            sectionLabel: "Configurations",
            parentLabel: "Articles",
            parentPath: "/configurations/articles",
          }),
        ],
      },
      {
        id: "parametres",
        name: "Parametres",
        path: "/configurations/parametres",
        link: "parametres",
        icon: Settings2,
        children: [
          leaf({
            id: "parametres-personnalisation",
            name: "Personnalisation",
            path: "/settings",
            link: "settings",
            icon: Palette,
            summary: "Couleurs, theme et personnalisation de l'interface.",
            sectionLabel: "Configurations",
            parentLabel: "Parametres",
            parentPath: "/configurations/parametres",
          }),
          leaf({
            id: "parametres-unite",
            name: "Unite",
            path: "/configurations/parametres/unite",
            link: "parametres-unite",
            icon: TestTube2,
            summary: "Unites de conditionnement, vente et stockage.",
            sectionLabel: "Configurations",
            parentLabel: "Parametres",
            parentPath: "/configurations/parametres",
          }),
          leaf({
            id: "parametres-tva",
            name: "TVA",
            path: "/configurations/parametres/tva",
            link: "parametres-tva",
            icon: WalletCards,
            summary: "Taux de taxe applicables selon le contexte de vente.",
            sectionLabel: "Configurations",
            parentLabel: "Parametres",
            parentPath: "/configurations/parametres",
          }),
          leaf({
            id: "parametres-devise",
            name: "Devise",
            path: "/configurations/parametres/devise",
            link: "parametres-devise",
            icon: BadgeDollarSign,
            summary: "Monnaies de travail et de valorisation du stock.",
            sectionLabel: "Configurations",
            parentLabel: "Parametres",
            parentPath: "/configurations/parametres",
          }),
          leaf({
            id: "parametres-conversions-devise",
            name: "Conversions devise",
            path: "/configurations/parametres/conversions-devise",
            link: "parametres-conversions-devise",
            icon: ArrowRightLeft,
            summary: "Taux de conversion entre devises configurees.",
            sectionLabel: "Configurations",
            parentLabel: "Parametres",
            parentPath: "/configurations/parametres",
          }),
          leaf({
            id: "parametres-bonus-client",
            name: "Bonus client",
            path: "/configurations/parametres/bonus-client",
            link: "parametres-bonus-client",
            icon: Gift,
            summary: "Regles de points bonus client et seuils de recompense.",
            sectionLabel: "Configurations",
            parentLabel: "Parametres",
            parentPath: "/configurations/parametres",
          }),
          leaf({
            id: "parametres-locale-vente",
            name: "Locale de vente",
            path: "/configurations/parametres/locale-vente",
            link: "parametres-locale-vente",
            icon: Store,
            summary: "Points de vente, comptoirs et affectations commerciales.",
            sectionLabel: "Configurations",
            parentLabel: "Parametres",
            parentPath: "/configurations/parametres",
          }),
          leaf({
            id: "parametres-zone-stockage",
            name: "Zone de stockage",
            path: "/configurations/parametres/zone-stockage",
            link: "parametres-zone-stockage",
            icon: Warehouse,
            summary: "Zones, rayons et emplacements de conservation.",
            sectionLabel: "Configurations",
            parentLabel: "Parametres",
            parentPath: "/configurations/parametres",
          }),
          leaf({
            id: "parametres-niveau-validation",
            name: "Niveau de validation",
            path: "/configurations/parametres/niveau-validation",
            link: "parametres-niveau-validation",
            icon: ShieldCheck,
            summary: "Circuit d'approbation des demandes et commandes.",
            sectionLabel: "Configurations",
            parentLabel: "Parametres",
            parentPath: "/configurations/parametres",
          }),
        ],
      },
      {
        id: "utilisateur",
        name: "Utilisateur",
        path: "/configurations/utilisateur",
        link: "utilisateur",
        icon: Users,
        children: [
          leaf({
            id: "utilisateur-liste",
            name: "Liste d'utilisateurs",
            path: "/configurations/utilisateur/liste-utilisateurs",
            link: "utilisateur-liste-utilisateurs",
            icon: Users,
            summary: "Annuaire des comptes et rattachements organisationnels.",
            sectionLabel: "Configurations",
            parentLabel: "Utilisateur",
            parentPath: "/configurations/utilisateur",
          }),
          leaf({
            id: "utilisateur-creer",
            name: "Creer",
            path: "/configurations/utilisateur/creer",
            link: "utilisateur-creer",
            icon: UserPlus,
            summary: "Creation rapide des utilisateurs et invitations.",
            sectionLabel: "Configurations",
            parentLabel: "Utilisateur",
            parentPath: "/configurations/utilisateur",
          }),
          leaf({
            id: "utilisateur-roles",
            name: "Role et permission",
            path: "/configurations/utilisateur/roles-permissions",
            link: "utilisateur-roles-permissions",
            icon: FileBadge,
            summary: "Grille des roles, droits et perimetres d'acces.",
            sectionLabel: "Configurations",
            parentLabel: "Utilisateur",
            parentPath: "/configurations/utilisateur",
          }),
        ],
      },
    ],
  },
];

export const sidebarItems = sidebarSections.flatMap((section) => section.items);

export const allRouteMeta = [
  dashboardMeta,
  settingsMeta,
  ...sidebarSections.flatMap((section) =>
    section.items.flatMap((item) => (item.children?.length ? item.children : [item])),
  ),
].filter((item, index, array) => array.findIndex((entry) => entry.path === item.path) === index);

let createRouteMeta = [];

const routePermissionConfig = {
  "/commande/demande-achat": {
    read: ["purchase_requests.read"],
    create: ["purchase_requests.create"],
    edit: ["purchase_requests.update", "purchase_requests.update_own_draft"],
    delete: ["purchase_requests.delete"],
    detail: ["purchase_requests.read"],
  },
  "/commande/commande": {
    read: ["purchase_orders.read"],
    create: ["purchase_orders.create"],
    edit: ["purchase_orders.update"],
    delete: ["purchase_orders.delete"],
    detail: ["purchase_orders.read"],
  },
  "/commande/liste-commande": {
    read: ["purchase_orders.read"],
    create: ["purchase_orders.create"],
    edit: ["purchase_orders.update"],
    delete: ["purchase_orders.delete"],
    detail: ["purchase_orders.read"],
  },
  "/mouvement/entree-stock": {
    read: ["movements.read"],
    create: ["movements.create"],
    edit: ["movements.update"],
    delete: ["movements.delete"],
    detail: ["movements.read"],
  },
  "/mouvement/sortie-stock": {
    read: ["movements.read"],
    create: ["movements.create"],
    edit: ["movements.update"],
    delete: ["movements.delete"],
  },
  "/mouvement/retour-stock": {
    read: ["movements.read"],
    create: ["movements.create"],
    edit: ["movements.update"],
    delete: ["movements.delete"],
  },
  "/mouvement/transfert": {
    read: ["transfers.read"],
    create: ["transfers.create"],
    edit: ["transfers.update"],
    delete: ["transfers.delete"],
    detail: ["transfers.read"],
  },
  "/mouvement/retour-fournisseur": {
    read: ["movements.read"],
    create: ["movements.create"],
    edit: ["movements.update"],
    delete: ["movements.delete"],
    detail: ["movements.read"],
  },
  "/mouvement/historique-mouvements": {
    read: ["movements.read"],
  },
  "/mouvement/historique-caisse": {
    read: ["movements.read"],
    detail: ["movements.read"],
  },
  "/etat-stock": {
    read: ["stock_state.read"],
  },
  "/inventaire/inventaire": {
    read: ["inventory.read"],
    create: ["inventory.create"],
    edit: ["inventory.update"],
    delete: ["inventory.delete"],
    detail: ["inventory.read"],
  },
  "/inventaire/etat-inventaire": {
    read: ["inventory.read"],
    create: ["inventory.create"],
    edit: ["inventory.update"],
    delete: ["inventory.delete"],
    detail: ["inventory.read"],
  },
  "/configurations/articles/produits": {
    read: ["settings.read"],
    create: ["settings.create"],
    edit: ["settings.update"],
    delete: ["settings.delete"],
  },
  "/configurations/articles/articles": {
    read: ["settings.read"],
    create: ["settings.create"],
    edit: ["settings.update"],
    delete: ["settings.delete"],
  },
  "/configurations/articles/collections": {
    read: ["settings.read"],
    create: ["settings.create"],
    edit: ["settings.update"],
    delete: ["settings.delete"],
  },
  "/configurations/articles/familles": {
    read: ["settings.read"],
    create: ["settings.create"],
    edit: ["settings.update"],
    delete: ["settings.delete"],
  },
  "/configurations/articles/sous-familles": {
    read: ["settings.read"],
    create: ["settings.create"],
    edit: ["settings.update"],
    delete: ["settings.delete"],
  },
  "/configurations/articles/fiche-technique": {
    read: ["settings.read"],
    create: ["settings.create"],
    edit: ["settings.update"],
    delete: ["settings.delete"],
  },
  "/configurations/articles/categorie": {
    read: ["settings.read"],
    create: ["settings.create"],
    edit: ["settings.update"],
    delete: ["settings.delete"],
  },
  "/configurations/parametres/unite": {
    read: ["settings.read"],
    create: ["settings.create"],
    edit: ["settings.update"],
    delete: ["settings.delete"],
  },
  "/configurations/parametres/tva": {
    read: ["settings.read"],
    create: ["settings.create"],
    edit: ["settings.update"],
    delete: ["settings.delete"],
  },
  "/configurations/parametres/devise": {
    read: ["settings.read"],
    create: ["settings.create"],
    edit: ["settings.update"],
    delete: ["settings.delete"],
  },
  "/configurations/parametres/conversions-devise": {
    read: ["settings.read"],
    create: ["settings.create"],
    edit: ["settings.update"],
    delete: ["settings.delete"],
  },
  "/configurations/parametres/bonus-client": {
    read: ["settings.read"],
    create: ["settings.create"],
    edit: ["settings.update"],
    delete: ["settings.delete"],
  },
  "/configurations/parametres/locale-vente": {
    read: ["settings.read"],
    create: ["settings.create"],
    edit: ["settings.update"],
    delete: ["settings.delete"],
  },
  "/configurations/parametres/zone-stockage": {
    read: ["settings.read"],
    create: ["settings.create"],
    edit: ["settings.update"],
    delete: ["settings.delete"],
  },
  "/configurations/parametres/niveau-validation": {
    read: ["settings.read"],
    create: ["settings.create"],
    edit: ["settings.update"],
    delete: ["settings.delete"],
  },
  "/configurations/utilisateur/liste-utilisateurs": {
    read: ["users.read"],
    create: ["users.create"],
    edit: ["users.update"],
    delete: ["users.delete"],
  },
  "/configurations/utilisateur/creer": {
    read: ["users.read"],
    create: ["users.create"],
    edit: ["users.update"],
    delete: ["users.delete"],
  },
  "/configurations/utilisateur/roles-permissions": {
    read: ["users.read"],
    create: ["users.create", "users.update"],
    edit: ["users.update"],
    delete: ["users.delete"],
  },
};

const normalizePath = (path = "") => {
  const normalized = typeof path === "string" ? path : "";
  return normalized.length > 1 && normalized.endsWith("/")
    ? normalized.slice(0, -1)
    : normalized || "/dashboard";
};

export const getRouteRequiredPermissions = (path = "") =>
  routePermissionConfig[normalizePath(path)]?.read || [];

export const getRouteActionPermissions = (path = "", action = "read") =>
  routePermissionConfig[normalizePath(path)]?.[action] || [];

export const findRouteByPath = (path) =>
  [...allRouteMeta, ...createRouteMeta].find(
    (item) => item.path === normalizePath(path),
  ) || dashboardMeta;

export const getBreadcrumbItems = (path) => {
  const route = findRouteByPath(path);
  return [{ label: "Accueil", path: "/dashboard" }, ...route.breadcrumbs];
};

const purchaseRequestColumns = [
  column("Code", (row) => row.code || "--"),
  column("Titre", "title"),
  column("Statut", "status", { render: (row) => renderPill(row.status) }),
  column("Boutique", "store.name"),
  column("Demandeur", (row) => formatPerson(row.requestedBy)),
  column("Articles", (row) => formatCount(row.items), {
    className: "text-center",
  }),
  column("Cree le", (row) => formatDate(row.createdAt), { sortBy: "createdAt" }),
];

const purchaseOrderColumns = [
  column("Code", (row) => row.code || "--", { sortBy: "code" }),
  column("Statut", "status", { render: (row) => renderPill(row.status) }),
  column("Fournisseur", "supplier.name"),
  column("Boutique", "store.name"),
  column("Articles", (row) => formatCount(row.items), {
    className: "text-center",
  }),
  column("Date commande", (row) => formatDate(row.orderDate || row.createdAt), {
    sortBy: "orderDate",
  }),
];

const stockEntryColumns = [
  column("Source", "sourceType"),
  column("Statut", "status", { render: (row) => renderPill(row.status) }),
  column("Boutique", "store.name"),
  column("Zone", "storageZone.name"),
  column("Articles", (row) => formatCount(row.items), {
    className: "text-center",
  }),
  column("Cree par", (row) => formatPerson(row.createdBy)),
  column("Cree le", (row) => formatDate(row.createdAt), { sortBy: "createdAt" }),
];

const inventoryMovementColumns = [
  column("Type", "movementType", {
    render: (row) => renderPill(row.movementType),
  }),
  column("Source", (row) => row.sourceType || "--"),
  column("Produit", "product.name"),
  column("Boutique", (row) => row.storageZone?.store?.name || "--"),
  column("Zone", "storageZone.name"),
  column("Quantite", (row) => row.quantity || "0", { sortBy: "quantity" }),
  column("Cree par", (row) => formatPerson(row.createdBy)),
  column("Date", (row) => formatDate(row.createdAt), { sortBy: "createdAt" }),
];

const transferColumns = [
  column("Code", (row) => row.code || "--"),
  column("Statut", "status", { render: (row) => renderPill(row.status) }),
  column("Boutique source", "fromStore.name"),
  column("Boutique cible", "toStore.name"),
  column("Zone source", "fromZone.name"),
  column("Zone cible", "toZone.name"),
  column("Articles", (row) => formatCount(row.items), {
    className: "text-center",
  }),
  column("Date", (row) => formatDate(row.createdAt), { sortBy: "createdAt" }),
];

const deliveryNoteColumns = [
  column("Code", (row) => row.code || "--", { sortBy: "code" }),
  column("Statut", "status", { render: (row) => renderPill(row.status) }),
  column("Fournisseur", "supplier.name"),
  column("Commande", (row) => row.purchaseOrder?.code || "--"),
  column("Articles", (row) => formatCount(row.items), {
    className: "text-center",
  }),
  column("Reception", (row) => formatDate(row.receivedAt || row.createdAt), {
    sortBy: "receivedAt",
  }),
];

const inventoryColumns = [
  column("Produit", "product.name"),
  column("Code", "product.sku"),
  column("Boutique", "store.name"),
  column("Zone", "storageZone.name"),
  column("Lot", (row) => row.batchNumber || "Sans lot", { sortBy: "batchNumber" }),
  column("Expiration", (row) => formatDateOnly(row.expiryDate), { sortBy: "expiryDate" }),
  column("Statut", "expiryStatus", {
    render: (row) => formatExpiryStatus(row.expiryStatus),
  }),
  column("Quantite", (row) => row.quantity || 0, { sortBy: "quantity" }),
  column("Seuil min", (row) => row.minLevel ?? 0),
  column("MAJ", (row) => formatDate(row.updatedAt), { sortBy: "updatedAt" }),
];

const inventoryLotColumns = [
  column("Produit", "product.name"),
  column("Code", "product.sku"),
  column("Boutique", "store.name"),
  column("Zone", "storageZone.name"),
  column("Lot", (row) => row.batchNumber || "Sans lot", { sortBy: "batchNumber" }),
  column("Expiration", (row) => formatDateOnly(row.expiryDate), { sortBy: "expiryDate" }),
  column("Statut", "expiryStatus", {
    render: (row) => formatExpiryStatus(row.expiryStatus),
  }),
  column("Jours restants", (row) => (row.daysToExpiry == null ? "--" : row.daysToExpiry)),
  column("Quantite", (row) => row.quantity || 0, { sortBy: "quantity" }),
  column("Cout unitaire", (row) => formatMoney(row.unitCost), { sortBy: "unitCost" }),
];

const inventorySessionColumns = [
  column("Code", (row) => row.code || "--", { sortBy: "code" }),
  column("Statut", "status", { render: (row) => renderPill(row.status) }),
  column("Boutique", "store.name"),
  column("Zone", "storageZone.name"),
  column("Demandeur", (row) => formatPerson(row.requestedBy)),
  column("Lignes", (row) => row.itemsCount ?? 0, { className: "text-center" }),
  column("Ecarts", (row) => row.discrepancyCount ?? 0, { className: "text-center" }),
  column("Niveaux", (row) => row.approvalsCount ?? 0, { className: "text-center" }),
  column("Cree le", (row) => formatDate(row.createdAt), { sortBy: "createdAt" }),
  column("Cloture le", (row) => formatDate(row.closedAt), { sortBy: "closedAt" }),
];

const orderColumns = [
  column("Statut", "status", { render: (row) => renderPill(row.status) }),
  column("Boutique", "store.name"),
  column("Client", (row) => formatPerson(row.customer)),
  column("Articles", (row) => formatCount(row.items), {
    className: "text-center",
  }),
  column("Total", (row) => formatMoney(row.total, row.currencyCode), { sortBy: "total" }),
  column("Date", (row) => formatDate(row.createdAt), { sortBy: "createdAt" }),
];

const productColumns = [
  column("Image", "imageUrl", { render: renderProductThumbnail }),
  column("Produit", "name"),
  column("SKU", (row) => row.sku || "--", { sortBy: "sku" }),
  column("Code scan", (row) => row.scanCode || "--", { sortBy: "scanCode" }),
  column("Categorie", "category.name"),
  column("Famille", "family.name"),
  column("TVA", (row) => row.tva?.code || row.tva?.name || "--"),
  column("Prix", (row) => formatMoney(row.unitPrice, row.currencyCode), { sortBy: "unitPrice" }),
  column("Seuil min", (row) => row.minLevel ?? "--", { sortBy: "minLevel" }),
  column("Seuil max", (row) => row.maxLevel ?? "--", { sortBy: "maxLevel" }),
  column("Actif", (row) => renderPill(row.isActive ? "ACTIVE" : "INACTIVE")),
];

const cashSessionMovementColumns = [
  {
    key: "type",
    label: "Type",
    render: (row) => renderPill(row.type),
  },
  {
    key: "amount",
    label: "Montant",
    render: (row) => formatMoney(row.amount, row.currencyCode),
  },
  {
    key: "reason",
    label: "Motif",
    render: (row) => row.reason || "--",
  },
  {
    key: "note",
    label: "Note",
    render: (row) => row.note || "--",
  },
  {
    key: "createdByName",
    label: "Cree par",
    render: (row) => row.createdByName || "--",
  },
  {
    key: "createdAt",
    label: "Date",
    render: (row) => formatDate(row.createdAt),
  },
];

const cashSessionColumns = [
  column("Statut", "status", { render: (row) => renderPill(row.status) }),
  column("Boutique", "storeName"),
  column("Caissier", "userName"),
  column("Zone", "storageZoneName"),
  column("Fonds initial", (row) => formatMoney(row.openingFloat, row.currencyCode)),
  column("Ventes cash", (row) => formatMoney(row.totalCashSales, row.currencyCode)),
  column("Ventes non cash", (row) => formatMoney(row.totalNonCashSales, row.currencyCode)),
  column("Cash theorique", (row) => formatMoney(row.expectedCash, row.currencyCode)),
  column("Cash compte", (row) =>
    row.closingCounted == null ? "--" : formatMoney(row.closingCounted, row.currencyCode)),
  column("Ecart", (row) =>
    row.variance == null ? "--" : formatMoney(row.variance, row.currencyCode)),
  column("Ouverte le", (row) => formatDate(row.openedAt), { sortBy: "openedAt" }),
  column("Cloturee le", (row) => formatDate(row.closedAt || row.updatedAt), {
    sortBy: "closedAt",
  }),
];

const articleColumns = [
  column("Image", "imageUrl", { render: renderProductThumbnail }),
  column("Reference", (row) => row.sku || row.id),
  column("Libelle", "name"),
  column("Description", (row) => row.description || "--"),
  column("Categorie", "category.name"),
  column("Famille", "family.name"),
  column("TVA", (row) => row.tva?.code || row.tva?.name || "--"),
  column("Prix vente", (row) => formatMoney(row.unitPrice, row.currencyCode), { sortBy: "unitPrice" }),
  column("Seuil min", (row) => row.minLevel ?? "--", { sortBy: "minLevel" }),
  column("Seuil max", (row) => row.maxLevel ?? "--", { sortBy: "maxLevel" }),
  column("Actif", (row) => renderPill(row.isActive ? "ACTIVE" : "INACTIVE")),
];

const technicalColumns = [
  column("Article", "name"),
  column("Reference", (row) => row.sku || "--", { sortBy: "sku" }),
  column("Composants", (row) => formatCount(row.components), {
    className: "text-center",
  }),
  column(
    "Composition",
    (row) =>
      Array.isArray(row.components) && row.components.length
        ? row.components
            .slice(0, 3)
            .map((item) => item.componentProduct?.name || item.componentName || "--")
            .join(", ")
        : "--",
  ),
  column("Maj", (row) => formatDate(row.updatedAt), { sortBy: "updatedAt" }),
];

const currencyColumns = [
  column("Code", "code", { sortBy: "code" }),
  column("Nom", "name", { sortBy: "name" }),
  column("Symbole", (row) => row.symbol || "--", { sortBy: "symbol" }),
  column("En cours", (row) => renderPill(row.isCurrent ? "ACTIVE" : "INACTIVE"), {
    sortBy: "isCurrent",
  }),
  column(
    "Secondaire",
    (row) => (row.isSecondary ? renderPill("ACTIVE") : "--"),
    { sortBy: "isSecondary" },
  ),
  column("Actif", (row) => renderPill(row.isActive ? "ACTIVE" : "INACTIVE"), {
    sortBy: "isActive",
  }),
  column("Conversions", (row) => row.conversionCount || 0, {
    sortBy: "conversionCount",
    className: "text-center",
  }),
];

const currencyConversionLabel = (row) =>
  row?.code && row?.name ? `${row.code} - ${row.name}` : row?.code || row?.name || "--";

const conversionColumns = [
  column("Devise depart", "fromCurrencyCode", { sortBy: "fromCurrencyCode" }),
  column("Devise cible", "toCurrencyCode", { sortBy: "toCurrencyCode" }),
  column("Taux", (row) => (row.rate ? Number(row.rate).toFixed(6) : "--"), {
    sortBy: "rate",
  }),
  column("Creation", (row) => formatDate(row.createdAt), { sortBy: "createdAt" }),
];

const customerBonusProgramColumns = [
  column("Nom", "name", { sortBy: "name" }),
  column("Montant seuil", "amountThreshold", { sortBy: "amountThreshold" }),
  column("Points gagnes", "pointsAwarded", { sortBy: "pointsAwarded" }),
  column("Valeur d'un point", "pointValueAmount", { sortBy: "pointValueAmount" }),
  column("Quota points", (row) => row.quotaPoints ?? "--", { sortBy: "quotaPoints" }),
  column("Periode (jours)", (row) => row.quotaPeriodDays ?? "--", {
    sortBy: "quotaPeriodDays",
  }),
  column("Prime montant", (row) => row.quotaRewardAmount ?? "--"),
  column("Actif", (row) => renderPill(row.isActive ? "ACTIVE" : "INACTIVE"), {
    sortBy: "isActive",
  }),
];

const familyColumns = [
  column("Nom", "name"),
  column("Categorie", (row) => row.category?.name || "--"),
  column("Cree le", (row) => formatDate(row.createdAt), { sortBy: "createdAt" }),
];

const collectionColumns = [
  column("Nom", "name"),
  column("Cree le", (row) => formatDate(row.createdAt), { sortBy: "createdAt" }),
];

const subFamilyColumns = [
  column("Nom", "name"),
  column("Famille parente", (row) => row.parentFamily?.name || "--"),
  column("Cree le", (row) => formatDate(row.createdAt), { sortBy: "createdAt" }),
];

const unitColumns = [
  column("Nom", "name"),
  column("Type", "businessType", {
    render: (row) => renderPill(row.businessType || row.type),
  }),
  column("Symbole", (row) => row.symbol || "--", { sortBy: "symbol" }),
  column("Cree le", (row) => formatDate(row.createdAt), { sortBy: "createdAt" }),
];

const storeColumns = [
  column("Nom", "name"),
  column("Code", (row) => row.code || "--", { sortBy: "code" }),
  column("Commune", (row) => row.commune || "--"),
  column("Ville", (row) => row.city || "--"),
  column("Pays", (row) => row.country || "--"),
  column("Creation", (row) => formatDate(row.createdAt), { sortBy: "createdAt" }),
];

const zoneColumns = [
  column("Nom", "name"),
  column("Code", (row) => row.code || "--", { sortBy: "code" }),
  column("Type", "zoneType", {
    render: (row) => renderPill(row.zoneType || "STANDARD"),
  }),
  column("Boutique", "store.name"),
  column("Creation", (row) => formatDate(row.createdAt), { sortBy: "createdAt" }),
];

const flowColumns = [
  column("Code", "code"),
  column("Nom", "name"),
  column("Etapes", (row) => formatCount(row.steps), {
    className: "text-center",
  }),
  column("Creation", (row) => formatDate(row.createdAt), { sortBy: "createdAt" }),
];

const userColumns = [
  column("Nom", (row) => formatPerson(row)),
  column("Role", "role", { render: (row) => renderPill(row.role) }),
  column("Email", (row) => row.email || "--"),
  column("Telephone", (row) => row.phone || "--"),
  column("Boutique", (row) => row.store?.name || row.storeName || "--"),
  column("Profil permissions", (row) => row.permissionProfile?.name || row.permissionProfileName || "--"),
  column("Actif", (row) => renderPill(row.isActive ? "ACTIVE" : "INACTIVE")),
];

const permissionProfileColumns = [
  column("Nom", "name"),
  column("Role", "role", { render: (row) => renderPill(row.role) }),
  column("Description", (row) => row.description || "--"),
  column("Permissions", (row) => row.permissionCount || 0, {
    className: "text-center",
  }),
  column("Utilisateurs", (row) => row.userCount || 0, {
    className: "text-center",
  }),
  column("Creation", (row) => formatDate(row.createdAt), { sortBy: "createdAt" }),
];

const approvalActions = (resourcePath) => [
  {
    id: `${resourcePath}-approve`,
    label: "Valider",
    method: "POST",
    endpoint: (row) => `${resourcePath}/${row.id}/approve`,
    visible: (row) => ["DRAFT", "SUBMITTED"].includes(row.status),
    tone: "success",
  },
  {
    id: `${resourcePath}-reject`,
    label: "Rejeter",
    method: "POST",
    endpoint: (row) => `${resourcePath}/${row.id}/reject`,
    visible: (row) => ["DRAFT", "SUBMITTED"].includes(row.status),
    tone: "danger",
  },
];

const stockEntryRowActions = [
  {
    id: "stock-entry-approve",
    label: "Valider",
    method: "POST",
    endpoint: (row) => `/api/stock-entries/${row.id}/approve`,
    visible: (row) => row.sourceType === "DIRECT" && row.status === "PENDING",
    tone: "success",
  },
  {
    id: "stock-entry-post",
    label: "Poster",
    method: "POST",
    endpoint: (row) => `/api/stock-entries/${row.id}/post`,
    visible: (row) => row.status === "APPROVED",
    tone: "primary",
  },
];

const currencyRowActions = [
  {
    id: "currency-set-current",
    label: "Definir en cours",
    method: "POST",
    endpoint: (row) => `/api/currency-settings/${row.id}/set-current`,
    visible: (row) => !row.isCurrent && row.isActive,
    tone: "success",
  },
  {
    id: "currency-set-secondary",
    label: "Definir secondaire",
    method: "POST",
    endpoint: (row) => `/api/currency-settings/${row.id}/set-secondary`,
    visible: (row) => !row.isCurrent && !row.isSecondary && row.isActive,
    tone: "primary",
  },
  {
    id: "currency-unset-secondary",
    label: "Retirer secondaire",
    method: "POST",
    endpoint: (row) => `/api/currency-settings/${row.id}/unset-secondary`,
    visible: (row) => row.isSecondary,
    tone: "danger",
  },
];

const customerBonusProgramRowActions = [
  {
    id: "bonus-program-set-current",
    label: "Definir actif",
    method: "POST",
    endpoint: (row) => `/api/customer-bonus-programs/${row.id}/set-current`,
    visible: (row) => !row.isActive,
    tone: "success",
  },
];

const productRowActions = [
  {
    id: "product-reactivate",
    label: "Reactiver",
    method: "PATCH",
    endpoint: (row) => `/api/products/${row.id}`,
    body: () => ({ isActive: true }),
    visible: (row) => row?.isActive === false,
    tone: "success",
  },
];

export const resourceCatalog = {
  "/commande/demande-achat": createResource({
    endpoint: "/api/purchase-requests",
    columns: purchaseRequestColumns,
    rowActions: [],
    tableTitle: "Demandes d'achat",
    tableDescription:
      "Demandes d'achat emises par les boutiques et services.",
    emptyMessage: "Aucune demande d'achat enregistree.",
  }),
  "/commande/requisitions": createResource({
    endpoint: "/api/supply-requests",
    columns: purchaseRequestColumns,
    rowActions: [],
    tableTitle: "Requisitions",
    tableDescription: "Demandes internes de stock et d'approvisionnement.",
    emptyMessage: "Aucune requisition disponible.",
  }),
  "/commande/commande": createResource({
    endpoint: "/api/purchase-orders",
    defaultQuery: { status: "DRAFT" },
    columns: purchaseOrderColumns,
    rowActions: [],
    tableTitle: "Commandes en preparation",
    tableDescription:
      "Commandes fournisseur en cours de construction ou validation.",
    emptyMessage: "Aucune commande en brouillon.",
  }),
  "/commande/liste-commande": createResource({
    endpoint: "/api/purchase-orders",
    columns: purchaseOrderColumns,
    rowActions: [],
    tableTitle: "Liste de commande",
    tableDescription: "Journal complet des commandes fournisseur.",
    emptyMessage: "Aucune commande disponible.",
  }),
  "/mouvement/entree-stock": createResource({
    endpoint: "/api/stock-entries",
    columns: stockEntryColumns,
    rowActions: [],
    tableTitle: "Entrees de stock",
    tableDescription:
      "Receptions et integrations au stock central et boutique.",
    emptyMessage: "Aucune entree de stock trouvee.",
  }),
  "/mouvement/sortie-stock": createResource({
    endpoint: "/api/inventory-movements",
    defaultQuery: { movementType: "OUT" },
    columns: inventoryMovementColumns,
    tableTitle: "Sorties de stock",
    tableDescription: "Mouvements de sortie identifies dans l'inventaire.",
    emptyMessage: "Aucune sortie de stock tracee.",
  }),
  "/mouvement/retour-stock": createResource({
    endpoint: "/api/inventory-movements",
    defaultQuery: { movementType: "ADJUSTMENT" },
    columns: inventoryMovementColumns,
    tableTitle: "Retours de stock",
    tableDescription:
      "Ajustements et retours internes reperes dans l'inventaire.",
    emptyMessage: "Aucun retour de stock disponible.",
  }),
  "/mouvement/transfert": createResource({
    endpoint: "/api/transfers",
    columns: transferColumns,
    rowActions: [
      {
        id: "transfer-complete",
        label: "Soumettre / Finaliser",
        method: "POST",
        endpoint: (row) => `/api/transfers/${row.id}/complete`,
        visible: (row) => row.status !== "COMPLETED" && row.status !== "CANCELED",
        tone: "primary",
      },
    ],
    tableTitle: "Transferts",
    tableDescription: "Transferts inter-boutiques et inter-zones.",
    emptyMessage: "Aucun transfert enregistre.",
  }),
  "/mouvement/retour-fournisseur": createResource({
    endpoint: "/api/supplier-returns",
    columns: [
      column("Reference", (row) => row.code || row.reference || "--"),
      column("Fournisseur", "supplier.name"),
      column("Zone", "storageZone.name"),
      column("Statut", "status", { render: (row) => renderPill(row.status) }),
      column("Date", (row) => formatDate(row.createdAt)),
    ],
    tableTitle: "Retours fournisseur",
    tableDescription: "Retours de produits vers les fournisseurs avec workflow de validation.",
    emptyMessage: "Aucun retour fournisseur disponible pour le moment.",
  }),
  "/mouvement/historique-mouvements": createResource({
    endpoint: "/api/inventory-movements",
    columns: inventoryMovementColumns,
    tableTitle: "Historique de mouvements",
    tableDescription:
      "Historique des mouvements d'inventaire remontes par le serveur.",
    emptyMessage: "Aucun mouvement d'inventaire trace.",
  }),
  "/mouvement/historique-caisse": createResource({
    endpoint: "/api/cash-sessions",
    columns: cashSessionColumns,
    tableTitle: "Historique caisse",
    tableDescription:
      "Historique des ouvertures, clotures et ecarts des sessions de caisse.",
    emptyMessage: "Aucune session de caisse disponible.",
  }),
  "/etat-stock": createResource({
    endpoint: "/api/inventory",
    defaultQuery: { detailed: "true" },
    columns: inventoryColumns,
    tableTitle: "Etat de stock",
    tableDescription:
      "Niveaux de stock actuels par lot, date d'expiration, boutique et zone.",
    emptyMessage: "Aucune ligne d'inventaire disponible.",
  }),
  "/lots-peremptions": createResource({
    endpoint: "/api/inventory",
    defaultQuery: { detailed: "true" },
    columns: inventoryLotColumns,
    tableTitle: "Lots / Peremptions",
    tableDescription:
      "Vue dediee des lots, dates d'expiration et alertes sur les peremptions.",
    emptyMessage: "Aucun lot disponible.",
    exportFileBaseName: "lots-peremptions",
  }),
  "/etat-consommation": createResource({
    endpoint: "/api/orders",
    defaultQuery: { status: "PAID" },
    columns: orderColumns,
    tableTitle: "Etat de consommation",
    tableDescription: "Lecture des ventes payees comme signal de consommation.",
    emptyMessage: "Aucune vente payee disponible.",
  }),
  "/inventaire/inventaire": createResource({
    endpoint: "/api/inventory/sessions",
    columns: inventorySessionColumns,
    tableTitle: "Inventaire",
    tableDescription:
      "Sessions d'inventaire avec snapshot theorique, comptage physique et workflow de validation.",
    emptyMessage: "Aucune session d'inventaire disponible.",
  }),
  "/inventaire/etat-inventaire": createResource({
    endpoint: "/api/inventory/sessions",
    defaultQuery: { status: "CLOSED" },
    columns: inventorySessionColumns,
    tableTitle: "Etat d'inventaire",
    tableDescription:
      "Inventaires clotures avec ecarts constates et historique des validations.",
    emptyMessage: "Aucun inventaire cloture disponible.",
  }),
  "/configurations/articles/produits": createResource({
    endpoint: "/api/products",
    defaultQuery: { kind: "COMPONENT" },
    columns: productColumns,
    rowActions: productRowActions,
    tableTitle: "Produits",
    tableDescription: "Catalogue des produits composants geres en stock.",
    emptyMessage: "Aucun produit composant disponible.",
    importConfig: {
      templatePath: "/api/products/template?kind=COMPONENT",
      importPath: "/api/products/import?kind=COMPONENT",
      templateFileName: "template-produits.xlsx",
      modalTitle: "Importer des produits",
      modalDescription:
        "Telechargez le template, completez vos produits composants, puis deposez le fichier XLSX ici.",
      templateButtonLabel: "Template produits",
      importButtonLabel: "Importer les produits",
      importSuccessMessage: "Les produits ont ete importes avec succes.",
    },
  }),
  "/configurations/articles/articles": createResource({
    endpoint: "/api/products",
    defaultQuery: { kind: "ARTICLE" },
    columns: articleColumns,
    rowActions: productRowActions,
    tableTitle: "Articles",
    tableDescription: "Referentiel des articles vendus aux clients.",
    emptyMessage: "Aucun article disponible.",
    importConfig: {
      templatePath: "/api/products/template?kind=ARTICLE",
      importPath: "/api/products/import?kind=ARTICLE",
      templateFileName: "template-articles.xlsx",
      modalTitle: "Importer des articles",
      modalDescription:
        "Telechargez le template, renseignez vos articles de vente, puis deposez le fichier XLSX ici.",
      templateButtonLabel: "Template articles",
      importButtonLabel: "Importer les articles",
      importSuccessMessage: "Les articles ont ete importes avec succes.",
    },
    extraImportConfigs: [
      {
        templatePath: "/api/products/technical-sheets/template",
        importPath: "/api/products/technical-sheets/import",
        templateFileName: "template-fiches-techniques.xlsx",
        modalTitle: "Importer des fiches techniques",
        modalDescription:
          "Telechargez le template, renseignez article et composants, puis importez le fichier XLSX.",
        templateButtonLabel: "Template fiche technique",
        importButtonLabel: "Importer fiche technique",
        importSuccessMessage: "Les fiches techniques ont ete importees avec succes.",
        selectionConfig: {
          fieldName: "articleId",
          name: "articleId",
          label: "Article",
          placeholder: "Rechercher un article...",
          endpoint: "/api/products",
          query: { kind: "ARTICLE" },
          required: true,
          mapOptionLabel: (row) =>
            row?.sku ? `${row.name} (${row.sku})` : row?.name || row?.id,
        },
      },
    ],
  }),
  "/configurations/articles/collections": createResource({
    endpoint: "/api/product-collections",
    columns: collectionColumns,
    tableTitle: "Collections",
    tableDescription: "Collections principales auxquelles sont rattachees les categories.",
    emptyMessage: "Aucune collection disponible.",
    importConfig: {
      templatePath: "/api/product-collections/template",
      importPath: "/api/product-collections/import",
      templateFileName: "template-collections.xlsx",
      modalTitle: "Importer des collections",
      modalDescription:
        "Telechargez le template, completez vos collections, puis deposez le fichier XLSX ici.",
      templateButtonLabel: "Template collections",
      importButtonLabel: "Importer les collections",
      importSuccessMessage: "Les collections ont ete importees avec succes.",
    },
  }),
  "/configurations/articles/familles": createResource({
    endpoint: "/api/product-families",
    columns: familyColumns,
    tableTitle: "Familles",
    tableDescription: "Familles d'articles definies dans le tenant.",
    emptyMessage: "Aucune famille disponible.",
    importConfig: {
      templatePath: "/api/product-families/template",
      importPath: "/api/product-families/import",
      templateFileName: "template-familles.xlsx",
      modalTitle: "Importer des familles",
      modalDescription:
        "Telechargez le template, completez vos familles, puis deposez le fichier XLSX ici.",
      templateButtonLabel: "Template familles",
      importButtonLabel: "Importer les familles",
      importSuccessMessage: "Les familles ont ete importees avec succes.",
    },
  }),
  "/configurations/articles/sous-familles": createResource({
    endpoint: "/api/product-subfamilies",
    columns: subFamilyColumns,
    tableTitle: "Sous-familles",
    tableDescription: "Sous-familles d'articles separees des familles principales.",
    emptyMessage: "Aucune sous-famille disponible.",
    importConfig: {
      templatePath: "/api/product-subfamilies/template",
      importPath: "/api/product-subfamilies/import",
      templateFileName: "template-sous-familles.xlsx",
      modalTitle: "Importer des sous-familles",
      modalDescription:
        "Telechargez le template, completez vos sous-familles, puis deposez le fichier XLSX ici.",
      templateButtonLabel: "Template sous-familles",
      importButtonLabel: "Importer les sous-familles",
      importSuccessMessage: "Les sous-familles ont ete importees avec succes.",
    },
  }),
  "/configurations/articles/fiche-technique": createResource({
    endpoint: "/api/products",
    defaultQuery: { kind: "ARTICLE", includeComponents: true, isActive: true },
    columns: technicalColumns,
    tableTitle: "Fiches techniques",
    tableDescription: "Composition des articles de vente a partir des produits composants.",
    emptyMessage: "Aucune fiche technique disponible.",
    importConfig: {
      templatePath: "/api/products/technical-sheets/template",
      importPath: "/api/products/technical-sheets/import",
      templateFileName: "template-fiches-techniques.xlsx",
      modalTitle: "Importer des fiches techniques",
      modalDescription:
        "Telechargez le template, renseignez article et composants, puis importez le fichier XLSX.",
      templateButtonLabel: "Template fiches techniques",
      importButtonLabel: "Importer les fiches techniques",
      importSuccessMessage: "Les fiches techniques ont ete importees avec succes.",
      selectionConfig: {
        fieldName: "articleId",
        name: "articleId",
        label: "Article",
        placeholder: "Rechercher un article...",
        endpoint: "/api/products",
        query: { kind: "ARTICLE" },
        required: true,
        mapOptionLabel: (row) =>
          row?.sku ? `${row.name} (${row.sku})` : row?.name || row?.id,
      },
    },
  }),
  "/configurations/articles/categorie": createResource({
    endpoint: "/api/product-categories",
    columns: [
      column("Nom", "name"),
      column("Collection", (row) => row.collection?.name || "--"),
      column("Cree le", (row) => formatDate(row.createdAt), { sortBy: "createdAt" }),
    ],
    tableTitle: "Categories",
    tableDescription: "Categories produits definies dans le tenant.",
    emptyMessage: "Aucune categorie disponible.",
    importConfig: {
      templatePath: "/api/product-categories/template",
      importPath: "/api/product-categories/import",
      templateFileName: "template-categories.xlsx",
      modalTitle: "Importer des categories",
      modalDescription:
        "Telechargez le template, completez vos categories, puis deposez le fichier XLSX ici.",
      templateButtonLabel: "Template categories",
      importButtonLabel: "Importer les categories",
      importSuccessMessage: "Les categories ont ete importees avec succes.",
    },
  }),
  "/configurations/parametres/unite": createResource({
    endpoint: "/api/units",
    columns: unitColumns,
    tableTitle: "Unites",
    tableDescription: "Unites de mesure, vente et stockage.",
    emptyMessage: "Aucune unite disponible.",
    importConfig: {
      templatePath: "/api/units/template",
      importPath: "/api/units/import",
      templateFileName: "template-unites.xlsx",
      modalTitle: "Importer des unites",
      modalDescription:
        "Telechargez le template, completez vos unites, puis deposez le fichier XLSX ici.",
      templateButtonLabel: "Template unites",
      importButtonLabel: "Importer les unites",
      importSuccessMessage: "Les unites ont ete importees avec succes.",
    },
  }),
  "/configurations/parametres/tva": createResource({
    endpoint: "/api/tax-rates",
    columns: [
      column("Code", "code", { sortBy: "code" }),
      column("Nom", (row) => row.name || "--", { sortBy: "name" }),
      column("Taux", "rate", { sortBy: "rate" }),
      column("Statut", "status", { render: (row) => renderPill(row.status), sortBy: "isActive" }),
    ],
    tableTitle: "TVA",
    tableDescription: "Taux TVA disponibles pour les articles et produits.",
    emptyMessage: "Aucune TVA configuree.",
  }),
  "/configurations/parametres/devise": createResource({
    endpoint: "/api/currency-settings",
    columns: currencyColumns,
    rowActions: currencyRowActions,
    tableTitle: "Devises",
    tableDescription:
      "Catalogue des devises, gestion des conversions et selection de la devise en cours.",
    emptyMessage: "Aucune devise configuree.",
  }),
  "/configurations/parametres/conversions-devise": createResource({
    endpoint: "/api/currency-settings/conversions",
    columns: conversionColumns,
    tableTitle: "Conversions devise",
    tableDescription:
      "Paires de conversion definies entre devises configurees dans le tenant.",
    emptyMessage: "Aucune conversion de devise configuree.",
  }),
  "/configurations/parametres/bonus-client": createResource({
    endpoint: "/api/customer-bonus-programs",
    columns: customerBonusProgramColumns,
    rowActions: customerBonusProgramRowActions,
    tableTitle: "Bonus client",
    tableDescription:
      "Parametres d'attribution des points bonus, equivalence montant et quota par periode.",
    emptyMessage: "Aucun programme bonus client configure.",
  }),
  "/configurations/parametres/locale-vente": createResource({
    endpoint: "/api/stores",
    columns: storeColumns,
    tableTitle: "Locales de vente",
    tableDescription: "Boutiques et points de vente connus du tenant.",
    emptyMessage: "Aucune boutique disponible.",
  }),
  "/configurations/parametres/zone-stockage": createResource({
    endpoint: "/api/storage-zones",
    columns: zoneColumns,
    tableTitle: "Zones de stockage",
    tableDescription: "Zones et emplacements de stockage par boutique.",
    emptyMessage: "Aucune zone de stockage disponible.",
  }),
  "/configurations/parametres/niveau-validation": createResource({
    endpoint: "/api/approval-flows",
    columns: flowColumns,
    tableTitle: "Niveaux de validation",
    tableDescription: "Circuits de validation definis pour les workflows.",
    emptyMessage: "Aucun flow de validation disponible.",
  }),
  "/configurations/utilisateur/liste-utilisateurs": createResource({
    endpoint: "/api/users",
    columns: userColumns,
    tableTitle: "Liste d'utilisateurs",
    tableDescription: "Comptes utilisateur actuellement enregistres.",
    emptyMessage: "Aucun utilisateur disponible.",
    importConfig: {
      templatePath: "/api/users/template",
      importPath: "/api/users/import",
      templateFileName: "template-utilisateurs.xlsx",
      modalTitle: "Importer des utilisateurs",
      modalDescription:
        "Telechargez le template, completez vos utilisateurs, puis deposez le fichier XLSX ici.",
      templateButtonLabel: "Template utilisateurs",
      importButtonLabel: "Importer les utilisateurs",
      importSuccessMessage: "Les utilisateurs ont ete importes avec succes.",
    },
  }),
  "/configurations/utilisateur/creer": createResource({
    endpoint: "/api/users",
    columns: userColumns,
    tableTitle: "Preparation creation utilisateur",
    tableDescription:
      "Vue des utilisateurs existants avant creation de nouveaux comptes.",
    emptyMessage: "Aucun utilisateur disponible.",
  }),
  "/configurations/utilisateur/roles-permissions": createResource({
    endpoint: "/api/permission-profiles",
    columns: permissionProfileColumns,
    tableTitle: "Roles et permissions",
    tableDescription:
      "Profils nommes de permissions avec matrice CRUD par module.",
    emptyMessage: "Aucun profil de permissions disponible.",
  }),
};

const sourceOptions = [
  { value: "DIRECT", label: "Direct" },
  { value: "PURCHASE_ORDER", label: "Commande fournisseur" },
  { value: "TRANSFER", label: "Transfert" },
];

const unitTypeOptions = [
  { value: "GESTION", label: "Unite de gestion" },
  { value: "DOSAGE", label: "Dosage" },
];

const zoneTypeOptions = [
  { value: "WAREHOUSE", label: "Depot" },
  { value: "STORE", label: "Boutique" },
  { value: "COUNTER", label: "Comptoir" },
];

const userRoleOptions = [
  { value: "SUPERADMIN", label: "Superadmin" },
  { value: "ADMIN", label: "Admin" },
  { value: "USER", label: "Utilisateur" },
];

const permissionProfileRoleOptions = [
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "USER", label: "Utilisateur" },
];

const sendViaOptions = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
];

const permissionsToMatrix = (permissions = []) =>
  (Array.isArray(permissions) ? permissions : []).reduce(
    (accumulator, code) => ({
      ...accumulator,
      [code]: true,
    }),
    {},
  );

const matrixToPermissions = (matrix = {}) =>
  Object.entries(matrix || {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([code]) => code);

const productLabel = (item) =>
  [item?.name, item?.sku ? `(${item.sku})` : null].filter(Boolean).join(" ");

const unitLabel = (item) =>
  [item?.name, item?.symbol ? `(${item.symbol})` : null].filter(Boolean).join(" ");

const zoneLabel = (item) =>
  [item?.name, item?.store?.name ? `- ${item.store.name}` : null]
    .filter(Boolean)
    .join(" ");

const productLineFields = (extraFields = [], options = {}) => [
  {
    name: "productId",
    label: "Produit",
    type: "search-select",
    required: true,
    optionsEndpoint: "/api/products",
    ...(options.query ? { query: options.query } : {}),
    optionValue: "id",
    optionLabel: productLabel,
    placeholder: "Rechercher un produit...",
  },
  {
    name: "unitId",
    label: "Unite",
    type: "search-select",
    required: true,
    optionsEndpoint: "/api/units",
    optionValue: "id",
    optionLabel: unitLabel,
    placeholder: "Rechercher une unite...",
  },
  {
    name: "quantity",
    label: "Quantite",
    type: "number",
    required: true,
    min: "0.01",
    step: "0.01",
  },
  ...extraFields,
];

const inventoryLineFields = (options = {}) => [
  {
    name: "productId",
    label: "Produit",
    type: "search-select",
    required: true,
    optionsEndpoint: "/api/products",
    ...(options.query ? { query: options.query } : {}),
    optionValue: "id",
    optionLabel: productLabel,
    placeholder: "Rechercher un produit...",
  },
  {
    name: "quantity",
    label: "Quantite",
    type: "number",
    required: true,
    min: "0.01",
    step: "0.01",
  },
  {
    name: "note",
    label: "Note ligne",
    type: "text",
    placeholder: "Optionnel",
  },
];

const componentProductQuery = { kind: "COMPONENT" };
const componentProductLineFields = (extraFields = []) =>
  productLineFields(extraFields, { query: componentProductQuery });
const componentInventoryLineFields = () =>
  inventoryLineFields({ query: componentProductQuery });

const buildDocumentItems = (items, extras) =>
  mapItems(items, (item) => {
    const quantity = numericValue(item.quantity);
    if (!item.productId || quantity === undefined) return null;

    return {
      productId: item.productId,
      unitId: compactValue(item.unitId),
      quantity,
      ...extras(item),
    };
  });

const buildInventoryAdjustmentRequests = (values, mode) =>
  mapItems(values.items, (item) => {
    const quantity = numericValue(item.quantity);
    if (!values.storageZoneId || !item.productId || quantity === undefined) return null;

    return {
      endpoint: "/api/inventory/adjust",
      method: "POST",
      body: {
        storageZoneId: values.storageZoneId,
        productId: item.productId,
        quantity,
        mode,
        note: compactValue(item.note || values.note),
      },
    };
  });

const purchaseRequestForm = {
  title: "Nouvelle demande d'achat",
  description: "Prepare une demande d'achat avec plusieurs lignes produits.",
  endpoint: "/api/purchase-requests",
  submitLabel: "Creer la demande",
  successMessage: "Demande d'achat creee.",
  fields: [
    {
      name: "code",
      label: "Code demande",
      type: "text",
      placeholder: "Genere automatiquement",
      disabled: true,
      description: "Code genere automatiquement au format DA0001.",
    },
    {
      name: "title",
      label: "Titre",
      type: "text",
      required: true,
      placeholder: "Ex. Reassort antibiotiques",
    },
    {
      name: "storeId",
      label: "Boutique",
      type: "search-select",
      optionsEndpoint: "/api/stores",
      optionValue: "id",
      optionLabel: "name",
      placeholder: "Rechercher une boutique...",
    },
    {
      name: "note",
      label: "Note",
      type: "textarea",
      placeholder: "Informations complementaires",
    },
  ],
  repeaters: [
    {
      name: "items",
      label: "Lignes de demande",
      addLabel: "Ajouter une ligne",
      minRows: 1,
      fields: productLineFields([
        {
          name: "note",
          label: "Note ligne",
          type: "text",
          placeholder: "Optionnel",
        },
      ]),
    },
  ],
  buildRequest: (values) => ({
    endpoint: "/api/purchase-requests",
    method: "POST",
    body: {
      title: values.title,
      storeId: compactValue(values.storeId),
      note: compactValue(values.note),
      items: buildDocumentItems(values.items, (item) => ({
        note: compactValue(item.note),
      })),
    },
  }),
};

const supplyRequestForm = {
  title: "Nouvelle requisition",
  description: "Cree une requisition de stock destinee a une boutique.",
  endpoint: "/api/supply-requests",
  submitLabel: "Creer la requisition",
  successMessage: "Requisition creee.",
  fields: [
    {
      name: "code",
      label: "Code requisition",
      type: "text",
      placeholder: "Genere automatiquement",
      disabled: true,
      description: "Code genere automatiquement au format REQ0001.",
    },
    {
      name: "title",
      label: "Titre",
      type: "text",
      required: true,
      placeholder: "Ex. Requisition mensuelle",
    },
    {
      name: "storeId",
      label: "Boutique",
      type: "search-select",
      optionsEndpoint: "/api/stores",
      optionValue: "id",
      optionLabel: "name",
      placeholder: "Rechercher une boutique...",
    },
    {
      name: "storageZoneId",
      label: "Zone cible",
      type: "search-select",
      optionsEndpoint: "/api/storage-zones",
      optionValue: "id",
      optionLabel: zoneLabel,
      placeholder: "Rechercher une zone cible...",
    },
    {
      name: "note",
      label: "Note",
      type: "textarea",
      placeholder: "Informations complementaires",
    },
  ],
  repeaters: [
    {
      name: "items",
      label: "Produits demandes",
      addLabel: "Ajouter un produit",
      minRows: 1,
      fields: productLineFields([
        {
          name: "note",
          label: "Note ligne",
          type: "text",
          placeholder: "Optionnel",
        },
      ]),
    },
  ],
  buildRequest: (values) => ({
    endpoint: "/api/supply-requests",
    method: "POST",
    body: {
      title: values.title,
      storeId: compactValue(values.storeId),
      storageZoneId: compactValue(values.storageZoneId),
      note: compactValue(values.note),
      items: buildDocumentItems(values.items, (item) => ({
        note: compactValue(item.note),
      })),
    },
  }),
};

const purchaseOrderForm = {
  title: "Nouvelle commande fournisseur",
  description: "Construit une commande d'achat liee a un fournisseur.",
  endpoint: "/api/purchase-orders",
  submitLabel: "Creer la commande",
  successMessage: "Commande creee.",
  fields: [
    {
      name: "storeId",
      label: "Boutique",
      type: "search-select",
      optionsEndpoint: "/api/stores",
      optionValue: "id",
      optionLabel: "name",
      placeholder: "Rechercher une boutique...",
    },
    {
      name: "supplierId",
      label: "Fournisseur",
      type: "search-select",
      required: true,
      optionsEndpoint: "/api/suppliers",
      optionValue: "id",
      optionLabel: "name",
      placeholder: "Rechercher un fournisseur...",
    },
    {
      name: "purchaseRequestId",
      label: "Demande d'achat source",
      type: "search-select",
      optionsEndpoint: "/api/purchase-requests",
      query: { status: "APPROVED" },
      optionValue: "id",
      optionLabel: (item) =>
        item?.code ? `${item.code} - ${item.title || "--"}` : item?.title || "--",
      placeholder: "Rechercher une demande validee...",
    },
    {
      name: "code",
      label: "Code commande",
      type: "text",
      placeholder: "Genere automatiquement",
      disabled: true,
      description: "Code genere automatiquement au format CMD0001.",
    },
    {
      name: "orderDate",
      label: "Date commande",
      type: "date",
    },
    {
      name: "expectedDate",
      label: "Date attendue",
      type: "date",
    },
    {
      name: "note",
      label: "Note",
      type: "textarea",
      placeholder: "Instructions fournisseur",
    },
  ],
  repeaters: [
    {
      name: "items",
      label: "Produits commandes",
      addLabel: "Ajouter un produit",
      minRows: 1,
      fields: componentProductLineFields([
        {
          name: "unitPrice",
          label: "Prix unitaire",
          type: "number",
          required: true,
          min: "0",
          step: "0.01",
        },
      ]),
    },
  ],
  buildRequest: (values) => ({
    endpoint: "/api/purchase-orders",
    method: "POST",
    body: {
      storeId: compactValue(values.storeId),
      supplierId: values.supplierId,
      purchaseRequestId: compactValue(values.purchaseRequestId),
      code: compactValue(values.code),
      orderDate: compactValue(values.orderDate),
      expectedDate: compactValue(values.expectedDate),
      note: compactValue(values.note),
      items: buildDocumentItems(values.items, (item) => ({
        unitPrice: numericValue(item.unitPrice) ?? 0,
      })),
    },
  }),
};

const stockEntryForm = {
  title: "Nouvelle entree de stock",
  description: "Enregistre une reception ou une integration manuelle de stock.",
  endpoint: "/api/stock-entries",
  submitLabel: "Creer l'entree",
  successMessage: "Entree de stock creee.",
  fields: [
    {
      name: "sourceType",
      label: "Source",
      type: "select",
      required: true,
      options: [
        { value: "PURCHASE_ORDER", label: "Commande validee" },
        { value: "DIRECT", label: "Entree directe" },
      ],
      initialValue: "PURCHASE_ORDER",
    },
    {
      name: "sourceId",
      label: "Commande source",
      type: "search-select",
      optionsEndpoint: "/api/purchase-orders",
      query: { status: "SENT" },
      optionValue: "id",
      optionLabel: (item) => item.code || item.id,
      placeholder: "Rechercher une commande validee...",
    },
    {
      name: "receiptNumber",
      label: "Numero de bon de reception",
      type: "text",
      placeholder: "Ex. BR-2026-001",
    },
    {
      name: "storeId",
      label: "Boutique",
      type: "search-select",
      optionsEndpoint: "/api/stores",
      optionValue: "id",
      optionLabel: "name",
      placeholder: "Rechercher une boutique...",
    },
    {
      name: "storageZoneId",
      label: "Zone de stockage",
      type: "search-select",
      required: true,
      optionsEndpoint: "/api/storage-zones",
      optionValue: "id",
      optionLabel: zoneLabel,
      placeholder: "Rechercher une zone de stockage...",
    },
    {
      name: "note",
      label: "Note",
      type: "textarea",
      placeholder: "Commentaire de reception",
    },
  ],
  repeaters: [
    {
      name: "items",
      label: "Produits recus",
      addLabel: "Ajouter un produit",
      minRows: 1,
      fields: componentProductLineFields([
        {
          name: "unitCost",
          label: "Cout unitaire",
          type: "number",
          min: "0",
          step: "0.01",
        },
        {
          name: "batchNumber",
          label: "Numero de lot",
          type: "text",
          placeholder: "Ex. LOT-2026-001",
        },
        {
          name: "expiryDate",
          label: "Date d'expiration",
          type: "date",
        },
        {
          name: "manufacturedAt",
          label: "Date de fabrication",
          type: "date",
        },
      ]),
    },
  ],
  fieldEffects: [
    {
      id: "stock-entry-source-type-change",
      field: "sourceType",
      fields: ["sourceType"],
      run: async ({ values, isEditing }) => {
        if (isEditing || values.sourceType === "PURCHASE_ORDER") {
          return null;
        }

        return {
          sourceId: "",
          storeId: "",
          storageZoneId: "",
          items: [repeaterRow(stockEntryForm.repeaters[0].fields, 0)],
        };
      },
    },
    {
      id: "stock-entry-source-id-change",
      field: "sourceId",
      fields: ["sourceType", "sourceId"],
      run: async ({ values, isEditing, token, requestJson }) => {
        if (isEditing || values.sourceType !== "PURCHASE_ORDER") {
          return null;
        }

        if (!values.sourceId) {
          return {
            storeId: "",
            storageZoneId: "",
            items: [repeaterRow(stockEntryForm.repeaters[0].fields, 0)],
          };
        }

        const order = await requestJson(`/api/purchase-orders/${values.sourceId}`, {
          token,
        });
        const resolvedStoreId = order?.storeId || order?.store?.id || "";
        const items = Array.isArray(order?.items)
          ? order.items
              .map((item) => {
                const quantity = Number(item.quantity || 0);
                return {
                  productId: item.productId || item.product?.id || "",
                  unitId: item.unitId || item.unit?.id || "",
                  quantity: Number.isFinite(quantity) && quantity > 0 ? String(quantity) : "",
                  unitCost:
                    item.unitPrice !== undefined && item.unitPrice !== null
                      ? String(item.unitPrice)
                      : "",
                  batchNumber: "",
                  expiryDate: "",
                  manufacturedAt: "",
                };
              })
              .filter((item) => item.productId)
          : [];
        let storageZoneId = "";

        if (resolvedStoreId) {
          try {
            const warehouseZonesPayload = await requestJson("/api/storage-zones", {
              token,
              query: { storeId: resolvedStoreId, zoneType: "WAREHOUSE" },
            });
            storageZoneId = pickRows(warehouseZonesPayload)[0]?.id || "";
          } catch {
            storageZoneId = "";
          }
        }

        return {
          storeId: resolvedStoreId,
          storageZoneId,
          note: order?.note || values.note || "",
          items: items.length
            ? items
            : [repeaterRow(stockEntryForm.repeaters[0].fields, 0)],
        };
      },
    },
  ],
  watchEffects: [
    {
      id: "stock-entry-purchase-order-prefill",
      fields: ["sourceType", "sourceId"],
      run: async ({ values, isEditing, token, requestJson }) => {
        if (isEditing) {
          return null;
        }

        if (values.sourceType !== "PURCHASE_ORDER") {
          return {
            sourceId: "",
            storeId: "",
            storageZoneId: "",
            items: [repeaterRow(stockEntryForm.repeaters[0].fields, 0)],
          };
        }

        if (!values.sourceId) {
          return {
            storeId: "",
            storageZoneId: "",
            items: [repeaterRow(stockEntryForm.repeaters[0].fields, 0)],
          };
        }

        const order = await requestJson(`/api/purchase-orders/${values.sourceId}`, {
          token,
        });
        const resolvedStoreId = order?.storeId || order?.store?.id || "";
        const items = Array.isArray(order?.items)
          ? order.items
              .map((item) => {
                const quantity = Number(item.quantity || 0);
                return {
                  productId: item.productId || item.product?.id || "",
                  unitId: item.unitId || item.unit?.id || "",
                  quantity: Number.isFinite(quantity) && quantity > 0 ? String(quantity) : "",
                  unitCost:
                    item.unitPrice !== undefined && item.unitPrice !== null
                      ? String(item.unitPrice)
                      : "",
                  batchNumber: "",
                  expiryDate: "",
                  manufacturedAt: "",
                };
              })
              .filter((item) => item.productId)
          : [];
        let storageZoneId = "";

        if (resolvedStoreId) {
          try {
            const warehouseZonesPayload = await requestJson("/api/storage-zones", {
              token,
              query: { storeId: resolvedStoreId, zoneType: "WAREHOUSE" },
            });
            storageZoneId = pickRows(warehouseZonesPayload)[0]?.id || "";
          } catch {
            storageZoneId = "";
          }
        }

        return {
          storeId: resolvedStoreId,
          storageZoneId,
          note: order?.note || values.note || "",
          items: items.length
            ? items
            : [repeaterRow(stockEntryForm.repeaters[0].fields, 0)],
        };
      },
    },
  ],
  buildRequest: (values) => ({
    endpoint: "/api/stock-entries",
    method: "POST",
    body: {
      sourceType: values.sourceType,
      sourceId: compactValue(values.sourceId),
      receiptNumber: compactValue(values.receiptNumber),
      operationType: "IN",
      storeId: compactValue(values.storeId),
      storageZoneId: values.storageZoneId,
      note: compactValue(values.note),
      items: buildDocumentItems(values.items, (item) => ({
        unitCost: numericValue(item.unitCost),
        batchNumber: compactValue(item.batchNumber),
        expiryDate: compactValue(item.expiryDate),
        manufacturedAt: compactValue(item.manufacturedAt),
      })),
    },
  }),
};

const stockOutputForm = {
  title: "Nouvelle sortie de stock",
  description:
    "Cree une sortie depuis une requisition validee ou une sortie directe a valider par un superadmin.",
  submitLabel: "Enregistrer la sortie",
  successMessage: "Sortie de stock enregistree.",
  fields: [
    {
      name: "mode",
      label: "Mode de sortie",
      type: "select",
      required: true,
      options: [
        { value: "REQUISITION", label: "Depuis une requisition validee" },
        { value: "DIRECT", label: "Sortie directe" },
      ],
      initialValue: "REQUISITION",
    },
    {
      name: "supplyRequestId",
      label: "Requisition validee",
      type: "search-select",
      optionsEndpoint: "/api/supply-requests",
      query: { status: "APPROVED" },
      optionValue: "id",
      optionLabel: "title",
      placeholder: "Rechercher une requisition validee...",
    },
    {
      name: "fromZoneId",
      label: "Zone source requisition",
      type: "search-select",
      optionsEndpoint: "/api/storage-zones",
      optionValue: "id",
      optionLabel: zoneLabel,
      placeholder: "Rechercher la zone source...",
    },
    {
      name: "toZoneId",
      label: "Zone cible requisition",
      type: "search-select",
      optionsEndpoint: "/api/storage-zones",
      optionValue: "id",
      optionLabel: zoneLabel,
      placeholder: "Rechercher la zone cible...",
    },
    {
      name: "storageZoneId",
      label: "Zone de sortie directe",
      type: "search-select",
      optionsEndpoint: "/api/storage-zones",
      optionValue: "id",
      optionLabel: zoneLabel,
      placeholder: "Rechercher une zone de sortie...",
    },
    {
      name: "note",
      label: "Note globale",
      type: "textarea",
      placeholder: "Motif de sortie",
    },
  ],
  repeaters: [
    {
      name: "items",
      label: "Lignes de sortie",
      addLabel: "Ajouter une ligne",
      minRows: 1,
      fields: componentInventoryLineFields(),
    },
  ],
  fieldEffects: [
    {
      id: "stock-output-mode-change",
      field: "mode",
      fields: ["mode"],
      run: async ({ values, isEditing }) => {
        if (isEditing || values.mode === "REQUISITION") {
          return null;
        }

        return {
          supplyRequestId: "",
          fromZoneId: "",
          toZoneId: "",
          storageZoneId: "",
          items: [repeaterRow(componentInventoryLineFields(), 0)],
        };
      },
    },
    {
      id: "stock-output-requisition-change",
      field: "supplyRequestId",
      fields: ["mode", "supplyRequestId"],
      run: async ({ values, isEditing, token, requestJson }) => {
        if (isEditing || values.mode !== "REQUISITION") {
          return null;
        }

        if (!values.supplyRequestId) {
          return {
            fromZoneId: "",
            toZoneId: "",
            storageZoneId: "",
            items: [repeaterRow(componentInventoryLineFields(), 0)],
          };
        }

        const request = await requestJson(`/api/supply-requests/${values.supplyRequestId}`, {
          token,
        });
        const items = Array.isArray(request?.items)
          ? request.items
              .map((item) => {
                const quantity = Number(item.quantity || 0);
                return {
                  productId: item.productId || item.product?.id || "",
                  quantity: Number.isFinite(quantity) && quantity > 0 ? String(quantity) : "",
                  note: item.note || "",
                };
              })
              .filter((item) => item.productId)
          : [];
        let targetZoneId = request?.storageZoneId || request?.storageZone?.id || "";
        let fromZoneId = "";

        if (!targetZoneId && request?.storeId) {
          try {
            const targetZonesPayload = await requestJson("/api/storage-zones", {
              token,
              query: { storeId: request.storeId },
            });
            targetZoneId = pickPreferredTargetZone(pickRows(targetZonesPayload))?.id || "";
          } catch {
            targetZoneId = "";
          }
        }

        try {
          const warehouseZonesPayload = await requestJson("/api/storage-zones", {
            token,
            query: { zoneType: "WAREHOUSE" },
          });
          fromZoneId = pickRows(warehouseZonesPayload)[0]?.id || "";
        } catch {
          fromZoneId = "";
        }

        return {
          fromZoneId,
          toZoneId: targetZoneId,
          storageZoneId: targetZoneId,
          note: request?.note || values.note || "",
          items: items.length ? items : [repeaterRow(componentInventoryLineFields(), 0)],
        };
      },
    },
  ],
  watchEffects: [
    {
      id: "stock-output-requisition-prefill",
      fields: ["mode", "supplyRequestId"],
      run: async ({ values, isEditing, token, requestJson }) => {
        if (isEditing) {
          return null;
        }

        if (values.mode !== "REQUISITION") {
          return {
            supplyRequestId: "",
            fromZoneId: "",
            toZoneId: "",
            items: [repeaterRow(componentInventoryLineFields(), 0)],
          };
        }

        if (!values.supplyRequestId) {
          return {
            fromZoneId: "",
            toZoneId: "",
            storageZoneId: "",
            items: [repeaterRow(componentInventoryLineFields(), 0)],
          };
        }

        const request = await requestJson(`/api/supply-requests/${values.supplyRequestId}`, {
          token,
        });
        const items = Array.isArray(request?.items)
          ? request.items
              .map((item) => {
                const quantity = Number(item.quantity || 0);
                return {
                  productId: item.productId || item.product?.id || "",
                  quantity: Number.isFinite(quantity) && quantity > 0 ? String(quantity) : "",
                  note: item.note || "",
                };
              })
              .filter((item) => item.productId)
          : [];
        let targetZoneId = request?.storageZoneId || request?.storageZone?.id || "";
        let fromZoneId = "";

        if (!targetZoneId && request?.storeId) {
          try {
            const targetZonesPayload = await requestJson("/api/storage-zones", {
              token,
              query: { storeId: request.storeId },
            });
            targetZoneId = pickPreferredTargetZone(pickRows(targetZonesPayload))?.id || "";
          } catch {
            targetZoneId = "";
          }
        }

        try {
          const warehouseZonesPayload = await requestJson("/api/storage-zones", {
            token,
            query: { zoneType: "WAREHOUSE" },
          });
          fromZoneId = pickRows(warehouseZonesPayload)[0]?.id || "";
        } catch {
          fromZoneId = "";
        }

        return {
          fromZoneId,
          toZoneId: targetZoneId,
          storageZoneId: targetZoneId,
          note: request?.note || values.note || "",
          items: items.length ? items : [repeaterRow(componentInventoryLineFields(), 0)],
        };
      },
    },
  ],
  buildRequests: (values) => {
    if (values.mode === "DIRECT") {
      return [
        {
          endpoint: "/api/stock-entries",
          method: "POST",
          body: {
            sourceType: "DIRECT",
            operationType: "OUT",
            storageZoneId: values.storageZoneId,
            note: compactValue(values.note),
            items: buildDocumentItems(values.items, () => ({})),
          },
        },
      ];
    }

    const transferItems = buildDocumentItems(values.items, () => ({}));

    return values.supplyRequestId
      ? [
          {
            endpoint: `/api/supply-requests/${values.supplyRequestId}/transfer`,
            method: "POST",
            body: {
              fromZoneId: compactValue(values.fromZoneId),
              toZoneId: compactValue(values.toZoneId),
              note: compactValue(values.note),
              items: transferItems,
            },
          },
        ]
      : [];
  },
};

const stockReturnForm = {
  title: "Nouveau retour de stock",
  description: "Reintegre des produits dans une zone de stockage.",
  submitLabel: "Enregistrer le retour",
  successMessage: "Retour de stock enregistre.",
  fields: [
    {
      name: "storageZoneId",
      label: "Zone de stockage",
      type: "search-select",
      required: true,
      optionsEndpoint: "/api/storage-zones",
      optionValue: "id",
      optionLabel: zoneLabel,
      placeholder: "Rechercher une zone de stockage...",
    },
    {
      name: "note",
      label: "Note globale",
      type: "textarea",
      placeholder: "Motif du retour",
    },
  ],
  repeaters: [
    {
      name: "items",
      label: "Produits retournes",
      addLabel: "Ajouter un produit",
      minRows: 1,
      fields: inventoryLineFields(),
    },
  ],
  buildRequests: (values) => buildInventoryAdjustmentRequests(values, "INCREMENT"),
};

const transferForm = {
  title: "Nouveau transfert",
  description: "Prepare un transfert entre deux boutiques ou deux zones.",
  endpoint: "/api/transfers",
  submitLabel: "Creer le transfert",
  successMessage: "Transfert cree.",
  fields: [
    {
      name: "code",
      label: "Code transfert",
      type: "text",
      placeholder: "Genere automatiquement",
      disabled: true,
      description: "Code genere automatiquement au format TRF0001.",
    },
    {
      name: "fromStoreId",
      label: "Boutique source",
      type: "search-select",
      required: true,
      optionsEndpoint: "/api/stores",
      optionValue: "id",
      optionLabel: "name",
      placeholder: "Rechercher la boutique source...",
    },
    {
      name: "toStoreId",
      label: "Boutique cible",
      type: "search-select",
      required: true,
      optionsEndpoint: "/api/stores",
      optionValue: "id",
      optionLabel: "name",
      placeholder: "Rechercher la boutique cible...",
    },
    {
      name: "fromZoneId",
      label: "Zone source",
      type: "search-select",
      optionsEndpoint: "/api/storage-zones",
      optionValue: "id",
      optionLabel: zoneLabel,
      placeholder: "Rechercher la zone source...",
    },
    {
      name: "toZoneId",
      label: "Zone cible",
      type: "search-select",
      optionsEndpoint: "/api/storage-zones",
      optionValue: "id",
      optionLabel: zoneLabel,
      placeholder: "Rechercher la zone cible...",
    },
    {
      name: "note",
      label: "Note",
      type: "textarea",
      placeholder: "Instruction logistique",
    },
  ],
  repeaters: [
    {
      name: "items",
      label: "Produits a transferer",
      addLabel: "Ajouter un produit",
      minRows: 1,
      fields: componentProductLineFields(),
    },
  ],
  buildRequest: (values) => ({
    endpoint: "/api/transfers",
    method: "POST",
    body: {
      fromStoreId: values.fromStoreId,
      toStoreId: values.toStoreId,
      fromZoneId: compactValue(values.fromZoneId),
      toZoneId: compactValue(values.toZoneId),
      note: compactValue(values.note),
      items: buildDocumentItems(values.items, () => ({})),
    },
  }),
};

const supplierReturnForm = {
  title: "Nouveau retour fournisseur",
  description: "Retourne des produits du stock vers un fournisseur avec validation.",
  submitLabel: "Creer le retour",
  successMessage: "Retour fournisseur cree.",
  fields: [
    {
      name: "reference",
      label: "Reference",
      type: "text",
      placeholder: "Genere automatiquement si vide",
    },
    {
      name: "supplierId",
      label: "Fournisseur",
      type: "search-select",
      optionsEndpoint: "/api/suppliers",
      optionValue: "id",
      optionLabel: "name",
      required: true,
    },
    {
      name: "storageZoneId",
      label: "Zone de stockage",
      type: "search-select",
      optionsEndpoint: "/api/storage-zones",
      optionValue: "id",
      optionLabel: zoneLabel,
      required: true,
    },
    {
      name: "note",
      label: "Note",
      type: "textarea",
      placeholder: "Motif du retour",
    },
  ],
  repeaters: [
    {
      name: "items",
      label: "Produits retournes",
      addLabel: "Ajouter un produit",
      minRows: 1,
      fields: productLineFields([
        {
          name: "reason",
          label: "Motif",
          type: "text",
          placeholder: "Lot defectueux, casse, etc.",
        },
      ]),
    },
  ],
  buildRequest: (values) => ({
    endpoint: "/api/supplier-returns",
    method: "POST",
    body: {
      reference: compactValue(values.reference),
      supplierId: values.supplierId,
      storageZoneId: values.storageZoneId,
      note: compactValue(values.note),
      items: buildDocumentItems(values.items, (item) => ({
        reason: compactValue(item.reason),
      })),
    },
  }),
};

const inventorySessionForm = {
  title: "Nouvel inventaire",
  description:
    "Ouvre une nouvelle session d'inventaire, charge les quantites systeme et bloque l'ouverture du suivant jusqu'a la cloture.",
  endpoint: "/api/inventory/sessions",
  submitLabel: "Ouvrir l'inventaire",
  successMessage: "Inventaire ouvert.",
  fields: [
    {
      name: "storeId",
      label: "Boutique",
      type: "search-select",
      required: true,
      optionsEndpoint: "/api/stores",
      optionValue: "id",
      optionLabel: "name",
      placeholder: "Rechercher une boutique...",
    },
    {
      name: "storageZoneId",
      label: "Zone de stockage",
      type: "search-select",
      required: true,
      optionsEndpoint: "/api/storage-zones",
      optionValue: "id",
      optionLabel: zoneLabel,
      placeholder: "Rechercher une zone de stockage...",
    },
    {
      name: "note",
      label: "Note globale",
      type: "textarea",
      placeholder: "Commentaire d'inventaire",
    },
  ],
  buildRequest: (values) => ({
    endpoint: "/api/inventory/sessions",
    method: "POST",
    body: {
      storeId: compactValue(values.storeId),
      storageZoneId: compactValue(values.storageZoneId),
      note: compactValue(values.note),
    },
  }),
};

const stockAdjustmentForm = {
  title: "Nouvel ajustement de stock",
  description: "Fixe ou corrige le stock theorique d'une zone.",
  submitLabel: "Enregistrer l'ajustement",
  successMessage: "Ajustement de stock enregistre.",
  fields: [
    {
      name: "storageZoneId",
      label: "Zone de stockage",
      type: "search-select",
      required: true,
      optionsEndpoint: "/api/storage-zones",
      optionValue: "id",
      optionLabel: zoneLabel,
      placeholder: "Rechercher une zone de stockage...",
    },
    {
      name: "note",
      label: "Note globale",
      type: "textarea",
      placeholder: "Commentaire d'ajustement",
    },
  ],
  repeaters: [
    {
      name: "items",
      label: "Lignes d'ajustement",
      addLabel: "Ajouter une ligne",
      minRows: 1,
      fields: inventoryLineFields(),
    },
  ],
  buildRequests: (values) => buildInventoryAdjustmentRequests(values, "SET"),
};

const productForm = {
  title: "Nouveau produit",
  description: "Ajoute un produit au catalogue principal.",
  endpoint: "/api/products",
  submitLabel: "Creer le produit",
  successMessage: "Produit cree.",
  fields: [
    {
      name: "name",
      label: "Nom du produit",
      type: "text",
      required: true,
      placeholder: "Ex. Paracetamol 500mg",
    },
    {
      name: "sku",
      label: "SKU",
      type: "text",
      placeholder: "Genere automatiquement",
      disabled: true,
      description: "Code genere automatiquement au format ART0001 ou PROD0001.",
    },
    {
      name: "scanCode",
      label: "Code scan",
      type: "text",
      placeholder: "QR code ou code-barres de l'article",
      description: "Code exact utilise au scan pour ajouter rapidement l'article au panier.",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      placeholder: "Forme, dosage, indication",
    },
    {
      name: "imageUrl",
      label: "Image",
      type: "image-upload",
      uploadEndpoint: "/api/products/upload-image",
      helper: "Ajoutez l'image de l'article ou du produit.",
    },
    {
      name: "unitPrice",
      label: "Prix unitaire",
      type: "number",
      required: true,
      min: "0",
      step: "0.01",
    },
    {
      name: "currencyCode",
      label: "Devise de saisie",
      type: "search-select",
      required: true,
      optionsEndpoint: "/api/currency-settings",
      optionValue: "code",
      optionLabel: (item) => item?.code || item?.name || "--",
      placeholder: "Choisir la devise...",
      usePrimaryCurrencyDefault: true,
      description: "Le prix saisi sera enregistre dans cette devise.",
    },
    {
      name: "purchaseUnitPrice",
      label: "Prix achat unitaire",
      type: "number",
      min: "0",
      step: "0.01",
    },
    {
      name: "minLevel",
      label: "Seuil min",
      type: "number",
      min: "0",
      step: "0.01",
    },
    {
      name: "maxLevel",
      label: "Seuil max",
      type: "number",
      min: "0",
      step: "0.01",
    },
    {
      name: "categoryId",
      label: "Categorie",
      type: "search-select",
      optionsEndpoint: "/api/product-categories",
      optionValue: "id",
      optionLabel: "name",
      placeholder: "Rechercher une categorie...",
    },
    {
      name: "familyId",
      label: "Famille",
      type: "search-select",
      optionsEndpoint: "/api/product-families",
      optionValue: "id",
      optionLabel: "name",
      placeholder: "Rechercher une famille...",
    },
    {
      name: "subFamilyId",
      label: "Sous-famille",
      type: "search-select",
      optionsEndpoint: "/api/product-subfamilies",
      optionValue: "id",
      optionLabel: "name",
      placeholder: "Rechercher une sous-famille...",
    },
    {
      name: "tvaId",
      label: "TVA",
      type: "search-select",
      optionsEndpoint: "/api/tax-rates",
      optionValue: "id",
      optionLabel: (item) => item?.code || item?.name || "--",
      placeholder: "Rechercher une TVA...",
    },
    {
      name: "managementUnitId",
      label: "Unite de gestion",
      type: "search-select",
      optionsEndpoint: "/api/units",
      optionValue: "id",
      optionLabel: unitLabel,
      query: { type: "GESTION" },
      placeholder: "Rechercher une unite de gestion...",
    },
    {
      name: "dosageUnitId",
      label: "Unite de dosage",
      type: "search-select",
      optionsEndpoint: "/api/units",
      optionValue: "id",
      optionLabel: unitLabel,
      query: { type: "DOSAGE" },
      placeholder: "Rechercher une unite de dosage...",
    },
  ],
  buildRequest: (values) => ({
    endpoint: "/api/products",
    method: "POST",
    body: {
      name: values.name,
      sku: compactValue(values.sku),
      scanCode: compactValue(values.scanCode),
      description: compactValue(values.description),
      imageUrl: compactValue(values.imageUrl),
      unitPrice: numericValue(values.unitPrice) ?? 0,
      currencyCode: compactValue(values.currencyCode),
      purchaseUnitPrice: numericValue(values.purchaseUnitPrice),
      minLevel: numericValue(values.minLevel),
      maxLevel: numericValue(values.maxLevel),
      categoryId: compactValue(values.categoryId),
      familyId: compactValue(values.familyId),
      subFamilyId: compactValue(values.subFamilyId),
      tvaId: compactValue(values.tvaId),
      managementUnitId: compactValue(values.managementUnitId),
      dosageUnitId: compactValue(values.dosageUnitId),
    },
  }),
};

const buildProductRequest = (values, kind) => ({
  endpoint: "/api/products",
  method: "POST",
  body: {
    name: values.name,
    sku: compactValue(values.sku),
    scanCode: compactValue(values.scanCode),
    description: compactValue(values.description),
    imageUrl: compactValue(values.imageUrl),
    unitPrice: numericValue(values.unitPrice) ?? 0,
    currencyCode: compactValue(values.currencyCode),
    purchaseUnitPrice: numericValue(values.purchaseUnitPrice),
    minLevel: numericValue(values.minLevel),
    maxLevel: numericValue(values.maxLevel),
    categoryId: compactValue(values.categoryId),
    familyId: compactValue(values.familyId),
    subFamilyId: compactValue(values.subFamilyId),
    tvaId: compactValue(values.tvaId),
    managementUnitId: compactValue(values.managementUnitId),
    dosageUnitId: compactValue(values.dosageUnitId),
    kind,
  },
});

const articleProductForm = {
  ...productForm,
  title: "Nouvel article",
  description: "Ajoute un article de vente propose au client.",
  submitLabel: "Creer l'article",
  successMessage: "Article cree.",
  buildRequest: (values) => buildProductRequest(values, "ARTICLE"),
};

const componentProductForm = {
  ...productForm,
  title: "Nouveau produit composant",
  description: "Ajoute un produit composant utilise dans les fiches techniques.",
  submitLabel: "Creer le produit",
  successMessage: "Produit composant cree.",
  buildRequest: (values) => buildProductRequest(values, "COMPONENT"),
};

const technicalSheetFields = [
  {
    name: "articleId",
    label: "Article",
    type: "search-select",
    required: true,
    optionsEndpoint: "/api/products",
    optionValue: "id",
    optionLabel: productLabel,
    query: { kind: "ARTICLE" },
    disableOnEdit: true,
    placeholder: "Rechercher un article...",
  },
];

const technicalSheetLineFields = [
  {
    name: "componentProductId",
    label: "Produit composant",
    type: "search-select",
    required: true,
    optionsEndpoint: "/api/products",
    optionValue: "id",
    optionLabel: productLabel,
    query: { kind: "COMPONENT" },
    placeholder: "Rechercher un produit composant...",
  },
  {
    name: "dosageUnitId",
    label: "Unite de dosage",
    type: "search-select",
    optionsEndpoint: "/api/units",
    optionValue: "id",
    optionLabel: unitLabel,
    query: { type: "DOSAGE" },
    placeholder: "Rechercher une unite de dosage...",
  },
  {
    name: "quantity",
    label: "Quantite composant",
    type: "number",
    required: true,
    min: "1",
    step: "1",
  },
];

const technicalSheetForm = {
  title: "Nouvelle fiche technique",
  description: "Associe plusieurs produits composants a un article de vente.",
  submitLabel: "Enregistrer la fiche",
  successMessage: "Fiche technique enregistree.",
  fields: technicalSheetFields,
  repeaters: [
    {
      name: "components",
      label: "Produits composants",
      addLabel: "Ajouter un composant",
      minRows: 1,
      fields: technicalSheetLineFields,
    },
  ],
  buildRequest: (values) => ({
    endpoint: values.articleId
      ? `/api/products/${values.articleId}/components`
      : undefined,
    method: "POST",
    body: {
      components: mapItems(values.components, (item) => {
        const quantity = numericValue(item.quantity);
        if (!item.componentProductId || quantity === undefined) return null;
        return {
          componentProductId: item.componentProductId,
          dosageUnitId: compactValue(item.dosageUnitId),
          quantity,
        };
      }),
    },
  }),
};

const simpleNameForm = (title, description, endpoint, submitLabel, successMessage) => ({
  title,
  description,
  endpoint,
  submitLabel,
  successMessage,
  fields: [
    {
      name: "name",
      label: "Nom",
      type: "text",
      required: true,
      placeholder: "Nom",
    },
  ],
  buildRequest: (values) => ({
    endpoint,
    method: "POST",
    body: { name: values.name },
  }),
});

const subFamilyForm = (
  title,
  description,
  endpoint,
  submitLabel,
  successMessage,
) => ({
  title,
  description,
  endpoint,
  submitLabel,
  successMessage,
  fields: [
    {
      name: "name",
      label: "Nom",
      type: "text",
      required: true,
      placeholder: "Nom",
    },
    {
      name: "parentFamilyId",
      label: "Famille parente",
      type: "search-select",
      optionsEndpoint: "/api/product-families",
      optionValue: "id",
      optionLabel: "name",
      placeholder: "Rechercher une famille...",
    },
  ],
  buildRequest: (values) => ({
    endpoint,
    method: "POST",
    body: {
      name: values.name,
      parentFamilyId: compactValue(values.parentFamilyId),
    },
  }),
});

const categoryForm = (
  title,
  description,
  endpoint,
  submitLabel,
  successMessage,
) => ({
  title,
  description,
  endpoint,
  submitLabel,
  successMessage,
  fields: [
    {
      name: "name",
      label: "Nom",
      type: "text",
      required: true,
      placeholder: "Nom",
    },
    {
      name: "collectionId",
      label: "Collection",
      type: "search-select",
      optionsEndpoint: "/api/product-collections",
      optionValue: "id",
      optionLabel: "name",
      placeholder: "Rechercher une collection...",
    },
  ],
  buildRequest: (values) => ({
    endpoint,
    method: "POST",
    body: {
      name: values.name,
      collectionId: compactValue(values.collectionId),
    },
  }),
});

const familyForm = (
  title,
  description,
  endpoint,
  submitLabel,
  successMessage,
) => ({
  title,
  description,
  endpoint,
  submitLabel,
  successMessage,
  fields: [
    {
      name: "name",
      label: "Nom",
      type: "text",
      required: true,
      placeholder: "Nom",
    },
    {
      name: "categoryId",
      label: "Categorie",
      type: "search-select",
      optionsEndpoint: "/api/product-categories",
      optionValue: "id",
      optionLabel: "name",
      placeholder: "Rechercher une categorie...",
    },
  ],
  buildRequest: (values) => ({
    endpoint,
    method: "POST",
    body: {
      name: values.name,
      categoryId: compactValue(values.categoryId),
    },
  }),
});

const unitForm = {
  title: "Nouvelle unite",
  description: "Ajoute une unite de mesure ou de vente.",
  endpoint: "/api/units",
  submitLabel: "Creer l'unite",
  successMessage: "Unite creee.",
  fields: [
    {
      name: "name",
      label: "Nom",
      type: "text",
      required: true,
      placeholder: "Ex. Boite",
    },
    {
      name: "type",
      label: "Type",
      type: "select",
      required: true,
      options: unitTypeOptions,
      initialValue: "GESTION",
    },
    {
      name: "symbol",
      label: "Symbole",
      type: "text",
      placeholder: "Ex. bx",
    },
  ],
  buildRequest: (values) => ({
    endpoint: "/api/units",
    method: "POST",
    body: {
      name: values.name,
      type: values.type,
      symbol: compactValue(values.symbol),
    },
  }),
};

const storeForm = {
  title: "Nouvelle boutique",
  description: "Ajoute un point de vente ou une boutique.",
  endpoint: "/api/stores",
  submitLabel: "Creer la boutique",
  successMessage: "Boutique creee.",
  fields: [
    { name: "name", label: "Nom", type: "text", required: true, placeholder: "Ex. Pharma Centre" },
    { name: "code", label: "Code", type: "text", placeholder: "Ex. PC001" },
    { name: "addressLine", label: "Adresse", type: "text", placeholder: "Adresse complete" },
    { name: "commune", label: "Commune", type: "text", placeholder: "Commune" },
    { name: "city", label: "Ville", type: "text", placeholder: "Ville" },
    { name: "country", label: "Pays", type: "text", placeholder: "Pays" },
  ],
  buildRequest: (values) => ({
    endpoint: "/api/stores",
    method: "POST",
    body: {
      name: values.name,
      code: compactValue(values.code),
      addressLine: compactValue(values.addressLine),
      commune: compactValue(values.commune),
      city: compactValue(values.city),
      country: compactValue(values.country),
    },
  }),
};

const zoneForm = {
  title: "Nouvelle zone de stockage",
  description: "Ajoute une zone physique rattachee a une boutique.",
  endpoint: "/api/storage-zones",
  submitLabel: "Creer la zone",
  successMessage: "Zone creee.",
  fields: [
    { name: "name", label: "Nom", type: "text", required: true, placeholder: "Ex. Depot principal" },
    { name: "code", label: "Code", type: "text", placeholder: "Ex. DEPOT-01" },
    {
      name: "storeId",
      label: "Boutique",
      type: "select",
      required: true,
      optionsEndpoint: "/api/stores",
      optionValue: "id",
      optionLabel: "name",
    },
    {
      name: "zoneType",
      label: "Type de zone",
      type: "select",
      options: zoneTypeOptions,
      initialValue: "STORE",
    },
    { name: "note", label: "Note", type: "textarea", placeholder: "Commentaire optionnel" },
  ],
  buildRequest: (values) => ({
    endpoint: "/api/storage-zones",
    method: "POST",
    body: {
      name: values.name,
      code: compactValue(values.code),
      storeId: values.storeId,
      zoneType: compactValue(values.zoneType),
      note: compactValue(values.note),
    },
  }),
};

const approvalFlowForm = {
  title: "Nouveau niveau de validation",
  description: "Definit un circuit d'approbation et ses etapes.",
  endpoint: "/api/approval-flows",
  submitLabel: "Creer le flow",
  successMessage: "Flow de validation cree.",
  fields: [
    {
      name: "code",
      label: "Code",
      type: "search-select",
      required: true,
      optionsEndpoint: "/api/approval-flows/catalog",
      optionValue: "code",
      optionLabel: (item) => `${item?.code || "--"} - ${item?.name || "--"}`,
      placeholder: "Choisir un code de validation",
    },
    { name: "name", label: "Nom", type: "text", required: true, placeholder: "Ex. Validation requisition" },
  ],
  repeaters: [
    {
      name: "steps",
      label: "Etapes",
      addLabel: "Ajouter une etape",
      minRows: 1,
      createRow: (index) => ({
        stepOrder: String(index + 1),
        approverRole: "ADMIN",
        approverUserId: "",
      }),
      fields: [
        { name: "stepOrder", label: "Ordre", type: "number", required: true, min: "1", step: "1" },
        { name: "approverRole", label: "Role approbateur", type: "select", options: userRoleOptions, initialValue: "ADMIN" },
        {
          name: "approverUserId",
          label: "Utilisateur specifique",
          type: "select",
          optionsEndpoint: "/api/users",
          optionValue: "id",
          optionLabel: (item) => formatPerson(item),
        },
      ],
    },
  ],
  buildRequest: (values) => ({
    endpoint: "/api/approval-flows",
    method: "POST",
    body: {
      code: values.code,
      name: values.name,
      steps: mapItems(values.steps, (step) => ({
        stepOrder: numericValue(step.stepOrder) ?? 1,
        approverRole: compactValue(step.approverRole),
        approverUserId: compactValue(step.approverUserId),
      })),
    },
  }),
};

const userForm = {
  title: "Nouvel utilisateur",
  description: "Cree un compte utilisateur et envoie un mot de passe temporaire.",
  endpoint: "/api/users",
  submitLabel: "Creer l'utilisateur",
  successMessage: "Utilisateur cree.",
  fields: [
    { name: "email", label: "Email", type: "email", placeholder: "utilisateur@exemple.com" },
    { name: "phone", label: "Telephone", type: "tel", placeholder: "+243..." },
    { name: "firstName", label: "Prenom", type: "text", placeholder: "Prenom" },
    { name: "lastName", label: "Nom", type: "text", placeholder: "Nom" },
    { name: "role", label: "Role", type: "select", options: userRoleOptions, initialValue: "USER" },
    {
      name: "storeId",
      label: "Boutique",
      type: "select",
      optionsEndpoint: "/api/stores",
      optionValue: "id",
      optionLabel: "name",
    },
    {
      name: "defaultStorageZoneId",
      label: "Zone par defaut",
      type: "search-select",
      optionsEndpoint: "/api/storage-zones",
      optionValue: "id",
      optionLabel: zoneLabel,
    },
    {
      name: "permissionProfileId",
      label: "Profil de permissions",
      type: "search-select",
      optionsEndpoint: "/api/permission-profiles",
      optionValue: "id",
      optionLabel: (item) => `${item.name} (${item.role})`,
      placeholder: "Choisir un profil de permissions...",
      emptyMessage: "Aucun profil disponible.",
    },
    { name: "sendVia", label: "Envoi mot de passe", type: "select", options: sendViaOptions, initialValue: "email" },
  ],
  buildRequest: (values) => ({
    endpoint: "/api/users",
    method: "POST",
    body: {
      email: compactValue(values.email),
      phone: compactValue(values.phone),
      firstName: compactValue(values.firstName),
      lastName: compactValue(values.lastName),
      role: compactValue(values.role),
      storeId: compactValue(values.storeId),
      defaultStorageZoneId: compactValue(values.defaultStorageZoneId),
      permissionProfileId: compactValue(values.permissionProfileId),
      sendVia: compactValue(values.sendVia),
    },
  }),
};

const tvaForm = {
  title: "Nouvelle TVA",
  description: "Ajoute un taux TVA utilisable dans le catalogue produits.",
  endpoint: "/api/tax-rates",
  submitLabel: "Creer la TVA",
  successMessage: "TVA enregistree.",
  fields: [
    { name: "code", label: "Code", type: "text", required: true, placeholder: "Ex. TVA16" },
    { name: "name", label: "Nom", type: "text", placeholder: "Ex. TVA 16%" },
    { name: "rate", label: "Taux", type: "number", required: true, min: "0", step: "0.01" },
    {
      name: "isActive",
      label: "Actif",
      type: "checkbox",
      checkboxLabel: "TVA active",
      initialValue: true,
    },
  ],
  buildRequest: (values) => ({
    endpoint: "/api/tax-rates",
    method: "POST",
    body: {
      code: compactValue(values.code),
      name: compactValue(values.name),
      rate: numericValue(values.rate),
      isActive: values.isActive !== false,
    },
  }),
};

const currencyForm = {
  title: "Nouvelle devise",
  description:
    "Creez une devise, puis definissez ses conversions sous la forme devise de depart vers devise cible.",
  endpoint: "/api/currency-settings",
  submitLabel: "Creer la devise",
  successMessage: "Devise enregistree.",
  fields: [
    {
      name: "code",
      label: "Code ISO de depart",
      type: "text",
      required: true,
      placeholder: "Ex. USD",
      disableOnEdit: true,
    },
    {
      name: "name",
      label: "Nom",
      type: "text",
      required: true,
      placeholder: "Ex. Dollar americain",
    },
    {
      name: "symbol",
      label: "Symbole",
      type: "text",
      placeholder: "Ex. $",
    },
    {
      name: "isCurrent",
      label: "Devise en cours",
      type: "checkbox",
      checkboxLabel: "Definir comme devise en cours",
      initialValue: false,
    },
    {
      name: "isSecondary",
      label: "Devise secondaire",
      type: "checkbox",
      checkboxLabel: "Utiliser comme devise secondaire",
      initialValue: false,
    },
    {
      name: "isActive",
      label: "Actif",
      type: "checkbox",
      checkboxLabel: "Devise active",
      initialValue: true,
    },
  ],
  repeaters: [
    {
      name: "conversions",
      label: "Conversions",
      description:
        "Chaque ligne represente une conversion de la devise de depart vers une devise cible.",
      addLabel: "Ajouter une conversion",
      fields: [
        {
          name: "fromCurrencyCode",
          label: "Devise de depart",
          type: "text",
          placeholder: "Ex. CDF",
        },
        {
          name: "toCurrencyCode",
          label: "Devise de conversion",
          type: "search-select",
          required: true,
          optionsEndpoint: "/api/currency-settings",
          optionValue: "code",
          optionLabel: "code",
          placeholder: "Choisir la devise cible...",
          emptyMessage: "Aucune devise cible disponible.",
        },
        {
          name: "rate",
          label: "Taux",
          type: "number",
          required: true,
          min: "0",
          step: "0.000001",
          placeholder: "Ex. 2800",
        },
      ],
    },
  ],
  buildRequest: (values) => ({
    endpoint: "/api/currency-settings",
    method: "POST",
    body: {
      code: upperCodeValue(values.code),
      name: compactValue(values.name),
      symbol: compactValue(values.symbol),
      isCurrent: Boolean(values.isCurrent),
      isSecondary: Boolean(values.isSecondary),
      isActive: values.isActive !== false,
      conversions: mapItems(values.conversions, (conversion) => ({
        fromCurrencyCode: upperCodeValue(conversion.fromCurrencyCode) || upperCodeValue(values.code),
        toCurrencyCode: upperCodeValue(conversion.toCurrencyCode),
        rate: numericValue(conversion.rate),
      })),
    },
  }),
};

const currencyConversionForm = {
  title: "Nouvelle conversion devise",
  description:
    "Definissez une paire de conversion explicite entre une devise de depart et une devise cible.",
  endpoint: "/api/currency-settings/conversions",
  submitLabel: "Creer la conversion",
  successMessage: "Conversion de devise enregistree.",
  fields: [
    {
      name: "fromCurrencyCode",
      label: "Devise de depart",
      type: "search-select",
      required: true,
      optionsEndpoint: "/api/currency-settings",
      optionValue: "code",
      optionLabel: currencyConversionLabel,
      placeholder: "Choisir la devise de depart...",
      emptyMessage: "Aucune devise disponible.",
    },
    {
      name: "toCurrencyCode",
      label: "Devise cible",
      type: "search-select",
      required: true,
      optionsEndpoint: "/api/currency-settings",
      optionValue: "code",
      optionLabel: currencyConversionLabel,
      placeholder: "Choisir la devise cible...",
      emptyMessage: "Aucune devise disponible.",
    },
    {
      name: "rate",
      label: "Taux",
      type: "number",
      required: true,
      min: "0",
      step: "0.000001",
      placeholder: "Ex. 2800",
    },
  ],
  buildRequest: (values) => ({
    endpoint: "/api/currency-settings/conversions",
    method: "POST",
    body: {
      fromCurrencyCode: upperCodeValue(values.fromCurrencyCode),
      toCurrencyCode: upperCodeValue(values.toCurrencyCode),
      rate: numericValue(values.rate),
    },
  }),
};

const customerBonusProgramForm = {
  title: "Nouveau programme bonus client",
  description:
    "Definit les points bonus attribues sur les ventes, leur equivalent montant et le quota sur une periode.",
  endpoint: "/api/customer-bonus-programs",
  submitLabel: "Creer le programme",
  successMessage: "Programme bonus client enregistre.",
  fields: [
    {
      name: "name",
      label: "Nom",
      type: "text",
      required: true,
      placeholder: "Ex. Fidelite standard",
    },
    {
      name: "amountThreshold",
      label: "Montant seuil",
      type: "number",
      required: true,
      min: "0.01",
      step: "0.01",
      placeholder: "Ex. 10",
    },
    {
      name: "pointsAwarded",
      label: "Points attribues",
      type: "number",
      required: true,
      min: "0",
      step: "1",
      placeholder: "Ex. 1",
    },
    {
      name: "pointValueAmount",
      label: "Equivalent montant d'un point",
      type: "number",
      required: true,
      min: "0",
      step: "0.01",
      placeholder: "Ex. 0.5",
    },
    {
      name: "quotaPoints",
      label: "Quota de points",
      type: "number",
      min: "0",
      step: "1",
      placeholder: "Ex. 100",
    },
    {
      name: "quotaPeriodDays",
      label: "Periode (jours)",
      type: "number",
      min: "0",
      step: "1",
      placeholder: "Ex. 30",
    },
    {
      name: "quotaRewardAmount",
      label: "Prime en montant",
      type: "number",
      min: "0",
      step: "0.01",
      placeholder: "Ex. 5",
    },
    {
      name: "isActive",
      label: "Actif",
      type: "checkbox",
      checkboxLabel: "Utiliser comme programme actif",
      initialValue: true,
    },
  ],
  buildRequest: (values) => ({
    endpoint: "/api/customer-bonus-programs",
    method: "POST",
    body: {
      name: compactValue(values.name),
      amountThreshold: numericValue(values.amountThreshold),
      pointsAwarded: numericValue(values.pointsAwarded),
      pointValueAmount: numericValue(values.pointValueAmount),
      quotaPoints: numericValue(values.quotaPoints),
      quotaPeriodDays: numericValue(values.quotaPeriodDays),
      quotaRewardAmount: numericValue(values.quotaRewardAmount),
      isActive: values.isActive !== false,
    },
  }),
};

const rolePermissionForm = {
  title: "Nouveau role ou jeu de permissions",
  description:
    "Definissez un profil nomme puis cochez les operations CRUD autorisees par module.",
  endpoint: "/api/permission-profiles",
  submitLabel: "Creer le profil",
  successMessage: "Profil de permissions cree.",
  fields: [
    {
      name: "name",
      label: "Nom",
      type: "text",
      required: true,
      placeholder: "Ex. Vendeur chef",
    },
    {
      name: "role",
      label: "Role",
      type: "select",
      required: true,
      options: permissionProfileRoleOptions,
      initialValue: "USER",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      placeholder: "Perimetre fonctionnel du role",
    },
    {
      name: "permissions",
      label: "Permissions",
      type: "permission-matrix",
      optionsEndpoint: "/api/permission-profiles/catalog",
    },
  ],
  buildRequest: (values) => ({
    endpoint: "/api/permission-profiles",
    method: "POST",
    body: {
      name: compactValue(values.name),
      role: compactValue(values.role),
      description: compactValue(values.description),
      permissions: matrixToPermissions(values.permissions),
    },
  }),
};

export const createCatalog = {
  "/commande/demande-achat": createForm({ createPath: "/commande/demande-achat/nouveau", ...purchaseRequestForm }),
  "/commande/requisitions": createForm({ createPath: "/commande/requisitions/nouveau", ...supplyRequestForm }),
  "/commande/commande": createForm({ createPath: "/commande/commande/nouveau", ...purchaseOrderForm }),
  "/commande/liste-commande": createForm({
    createPath: "/commande/liste-commande/nouveau",
    ...purchaseOrderForm,
    title: "Nouvelle commande",
  }),
  "/mouvement/entree-stock": createForm({ createPath: "/mouvement/entree-stock/nouveau", ...stockEntryForm }),
  "/mouvement/sortie-stock": createForm({ createPath: "/mouvement/sortie-stock/nouveau", ...stockOutputForm }),
  "/mouvement/retour-stock": createForm({ createPath: "/mouvement/retour-stock/nouveau", ...stockReturnForm }),
  "/mouvement/transfert": createForm({ createPath: "/mouvement/transfert/nouveau", ...transferForm }),
  "/mouvement/retour-fournisseur": createForm({ createPath: "/mouvement/retour-fournisseur/nouveau", ...supplierReturnForm }),
  "/etat-stock": createForm({
    createPath: "/etat-stock/nouveau",
    ...stockAdjustmentForm,
    title: "Nouvel ajustement de stock",
  }),
  "/inventaire/inventaire": createForm({
    createPath: "/inventaire/inventaire/nouveau",
    ...inventorySessionForm,
  }),
  "/configurations/articles/produits": createForm({
    createPath: "/configurations/articles/produits/nouveau",
    ...componentProductForm,
  }),
  "/configurations/articles/articles": createForm({
    createPath: "/configurations/articles/articles/nouveau",
    ...articleProductForm,
  }),
  "/configurations/articles/collections": createForm({
    createPath: "/configurations/articles/collections/nouveau",
    ...simpleNameForm(
      "Nouvelle collection",
      "Ajoute une collection de categories.",
      "/api/product-collections",
      "Creer la collection",
      "Collection creee.",
    ),
  }),
  "/configurations/articles/familles": createForm({
    createPath: "/configurations/articles/familles/nouveau",
    ...familyForm(
      "Nouvelle famille",
      "Ajoute une famille d'articles.",
      "/api/product-families",
      "Creer la famille",
      "Famille creee.",
    ),
  }),
  "/configurations/articles/sous-familles": createForm({
    createPath: "/configurations/articles/sous-familles/nouveau",
    ...subFamilyForm(
      "Nouvelle sous-famille",
      "Ajoute une sous-famille d'articles.",
      "/api/product-subfamilies",
      "Creer la sous-famille",
      "Sous-famille creee.",
    ),
  }),
  "/configurations/articles/fiche-technique": createForm({
    createPath: "/configurations/articles/fiche-technique/nouveau",
    ...technicalSheetForm,
  }),
  "/configurations/articles/categorie": createForm({
    createPath: "/configurations/articles/categorie/nouveau",
    ...categoryForm(
      "Nouvelle categorie",
      "Ajoute une categorie de produits.",
      "/api/product-categories",
      "Creer la categorie",
      "Categorie creee.",
    ),
  }),
  "/configurations/parametres/unite": createForm({ createPath: "/configurations/parametres/unite/nouveau", ...unitForm }),
  "/configurations/parametres/tva": createForm({ createPath: "/configurations/parametres/tva/nouveau", ...tvaForm }),
  "/configurations/parametres/devise": createForm({ createPath: "/configurations/parametres/devise/nouveau", ...currencyForm }),
  "/configurations/parametres/conversions-devise": createForm({
    createPath: "/configurations/parametres/conversions-devise/nouveau",
    ...currencyConversionForm,
  }),
  "/configurations/parametres/bonus-client": createForm({
    createPath: "/configurations/parametres/bonus-client/nouveau",
    ...customerBonusProgramForm,
  }),
  "/configurations/parametres/locale-vente": createForm({ createPath: "/configurations/parametres/locale-vente/nouveau", ...storeForm }),
  "/configurations/parametres/zone-stockage": createForm({ createPath: "/configurations/parametres/zone-stockage/nouveau", ...zoneForm }),
  "/configurations/parametres/niveau-validation": createForm({
    createPath: "/configurations/parametres/niveau-validation/nouveau",
    ...approvalFlowForm,
  }),
  "/configurations/utilisateur/liste-utilisateurs": createForm({
    createPath: "/configurations/utilisateur/liste-utilisateurs/nouveau",
    ...userForm,
  }),
  "/configurations/utilisateur/creer": createForm({
    createPath: "/configurations/utilisateur/creer/nouveau",
    ...userForm,
  }),
  "/configurations/utilisateur/roles-permissions": createForm({
    createPath: "/configurations/utilisateur/roles-permissions/nouveau",
    ...rolePermissionForm,
  }),
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const toAmountInputValue = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const amount = Number(value);
  return Number.isFinite(amount) ? String(amount) : "";
};

const documentItemsToFormValues = (items = [], extraFields = () => ({})) =>
  items.map((item) => ({
    productId: item.productId || item.product?.id || "",
    unitId: item.unitId || item.unit?.id || "",
    quantity: toAmountInputValue(item.quantity),
    ...extraFields(item),
  }));

const basePatchBuilder = (builder, endpointBuilder) => (values, id) => {
  const request = builder(values);
  return {
    ...request,
    endpoint: endpointBuilder(id),
    method: "PATCH",
  };
};

const isDraftStatus = (row) => row?.status === "DRAFT";
const isDraftOrRejectedWithRawDraft = (row) =>
  row?.rawStatus === "DRAFT" && ["DRAFT", "REJECTED"].includes(row?.status);
const isPendingStatus = (row) => row?.status === "PENDING";
const alwaysMutable = () => true;
const productDeactivateConfig = {
  deleteLabel: "Desactiver",
  deleteConfirmTitle: "Confirmer la desactivation",
  deleteConfirmDescription: (row) =>
    `Voulez-vous vraiment desactiver ${row?.name || row?.sku || row?.id || "cet element"} ? Il sera masque des listes actives mais conserve dans l'historique.`,
};
const productHardDeleteConfig = {
  hardDeleteLabel: "Supprimer definitivement",
  hardDeleteConfirmTitle: "Confirmer la suppression definitive",
  hardDeleteConfirmDescription: (row) =>
    `Voulez-vous vraiment supprimer definitivement ${row?.name || row?.sku || row?.id || "cet element"} ? Cette action est irreversible et echouera si le produit est deja reference.`,
};
const productFormValues = (row) => ({
  name: row.name || "",
  sku: row.sku || "",
  scanCode: row.scanCode || "",
  description: row.description || "",
  imageUrl: row.imageUrl || "",
  unitPrice: toAmountInputValue(row.unitPrice),
  currencyCode: row.currencyCode || "",
  purchaseUnitPrice: toAmountInputValue(row.purchaseUnitPrice),
  minLevel: toAmountInputValue(row.minLevel),
  maxLevel: toAmountInputValue(row.maxLevel),
  categoryId: row.categoryId || row.category?.id || "",
  familyId: row.familyId || row.family?.id || "",
  subFamilyId: row.subFamilyId || row.subFamily?.id || "",
  tvaId: row.tvaId || row.tva?.id || "",
  managementUnitId:
    row.saleUnitId || row.saleUnit?.id || row.stockUnitId || row.stockUnit?.id || "",
  dosageUnitId: row.dosageUnitId || row.dosageUnit?.id || "",
});

export const editCatalog = {
  "/commande/demande-achat": {
    ...purchaseRequestForm,
    editPath: "/commande/demande-achat/modifier",
    detailPath: "/commande/demande-achat/detail",
    detailEndpoint: (id) => `/api/purchase-requests/${id}`,
    buildFormValues: (row) => ({
      code: row.code || "",
      title: row.title || "",
      storeId: row.storeId || row.store?.id || "",
      note: row.note || "",
      items: documentItemsToFormValues(row.items, (item) => ({
        note: item.note || "",
      })),
    }),
    buildUpdateRequest: basePatchBuilder(
      purchaseRequestForm.buildRequest,
      (id) => `/api/purchase-requests/${id}`,
    ),
    deleteRequest: (id) => ({ endpoint: `/api/purchase-requests/${id}`, method: "DELETE" }),
    pdfUrl: (row) => `/api/purchase-requests/${row.id}/pdf`,
    canEdit: isDraftStatus,
    canDelete: isDraftStatus,
    detailKind: "approval-request",
  },
  "/commande/requisitions": {
    ...supplyRequestForm,
    editPath: "/commande/requisitions/modifier",
    detailPath: "/commande/requisitions/detail",
    detailEndpoint: (id) => `/api/supply-requests/${id}`,
    buildFormValues: (row) => ({
      code: row.code || "",
      title: row.title || "",
      storeId: row.storeId || row.store?.id || "",
      storageZoneId: row.storageZoneId || row.storageZone?.id || "",
      note: row.note || "",
      items: documentItemsToFormValues(row.items, (item) => ({
        note: item.note || "",
      })),
    }),
    buildUpdateRequest: basePatchBuilder(
      supplyRequestForm.buildRequest,
      (id) => `/api/supply-requests/${id}`,
    ),
    deleteRequest: (id) => ({ endpoint: `/api/supply-requests/${id}`, method: "DELETE" }),
    canEdit: isDraftStatus,
    canDelete: isDraftStatus,
    pdfUrl: (row) => `/api/supply-requests/${row.id}/pdf`,
    detailKind: "approval-request",
  },
  "/commande/commande": {
    ...purchaseOrderForm,
    editPath: "/commande/commande/modifier",
    detailPath: "/commande/commande/detail",
    detailEndpoint: (id) => `/api/purchase-orders/${id}`,
    buildFormValues: (row) => ({
      storeId: row.storeId || row.store?.id || "",
      supplierId: row.supplierId || row.supplier?.id || "",
      purchaseRequestId:
        row.purchaseRequestId || row.purchaseRequest?.id || "",
      code: row.code || "",
      orderDate: toDateInputValue(row.orderDate),
      expectedDate: toDateInputValue(row.expectedDate),
      note: row.note || "",
      items: documentItemsToFormValues(row.items, (item) => ({
        unitPrice: toAmountInputValue(item.unitPrice),
      })),
    }),
    buildUpdateRequest: basePatchBuilder(
      purchaseOrderForm.buildRequest,
      (id) => `/api/purchase-orders/${id}`,
    ),
    deleteRequest: (id) => ({ endpoint: `/api/purchase-orders/${id}`, method: "DELETE" }),
    canEdit: isDraftOrRejectedWithRawDraft,
    canDelete: isDraftOrRejectedWithRawDraft,
    pdfUrl: (row) => `/api/purchase-orders/${row.id}/pdf`,
    detailKind: "purchase-order",
  },
  "/commande/liste-commande": {
    ...purchaseOrderForm,
    editPath: "/commande/liste-commande/modifier",
    detailPath: "/commande/liste-commande/detail",
    detailEndpoint: (id) => `/api/purchase-orders/${id}`,
    buildFormValues: (row) => ({
      storeId: row.storeId || row.store?.id || "",
      supplierId: row.supplierId || row.supplier?.id || "",
      purchaseRequestId:
        row.purchaseRequestId || row.purchaseRequest?.id || "",
      code: row.code || "",
      orderDate: toDateInputValue(row.orderDate),
      expectedDate: toDateInputValue(row.expectedDate),
      note: row.note || "",
      items: documentItemsToFormValues(row.items, (item) => ({
        unitPrice: toAmountInputValue(item.unitPrice),
      })),
    }),
    buildUpdateRequest: basePatchBuilder(
      purchaseOrderForm.buildRequest,
      (id) => `/api/purchase-orders/${id}`,
    ),
    deleteRequest: (id) => ({ endpoint: `/api/purchase-orders/${id}`, method: "DELETE" }),
    canEdit: isDraftOrRejectedWithRawDraft,
    canDelete: isDraftOrRejectedWithRawDraft,
    pdfUrl: (row) => `/api/purchase-orders/${row.id}/pdf`,
    detailKind: "purchase-order",
  },
  "/mouvement/entree-stock": {
    ...stockEntryForm,
    editPath: "/mouvement/entree-stock/modifier",
    detailPath: "/mouvement/entree-stock/detail",
    detailEndpoint: (id) => `/api/stock-entries/${id}`,
    buildFormValues: (row) => ({
      sourceType: row.sourceType || "DIRECT",
      sourceId: row.sourceId || "",
      receiptNumber: "",
      storeId: row.storeId || row.store?.id || "",
      storageZoneId: row.storageZoneId || row.storageZone?.id || "",
      note: row.note || "",
      items: documentItemsToFormValues(row.items, (item) => ({
        unitCost: toAmountInputValue(item.unitCost),
        batchNumber: item.batchNumber || "",
        expiryDate: toDateInputValue(item.expiryDate),
        manufacturedAt: toDateInputValue(item.manufacturedAt),
      })),
    }),
    buildUpdateRequest: (values, id, row) => ({
      endpoint: `/api/stock-entries/${id}`,
      method: "PATCH",
      body: {
        sourceId: compactValue(values.sourceId),
        storeId: compactValue(values.storeId),
        storageZoneId: values.storageZoneId,
        note: compactValue(values.note),
        operationType:
          row?.items?.some((item) => Number(item.quantity || 0) < 0) ? "OUT" : "IN",
        items: buildDocumentItems(values.items, (item) => ({
          unitCost: numericValue(item.unitCost),
          batchNumber: compactValue(item.batchNumber),
          expiryDate: compactValue(item.expiryDate),
          manufacturedAt: compactValue(item.manufacturedAt),
        })),
      },
    }),
    deleteRequest: (id) => ({ endpoint: `/api/stock-entries/${id}`, method: "DELETE" }),
    canEdit: (row) =>
      row?.sourceType === "DIRECT" &&
      row?.rawStatus === "PENDING" &&
      ["PENDING", "REJECTED"].includes(row?.status),
    canDelete: (row) =>
      row?.sourceType === "DIRECT" &&
      row?.rawStatus === "PENDING" &&
      ["PENDING", "REJECTED"].includes(row?.status),
    pdfUrl: (row) => `/api/stock-entries/${row.id}/pdf`,
    detailKind: "stock-entry",
  },
  "/mouvement/transfert": {
    ...transferForm,
    editPath: "/mouvement/transfert/modifier",
    detailPath: "/mouvement/transfert/detail",
    detailEndpoint: (id) => `/api/transfers/${id}`,
    buildFormValues: (row) => ({
      code: row.code || "",
      fromStoreId: row.fromStoreId || row.fromStore?.id || "",
      toStoreId: row.toStoreId || row.toStore?.id || "",
      fromZoneId: row.fromZoneId || row.fromZone?.id || "",
      toZoneId: row.toZoneId || row.toZone?.id || "",
      note: row.note || "",
      items: documentItemsToFormValues(row.items),
    }),
    buildUpdateRequest: basePatchBuilder(
      transferForm.buildRequest,
      (id) => `/api/transfers/${id}`,
    ),
    pdfUrl: (row) => `/api/transfers/${row.id}/pdf`,
    deleteRequest: (id) => ({ endpoint: `/api/transfers/${id}`, method: "DELETE" }),
    canEdit: isDraftOrRejectedWithRawDraft,
    canDelete: isDraftOrRejectedWithRawDraft,
    detailKind: "transfer",
  },
  "/mouvement/retour-fournisseur": {
    ...supplierReturnForm,
    editPath: "/mouvement/retour-fournisseur/modifier",
    detailPath: "/mouvement/retour-fournisseur/detail",
    detailEndpoint: (id) => `/api/supplier-returns/${id}`,
    buildFormValues: (row) => ({
      reference: row.code || row.reference || "",
      supplierId: row.supplierId || row.supplier?.id || "",
      storageZoneId: row.storageZoneId || row.storageZone?.id || "",
      note: row.note || "",
      items: documentItemsToFormValues(row.items, (item) => ({
        reason: item.reason || "",
      })),
    }),
    buildUpdateRequest: basePatchBuilder(
      supplierReturnForm.buildRequest,
      (id) => `/api/supplier-returns/${id}`,
    ),
    deleteRequest: (id) => ({ endpoint: `/api/supplier-returns/${id}`, method: "DELETE" }),
    canEdit: (row) => ["DRAFT", "REJECTED"].includes(row?.status),
    canDelete: (row) => ["DRAFT", "REJECTED"].includes(row?.status),
    detailKind: "supplier-return",
  },
  "/mouvement/historique-caisse": {
    editPath: null,
    detailPath: "/mouvement/historique-caisse/detail",
    detailEndpoint: (id) => `/api/cash-sessions/${id}`,
    canEdit: () => false,
    canDelete: () => false,
    detailKind: "cash-session",
  },
  "/inventaire/inventaire": {
    ...inventorySessionForm,
    editPath: "/inventaire/inventaire/modifier",
    detailPath: "/inventaire/inventaire/detail",
    detailEndpoint: (id) => `/api/inventory/sessions/${id}`,
    canEdit: () => false,
    canDelete: () => false,
    detailKind: "inventory-session",
  },
  "/inventaire/etat-inventaire": {
    ...inventorySessionForm,
    editPath: "/inventaire/etat-inventaire/modifier",
    detailPath: "/inventaire/etat-inventaire/detail",
    detailEndpoint: (id) => `/api/inventory/sessions/${id}`,
    canEdit: () => false,
    canDelete: () => false,
    detailKind: "inventory-session",
  },
  "/configurations/articles/produits": {
    ...componentProductForm,
    editPath: "/configurations/articles/produits/modifier",
    detailEndpoint: (id) => `/api/products/${id}`,
    buildFormValues: productFormValues,
    buildUpdateRequest: basePatchBuilder(
      componentProductForm.buildRequest,
      (id) => `/api/products/${id}`,
    ),
    deleteRequest: (id) => ({ endpoint: `/api/products/${id}`, method: "DELETE" }),
    canEdit: alwaysMutable,
    canDelete: alwaysMutable,
    ...productDeactivateConfig,
    hardDeleteRequest: (id) => ({ endpoint: `/api/products/${id}/hard`, method: "DELETE" }),
    canHardDelete: alwaysMutable,
    ...productHardDeleteConfig,
  },
  "/configurations/articles/articles": {
    ...articleProductForm,
    editPath: "/configurations/articles/articles/modifier",
    detailEndpoint: (id) => `/api/products/${id}`,
    buildFormValues: productFormValues,
    buildUpdateRequest: basePatchBuilder(
      articleProductForm.buildRequest,
      (id) => `/api/products/${id}`,
    ),
    deleteRequest: (id) => ({ endpoint: `/api/products/${id}`, method: "DELETE" }),
    canEdit: alwaysMutable,
    canDelete: alwaysMutable,
    ...productDeactivateConfig,
    hardDeleteRequest: (id) => ({ endpoint: `/api/products/${id}/hard`, method: "DELETE" }),
    canHardDelete: alwaysMutable,
    ...productHardDeleteConfig,
  },
  "/configurations/articles/fiche-technique": {
    ...technicalSheetForm,
    editPath: "/configurations/articles/fiche-technique/modifier",
    detailEndpoint: (id) => `/api/products/${id}`,
    buildFormValues: (row) => ({
      articleId: row.id || "",
      components: (row.components || []).map((item) => ({
        componentProductId: item.componentProductId || item.componentProduct?.id || "",
        dosageUnitId: item.dosageUnitId || item.dosageUnit?.id || "",
        quantity: toAmountInputValue(item.quantity),
      })),
    }),
    buildUpdateRequest: (values, id) => ({
      endpoint: `/api/products/${id}/components`,
      method: "PUT",
      body: {
        components: mapItems(values.components, (item) => {
          const quantity = numericValue(item.quantity);
          if (!item.componentProductId || quantity === undefined) return null;
          return {
            componentProductId: item.componentProductId,
            dosageUnitId: compactValue(item.dosageUnitId),
            quantity,
          };
        }),
      },
    }),
    deleteRequest: (id) => ({ endpoint: `/api/products/${id}/components`, method: "DELETE" }),
    canEdit: alwaysMutable,
    canDelete: alwaysMutable,
  },
  "/configurations/articles/collections": {
    ...simpleNameForm(
      "Modifier la collection",
      "Edition d'une collection.",
      "/api/product-collections",
      "Enregistrer",
      "Collection modifiee.",
    ),
    editPath: "/configurations/articles/collections/modifier",
    buildFormValues: (row) => ({ name: row.name || "" }),
    buildUpdateRequest: (values, id) => ({
      endpoint: `/api/product-collections/${id}`,
      method: "PATCH",
      body: { name: values.name },
    }),
    deleteRequest: (id) => ({
      endpoint: `/api/product-collections/${id}`,
      method: "DELETE",
    }),
    canEdit: alwaysMutable,
    canDelete: alwaysMutable,
  },
  "/configurations/articles/familles": {
    ...familyForm(
      "Modifier la famille",
      "Edition d'une famille.",
      "/api/product-families",
      "Enregistrer",
      "Famille modifiee.",
    ),
    editPath: "/configurations/articles/familles/modifier",
    buildFormValues: (row) => ({
      name: row.name || "",
      categoryId: row.categoryId || row.category?.id || "",
    }),
    buildUpdateRequest: (values, id) => ({
      endpoint: `/api/product-families/${id}`,
      method: "PATCH",
      body: {
        name: values.name,
        categoryId: compactValue(values.categoryId),
      },
    }),
    deleteRequest: (id) => ({ endpoint: `/api/product-families/${id}`, method: "DELETE" }),
    canEdit: alwaysMutable,
    canDelete: alwaysMutable,
  },
  "/configurations/articles/sous-familles": {
    ...subFamilyForm(
      "Modifier la sous-famille",
      "Edition d'une sous-famille.",
      "/api/product-subfamilies",
      "Enregistrer",
      "Sous-famille modifiee.",
    ),
    editPath: "/configurations/articles/sous-familles/modifier",
    buildFormValues: (row) => ({
      name: row.name || "",
      parentFamilyId: row.parentFamilyId || row.parentFamily?.id || "",
    }),
    buildUpdateRequest: (values, id) => ({
      endpoint: `/api/product-subfamilies/${id}`,
      method: "PATCH",
      body: {
        name: values.name,
        parentFamilyId: compactValue(values.parentFamilyId),
      },
    }),
    deleteRequest: (id) => ({
      endpoint: `/api/product-subfamilies/${id}`,
      method: "DELETE",
    }),
    canEdit: alwaysMutable,
    canDelete: alwaysMutable,
  },
  "/configurations/articles/categorie": {
    ...categoryForm(
      "Modifier la categorie",
      "Edition d'une categorie.",
      "/api/product-categories",
      "Enregistrer",
      "Categorie modifiee.",
    ),
    editPath: "/configurations/articles/categorie/modifier",
    buildFormValues: (row) => ({
      name: row.name || "",
      collectionId: row.collectionId || row.collection?.id || "",
    }),
    buildUpdateRequest: (values, id) => ({
      endpoint: `/api/product-categories/${id}`,
      method: "PATCH",
      body: {
        name: values.name,
        collectionId: compactValue(values.collectionId),
      },
    }),
    deleteRequest: (id) => ({ endpoint: `/api/product-categories/${id}`, method: "DELETE" }),
    canEdit: alwaysMutable,
    canDelete: alwaysMutable,
  },
  "/configurations/parametres/unite": {
    ...unitForm,
    editPath: "/configurations/parametres/unite/modifier",
    buildFormValues: (row) => ({
      name: row.name || "",
      type: row.businessType || (row.type === "DOSAGE" ? "DOSAGE" : "GESTION"),
      symbol: row.symbol || "",
    }),
    buildUpdateRequest: (values, id) => ({
      endpoint: `/api/units/${id}`,
      method: "PATCH",
      body: {
        name: values.name,
        type: values.type,
        symbol: compactValue(values.symbol),
      },
    }),
    deleteRequest: (id) => ({ endpoint: `/api/units/${id}`, method: "DELETE" }),
    canEdit: alwaysMutable,
    canDelete: alwaysMutable,
  },
  "/configurations/parametres/tva": {
    ...tvaForm,
    title: "Modifier TVA",
    submitLabel: "Enregistrer",
    successMessage: "TVA mise a jour.",
    editPath: "/configurations/parametres/tva/modifier",
    detailEndpoint: (id) => `/api/tax-rates/${id}`,
    buildFormValues: (row) => ({
      code: row.code || "",
      name: row.name || "",
      rate: row.rate ?? "",
      isActive: row.isActive !== false,
    }),
    buildUpdateRequest: (values, id) => ({
      endpoint: `/api/tax-rates/${id}`,
      method: "PATCH",
      body: {
        code: compactValue(values.code),
        name: compactValue(values.name),
        rate: numericValue(values.rate),
        isActive: values.isActive !== false,
      },
    }),
    deleteRequest: (id) => ({ endpoint: `/api/tax-rates/${id}`, method: "DELETE" }),
    canEdit: alwaysMutable,
    canDelete: alwaysMutable,
  },
  "/configurations/parametres/devise": {
    ...currencyForm,
    title: "Modifier devise",
    submitLabel: "Enregistrer",
    successMessage: "Devise mise a jour.",
    editPath: "/configurations/parametres/devise/modifier",
    detailEndpoint: (id) => `/api/currency-settings/${id}`,
    buildFormValues: (row) => ({
      code: row.code || "",
      name: row.name || "",
      symbol: row.symbol || "",
      isCurrent: Boolean(row.isCurrent),
      isSecondary: Boolean(row.isSecondary),
      isActive: row.isActive !== false,
      conversions: (row.conversions || []).map((conversion) => ({
        fromCurrencyCode: conversion.fromCurrencyCode || row.code || "",
        toCurrencyCode: conversion.toCurrencyCode || "",
        rate: toAmountInputValue(conversion.rate),
      })),
    }),
    buildUpdateRequest: (values, id) => ({
      endpoint: `/api/currency-settings/${id}`,
      method: "PATCH",
      body: {
        code: upperCodeValue(values.code),
        name: compactValue(values.name),
        symbol: compactValue(values.symbol),
        isCurrent: Boolean(values.isCurrent),
        isSecondary: Boolean(values.isSecondary),
        isActive: values.isActive !== false,
        conversions: mapItems(values.conversions, (conversion) => ({
          fromCurrencyCode:
            upperCodeValue(conversion.fromCurrencyCode) || upperCodeValue(values.code),
          toCurrencyCode: upperCodeValue(conversion.toCurrencyCode),
          rate: numericValue(conversion.rate),
        })),
      },
    }),
    deleteRequest: (id) => ({ endpoint: `/api/currency-settings/${id}`, method: "DELETE" }),
    canDelete: (row) => !row?.isCurrent,
    deleteLabel: "Supprimer",
    deleteConfirmTitle: "Confirmer la suppression",
    deleteConfirmDescription: (row) =>
      `Voulez-vous vraiment supprimer la devise ${row?.code || row?.name || "selectionnee"} ?`,
    canEdit: alwaysMutable,
  },
  "/configurations/parametres/conversions-devise": {
    ...currencyConversionForm,
    title: "Modifier conversion devise",
    submitLabel: "Enregistrer",
    successMessage: "Conversion de devise mise a jour.",
    editPath: "/configurations/parametres/conversions-devise/modifier",
    detailEndpoint: (id) => `/api/currency-settings/conversions/${id}`,
    buildFormValues: (row) => ({
      fromCurrencyCode: row.fromCurrencyCode || "",
      toCurrencyCode: row.toCurrencyCode || "",
      rate: toAmountInputValue(row.rate),
    }),
    buildUpdateRequest: (values, id) => ({
      endpoint: `/api/currency-settings/conversions/${id}`,
      method: "PATCH",
      body: {
        fromCurrencyCode: upperCodeValue(values.fromCurrencyCode),
        toCurrencyCode: upperCodeValue(values.toCurrencyCode),
        rate: numericValue(values.rate),
      },
    }),
    deleteRequest: (id) => ({
      endpoint: `/api/currency-settings/conversions/${id}`,
      method: "DELETE",
    }),
    canEdit: alwaysMutable,
    canDelete: alwaysMutable,
  },
  "/configurations/parametres/bonus-client": {
    ...customerBonusProgramForm,
    title: "Modifier programme bonus client",
    submitLabel: "Enregistrer",
    successMessage: "Programme bonus client mis a jour.",
    editPath: "/configurations/parametres/bonus-client/modifier",
    detailEndpoint: (id) => `/api/customer-bonus-programs/${id}`,
    buildFormValues: (row) => ({
      name: row.name || "",
      amountThreshold: row.amountThreshold ?? "",
      pointsAwarded: row.pointsAwarded ?? "",
      pointValueAmount: row.pointValueAmount ?? "",
      quotaPoints: row.quotaPoints ?? "",
      quotaPeriodDays: row.quotaPeriodDays ?? "",
      quotaRewardAmount: row.quotaRewardAmount ?? "",
      isActive: row.isActive !== false,
    }),
    buildUpdateRequest: (values, id) => ({
      endpoint: `/api/customer-bonus-programs/${id}`,
      method: "PATCH",
      body: {
        name: compactValue(values.name),
        amountThreshold: numericValue(values.amountThreshold),
        pointsAwarded: numericValue(values.pointsAwarded),
        pointValueAmount: numericValue(values.pointValueAmount),
        quotaPoints: numericValue(values.quotaPoints),
        quotaPeriodDays: numericValue(values.quotaPeriodDays),
        quotaRewardAmount: numericValue(values.quotaRewardAmount),
        isActive: values.isActive !== false,
      },
    }),
    deleteRequest: (id) => ({
      endpoint: `/api/customer-bonus-programs/${id}`,
      method: "DELETE",
    }),
    canEdit: alwaysMutable,
    canDelete: (row) => !row?.isActive,
  },
  "/configurations/parametres/locale-vente": {
    ...storeForm,
    editPath: "/configurations/parametres/locale-vente/modifier",
    buildFormValues: (row) => ({
      name: row.name || "",
      code: row.code || "",
      addressLine: row.addressLine || "",
      commune: row.commune || "",
      city: row.city || "",
      country: row.country || "",
    }),
    buildUpdateRequest: (values, id) => ({
      endpoint: `/api/stores/${id}`,
      method: "PATCH",
      body: {
        name: values.name,
        code: compactValue(values.code),
        addressLine: compactValue(values.addressLine),
        commune: compactValue(values.commune),
        city: compactValue(values.city),
        country: compactValue(values.country),
      },
    }),
    deleteRequest: (id) => ({ endpoint: `/api/stores/${id}`, method: "DELETE" }),
    canEdit: alwaysMutable,
    canDelete: alwaysMutable,
  },
  "/configurations/parametres/zone-stockage": {
    ...zoneForm,
    editPath: "/configurations/parametres/zone-stockage/modifier",
    buildFormValues: (row) => ({
      name: row.name || "",
      code: row.code || "",
      storeId: row.storeId || row.store?.id || "",
      zoneType: row.zoneType || "STORE",
      note: row.note || "",
    }),
    buildUpdateRequest: (values, id) => ({
      endpoint: `/api/storage-zones/${id}`,
      method: "PATCH",
      body: {
        name: values.name,
        code: compactValue(values.code),
        storeId: values.storeId,
        zoneType: compactValue(values.zoneType),
        note: compactValue(values.note),
      },
    }),
    deleteRequest: (id) => ({ endpoint: `/api/storage-zones/${id}`, method: "DELETE" }),
    canEdit: alwaysMutable,
    canDelete: alwaysMutable,
  },
  "/configurations/parametres/niveau-validation": {
    ...approvalFlowForm,
    editPath: "/configurations/parametres/niveau-validation/modifier",
    buildFormValues: (row) => ({
      code: row.code || "",
      name: row.name || "",
      steps: (row.steps || []).map((step) => ({
        stepOrder: String(step.stepOrder || ""),
        approverRole: step.approverRole || "ADMIN",
        approverUserId: step.approverUserId || step.approver?.id || "",
      })),
    }),
    buildUpdateRequest: (values, id) => ({
      endpoint: `/api/approval-flows/${id}`,
      method: "PATCH",
      body: {
        code: values.code,
        name: values.name,
        steps: mapItems(values.steps, (step) => ({
          stepOrder: numericValue(step.stepOrder) ?? 1,
          approverRole: compactValue(step.approverRole),
          approverUserId: compactValue(step.approverUserId),
        })),
      },
    }),
    deleteRequest: (id) => ({ endpoint: `/api/approval-flows/${id}`, method: "DELETE" }),
    canEdit: alwaysMutable,
    canDelete: alwaysMutable,
  },
  "/configurations/utilisateur/liste-utilisateurs": {
    ...userForm,
    editPath: "/configurations/utilisateur/liste-utilisateurs/modifier",
    detailEndpoint: (id) => `/api/users/${id}`,
    buildFormValues: (row) => ({
      email: row.email || "",
      phone: row.phone || "",
      firstName: row.firstName || "",
      lastName: row.lastName || "",
      role: row.role || "USER",
      storeId: row.storeId || row.store?.id || "",
      defaultStorageZoneId: row.defaultStorageZoneId || "",
      permissionProfileId: row.permissionProfileId || row.permissionProfile?.id || "",
      sendVia: "email",
    }),
    buildUpdateRequest: (values, id) => ({
      endpoint: `/api/users/${id}`,
      method: "PATCH",
      body: {
        email: compactValue(values.email),
        phone: compactValue(values.phone),
        firstName: compactValue(values.firstName),
        lastName: compactValue(values.lastName),
        role: compactValue(values.role),
        storeId: compactValue(values.storeId),
        defaultStorageZoneId: compactValue(values.defaultStorageZoneId),
        permissionProfileId: compactValue(values.permissionProfileId),
      },
    }),
    deleteRequest: (id) => ({ endpoint: `/api/users/${id}`, method: "DELETE" }),
    canEdit: alwaysMutable,
    canDelete: alwaysMutable,
  },
  "/configurations/utilisateur/creer": {
    ...userForm,
    editPath: "/configurations/utilisateur/creer/modifier",
    detailEndpoint: (id) => `/api/users/${id}`,
    buildFormValues: (row) => ({
      email: row.email || "",
      phone: row.phone || "",
      firstName: row.firstName || "",
      lastName: row.lastName || "",
      role: row.role || "USER",
      storeId: row.storeId || row.store?.id || "",
      defaultStorageZoneId: row.defaultStorageZoneId || "",
      permissionProfileId: row.permissionProfileId || row.permissionProfile?.id || "",
      sendVia: "email",
    }),
    buildUpdateRequest: (values, id) => ({
      endpoint: `/api/users/${id}`,
      method: "PATCH",
      body: {
        email: compactValue(values.email),
        phone: compactValue(values.phone),
        firstName: compactValue(values.firstName),
        lastName: compactValue(values.lastName),
        role: compactValue(values.role),
        storeId: compactValue(values.storeId),
        defaultStorageZoneId: compactValue(values.defaultStorageZoneId),
        permissionProfileId: compactValue(values.permissionProfileId),
      },
    }),
    deleteRequest: (id) => ({ endpoint: `/api/users/${id}`, method: "DELETE" }),
    canEdit: alwaysMutable,
    canDelete: alwaysMutable,
  },
  "/configurations/utilisateur/roles-permissions": {
    ...rolePermissionForm,
    title: "Modifier role ou jeu de permissions",
    submitLabel: "Enregistrer",
    successMessage: "Profil de permissions mis a jour.",
    editPath: "/configurations/utilisateur/roles-permissions/modifier",
    detailEndpoint: (id) => `/api/permission-profiles/${id}`,
    buildFormValues: (row) => ({
      name: row.name || "",
      role: row.role || "USER",
      description: row.description || "",
      permissions: permissionsToMatrix(row.permissions),
    }),
    buildUpdateRequest: (values, id) => ({
      endpoint: `/api/permission-profiles/${id}`,
      method: "PATCH",
      body: {
        name: compactValue(values.name),
        role: compactValue(values.role),
        description: compactValue(values.description),
        permissions: matrixToPermissions(values.permissions),
      },
    }),
    deleteRequest: (id) => ({
      endpoint: `/api/permission-profiles/${id}`,
      method: "DELETE",
    }),
    canEdit: alwaysMutable,
    canDelete: alwaysMutable,
  },
};

export const getEditConfig = (path) => editCatalog[normalizePath(path)] || null;

export const getResourceConfig = (path) => resourceCatalog[normalizePath(path)] || null;
export const getCreateConfig = (path) => createCatalog[normalizePath(path)] || null;

const createPageCatalog = Object.fromEntries(
  Object.entries(createCatalog).map(([resourcePath, config]) => [
    normalizePath(config.createPath),
    {
      ...config,
      resourcePath,
    },
  ]),
);

export const getCreatePageConfig = (path) =>
  createPageCatalog[normalizePath(path)] || null;

const editPageCatalog = Object.fromEntries(
  Object.entries(editCatalog)
    .filter(([, config]) => config.editPath)
    .map(([resourcePath, config]) => [
      normalizePath(config.editPath),
      {
        ...config,
        resourcePath,
        mode: "edit",
      },
    ]),
);

export const getEditPageConfig = (path) =>
  editPageCatalog[normalizePath(path)] || null;

const detailPageCatalog = Object.fromEntries(
  Object.entries(editCatalog)
    .filter(([, config]) => config.detailPath)
    .map(([resourcePath, config]) => [
      normalizePath(config.detailPath),
      {
        ...config,
        resourcePath,
        mode: "detail",
      },
    ]),
);

export const getDetailPageConfig = (path) =>
  detailPageCatalog[normalizePath(path)] || null;

export const getTableActionConfig = (path) => {
  const resourcePath = normalizePath(path);
  const editConfig = editCatalog[resourcePath];

  return {
    editPath: editConfig?.editPath || null,
    detailPath: editConfig?.detailPath || null,
    canEdit: editConfig?.canEdit || null,
    canDelete: editConfig?.canDelete || null,
    deleteRequest: editConfig?.deleteRequest || null,
    deleteLabel: editConfig?.deleteLabel || null,
    deleteConfirmTitle: editConfig?.deleteConfirmTitle || null,
    deleteConfirmDescription: editConfig?.deleteConfirmDescription || null,
    canHardDelete: editConfig?.canHardDelete || null,
    hardDeleteRequest: editConfig?.hardDeleteRequest || null,
    hardDeleteLabel: editConfig?.hardDeleteLabel || null,
    hardDeleteConfirmTitle: editConfig?.hardDeleteConfirmTitle || null,
    hardDeleteConfirmDescription: editConfig?.hardDeleteConfirmDescription || null,
    pdfUrl: editConfig?.pdfUrl || null,
  };
};

createRouteMeta = [
  ...Object.entries(createCatalog).map(([resourcePath, config]) => {
    const resourceRoute = allRouteMeta.find((item) => item.path === resourcePath);
    const createPath = normalizePath(config.createPath);
    const label =
      config.title ||
      `Nouveau ${resourceRoute?.name?.toLowerCase() || "document"}`;

    return {
      id: `${resourceRoute?.id || createPath}-nouveau`,
      name: label,
      path: createPath,
      link: resourceRoute?.link || createPath.slice(1),
      icon: resourceRoute?.icon || FilePlus2,
      summary: config.description || resourceRoute?.summary || "",
      sectionLabel: resourceRoute?.sectionLabel || "Administration",
      breadcrumbs: [...(resourceRoute?.breadcrumbs || []), { label, path: createPath }],
    };
  }),
  ...Object.entries(editCatalog).map(([resourcePath, config]) => {
    const resourceRoute = allRouteMeta.find((item) => item.path === resourcePath);
    const editPath = normalizePath(config.editPath);
    const label = `Modifier ${resourceRoute?.name?.toLowerCase() || "element"}`;

    return {
      id: `${resourceRoute?.id || editPath}-modifier`,
      name: label,
      path: editPath,
      link: resourceRoute?.link || editPath.slice(1),
      icon: resourceRoute?.icon || FileCog,
      summary: config.description || resourceRoute?.summary || "",
      sectionLabel: resourceRoute?.sectionLabel || "Administration",
      breadcrumbs: [...(resourceRoute?.breadcrumbs || []), { label, path: editPath }],
    };
  }),
  ...Object.entries(detailPageCatalog).map(([detailPath, config]) => {
    const resourceRoute = allRouteMeta.find((item) => item.path === config.resourcePath);
    const label = `Detail ${resourceRoute?.name?.toLowerCase() || "document"}`;

    return {
      id: `${resourceRoute?.id || detailPath}-detail`,
      name: label,
      path: normalizePath(detailPath),
      link: resourceRoute?.link || normalizePath(detailPath).slice(1),
      icon: FileSearch,
      summary: config.description || resourceRoute?.summary || "",
      sectionLabel: resourceRoute?.sectionLabel || "Administration",
      breadcrumbs: [
        ...(resourceRoute?.breadcrumbs || []),
        { label, path: normalizePath(detailPath) },
      ],
    };
  }),
];

const redirectRoutes = sidebarItems
  .filter((item) => item.children?.length)
  .map((item) => ({
    path: item.path.slice(1),
    element: <Navigate to={item.children[0].path} replace />,
  }));

const workspaceRoutes = allRouteMeta
  .filter((item) => item.path !== dashboardMeta.path && item.path !== settingsMeta.path)
  .map((item) => ({
    path: item.path.slice(1),
    element: <AdminResourcePage />,
  }));

const createRoutes = Object.values(createPageCatalog).map((item) => ({
  path: item.createPath.slice(1),
  element:
    normalizePath(item.createPath) === "/inventaire/inventaire/nouveau" ? (
      <AdminInventoryCountPage />
    ) : (
      <AdminCreatePage />
    ),
}));

const editRoutes = Object.values(editPageCatalog).map((item) => ({
  path: item.editPath.slice(1),
  element: <AdminCreatePage />,
}));

const detailRoutes = Object.values(detailPageCatalog).map((item) => ({
  path: item.detailPath.slice(1),
  element: <AdminDetailPage />,
}));

const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <MainLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "dashboard", element: <Dashboard /> },
          { path: "settings", element: <SettingsPage /> },
          {
            path: "configurations/articles/produits-vente",
            element: <Navigate to="/configurations/articles/articles" replace />,
          },
          ...redirectRoutes,
          ...workspaceRoutes,
          ...createRoutes,
          ...editRoutes,
          ...detailRoutes,
        ],
      },
    ],
  },
]);

export default router;
