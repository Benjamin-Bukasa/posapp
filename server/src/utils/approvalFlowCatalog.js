const APPROVAL_FLOW_CATALOG = [
  { code: "PURCHASE_REQUEST", name: "Demande d'achat", module: "Achats" },
  { code: "PURCHASE_ORDER", name: "Bon de commande", module: "Achats" },
  { code: "SUPPLIER_RETURN", name: "Retour fournisseur", module: "Achats" },
  { code: "SUPPLY_REQUEST", name: "Requisition", module: "Approvisionnement / stock" },
  { code: "STOCK_ENTRY", name: "Entree en stock", module: "Approvisionnement / stock" },
  { code: "STOCK_EXIT", name: "Sortie en stock", module: "Approvisionnement / stock" },
  { code: "DIRECT_STOCK_ENTRY", name: "Entree directe", module: "Approvisionnement / stock" },
  { code: "DIRECT_STOCK_EXIT", name: "Sortie directe", module: "Approvisionnement / stock" },
  { code: "STOCK_RETURN", name: "Retour stock", module: "Approvisionnement / stock" },
  { code: "TRANSFER", name: "Transfert", module: "Approvisionnement / stock" },
  { code: "INVENTORY", name: "Inventaire", module: "Approvisionnement / stock" },
  { code: "INVENTORY_ADJUSTMENT", name: "Ajustement d'inventaire", module: "Approvisionnement / stock" },
  { code: "INVENTORY_MOVEMENT", name: "Mouvement de stock", module: "Approvisionnement / stock" },
  { code: "ARTICLE_CREATE", name: "Creation article", module: "Catalogue" },
  { code: "ARTICLE_UPDATE", name: "Modification article", module: "Catalogue" },
  { code: "PRODUCT_CREATE", name: "Creation produit", module: "Catalogue" },
  { code: "PRODUCT_UPDATE", name: "Modification produit", module: "Catalogue" },
  { code: "TECHNICAL_SHEET", name: "Fiche technique", module: "Catalogue" },
  { code: "CATEGORY", name: "Categorie", module: "Catalogue" },
  { code: "COLLECTION", name: "Collection", module: "Catalogue" },
  { code: "FAMILY", name: "Famille", module: "Catalogue" },
  { code: "SUB_FAMILY", name: "Sous-famille", module: "Catalogue" },
  { code: "UNIT", name: "Unite", module: "Catalogue" },
  { code: "TAX_RATE", name: "TVA", module: "Catalogue" },
  { code: "CURRENCY", name: "Devise", module: "Catalogue" },
  { code: "USER_CREATE", name: "Creation utilisateur", module: "Utilisateurs / securite" },
  { code: "USER_UPDATE", name: "Modification utilisateur", module: "Utilisateurs / securite" },
  { code: "ROLE_PERMISSION", name: "Role et permission", module: "Utilisateurs / securite" },
  { code: "APPROVAL_FLOW", name: "Niveau de validation", module: "Utilisateurs / securite" },
  { code: "SALE_UPDATE", name: "Modification vente", module: "Caisse / ventes" },
  { code: "SALE_CANCEL", name: "Annulation vente", module: "Caisse / ventes" },
  { code: "CASH_SESSION_OPEN", name: "Ouverture de caisse", module: "Caisse / ventes" },
  { code: "CASH_SESSION_CLOSE", name: "Cloture de caisse", module: "Caisse / ventes" },
  { code: "CASH_MOVEMENT", name: "Entree / sortie de caisse", module: "Caisse / ventes" },
  { code: "CUSTOMER_BONUS_RULE", name: "Regle bonus client", module: "Caisse / ventes" },
  { code: "STORE", name: "Boutique", module: "Parametres / referentiels" },
  { code: "STORAGE_ZONE", name: "Zone de stockage", module: "Parametres / referentiels" },
  { code: "SETTINGS", name: "Parametres globaux", module: "Parametres / referentiels" },
];

const APPROVAL_FLOW_CODE_SET = new Set(APPROVAL_FLOW_CATALOG.map((entry) => entry.code));

const normalizeApprovalFlowCode = (value) => String(value || "").trim().toUpperCase();

const findApprovalFlowCatalogEntry = (code) =>
  APPROVAL_FLOW_CATALOG.find((entry) => entry.code === normalizeApprovalFlowCode(code)) || null;

module.exports = {
  APPROVAL_FLOW_CATALOG,
  APPROVAL_FLOW_CODE_SET,
  normalizeApprovalFlowCode,
  findApprovalFlowCatalogEntry,
};
