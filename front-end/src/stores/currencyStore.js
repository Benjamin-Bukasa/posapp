import { create } from "zustand";
import { apiGet } from "../services/apiClient";
import {
  DEFAULT_CURRENCY_SETTINGS,
  normalizeCurrencySettings,
} from "../utils/currency";

const useCurrencyStore = create((set, get) => ({
  settings: DEFAULT_CURRENCY_SETTINGS,
  loading: false,
  loaded: false,
  error: null,

  reset: () =>
    set({
      settings: DEFAULT_CURRENCY_SETTINGS,
      loading: false,
      loaded: false,
      error: null,
    }),

  loadSettings: async ({ force = false } = {}) => {
    if (get().loading) return get().settings;
    if (get().loaded && !force) return get().settings;

    set({ loading: true, error: null });

    try {
      const payload = await apiGet("/api/currency-settings/current");
      const settings = normalizeCurrencySettings(payload);
      set({
        settings,
        loading: false,
        loaded: true,
        error: null,
      });
      return settings;
    } catch (error) {
      set({
        settings: DEFAULT_CURRENCY_SETTINGS,
        loading: false,
        loaded: true,
        error: error.message || "Impossible de charger la devise.",
      });
      return DEFAULT_CURRENCY_SETTINGS;
    }
  },
}));

export default useCurrencyStore;
