import { StyleSheet, Text, TextInput, View } from "react-native";
import { Controller } from "react-hook-form";
import { useThemePalette } from "../../theme/useThemePalette";

const AppInput = ({
  control,
  name,
  label,
  placeholder,
  secureTextEntry = false,
  rules,
  keyboardType = "default",
  autoCapitalize = "none",
}) => {
  const palette = useThemePalette();

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View style={styles.wrapper}>
          <Text style={[styles.label, { color: palette.textPrimary }]}>{label}</Text>
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            placeholderTextColor={palette.textSecondary}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            style={[
              styles.input,
              {
                backgroundColor: palette.surface,
                color: palette.textPrimary,
                borderColor: error ? palette.danger : palette.border,
              },
            ]}
          />
          {error ? (
            <Text style={[styles.errorText, { color: palette.danger }]}>
              {error.message}
            </Text>
          ) : null}
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
  },
  input: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
  },
});

export default AppInput;
