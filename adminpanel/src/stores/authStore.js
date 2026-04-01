import { create } from "zustand";
import { translateMessage } from "../utils/translateMessage";

const API_URL = import.meta.env.VITE_API_URL || "https://posapp-server.onrender.com";
const TOKEN_KEY = "adminpanel.token";
const REFRESH_KEY = "adminpanel.refreshToken";
const USER_KEY = "adminpanel.user";
const ADMIN_ROLES = new Set(["SUPERADMIN", "ADMIN"]);

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
};

const persistAuth = ({ accessToken, refreshToken, user }) => {
  if (typeof window === "undefined") return;
  if (accessToken) {
    window.localStorage.setItem(TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    window.localStorage.setItem(REFRESH_KEY, refreshToken);
  }
  if (user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
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

const hasAdminAccess = (role) => ADMIN_ROLES.has(role);

const clearState = (set) => {
  clearAuthStorage();
  set({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    loading: false,
    error: null,
  });
};

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isInitialized: false,
  loading: false,
  error: null,

  init: async () => {
    const { accessToken, refreshToken, user } = getStoredAuth();

    if (!accessToken || !user?.id) {
      clearState(set);
      set({ isInitialized: true });
      return;
    }

    set({
      user,
      accessToken,
      refreshToken: refreshToken || null,
      isAuthenticated: true,
      loading: true,
      error: null,
      isInitialized: false,
    });

    try {
      await get().refreshCurrentUser();
    } catch (error) {
      if (refreshToken) {
        try {
          await get().refreshSession();
          await get().refreshCurrentUser();
        } catch (refreshError) {
          clearState(set);
        }
      } else {
        clearState(set);
      }
    } finally {
      set({ loading: false, isInitialized: true });
    }
  },

  login: async ({ identifier, password, rememberMe, twoFactorCode }) => {
    set({ loading: true, error: null });

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          password,
          rememberMe: Boolean(rememberMe),
          twoFactorCode,
          clientType: "adminpanel",
        }),
      });

      const data = await parseJson(response);

      if (!response.ok) {
        throw new Error(translateMessage(data.message, "Connexion echouee."));
      }

      if (!hasAdminAccess(data.user?.role)) {
        throw new Error("Acces admin reserve aux administrateurs.");
      }

      persistAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });

      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        loading: false,
        error: null,
      });

      await get().refreshCurrentUser();
      return { success: true };
    } catch (error) {
      clearState(set);
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

    persistAuth({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: get().user,
    });

    set({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      isAuthenticated: true,
    });

    return data;
  },

  refreshCurrentUser: async () => {
    const { accessToken, user } = get();
    if (!accessToken || !user?.id) {
      throw new Error("Session manquante.");
    }

    const response = await fetch(`${API_URL}/api/users/${user.id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await parseJson(response);

    if (!response.ok) {
      throw new Error(
        translateMessage(data.message, "Impossible de charger le profil."),
      );
    }

    if (!hasAdminAccess(data.role)) {
      throw new Error("Acces admin reserve aux administrateurs.");
    }

    const nextUser = { ...user, ...data };
    persistAuth({
      accessToken,
      refreshToken: get().refreshToken,
      user: nextUser,
    });

    set({
      user: nextUser,
      isAuthenticated: true,
      error: null,
    });

    return nextUser;
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
      // ignore logout transport errors
    } finally {
      clearState(set);
      set({ isInitialized: true });
    }
  },
}));

export default useAuthStore;
