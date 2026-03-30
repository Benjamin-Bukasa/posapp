import { translateMessage } from "../utils/translateMessage";

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

export const requestJson = async (
  path,
  { method = "GET", token, headers = {}, body, query } = {},
) => {
  const response = await fetch(buildUrl(path, query), {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

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
  { method = "GET", token, headers = {}, body, query } = {},
) => {
  const response = await fetch(buildUrl(path, query), {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

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
  { method = "POST", token, headers = {}, formData, query } = {},
) => {
  const response = await fetch(buildUrl(path, query), {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: formData,
  });

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
