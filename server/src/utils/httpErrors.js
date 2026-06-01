const DUPLICATE_FIELD_MESSAGES = {
  email: "Cet email existe deja.",
  phone: "Ce numero de telephone existe deja.",
  sku: "Ce code existe deja.",
  scanCode: "Ce code de scan existe deja.",
  code: "Ce code existe deja.",
};
const DEFAULT_INTERNAL_ERROR_MESSAGE = "Une erreur interne est survenue.";

const resolvePrismaTarget = (error) => {
  if (!Array.isArray(error?.meta?.target)) {
    return [];
  }

  return error.meta.target.map((value) => String(value || ""));
};

const buildDuplicateMessage = (targets = []) => {
  const normalizedTargets = targets
    .flatMap((target) =>
      String(target || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .map((target) => target.replace(/.*\./, ""));

  const knownMessage = normalizedTargets
    .map((target) => DUPLICATE_FIELD_MESSAGES[target])
    .find(Boolean);

  if (knownMessage) {
    return knownMessage;
  }

  if (normalizedTargets.length === 1) {
    return `La valeur du champ ${normalizedTargets[0]} existe deja.`;
  }

  return "Une valeur unique existe deja dans la base de donnees.";
};

const isTransactionExpiredError = (error) =>
  error?.code === "P2028" ||
  String(error?.message || "").includes("Transaction already closed") ||
  String(error?.meta?.error || "").includes("Transaction already closed");

const normalizeError = (error) => {
  if (!error) {
    return {
      status: 500,
      message: "Une erreur inattendue est survenue.",
    };
  }

  if (error.status && error.message) {
    return {
      status: error.status,
      message: error.message,
    };
  }

  if (isTransactionExpiredError(error)) {
    return {
      status: 503,
      message:
        "Cette operation a pris trop de temps et a ete annulee. Reessayez dans quelques secondes.",
    };
  }

  if (error.code === "P2002") {
    return {
      status: 409,
      message: buildDuplicateMessage(resolvePrismaTarget(error)),
    };
  }

  if (error.code === "P2025") {
    return {
      status: 404,
      message: "La ressource demandee est introuvable ou a deja ete modifiee.",
    };
  }

  if (error.code === "P2003") {
    return {
      status: 409,
      message:
        "Cette operation est impossible car des donnees liees dependent encore de cet enregistrement.",
    };
  }

  if (error.code === "P2021") {
    return {
      status: 500,
      message:
        "Une structure de base de donnees attendue est introuvable. Verifiez les migrations Prisma.",
    };
  }

  return {
    status: 500,
    message: error.message || DEFAULT_INTERNAL_ERROR_MESSAGE,
  };
};

const sendErrorResponse = (res, error, fallbackMessage = null) => {
  const normalized = normalizeError(error);
  const message =
    normalized.status === 500 && normalized.message === DEFAULT_INTERNAL_ERROR_MESSAGE
      ? fallbackMessage || normalized.message
      : normalized.message;

  return res.status(normalized.status).json({ message });
};

module.exports = {
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  normalizeError,
  isTransactionExpiredError,
  sendErrorResponse,
};
