import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import useThemeStore from "./stores/themeStore";
import useAuthStore from "./stores/authStore";
import useCurrencyStore from "./stores/currencyStore";
import useUserPreferenceStore from "./stores/userPreferenceStore";
import { startLotAlertPolling, stopLotAlertPolling } from "./services/lotAlertPolling";

useThemeStore.getState().initTheme();
useAuthStore.getState().init();
if (useAuthStore.getState().isAuthenticated) {
  useCurrencyStore.getState().loadSettings({
    token: useAuthStore.getState().accessToken,
  });
  useUserPreferenceStore.getState().loadPreferences({
    token: useAuthStore.getState().accessToken,
  });
  startLotAlertPolling();
}
useAuthStore.subscribe((state, previousState) => {
  if (state.isAuthenticated && state.accessToken !== previousState.accessToken) {
    useCurrencyStore.getState().loadSettings({
      token: state.accessToken,
      force: true,
    });
    useUserPreferenceStore.getState().loadPreferences({
      token: state.accessToken,
      force: true,
    });
    startLotAlertPolling();
  }

  if (!state.isAuthenticated && previousState.isAuthenticated) {
    useCurrencyStore.getState().reset();
    useUserPreferenceStore.getState().reset();
    stopLotAlertPolling();
  }
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
