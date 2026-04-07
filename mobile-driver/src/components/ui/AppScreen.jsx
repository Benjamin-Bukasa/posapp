import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemePalette } from "../../theme/useThemePalette";

const AppScreen = ({ children, scroll = true }) => {
  const palette = useThemePalette();

  if (!scroll) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
        <View style={styles.viewContainer}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 34,
    paddingTop: 20,
    paddingBottom: 120,
    gap: 20,
  },
  viewContainer: {
    flex: 1,
    paddingHorizontal: 34,
    paddingTop: 20,
  },
});

export default AppScreen;
