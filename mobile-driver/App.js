import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import DebugErrorBoundary from "./src/components/debug/DebugErrorBoundary";
import DebugPanel from "./src/components/debug/DebugPanel";
import AppNavigator from "./src/navigation/AppNavigator";
import useAuthStore from "./src/stores/authStore";
import useThemeStore from "./src/stores/themeStore";
import { useThemePalette } from "./src/theme/useThemePalette";

const Bootstrap = () => {
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const initTheme = useThemeStore((state) => state.initTheme);
  const initialized = useThemeStore((state) => state.initialized);
  const palette = useThemePalette();

  if (!initialized) {
    initTheme();
  }

  if (!isHydrated || !initialized) {
    return (
      <View style={[styles.loader, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.secondaryValue} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={palette.theme === "dark" ? "light" : "dark"} />
      <AppNavigator />
      <DebugPanel />
    </>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <DebugErrorBoundary>
        <Bootstrap />
      </DebugErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
