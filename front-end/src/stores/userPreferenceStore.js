import { create } from "zustand";
import { apiGet, apiPatch } from "../services/apiClient";
import useThemeStore from "./themeStore";

export const DEFAULT_USER_PREFERENCES = {
  theme: null,
  primaryColor: "green",
  secondaryColor: "green",
  accentColor: "green",
  printerMode: "browser",
  printerServiceUrl: "",
  printerName: "",
  autoPrintReceipt: true,
  showSecondaryAmounts: true,
};

const normalizePreferences = (payload = {}) => ({
  ...DEFAULT_USER_PREFERENCES,
  ...(payload || {}),
  autoPrintReceipt:
    payload?.autoPrintReceipt === undefined
      ? DEFAULT_USER_PREFERENCES.autoPrintReceipt
      : Boolean(payload.autoPrintReceipt),
  showSecondaryAmounts:
    payload?.showSecondaryAmounts === undefined
      ? DEFAULT_USER_PREFERENCES.showSecondaryAmounts
      : Boolean(payload.showSecondaryAmounts),
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

  loadPreferences: async ({ force = false } = {}) => {
    if (get().loading) return get().preferences;
    if (get().loaded && !force) return get().preferences;

    set({ loading: true, error: null });
    try {
      const payload = await apiGet("/api/users/me/preferences");
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

  savePreferences: async (patch = {}) => {
    set({ saving: true, error: null });
    try {
      const payload = await apiPatch("/api/users/me/preferences", patch);
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
