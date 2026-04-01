import { useEffect, useMemo, useState } from "react";
import { MonitorCog, Moon, Palette, Sun, UserCog } from "lucide-react";
import useAuthStore from "../stores/authStore";
import useThemeStore from "../stores/themeStore";
import useToastStore from "../stores/toastStore";
import useUserPreferenceStore from "../stores/userPreferenceStore";
import { COLOR_OPTIONS, COLOR_PRESETS } from "../utils/appearance";
import { formatName } from "../utils/formatters";

const cardClassName = "rounded-xl border border-border bg-surface p-5 shadow-sm";

const themeLabel = (theme) => (theme === "dark" ? "Sombre" : "Clair");

const colorPreview = (field, value) => {
  const preset = COLOR_PRESETS[value] || COLOR_PRESETS.green;
  if (field === "primaryColor") return preset.primary;
  if (field === "secondaryColor") return preset.secondary;
  return preset.accent;
};

const SettingsPage = () => {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const primaryColor = useThemeStore((state) => state.primaryColor);
  const secondaryColor = useThemeStore((state) => state.secondaryColor);
  const accentColor = useThemeStore((state) => state.accentColor);
  const setPalette = useThemeStore((state) => state.setPalette);
  const preferences = useUserPreferenceStore((state) => state.preferences);
  const loadPreferences = useUserPreferenceStore((state) => state.loadPreferences);
  const savePreferences = useUserPreferenceStore((state) => state.savePreferences);
  const loading = useUserPreferenceStore((state) => state.loading);
  const saving = useUserPreferenceStore((state) => state.saving);
  const showToast = useToastStore((state) => state.showToast);

  const [appearanceForm, setAppearanceForm] = useState({
    primaryColor: "green",
    secondaryColor: "green",
    accentColor: "green",
  });

  useEffect(() => {
    if (!accessToken) return;
    loadPreferences({ token: accessToken });
  }, [accessToken, loadPreferences]);

  useEffect(() => {
    setAppearanceForm({
      primaryColor: preferences.primaryColor || primaryColor || "green",
      secondaryColor: preferences.secondaryColor || secondaryColor || "green",
      accentColor: preferences.accentColor || accentColor || "green",
    });
  }, [
    preferences.primaryColor,
    preferences.secondaryColor,
    preferences.accentColor,
    primaryColor,
    secondaryColor,
    accentColor,
  ]);

  const sessionItems = useMemo(
    () => [
      {
        label: "Utilisateur",
        value: formatName(user) || user?.email || "Utilisateur",
      },
      {
        label: "Role",
        value: user?.role || "ADMIN",
      },
      {
        label: "Tenant",
        value: user?.tenantName || "POSapp",
      },
    ],
    [user],
  );

  const handleSaveTheme = async (nextTheme) => {
    const appearancePatch = {
      theme: nextTheme,
      primaryColor,
      secondaryColor,
      accentColor,
    };
    setTheme(nextTheme);
    try {
      await savePreferences(appearancePatch, { token: accessToken });
      showToast({
        title: "Theme enregistre",
        message: `Le theme ${themeLabel(nextTheme).toLowerCase()} a ete sauvegarde.`,
        variant: "success",
      });
    } catch (error) {
      showToast({
        title: "Erreur",
        message: error.message || "Impossible de sauvegarder le theme.",
        variant: "danger",
      });
    }
  };

  const handleSaveColors = async () => {
    setPalette(appearanceForm);
    try {
      await savePreferences(appearanceForm, { token: accessToken });
      showToast({
        title: "Couleurs enregistrees",
        message: "Les couleurs d'affichage ont ete sauvegardees.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        title: "Erreur",
        message: error.message || "Impossible de sauvegarder les couleurs.",
        variant: "danger",
      });
    }
  };

  return (
    <section className="flex h-full w-full flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Parametres</h1>
        <p className="text-sm text-text-secondary">
          Personnalisation du theme et des couleurs de l'adminpanel.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className={cardClassName}>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <MonitorCog size={18} />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-text-primary">Apparence</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Mode clair ou sombre pour votre session admin.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handleSaveTheme("light")}
              disabled={saving}
              className={[
                "rounded-xl border px-4 py-4 text-left transition disabled:opacity-60",
                theme === "light"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:border-primary/40",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 text-text-primary">
                <Sun size={16} />
                <span className="font-medium">Mode clair</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleSaveTheme("dark")}
              disabled={saving}
              className={[
                "rounded-xl border px-4 py-4 text-left transition disabled:opacity-60",
                theme === "dark"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:border-primary/40",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 text-text-primary">
                <Moon size={16} />
                <span className="font-medium">Mode sombre</span>
              </div>
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-secondary">
            Theme actif :{" "}
            <span className="font-medium text-text-primary">{themeLabel(theme)}</span>
          </div>
        </div>

        <div className={`${cardClassName} xl:col-span-2`}>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-secondary/15 p-3 text-secondary">
              <Palette size={18} />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-text-primary">Couleurs</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Choisissez les couleurs primaire, secondaire et accent.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {[
              { key: "primaryColor", label: "Primary color" },
              { key: "secondaryColor", label: "Secondary color" },
              { key: "accentColor", label: "Accent color" },
            ].map((field) => (
              <div key={field.key} className="grid gap-2">
                <label className="text-sm font-medium text-text-primary">
                  {field.label}
                </label>
                <select
                  value={appearanceForm[field.key]}
                  onChange={(event) =>
                    setAppearanceForm((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-secondary"
                >
                  {COLOR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3">
                  <span
                    className="h-5 w-5 rounded-full border border-black/10"
                    style={{
                      backgroundColor: `rgb(${colorPreview(
                        field.key,
                        appearanceForm[field.key],
                      )})`,
                    }}
                  />
                  <span className="text-sm text-text-secondary">
                    {COLOR_OPTIONS.find((option) => option.value === appearanceForm[field.key])
                      ?.label || "Vert"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSaveColors}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Sauvegarde..." : "Sauvegarder les couleurs"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={cardClassName}>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-accent/20 p-3 text-primary">
              <UserCog size={18} />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-text-primary">Session</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Resume du compte admin connecte.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {sessionItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3 text-sm"
              >
                <span className="text-text-secondary">{item.label}</span>
                <span className="text-right font-medium text-text-primary">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SettingsPage;
