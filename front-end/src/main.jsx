import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import routes from "./routes/router";
import useThemeStore from "./stores/themeStore";
import useAuthStore from "./stores/authStore";
import useCurrencyStore from "./stores/currencyStore";
import useUserPreferenceStore from "./stores/userPreferenceStore";
import ToastContainer from "./components/ui/toast";
import { initRealtimeListeners } from "./services/realtimeListeners";

useThemeStore.getState().initTheme();
useAuthStore.getState().init();
if (useAuthStore.getState().isAuthenticated) {
  useCurrencyStore.getState().loadSettings();
  useUserPreferenceStore.getState().loadPreferences();
}

const syncCurrencySettings = () => {
  if (useAuthStore.getState().isAuthenticated) {
    useCurrencyStore.getState().loadSettings({ force: true });
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("focus", syncCurrencySettings);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      syncCurrencySettings();
    }
  });
}

useAuthStore.subscribe((state, previousState) => {
  if (state.isAuthenticated && state.accessToken !== previousState.accessToken) {
    useCurrencyStore.getState().loadSettings({ force: true });
    useUserPreferenceStore.getState().loadPreferences({ force: true });
  }

  if (!state.isAuthenticated && previousState.isAuthenticated) {
    useCurrencyStore.getState().reset();
    useUserPreferenceStore.getState().reset();
  }
});
initRealtimeListeners();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={routes} />
    <ToastContainer />
  </StrictMode>,
)
