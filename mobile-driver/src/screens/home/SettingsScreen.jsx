import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  ArrowUp,
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  KeyRound,
  Languages,
  Link2,
  LogOut,
  MoonStar,
  Palette,
  ShieldCheck,
  Smartphone,
  SunMedium,
  UserRound,
} from "lucide-react-native";
import AppScreen from "../../components/ui/AppScreen";
import useAuthStore from "../../stores/authStore";
import useThemeStore from "../../stores/themeStore";
import { COLOR_OPTIONS } from "../../theme/appearance";
import { useThemePalette } from "../../theme/useThemePalette";

const SettingRow = ({
  icon: Icon,
  label,
  value,
  palette,
  onPress,
  right,
  danger = false,
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.row,
      {
        backgroundColor: palette.surface,
        opacity: pressed ? 0.82 : 1,
      },
    ]}
  >
    <View style={styles.rowLeft}>
      <View style={[styles.iconWrap, { backgroundColor: palette.mutedSurface }]}>
        <Icon size={18} color={danger ? palette.danger : palette.textPrimary} />
      </View>
      <View style={styles.rowTextWrap}>
        <Text
          style={[
            styles.rowLabel,
            { color: danger ? palette.danger : palette.textPrimary },
          ]}
        >
          {label}
        </Text>
        {value ? (
          <Text style={[styles.rowValue, { color: palette.textSecondary }]}>{value}</Text>
        ) : null}
      </View>
    </View>
    {right ?? <ChevronRight size={18} color={palette.textSecondary} />}
  </Pressable>
);

const SettingGroup = ({ title, children, palette }) => (
  <View style={styles.group}>
    <Text style={[styles.groupTitle, { color: palette.textPrimary }]}>{title}</Text>
    <View
      style={[
        styles.groupCard,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
      ]}
    >
      {children}
    </View>
  </View>
);

const PaletteSwatch = ({ option, selected, palette, onPress }) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.swatch,
      {
        backgroundColor: selected ? palette.primaryValue : palette.surface,
        borderColor: selected ? palette.primaryValue : palette.border,
      },
    ]}
  >
    <Text style={[styles.swatchLabel, { color: selected ? "#FFFFFF" : palette.textPrimary }]}>
      {option.label}
    </Text>
  </Pressable>
);

const SettingsScreen = () => {
  const navigation = useNavigation();
  const palette = useThemePalette();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const theme = useThemeStore((state) => state.theme);
  const primaryColor = useThemeStore((state) => state.primaryColor);
  const secondaryColor = useThemeStore((state) => state.secondaryColor);
  const accentColor = useThemeStore((state) => state.accentColor);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const setPalette = useThemeStore((state) => state.setPalette);
  const [faceIdEnabled, setFaceIdEnabled] = useState(true);

  const fullName = useMemo(
    () => [user?.firstName, user?.lastName].filter(Boolean).join(" "),
    [user?.firstName, user?.lastName],
  );

  return (
    <AppScreen>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            }
          }}
          style={[styles.backButton, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <ChevronLeft size={18} color={palette.textPrimary} />
        </Pressable>
        <Text style={[styles.pageTitle, { color: palette.textPrimary }]}>Settings</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <SettingGroup title="General" palette={palette}>
        <SettingRow icon={Bell} label="Notifications" palette={palette} />
        <SettingRow
          icon={theme === "dark" ? MoonStar : Palette}
          label="Appearance"
          value={theme === "dark" ? "Dark mode" : "Light mode"}
          palette={palette}
          onPress={toggleTheme}
        />
        <SettingRow icon={Languages} label="Language" value="Francais" palette={palette} />
      </SettingGroup>

      <SettingGroup title="Security" palette={palette}>
        <SettingRow
          icon={ShieldCheck}
          label="Face ID"
          palette={palette}
          right={
            <Switch
              value={faceIdEnabled}
              onValueChange={setFaceIdEnabled}
              trackColor={{
                false: "rgba(15,23,42,0.12)",
                true: palette.success,
              }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="rgba(15,23,42,0.12)"
            />
          }
        />
        <SettingRow icon={Link2} label="Linked Devices" palette={palette} />
        <SettingRow icon={KeyRound} label="Passcode" palette={palette} />
        <SettingRow
          icon={Smartphone}
          label="Transaction Confirmation"
          palette={palette}
        />
        <SettingRow icon={Fingerprint} label="Biometrics" palette={palette} />
      </SettingGroup>

      <SettingGroup title="Payments & Transfers" palette={palette}>
        <SettingRow
          icon={ArrowUp}
          label="Faster Payments System"
          value="Mobile money"
          palette={palette}
        />
      </SettingGroup>

      <SettingGroup title="Appearance" palette={palette}>
        <View style={styles.inlineInfo}>
          <View style={[styles.inlineIcon, { backgroundColor: palette.mutedSurface }]}>
            {theme === "dark" ? (
              <MoonStar size={18} color={palette.secondaryValue} />
            ) : (
              <SunMedium size={18} color={palette.secondaryValue} />
            )}
          </View>
          <View style={styles.inlineInfoText}>
            <Text style={[styles.inlineLabel, { color: palette.textPrimary }]}>Theme mode</Text>
            <Text style={[styles.inlineValue, { color: palette.textSecondary }]}>
              {theme === "dark" ? "Dark" : "Light"}
            </Text>
          </View>
          <Pressable
            onPress={toggleTheme}
            style={[
              styles.inlineAction,
              {
                backgroundColor: palette.mutedSurface,
                borderColor: palette.border,
              },
            ]}
          >
            <Text style={[styles.inlineActionText, { color: palette.textPrimary }]}>Switch</Text>
          </Pressable>
        </View>

        <View style={styles.swatchGrid}>
          {COLOR_OPTIONS.map((option) => {
            const selected =
              option.value === primaryColor &&
              option.value === secondaryColor &&
              option.value === accentColor;

            return (
              <PaletteSwatch
                key={option.value}
                option={option}
                selected={selected}
                palette={palette}
                onPress={() =>
                  setPalette({
                    primaryColor: option.value,
                    secondaryColor: option.value,
                    accentColor: option.value,
                  })
                }
              />
            );
          })}
        </View>
      </SettingGroup>

      <SettingGroup title="Account" palette={palette}>
        <SettingRow
          icon={UserRound}
          label="Driver profile"
          value={fullName || "Driver"}
          palette={palette}
        />
        <SettingRow
          icon={Building2}
          label="Assigned store"
          value={user?.storeName || "No store"}
          palette={palette}
        />
        <SettingRow
          icon={LogOut}
          label="Sign out"
          palette={palette}
          danger
          onPress={logout}
          right={<ChevronRight size={18} color={palette.danger} />}
        />
      </SettingGroup>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  topBarSpacer: {
    width: 36,
    height: 36,
  },
  group: {
    gap: 12,
  },
  groupTitle: {
    fontSize: 17,
    fontWeight: "700",
    paddingHorizontal: 4,
  },
  groupCard: {
    borderRadius: 26,
    borderWidth: 0.5,
    paddingHorizontal: 18,
    paddingVertical: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  row: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTextWrap: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  rowValue: {
    marginTop: 4,
    fontSize: 12,
  },
  inlineInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  inlineIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineInfoText: {
    flex: 1,
  },
  inlineLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  inlineValue: {
    marginTop: 4,
    fontSize: 12,
  },
  inlineAction: {
    borderRadius: 14,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inlineActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  swatchGrid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  swatch: {
    borderRadius: 16,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  swatchLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
});

export default SettingsScreen;
