import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_APPEARANCE,
  normalizeColorChoice,
} from "../theme/appearance";

const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: DEFAULT_APPEARANCE.theme,
      primaryColor: DEFAULT_APPEARANCE.primaryColor,
      secondaryColor: DEFAULT_APPEARANCE.secondaryColor,
      accentColor: DEFAULT_APPEARANCE.accentColor,
      initialized: false,
      initTheme: () => {
        if (get().initialized) {
          return;
        }
        set({ initialized: true });
      },
      setTheme: (theme) =>
        set({ theme: theme === "dark" ? "dark" : "light" }),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === "dark" ? "light" : "dark",
        })),
      setPalette: ({ primaryColor, secondaryColor, accentColor } = {}) =>
        set((state) => ({
          primaryColor: normalizeColorChoice(primaryColor, state.primaryColor),
          secondaryColor: normalizeColorChoice(
            secondaryColor,
            state.secondaryColor,
          ),
          accentColor: normalizeColorChoice(accentColor, state.accentColor),
        })),
    }),
    {
      name: "mobile-driver-theme",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        theme: state.theme,
        primaryColor: state.primaryColor,
        secondaryColor: state.secondaryColor,
        accentColor: state.accentColor,
      }),
    },
  ),
);

export default useThemeStore;
