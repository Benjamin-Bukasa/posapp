import { create } from "zustand";
import { translateMessage } from "../utils/translateMessage";

const API_URL = import.meta.env.VITE_API_URL || "https://posapp-server.onrender.com";
const TOKEN_KEY = "token";
const REFRESH_KEY = "refreshToken";
const USER_KEY = "user";
const PENDING_KEY = "pendingIdentifier";

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
};

const persistAuth = ({ accessToken, refreshToken, user }) => {
  if (typeof window === "undefined") return;
  if (accessToken) window.localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) window.localStorage.setItem(REFRESH_KEY, refreshToken);
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
};

const clearAuthStorage = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.localStorage.removeItem(USER_KEY);
};

const getStoredAuth = () => {
  if (typeof window === "undefined") return {};
  const accessToken = window.localStorage.getItem(TOKEN_KEY);
  const refreshToken = window.localStorage.getItem(REFRESH_KEY);
  const userRaw = window.localStorage.getItem(USER_KEY);
  let user = null;
  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch (error) {
      user = null;
    }
  }
  return { accessToken, refreshToken, user };
};

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  requirePasswordChange: false,
  pendingIdentifier: null,

  init: () => {
    const { accessToken, refreshToken, user } = getStoredAuth();
    set({
      accessToken: accessToken || null,
      refreshToken: refreshToken || null,
      user: user || null,
      isAuthenticated: Boolean(accessToken),
    });

    if (refreshToken && (!user || !user.tenantName)) {
      get()
        .refreshSession()
        .catch(() => {});
    }
  },

  login: async ({ identifier, password, rememberMe, twoFactorCode }) => {
    set({ loading: true, error: null, requirePasswordChange: false });
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          password,
          rememberMe: Boolean(rememberMe),
          twoFactorCode,
          clientType: "frontend",
        }),
      });
      const data = await parseJson(response);

      if (!response.ok) {
        if (response.status === 403 && data.requirePasswordChange) {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(PENDING_KEY, identifier || "");
          }
          set({
            loading: false,
            requirePasswordChange: true,
            pendingIdentifier: identifier || null,
          });
          return {
            requirePasswordChange: true,
            message: translateMessage(data.message, "Changement de mot de passe requis."),
          };
        }
        throw new Error(translateMessage(data.message, "Connexion echouee."));
      }

      const accessToken = data.accessToken;
      const refreshToken = data.refreshToken;
      const user = data.user;

      persistAuth({ accessToken, refreshToken, user });

      set({
        loading: false,
        user,
        accessToken,
        refreshToken,
        isAuthenticated: true,
        requirePasswordChange: false,
        pendingIdentifier: null,
      });

      return { success: true };
    } catch (error) {
      const message = translateMessage(error.message, "Connexion echouee.");
      set({ loading: false, error: message });
      return { success: false, message };
    }
  },

  refreshSession: async () => {
    const refreshToken = get().refreshToken;
    if (!refreshToken) {
      throw new Error("Jeton de rafraichissement manquant.");
    }

    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await parseJson(response);

    if (!response.ok) {
      throw new Error(translateMessage(data.message, "Session expiree."));
    }

    const nextUser = data.user ? { ...(get().user || {}), ...data.user } : get().user;

    persistAuth({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: nextUser,
    });

    set({
      user: nextUser,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      isAuthenticated: true,
    });

    return data;
  },

  logout: async () => {
    const refreshToken = get().refreshToken;
    try {
      if (refreshToken) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (error) {
      // ignore network errors on logout
    } finally {
      clearAuthStorage();
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        requirePasswordChange: false,
        pendingIdentifier: null,
      });
    }
  },

  forgotPassword: async ({ identifier, sendVia }) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, sendVia }),
      });
      const data = await parseJson(response);
      if (!response.ok) {
        throw new Error(
          translateMessage(data.message, "Erreur lors de la demande."),
        );
      }
      set({ loading: false });
      return { success: true, message: data.message };
    } catch (error) {
      const message = translateMessage(error.message, "Erreur lors de la demande.");
      set({ loading: false, error: message });
      return { success: false, message };
    }
  },

  resetPassword: async ({ token, newPassword }) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await parseJson(response);
      if (!response.ok) {
        throw new Error(
          translateMessage(data.message, "Erreur lors du reset."),
        );
      }
      set({ loading: false });
      return { success: true, message: data.message };
    } catch (error) {
      const message = translateMessage(error.message, "Erreur lors du reset.");
      set({ loading: false, error: message });
      return { success: false, message };
    }
  },

  firstLoginChangePassword: async ({
    identifier,
    tempPassword,
    newPassword,
  }) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(
        `${API_URL}/api/auth/first-login/change-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, tempPassword, newPassword }),
        }
      );
      const data = await parseJson(response);
      if (!response.ok) {
        throw new Error(
          translateMessage(data.message, "Erreur de mise a jour."),
        );
      }

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(PENDING_KEY);
      }

      set({
        loading: false,
        requirePasswordChange: false,
        pendingIdentifier: null,
      });
      return { success: true, message: data.message };
    } catch (error) {
      const message = translateMessage(error.message, "Erreur de mise a jour.");
      set({ loading: false, error: message });
      return { success: false, message };
    }
  },

  changePassword: async ({ oldPassword, newPassword }) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${get().accessToken || ""}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await parseJson(response);
      if (!response.ok) {
        throw new Error(
          translateMessage(data.message, "Erreur de modification."),
        );
      }
      set({ loading: false });
      return { success: true, message: data.message };
    } catch (error) {
      const message = translateMessage(error.message, "Erreur de modification.");
      set({ loading: false, error: message });
      return { success: false, message };
    }
  },

  updateUser: (patch = {}) => {
    const current = get().user || {};
    const nextUser = { ...current, ...patch };
    persistAuth({ user: nextUser });
    set({ user: nextUser });
    return nextUser;
  },

  getPendingIdentifier: () => {
    const stateValue = get().pendingIdentifier;
    if (stateValue) return stateValue;
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(PENDING_KEY);
  },
}));

export default useAuthStore;
