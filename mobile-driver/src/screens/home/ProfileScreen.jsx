import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  BadgeCheck,
  Building2,
  LogOut,
  Mail,
  MoonStar,
  Palette,
  Phone,
  SunMedium,
} from "lucide-react-native";
import AppButton from "../../components/ui/AppButton";
import AppScreen from "../../components/ui/AppScreen";
import SectionCard from "../../components/ui/SectionCard";
import useAuthStore from "../../stores/authStore";
import useThemeStore from "../../stores/themeStore";
import { COLOR_OPTIONS } from "../../theme/appearance";
import { useThemePalette } from "../../theme/useThemePalette";

const InfoRow = ({ icon: Icon, label, value, palette }) => (
  <View style={styles.infoRow}>
    <View style={[styles.infoIcon, { backgroundColor: palette.softCard }]}>
      <Icon size={18} color={palette.secondaryValue} />
    </View>
    <View style={styles.infoTextWrap}>
      <Text style={[styles.infoLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: palette.textPrimary }]}>{value || "--"}</Text>
    </View>
  </View>
);

const ProfileScreen = () => {
  const palette = useThemePalette();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const theme = useThemeStore((state) => state.theme);
  const primaryColor = useThemeStore((state) => state.primaryColor);
  const secondaryColor = useThemeStore((state) => state.secondaryColor);
  const accentColor = useThemeStore((state) => state.accentColor);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const setPalette = useThemeStore((state) => state.setPalette);

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  return (
    <AppScreen>
      <View
        style={[
          styles.heroCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: palette.secondaryValue }]}>
          <Text style={styles.avatarText}>
            {(fullName || user?.email || "D").slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.heroName, { color: palette.textPrimary }]}>
          {fullName || "Driver"}
        </Text>
        <Text style={[styles.heroRole, { color: palette.textSecondary }]}>Delivery Partner</Text>
      </View>

      <SectionCard title="Account details" subtitle="Infos du compte livreur connecte.">
        <View style={styles.infoList}>
          <InfoRow icon={BadgeCheck} label="Nom" value={fullName} palette={palette} />
          <InfoRow icon={Mail} label="Email" value={user?.email} palette={palette} />
          <InfoRow icon={Phone} label="Telephone" value={user?.phone} palette={palette} />
          <InfoRow icon={Building2} label="Boutique" value={user?.storeName} palette={palette} />
        </View>
      </SectionCard>

      <SectionCard title="Appearance" subtitle="Light, dark and accent colors like the references.">
        <Pressable
          onPress={toggleTheme}
          style={[
            styles.themeRow,
            { backgroundColor: palette.mutedSurface, borderColor: palette.border },
          ]}
        >
          <View style={styles.themeLeft}>
            {theme === "dark" ? (
              <MoonStar size={18} color={palette.secondaryValue} />
            ) : (
              <SunMedium size={18} color={palette.secondaryValue} />
            )}
            <Text style={[styles.themeText, { color: palette.textPrimary }]}>
              Mode {theme === "dark" ? "sombre" : "clair"}
            </Text>
          </View>
          <Text style={[styles.themeHint, { color: palette.textSecondary }]}>Switch</Text>
        </Pressable>

        <View style={styles.paletteGrid}>
          {COLOR_OPTIONS.map((option) => {
            const selected =
              option.value === primaryColor &&
              option.value === secondaryColor &&
              option.value === accentColor;
            return (
              <Pressable
                key={option.value}
                onPress={() =>
                  setPalette({
                    primaryColor: option.value,
                    secondaryColor: option.value,
                    accentColor: option.value,
                  })
                }
                style={[
                  styles.paletteCard,
                  {
                    backgroundColor: selected ? palette.header : palette.mutedSurface,
                    borderColor: selected ? palette.secondaryValue : palette.border,
                  },
                ]}
              >
                <Palette size={18} color={selected ? palette.primaryValue : palette.secondaryValue} />
                <Text style={[styles.paletteLabel, { color: palette.textPrimary }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      <SectionCard title="Session" subtitle="End the current driver session on this device.">
        <AppButton label="Se deconnecter" onPress={logout} />
        <View style={styles.sessionNote}>
          <LogOut size={16} color={palette.textSecondary} />
          <Text style={[styles.sessionText, { color: palette.textSecondary }]}>
            La session locale sera effacee, puis l'ecran de connexion reapparaitra.
          </Text>
        </View>
      </SectionCard>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 22,
    borderWidth: 0.5,
    padding: 22,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
  },
  heroName: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: "800",
  },
  heroRole: {
    marginTop: 6,
    fontSize: 14,
  },
  infoList: {
    gap: 14,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    textTransform: "uppercase",
  },
  infoValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "700",
  },
  themeRow: {
    borderRadius: 16,
    borderWidth: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  themeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  themeText: {
    fontSize: 15,
    fontWeight: "700",
  },
  themeHint: {
    fontSize: 13,
  },
  paletteGrid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  paletteCard: {
    minWidth: "30%",
    borderRadius: 16,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  paletteLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  sessionNote: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sessionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
});

export default ProfileScreen;
