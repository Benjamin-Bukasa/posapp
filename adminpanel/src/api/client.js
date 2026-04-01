import { translateMessage } from "../utils/translateMessage";
import useAuthStore from "../stores/authStore";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

const buildUrl = (path, query = {}) => {
  const target = new URL(path, API_URL);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    target.searchParams.set(key, String(value));
  });
  return target.toString();
};

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
};

let refreshPromise = null;

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    const auth = useAuthStore.getState();
    refreshPromise = auth
      .refreshSession()
      .catch(async (error) => {
        await useAuthStore.getState().logout();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

const performRequest = async (
  buildResponse,
  { token, retryOn401 = true } = {},
) => {
  const response = await buildResponse(token);

  if (response.status !== 401 || !retryOn401 || !token) {
    return response;
  }

  const refreshed = await refreshAccessToken();
  return buildResponse(refreshed.accessToken);
};

export const requestJson = async (
  path,
  { method = "GET", token, headers = {}, body, query, retryOn401 = true } = {},
) => {
  const response = await performRequest(
    (activeToken) =>
      fetch(buildUrl(path, query), {
        method,
        headers: {
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
    { token, retryOn401 },
  );

  const payload = await parseJson(response);

  if (!response.ok) {
    throw new ApiError(
      translateMessage(payload.message, "Une erreur est survenue."),
      response.status,
      payload,
    );
  }

  return payload;
};

export const requestBlob = async (
  path,
  { method = "GET", token, headers = {}, body, query, retryOn401 = true } = {},
) => {
  const response = await performRequest(
    (activeToken) =>
      fetch(buildUrl(path, query), {
        method,
        headers: {
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
    { token, retryOn401 },
  );

  if (!response.ok) {
    const payload = await parseJson(response);
    throw new ApiError(
      translateMessage(payload.message, "Une erreur est survenue."),
      response.status,
      payload,
    );
  }

  return response.blob();
};

export const requestFormData = async (
  path,
  { method = "POST", token, headers = {}, formData, query, retryOn401 = true } = {},
) => {
  const response = await performRequest(
    (activeToken) =>
      fetch(buildUrl(path, query), {
        method,
        headers: {
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
          ...headers,
        },
        body: formData,
      }),
    { token, retryOn401 },
  );

  const payload = await parseJson(response);

  if (!response.ok) {
    throw new ApiError(
      translateMessage(payload.message, "Une erreur est survenue."),
      response.status,
      payload,
    );
  }

  return payload;
};
