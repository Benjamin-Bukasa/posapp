const PERMISSION_MODULES = [
  {
    key: "transfers",
    label: "Transfert",
    description: "Gestion des transferts de stock entre zones et boutiques.",
    actions: [
      { code: "transfers.read", label: "Voir" },
      { code: "transfers.create", label: "Creer" },
      { code: "transfers.update", label: "Modifier" },
      { code: "transfers.delete", label: "Supprimer" },
    ],
  },
  {
    key: "purchase_requests",
    label: "Demande d'achat",
    description: "Demandes d'achat, validation et suivi.",
    actions: [
      { code: "purchase_requests.read", label: "Voir" },
      { code: "purchase_requests.create", label: "Creer" },
      { code: "purchase_requests.update", label: "Modifier" },
      { code: "purchase_requests.delete", label: "Supprimer" },
      {
        code: "purchase_requests.update_own_draft",
        label: "Modifier sa propre demande non validee",
      },
    ],
  },
  {
    key: "users",
    label: "Utilisateurs",
    description: "Creation, modification et suppression des comptes utilisateur.",
    actions: [
      { code: "users.read", label: "Voir" },
      { code: "users.create", label: "Creer" },
      { code: "users.update", label: "Modifier" },
      { code: "users.delete", label: "Supprimer" },
    ],
  },
  {
    key: "purchase_orders",
    label: "Commande",
    description: "Commandes fournisseur et cycle de validation.",
    actions: [
      { code: "purchase_orders.read", label: "Voir" },
      { code: "purchase_orders.create", label: "Creer" },
      { code: "purchase_orders.update", label: "Modifier" },
      { code: "purchase_orders.delete", label: "Supprimer" },
    ],
  },
  {
    key: "stock_state",
    label: "Etat de stock",
    description: "Consultation de l'etat de stock et des niveaux disponibles.",
    actions: [{ code: "stock_state.read", label: "Voir" }],
  },
  {
    key: "inventory",
    label: "Inventaire",
    description: "Campagnes d'inventaire et ajustements d'inventaire.",
    actions: [
      { code: "inventory.read", label: "Voir" },
      { code: "inventory.create", label: "Creer" },
      { code: "inventory.update", label: "Modifier" },
      { code: "inventory.delete", label: "Supprimer" },
    ],
  },
  {
    key: "settings",
    label: "Parametre",
    description:
      "Devise, unite, TVA, articles, produits, familles, categories et autres referentiels.",
    actions: [
      { code: "settings.read", label: "Voir" },
      { code: "settings.create", label: "Creer" },
      { code: "settings.update", label: "Modifier" },
      { code: "settings.delete", label: "Supprimer" },
    ],
  },
  {
    key: "movements",
    label: "Mouvement",
    description: "Entrees, sorties, retours et historique des mouvements de stock.",
    actions: [
      { code: "movements.read", label: "Voir" },
      { code: "movements.create", label: "Creer" },
      { code: "movements.update", label: "Modifier" },
      { code: "movements.delete", label: "Supprimer" },
    ],
  },
];

const PERMISSION_CODE_SET = new Set(
  PERMISSION_MODULES.flatMap((moduleItem) =>
    moduleItem.actions.map((action) => action.code),
  ),
);

const isKnownPermissionCode = (code) => PERMISSION_CODE_SET.has(code);

module.exports = {
  PERMISSION_MODULES,
  PERMISSION_CODE_SET,
  isKnownPermissionCode,
};
