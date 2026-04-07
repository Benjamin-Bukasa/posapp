import { StyleSheet, Text, View } from "react-native";
import { useThemePalette } from "../../theme/useThemePalette";

const SectionCard = ({ title, subtitle, right, children }) => {
  const palette = useThemePalette();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
          shadowColor: "#C78059",
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.title, { color: palette.textPrimary }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{subtitle}</Text>
          ) : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 0.5,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
  },
});

export default SectionCard;
