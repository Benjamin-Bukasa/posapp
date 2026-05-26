import { create } from "zustand";
import { apiGet } from "../services/apiClient";
import {
  DEFAULT_RECEIPT_SETTINGS,
  normalizeReceiptSettings,
} from "../utils/receiptSettings";

const useReceiptSettingsStore = create((set, get) => ({
  settings: DEFAULT_RECEIPT_SETTINGS,
  loading: false,
  loaded: false,
  error: null,

  reset: () =>
    set({
      settings: DEFAULT_RECEIPT_SETTINGS,
      loading: false,
      loaded: false,
      error: null,
    }),

  loadSettings: async ({ force = false } = {}) => {
    if (get().loading) return get().settings;
    if (get().loaded && !force) return get().settings;

    set({ loading: true, error: null });
    try {
      const payload = await apiGet("/api/receipt-settings/current");
      const settings = normalizeReceiptSettings(payload);
      set({
        settings,
        loading: false,
        loaded: true,
        error: null,
      });
      return settings;
    } catch (error) {
      set({
        settings: DEFAULT_RECEIPT_SETTINGS,
        loading: false,
        loaded: true,
        error: error.message || "Impossible de charger les parametres du ticket.",
      });
      return DEFAULT_RECEIPT_SETTINGS;
    }
  },
}));

export default useReceiptSettingsStore;
