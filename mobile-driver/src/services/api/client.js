import axios from "axios";
import useDebugStore from "../../stores/debugStore";
import {
  getApiBaseUrl,
  normalizeAppError,
  serializeErrorForLog,
} from "../../utils/errorHandling";

export const API_URL = getApiBaseUrl();

let authTokenGetter = () => null;

export const setAuthTokenGetter = (getter) => {
  authTokenGetter = typeof getter === "function" ? getter : () => null;
};

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = authTokenGetter();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  useDebugStore.getState().addLog({
    level: "info",
    scope: "api",
    message: `${(config.method || "GET").toUpperCase()} ${config.baseURL || ""}${config.url || ""}`,
  });

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalized = normalizeAppError(error, "Requete API impossible.");

    useDebugStore.getState().addLog({
      level: "error",
      scope: "api",
      message: normalized.message,
      details: {
        ...serializeErrorForLog(error, "Requete API impossible."),
        method: error?.config?.method?.toUpperCase?.() || null,
        url: `${error?.config?.baseURL || ""}${error?.config?.url || ""}`,
      },
    });

    return Promise.reject(error);
  },
);

export default apiClient;
