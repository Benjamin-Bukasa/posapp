export const getApiBaseUrl = () =>
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

export const toDisplayString = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toDisplayString).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    if (typeof value.message === "string") {
      return value.message;
    }

    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  }

  return String(value);
};

export const normalizeAppError = (error, fallback = "Une erreur est survenue.") => {
  const status = error?.response?.status ?? null;
  const data = error?.response?.data;
  const code = error?.code ?? null;

  const message =
    toDisplayString(data?.message) ||
    toDisplayString(data?.error) ||
    toDisplayString(error?.message) ||
    fallback;

  const details =
    toDisplayString(data?.details) ||
    toDisplayString(data?.errors) ||
    null;

  const isNetworkError =
    code === "ERR_NETWORK" ||
    code === "ECONNABORTED" ||
    (!status && !!error?.request);

  const hint = isNetworkError
    ? "Verifie l'URL API, le Wi-Fi du telephone et si le serveur POSapp est bien lance."
    : null;

  return {
    message,
    details,
    status,
    code,
    hint,
    isNetworkError,
  };
};

export const serializeErrorForLog = (error, fallback) => {
  const normalized = normalizeAppError(error, fallback);

  return {
    ...normalized,
    name: error?.name || "Error",
    stack: typeof error?.stack === "string" ? error.stack : null,
    raw:
      error?.response?.data && typeof error.response.data === "object"
        ? error.response.data
        : null,
  };
};
