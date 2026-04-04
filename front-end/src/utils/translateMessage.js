const exactTranslations = new Map([
  ["Unauthorized", "Non autorise."],
  ["Forbidden", "Acces refuse."],
  ["Request failed.", "La requete a echoue."],
  ["Connection failed", "Connexion impossible."],
  ["User limit reached for your subscription.", "La limite d'utilisateurs de votre abonnement est atteinte."],
  ["User already exists.", "Cet utilisateur existe deja."],
  ["Email or phone required.", "L'email ou le telephone est requis."],
  ["Phone required for SMS delivery.", "Le numero de telephone est requis pour l'envoi par SMS."],
  ["User not found.", "Utilisateur introuvable."],
  ["Customer not found.", "Client introuvable."],
  ["Product not found.", "Produit introuvable."],
  ["Invalid sale.", "Vente invalide."],
  ["Invalid article selected.", "Article invalide selectionne."],
  ["Received amount must cover the sale total.", "Le montant recu doit couvrir le total de la vente."],
  ["Insufficient stock for the selected product.", "Stock insuffisant pour le produit selectionne."],
  ["components array required.", "La liste des composants est requise."],
  ["Only ARTICLE products can have a technical sheet.", "Seuls les articles peuvent avoir une fiche technique."],
  ["An article cannot include itself as a component.", "Un article ne peut pas se contenir lui-meme comme composant."],
  ["Unable to create product.", "Impossible de creer le produit."],
  ["Unable to add components.", "Impossible d'ajouter les composants."],
  ["Unable to replace components.", "Impossible de remplacer les composants."],
  ["Unable to clear technical sheet.", "Impossible de vider la fiche technique."],
  ["Unable to update component.", "Impossible de mettre a jour le composant."],
  ["Not allowed to approve this step.", "Vous n'etes pas autorise a valider cette etape."],
  ["Not allowed to reject this step.", "Vous n'etes pas autorise a rejeter cette etape."],
  ["Direct entry must be approved first.", "L'entree directe doit d'abord etre approuvee."],
  ["Refresh token missing.", "Jeton de rafraichissement manquant."],
  ["Missing session.", "Session manquante."],
  ["Session expired.", "Session expiree."],
  ["GOOGLE_CLIENT_ID not configured.", "La connexion Google n'est pas configuree sur le serveur."],
  ["Invalid Google token.", "Le jeton Google est invalide ou expire."],
  ["Two-factor enabled. Use normal login flow.", "La double authentification est active. Utilisez la connexion classique."],
  ["tenantName and plan required for first Google login.", "Ce compte Google n'est pas encore lie a un utilisateur POSapp."],
  ["Customer bonus program not found.", "Programme bonus client introuvable."],
  ["Active customer bonus program cannot be deleted.", "Le programme bonus client actif ne peut pas etre supprime."],
  ["name required.", "Le nom est requis."],
  ["amountThreshold must be greater than zero.", "Le montant seuil doit etre superieur a zero."],
  ["pointsAwarded must be zero or greater.", "Les points attribues doivent etre superieurs ou egaux a zero."],
  ["pointValueAmount must be zero or greater.", "L'equivalent montant du point doit etre superieur ou egal a zero."],
  ["quotaPoints and quotaPeriodDays must be provided together.", "Le quota de points et la periode doivent etre renseignes ensemble."],
  ["quotaPoints must be greater than zero.", "Le quota de points doit etre superieur a zero."],
  ["quotaPeriodDays must be greater than zero.", "La periode en jours doit etre superieure a zero."],
  ["quotaRewardAmount must be zero or greater.", "La prime en montant doit etre superieure ou egale a zero."],
  ["firstName, lastName and phone or email required.", "Le prenom, le nom et un telephone ou un email sont requis."],
  ["Tax rate not found.", "TVA introuvable."],
  ["Tax rate already exists.", "Cette TVA existe deja."],
  ["Tax code required.", "Le code TVA est requis."],
  ["Tax rate must be zero or greater.", "Le taux TVA doit etre superieur ou egal a zero."],
]);

const patternTranslations = [
  {
    regex: /^Invalid item on line (\d+)\.?$/i,
    format: (_, line) => `Article invalide a la ligne ${line}.`,
  },
  {
    regex: /^Component quantity invalid on line (\d+)\.?$/i,
    format: (_, line) => `Quantite de composant invalide a la ligne ${line}.`,
  },
  {
    regex: /^componentProductId or componentName required on line (\d+)\.?$/i,
    format: (_, line) =>
      `Le produit composant ou son nom est requis a la ligne ${line}.`,
  },
  {
    regex: /^Component product not found on line (\d+)\.?$/i,
    format: (_, line) => `Produit composant introuvable a la ligne ${line}.`,
  },
  {
    regex: /^Technical sheet incomplete for article (.+)\.?$/i,
    format: (_, articleName) =>
      `La fiche technique de l'article ${articleName} est incomplete.`,
  },
  {
    regex: /^Article (.+) contains a non-component product\.?$/i,
    format: (_, articleName) =>
      `L'article ${articleName} contient un produit qui n'est pas un composant.`,
  },
  {
    regex: /^Component (.+) is inactive\.?$/i,
    format: (_, componentName) => `Le composant ${componentName} est inactif.`,
  },
  {
    regex: /^Technical sheet quantities for (.+) must result in whole stock units\.?$/i,
    format: (_, articleName) =>
      `Les quantites de la fiche technique de ${articleName} doivent produire des unites de stock entieres.`,
  },
  {
    regex: /^Insufficient stock for (.+)\.?$/i,
    format: (_, label) => `Stock insuffisant pour ${label}.`,
  },
];

export const translateMessage = (message, fallback = "") => {
  const normalized = String(message || "").trim();
  if (!normalized) return fallback;

  if (exactTranslations.has(normalized)) {
    return exactTranslations.get(normalized);
  }

  for (const rule of patternTranslations) {
    const match = normalized.match(rule.regex);
    if (match) {
      return rule.format(...match);
    }
  }

  return normalized;
};

export default translateMessage;
