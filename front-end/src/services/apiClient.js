import { translateMessage } from "../utils/translateMessage";
import useAuthStore from "../stores/authStore";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const buildUrl = (path) => {
  if (!path) return API_URL;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_URL}${path}`;
};

const getToken = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token");
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

const buildQuery = (params = {}) => {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );
  if (entries.length === 0) return "";
  const searchParams = new URLSearchParams();
  entries.forEach(([key, value]) => searchParams.append(key, String(value)));
  return searchParams.toString();
};

const apiRequest = async (path, options = {}) => {
  const { method = "GET", body, headers = {}, retryOn401 = true } = options;
  const init = {
    method,
    headers: {
      Accept: "application/json",
      ...headers,
    },
  };

  const execute = async (activeToken) => {
    const nextInit = {
      ...init,
      headers: {
        ...init.headers,
      },
    };

    if (activeToken) {
      nextInit.headers.Authorization = `Bearer ${activeToken}`;
    }

    if (body !== undefined) {
      if (body instanceof FormData) {
        nextInit.body = body;
      } else {
        nextInit.headers["Content-Type"] = "application/json";
        nextInit.body = JSON.stringify(body);
      }
    }

    return fetch(buildUrl(path), nextInit);
  };

  let token = getToken();
  let response = await execute(token);

  if (response.status === 401 && retryOn401 && token) {
    const refreshed = await refreshAccessToken();
    token = refreshed.accessToken;
    response = await execute(token);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      translateMessage(data?.message, "La requete a echoue."),
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

const apiGet = (path) => apiRequest(path);
const apiPost = (path, body) => apiRequest(path, { method: "POST", body });
const apiPatch = (path, body) => apiRequest(path, { method: "PATCH", body });
const apiDelete = (path, body) => apiRequest(path, { method: "DELETE", body });

export { apiGet, apiPost, apiPatch, apiDelete, buildQuery, buildUrl, API_URL };
