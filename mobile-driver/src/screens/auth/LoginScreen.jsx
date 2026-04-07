import { StyleSheet, Text, View } from "react-native";
import { Truck, ShieldCheck } from "lucide-react-native";
import { useForm } from "react-hook-form";
import AppButton from "../../components/ui/AppButton";
import AppInput from "../../components/ui/AppInput";
import AppScreen from "../../components/ui/AppScreen";
import useAuthStore from "../../stores/authStore";
import { useThemePalette } from "../../theme/useThemePalette";

const LoginScreen = () => {
  const palette = useThemePalette();
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);

  const { control, handleSubmit } = useForm({
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const onSubmit = async (values) => {
    await login({
      identifier: values.identifier.trim(),
      password: values.password,
    });
  };

  return (
    <AppScreen scroll={false}>
      <View style={styles.container}>
        <View style={styles.topGroup}>
          <View style={[styles.heroCard, { backgroundColor: palette.primaryValue }]}>
            <View style={styles.heroHeader}>
              <View style={[styles.heroIconBox, { backgroundColor: palette.accentValue }]}>
                <Truck size={28} color={palette.primaryValue} />
              </View>
              <View style={[styles.badge, { backgroundColor: palette.overlay }]}>
                <Text style={styles.badgeText}>Driver App</Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>Connexion livreur</Text>
            <Text style={styles.heroText}>
              Connecte-toi pour voir tes missions, partager ta position et suivre
              l'etat de tes livraisons.
            </Text>
          </View>

          <View style={styles.formGroup}>
            <AppInput
              control={control}
              name="identifier"
              label="Email ou telephone"
              placeholder="driver@posapp.com"
              rules={{ required: "Identifiant requis." }}
            />
            <AppInput
              control={control}
              name="password"
              label="Mot de passe"
              placeholder="Votre mot de passe"
              secureTextEntry
              rules={{ required: "Mot de passe requis." }}
            />
            {error ? <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text> : null}
            <AppButton
              label={loading ? "Connexion..." : "Se connecter"}
              onPress={handleSubmit(onSubmit)}
              loading={loading}
            />
          </View>
        </View>

        <View style={styles.footerRow}>
          <ShieldCheck size={18} color={palette.textSecondary} />
          <Text style={[styles.footerText, { color: palette.textSecondary }]}>
            Phase 1 : socle mobile livreur. Les APIs d'assignation et de tracking
            seront branchees dans la phase suivante.
          </Text>
        </View>
      </View>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  topGroup: {
    gap: 32,
  },
  heroCard: {
    borderRadius: 32,
    padding: 24,
  },
  heroHeader: {
    marginBottom: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroIconBox: {
    height: 56,
    width: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 2,
    color: "#FFFFFF",
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  heroText: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 24,
    color: "rgba(255,255,255,0.8)",
  },
  formGroup: {
    gap: 16,
  },
  errorText: {
    fontSize: 14,
  },
  footerRow: {
    marginTop: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  footerText: {
    flex: 1,
    fontSize: 14,
  },
});

export default LoginScreen;
