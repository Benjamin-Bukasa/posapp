import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import routes from "./routes/router";
import useThemeStore from "./stores/themeStore";
import useAuthStore from "./stores/authStore";
import useCurrencyStore from "./stores/currencyStore";
import useUserPreferenceStore from "./stores/userPreferenceStore";
import useRealtimeStore from "./stores/realtimeStore";
import ToastContainer from "./components/ui/toast";
import { initRealtimeListeners } from "./services/realtimeListeners";

const buildRealtimeScope = (state) =>
  state?.isAuthenticated && state?.user?.id
    ? `${state.user.tenantId || "tenant"}:${state.user.id}`
    : null;

useThemeStore.getState().initTheme();
useAuthStore.getState().init();
useRealtimeStore.getState().setPersistenceScope(buildRealtimeScope(useAuthStore.getState()));
if (useAuthStore.getState().isAuthenticated) {
  useCurrencyStore.getState().loadSettings();
  useUserPreferenceStore.getState().loadPreferences();
}

const syncSessionContext = async () => {
  const auth = useAuthStore.getState();
  if (!auth.isAuthenticated) return;

  await auth.syncSessionSilently();

  if (useAuthStore.getState().isAuthenticated) {
    useCurrencyStore.getState().loadSettings({ force: true });
    useUserPreferenceStore.getState().loadPreferences({ force: true });
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("focus", () => {
    syncSessionContext();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      syncSessionContext();
    }
  });
}

useAuthStore.subscribe((state, previousState) => {
  const nextScope = buildRealtimeScope(state);
  const previousScope = buildRealtimeScope(previousState);

  if (nextScope !== previousScope) {
    useRealtimeStore.getState().setPersistenceScope(nextScope);
  }

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
