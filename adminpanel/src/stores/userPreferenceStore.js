import { create } from "zustand";
import { requestJson } from "../api/client";
import useThemeStore from "./themeStore";

export const DEFAULT_USER_PREFERENCES = {
  theme: null,
  primaryColor: "green",
  secondaryColor: "green",
  accentColor: "green",
};

const normalizePreferences = (payload = {}) => ({
  ...DEFAULT_USER_PREFERENCES,
  ...(payload || {}),
});

const applyThemePreference = (preferences) =>
  useThemeStore.getState().applyPreferences(preferences);

const useUserPreferenceStore = create((set, get) => ({
  preferences: DEFAULT_USER_PREFERENCES,
  loading: false,
  loaded: false,
  saving: false,
  error: null,

  reset: () =>
    set({
      preferences: DEFAULT_USER_PREFERENCES,
      loading: false,
      loaded: false,
      saving: false,
      error: null,
    }),

  loadPreferences: async ({ force = false, token } = {}) => {
    if (get().loading) return get().preferences;
    if (get().loaded && !force) return get().preferences;

    set({ loading: true, error: null });
    try {
      const payload = await requestJson("/api/users/me/preferences", { token });
      const preferences = normalizePreferences(payload);
      applyThemePreference(preferences);
      set({
        preferences,
        loading: false,
        loaded: true,
        error: null,
      });
      return preferences;
    } catch (error) {
      set({
        preferences: DEFAULT_USER_PREFERENCES,
        loading: false,
        loaded: true,
        error: error.message || "Impossible de charger les preferences.",
      });
      return DEFAULT_USER_PREFERENCES;
    }
  },

  savePreferences: async (patch = {}, { token } = {}) => {
    set({ saving: true, error: null });
    try {
      const payload = await requestJson("/api/users/me/preferences", {
        method: "PATCH",
        body: patch,
        token,
      });
      const preferences = normalizePreferences(payload);
      applyThemePreference(preferences);
      set({
        preferences,
        saving: false,
        loaded: true,
        error: null,
      });
      return preferences;
    } catch (error) {
      set({
        saving: false,
        error: error.message || "Impossible de sauvegarder les preferences.",
      });
      throw error;
    }
  },
}));

export default useUserPreferenceStore;
