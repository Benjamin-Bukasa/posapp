import { Pressable, StyleSheet, Text, View } from "react-native";
import { LoaderCircle } from "lucide-react-native";
import { useThemePalette } from "../../theme/useThemePalette";

const AppButton = ({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
}) => {
  const palette = useThemePalette();

  const backgroundColor =
    variant === "primary" ? palette.secondaryValue : palette.surface;
  const textColor = variant === "primary" ? "#FFFFFF" : palette.textPrimary;
  const borderColor =
    variant === "primary" ? palette.secondaryValue : palette.border;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor,
          borderWidth: 0.5,
          borderColor,
          opacity: disabled || loading ? 0.6 : 1,
          shadowColor: variant === "primary" ? palette.secondaryValue : "#000000",
        },
      ]}
    >
      <View style={styles.rowCenter}>
        {loading ? <LoaderCircle size={18} color={textColor} /> : null}
        <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  rowCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default AppButton;
