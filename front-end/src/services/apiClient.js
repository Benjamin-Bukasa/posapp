import { translateMessage } from "../utils/translateMessage";

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
  const { method = "GET", body, headers = {} } = options;
  const init = {
    method,
    headers: {
      Accept: "application/json",
      ...headers,
    },
  };

  const token = getToken();
  if (token) {
    init.headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    if (body instanceof FormData) {
      init.body = body;
    } else {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
  }

  const response = await fetch(buildUrl(path), init);
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
const apiDelete = (path) => apiRequest(path, { method: "DELETE" });

export { apiGet, apiPost, apiPatch, apiDelete, buildQuery, buildUrl, API_URL };
