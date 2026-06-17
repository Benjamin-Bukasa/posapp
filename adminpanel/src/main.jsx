import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.jsx";
import useThemeStore from "./stores/themeStore";
import useAuthStore from "./stores/authStore";
import useCurrencyStore from "./stores/currencyStore";
import useUserPreferenceStore from "./stores/userPreferenceStore";
import useRealtimeStore from "./stores/realtimeStore";
import { startLotAlertPolling, stopLotAlertPolling } from "./services/lotAlertPolling";

const buildRealtimeScope = (state) =>
  state?.isAuthenticated && state?.user?.id
    ? `${state.user.tenantId || "tenant"}:${state.user.id}`
    : null;

useThemeStore.getState().initTheme();
useAuthStore.getState().init();
useRealtimeStore.getState().setPersistenceScope(buildRealtimeScope(useAuthStore.getState()));
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
  const nextScope = buildRealtimeScope(state);
  const previousScope = buildRealtimeScope(previousState);

  if (nextScope !== previousScope) {
    useRealtimeStore.getState().setPersistenceScope(nextScope);
  }

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

const updateAdminSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateAdminSW(true);
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
