import { create } from "zustand";
import {
  applyAppearance,
  DEFAULT_APPEARANCE,
  normalizeColorChoice,
} from "../utils/appearance";

const STORAGE_KEY = "adminpanel-theme";
const PRIMARY_KEY = "adminpanel.primaryColor";
const SECONDARY_KEY = "adminpanel.secondaryColor";
const ACCENT_KEY = "adminpanel.accentColor";

const getPreferredTheme = () => {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")
    ?.matches;
  return prefersDark ? "dark" : "light";
};

const getStoredColor = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  return normalizeColorChoice(window.localStorage.getItem(key), fallback);
};

let transitionTimeout;

const applyTheme = (appearance) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add("theme-transition");
  applyAppearance(appearance);
  if (transitionTimeout) clearTimeout(transitionTimeout);
  transitionTimeout = setTimeout(() => {
    root.classList.remove("theme-transition");
  }, 350);
};

const persistTheme = (appearance) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, appearance.theme);
  window.localStorage.setItem(PRIMARY_KEY, appearance.primaryColor);
  window.localStorage.setItem(SECONDARY_KEY, appearance.secondaryColor);
  window.localStorage.setItem(ACCENT_KEY, appearance.accentColor);
};

const useThemeStore = create((set, get) => ({
  theme: DEFAULT_APPEARANCE.theme,
  primaryColor: DEFAULT_APPEARANCE.primaryColor,
  secondaryColor: DEFAULT_APPEARANCE.secondaryColor,
  accentColor: DEFAULT_APPEARANCE.accentColor,
  initTheme: () => {
    const appearance = {
      theme: getPreferredTheme(),
      primaryColor: getStoredColor(PRIMARY_KEY, DEFAULT_APPEARANCE.primaryColor),
      secondaryColor: getStoredColor(SECONDARY_KEY, DEFAULT_APPEARANCE.secondaryColor),
      accentColor: getStoredColor(ACCENT_KEY, DEFAULT_APPEARANCE.accentColor),
    };
    applyTheme(appearance);
    persistTheme(appearance);
    set(appearance);
  },
  setTheme: (theme) => {
    const nextTheme = theme === "dark" ? "dark" : "light";
    const current = get();
    const appearance = {
      theme: nextTheme,
      primaryColor: current.primaryColor,
      secondaryColor: current.secondaryColor,
      accentColor: current.accentColor,
    };
    applyTheme(appearance);
    persistTheme(appearance);
    set(appearance);
  },
  setPalette: ({ primaryColor, secondaryColor, accentColor } = {}) => {
    const current = get();
    const appearance = {
      theme: current.theme,
      primaryColor: normalizeColorChoice(primaryColor, current.primaryColor),
      secondaryColor: normalizeColorChoice(secondaryColor, current.secondaryColor),
      accentColor: normalizeColorChoice(accentColor, current.accentColor),
    };
    applyTheme(appearance);
    persistTheme(appearance);
    set(appearance);
  },
  applyPreferences: (preferences = {}) => {
    const current = get();
    const appearance = {
      theme: preferences.theme === "dark" ? "dark" : preferences.theme === "light" ? "light" : current.theme,
      primaryColor: normalizeColorChoice(preferences.primaryColor, current.primaryColor),
      secondaryColor: normalizeColorChoice(preferences.secondaryColor, current.secondaryColor),
      accentColor: normalizeColorChoice(preferences.accentColor, current.accentColor),
    };
    applyTheme(appearance);
    persistTheme(appearance);
    set(appearance);
  },
  toggleTheme: () => {
    const current = get().theme;
    const next = current === "dark" ? "light" : "dark";
    get().setTheme(next);
  },
}));

export default useThemeStore;
