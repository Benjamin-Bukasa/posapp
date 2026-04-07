import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import apiClient, { setAuthTokenGetter } from "../services/api/client";
import useDebugStore from "./debugStore";
import { normalizeAppError } from "../utils/errorHandling";

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isHydrated: false,
      loading: false,
      error: null,
      setHydrated: () => set({ isHydrated: true }),
      login: async ({ identifier, password }) => {
        set({ loading: true, error: null });
        try {
          const response = await apiClient.post("/api/auth/login", {
            identifier,
            password,
            rememberMe: true,
            clientType: "frontend",
          });

          set({
            user: response.data.user,
            accessToken: response.data.accessToken,
            refreshToken: response.data.refreshToken,
            isAuthenticated: true,
            loading: false,
            error: null,
          });

          useDebugStore.getState().addLog({
            level: "info",
            scope: "auth",
            message: "Connexion reussie.",
            details: {
              userId: response.data.user?.id || null,
              email: response.data.user?.email || null,
            },
          });

          return { success: true };
        } catch (error) {
          const normalized = normalizeAppError(error, "Connexion impossible.");
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            loading: false,
            error: normalized.message,
          });
          useDebugStore.getState().addLog({
            level: "error",
            scope: "auth",
            message: normalized.message,
            details: normalized,
          });
          return { success: false, message: normalized.message };
        }
      },
      logout: async () => {
        const refreshToken = useAuthStore.getState().refreshToken;
        try {
          if (refreshToken) {
            await apiClient.post("/api/auth/logout", { refreshToken });
          }
        } catch (_error) {
          // ignore logout transport errors
        } finally {
          useDebugStore.getState().addLog({
            level: "info",
            scope: "auth",
            message: "Deconnexion locale effectuee.",
          });
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            loading: false,
            error: null,
          });
        }
      },
    }),
    {
      name: "mobile-driver-auth",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated?.();
      },
    },
  ),
);

setAuthTokenGetter(() => useAuthStore.getState().accessToken);

export default useAuthStore;
