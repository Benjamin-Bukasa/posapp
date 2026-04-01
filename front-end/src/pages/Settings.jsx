import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CircleHelp,
  LogOut,
  MonitorCog,
  Moon,
  Printer,
  Shield,
  Store,
  Sun,
  UserCog,
  Wallet,
  Warehouse,
} from "lucide-react";
import Button from "../components/ui/button";
import CashMovementModal from "../components/ui/cashMovementModal";
import CashSessionModal from "../components/ui/cashSessionModal";
import Input from "../components/ui/input";
import { apiGet, apiPost } from "../services/apiClient";
import useAuthStore from "../stores/authStore";
import useCurrencyStore from "../stores/currencyStore";
import useThemeStore from "../stores/themeStore";
import useToastStore from "../stores/toastStore";
import useUserPreferenceStore from "../stores/userPreferenceStore";
import { COLOR_OPTIONS, COLOR_PRESETS } from "../utils/appearance";
import {
  buildSecondaryRateLabel,
  formatPrimaryAmount,
  formatSecondaryAmount,
  hasSecondaryCurrency,
} from "../utils/currency";

const settingsCardClassName =
  "rounded-xl border border-border bg-surface p-4 shadow-sm";

const displayValue = (value, fallback = "Non renseigne") => {
  if (value === null || value === undefined || value === "") return fallback;
  return value;
};

const themeLabel = (theme) => (theme === "dark" ? "Sombre" : "Clair");

function Settings() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const changePassword = useAuthStore((state) => state.changePassword);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const primaryColor = useThemeStore((state) => state.primaryColor);
  const secondaryColor = useThemeStore((state) => state.secondaryColor);
  const accentColor = useThemeStore((state) => state.accentColor);
  const setPalette = useThemeStore((state) => state.setPalette);
  const currencySettings = useCurrencyStore((state) => state.settings);
  const loadCurrencySettings = useCurrencyStore((state) => state.loadSettings);
  const currencyLoading = useCurrencyStore((state) => state.loading);
  const showToast = useToastStore((state) => state.showToast);
  const preferences = useUserPreferenceStore((state) => state.preferences);
  const loadPreferences = useUserPreferenceStore((state) => state.loadPreferences);
  const savePreferences = useUserPreferenceStore((state) => state.savePreferences);
  const preferenceLoading = useUserPreferenceStore((state) => state.loading);
  const preferenceSaving = useUserPreferenceStore((state) => state.saving);

  const [printerForm, setPrinterForm] = useState({
    printerMode: "browser",
    printerServiceUrl: "",
    printerName: "",
    autoPrintReceipt: true,
    showSecondaryAmounts: true,
  });
  const [appearanceForm, setAppearanceForm] = useState({
    primaryColor: "green",
    secondaryColor: "green",
    accentColor: "green",
  });
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [zoneName, setZoneName] = useState("");
  const [cashSession, setCashSession] = useState(null);
  const [cashSessionLoading, setCashSessionLoading] = useState(false);
  const [cashSessionSubmitting, setCashSessionSubmitting] = useState(false);
  const [isOpenCashModalOpen, setIsOpenCashModalOpen] = useState(false);
  const [isCloseCashModalOpen, setIsCloseCashModalOpen] = useState(false);
  const [cashMovementType, setCashMovementType] = useState("IN");
  const [isCashMovementModalOpen, setIsCashMovementModalOpen] = useState(false);

  useEffect(() => {
    loadCurrencySettings();
    loadPreferences();
  }, [loadCurrencySettings, loadPreferences]);

  const loadCashSession = async ({ silent = false } = {}) => {
    if (!silent) {
      setCashSessionLoading(true);
    }

    try {
      const session = await apiGet("/api/cash-sessions/current");
      setCashSession(session || null);
    } catch (error) {
      if (error.status === 404) {
        setCashSession(null);
      } else if (!silent) {
        showToast({
          title: "Caisse",
          message: error.message || "Impossible de charger l'etat de la caisse.",
          variant: "warning",
        });
      }
    } finally {
      if (!silent) {
        setCashSessionLoading(false);
      }
    }
  };

  useEffect(() => {
    loadCashSession();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadZoneName = async () => {
      if (!user?.defaultStorageZoneId) {
        setZoneName("");
        return;
      }

      try {
        const payload = await apiGet("/api/storage-zones");
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
        const zone = rows.find(
          (item) => String(item.id) === String(user.defaultStorageZoneId),
        );
        if (!cancelled) {
          setZoneName(zone?.name || "");
        }
      } catch (_error) {
        if (!cancelled) {
          setZoneName("");
        }
      }
    };

    loadZoneName();

    return () => {
      cancelled = true;
    };
  }, [user?.defaultStorageZoneId]);

  useEffect(() => {
    setPrinterForm({
      printerMode: preferences.printerMode || "browser",
      printerServiceUrl: preferences.printerServiceUrl || "",
      printerName: preferences.printerName || "",
      autoPrintReceipt: preferences.autoPrintReceipt !== false,
      showSecondaryAmounts: preferences.showSecondaryAmounts !== false,
    });
  }, [preferences]);

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
        value:
          [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
          user?.email ||
          "Utilisateur",
      },
      { label: "Role", value: displayValue(user?.role, "USER") },
      { label: "Email", value: displayValue(user?.email) },
      { label: "Telephone", value: displayValue(user?.phone) },
    ],
    [user],
  );

  const locationItems = useMemo(
    () => [
      { label: "Boutique", value: displayValue(user?.storeName) },
      {
        label: "Zone de stockage",
        value: displayValue(zoneName, "Zone non definie"),
      },
<<<<<<< HEAD
      { label: "Tenant", value: displayValue(user?.tenantName, "POSapp") },
=======
      { label: "Tenant", value: displayValue(user?.tenantName, "NEOPHARMA") },
>>>>>>> aed4c876093dd2e186d658b809f50bca4071b79d
    ],
    [user, zoneName],
  );

  const currencyItems = useMemo(() => {
    const items = [
      {
        label: "Devise principale",
        value: displayValue(currencySettings.primaryCurrencyCode, "USD"),
      },
    ];

    if (hasSecondaryCurrency(currencySettings)) {
      items.push({
        label: "Devise secondaire",
        value: currencySettings.secondaryCurrencyCode,
      });
      items.push({
        label: "Taux de conversion",
        value: buildSecondaryRateLabel(currencySettings),
      });
    } else {
      items.push({
        label: "Devise secondaire",
        value: "Aucune devise secondaire active",
      });
    }

    return items;
  }, [currencySettings]);

  const secondaryEnabled = hasSecondaryCurrency(currencySettings);

  const handleLogout = async () => {
    await logout();
    showToast({
      title: "Deconnexion",
      message: "Votre session a ete fermee.",
      variant: "success",
    });
    navigate("/login", { replace: true });
  };

  const handleSaveTheme = async (nextTheme) => {
    const appearancePatch = {
      theme: nextTheme,
      primaryColor,
      secondaryColor,
      accentColor,
    };
    setTheme(nextTheme);
    try {
      await savePreferences(appearancePatch);
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
      await savePreferences(appearanceForm);
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

  const handleSavePrinterSettings = async () => {
    try {
      await savePreferences(printerForm);
      showToast({
        title: "Preferences enregistrees",
        message: "Les parametres imprimante et caisse ont ete sauvegardes.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        title: "Erreur",
        message: error.message || "Impossible de sauvegarder les preferences.",
        variant: "danger",
      });
    }
  };

  const handleOpenCashSession = async ({ amount, note }) => {
    setCashSessionSubmitting(true);
    try {
      const session = await apiPost("/api/cash-sessions/open", {
        openingFloat: amount,
        note,
      });
      setCashSession(session);
      setIsOpenCashModalOpen(false);
      showToast({
        title: "Caisse ouverte",
        message: `Fonds initial: ${formatPrimaryAmount(amount, currencySettings)}`,
        variant: "success",
      });
    } catch (error) {
      showToast({
        title: "Ouverture impossible",
        message: error.message || "Impossible d'ouvrir la caisse.",
        variant: "danger",
      });
    } finally {
      setCashSessionSubmitting(false);
    }
  };

  const handleCloseCashSession = async ({ amount, note }) => {
    if (!cashSession?.id) return;

    setCashSessionSubmitting(true);
    try {
      const closedSession = await apiPost(`/api/cash-sessions/${cashSession.id}/close`, {
        countedCash: amount,
        note,
      });
      setCashSession(null);
      setIsCloseCashModalOpen(false);
      showToast({
        title: "Caisse cloturee",
        message:
          closedSession?.variance != null
            ? `Ecart: ${formatPrimaryAmount(closedSession.variance, currencySettings)}`
            : "La session de caisse a ete cloturee.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        title: "Cloture impossible",
        message: error.message || "Impossible de cloturer la caisse.",
        variant: "danger",
      });
    } finally {
      setCashSessionSubmitting(false);
    }
  };

  const handleCashMovement = async ({ type, amount, reason, note }) => {
    if (!cashSession?.id) return;

    setCashSessionSubmitting(true);
    try {
      const updatedSession = await apiPost(`/api/cash-sessions/${cashSession.id}/movements`, {
        type,
        amount,
        reason,
        note,
      });
      setCashSession(updatedSession);
      setIsCashMovementModalOpen(false);
      showToast({
        title: type === "IN" ? "Entree de caisse" : "Sortie de caisse",
        message: `${formatPrimaryAmount(amount, currencySettings)} enregistre.`,
        variant: "success",
      });
    } catch (error) {
      showToast({
        title: "Mouvement de caisse",
        message: error.message || "Impossible d'enregistrer ce mouvement de caisse.",
        variant: "danger",
      });
    } finally {
      setCashSessionSubmitting(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      showToast({
        title: "Champs requis",
        message: "Remplissez tous les champs du bloc securite.",
        variant: "warning",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast({
        title: "Erreur",
        message: "Les mots de passe ne correspondent pas.",
        variant: "danger",
      });
      return;
    }

    setPasswordSaving(true);
    try {
      const result = await changePassword({ oldPassword, newPassword });
      if (!result?.success) {
        throw new Error(result?.message || "Impossible de modifier le mot de passe.");
      }

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast({
        title: "Mot de passe mis a jour",
        message: result.message || "Le mot de passe a ete modifie.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        title: "Erreur",
        message: error.message || "Impossible de modifier le mot de passe.",
        variant: "danger",
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <section className="w-full h-full flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Parametres</h1>
        <p className="text-sm text-text-secondary">
          Preferences d'affichage, impression, caisse et securite du compte.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className={settingsCardClassName}>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <MonitorCog size={18} />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-text-primary">Apparence</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Theme visuel persiste sur votre compte utilisateur.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handleSaveTheme("light")}
              disabled={preferenceSaving}
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
              disabled={preferenceSaving}
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

        <div className={settingsCardClassName}>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-secondary/15 p-3 text-secondary">
              <MonitorCog size={18} />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-text-primary">Couleurs</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Personnalisez les couleurs principales de l'interface.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4">
            {[
              { key: "primaryColor", label: "Primary color" },
              { key: "secondaryColor", label: "Secondary color" },
              { key: "accentColor", label: "Accent color" },
            ].map((field) => (
              <div key={field.key} className="grid gap-2">
                <label className="text-sm font-medium text-text-primary">
                  {field.label}
                </label>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <select
                    value={appearanceForm[field.key]}
                    onChange={(event) =>
                      setAppearanceForm((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent"
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
                        backgroundColor: `rgb(${
                          field.key === "primaryColor"
                            ? COLOR_PRESETS[appearanceForm[field.key]].primary
                            : field.key === "secondaryColor"
                              ? COLOR_PRESETS[appearanceForm[field.key]].secondary
                              : COLOR_PRESETS[appearanceForm[field.key]].accent
                        })`,
                      }}
                    />
                    <span className="text-sm text-text-secondary">
                      {COLOR_OPTIONS.find((option) => option.value === appearanceForm[field.key])?.label}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              label={preferenceSaving ? "Sauvegarde..." : "Sauvegarder les couleurs"}
              variant="primary"
              size="small"
              disabled={preferenceSaving || preferenceLoading}
              onClick={handleSaveColors}
            />
          </div>
        </div>

        <div className={settingsCardClassName}>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-success/10 p-3 text-success">
              <Wallet size={18} />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-text-primary">Devise de travail</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Devise active appliquee dans la caisse et les rapports.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {currencyItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3 text-sm"
              >
                <span className="text-text-secondary">{item.label}</span>
                <span className="text-right font-medium text-text-primary">
                  {currencyLoading ? "Chargement..." : item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={settingsCardClassName}>
          <div className="flex items-start gap-3">
            <div
              className={[
                "rounded-xl p-3",
                cashSession ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
              ].join(" ")}
            >
              <Wallet size={18} />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-text-primary">
                Session de caisse
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                Ouvrez, alimentez ou cloturez la caisse depuis ce panneau.
              </p>
            </div>
          </div>

          <div
            className={[
              "mt-4 rounded-xl border px-4 py-3",
              cashSession ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {cashSessionLoading
                    ? "Chargement..."
                    : cashSession
                      ? "Caisse ouverte"
                      : "Aucune caisse ouverte"}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {cashSession
                    ? `Boutique: ${cashSession.storeName || user?.storeName || "--"} - Zone: ${cashSession.storageZoneName || zoneName || "--"}`
                    : "Ouvrez une caisse avant d'encaisser des ventes."}
                </p>
              </div>
              <span
                className={[
                  "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                  cashSession ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
                ].join(" ")}
              >
                {cashSession ? "Ouverte" : "Fermee"}
              </span>
            </div>
          </div>

          {cashSession ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-text-secondary">Fonds initial</p>
                <p className="mt-2 text-sm font-semibold text-text-primary">
                  {formatPrimaryAmount(cashSession.openingFloat || 0, currencySettings)}
                </p>
                {secondaryEnabled ? (
                  <p className="text-[11px] text-text-secondary">
                    {formatSecondaryAmount(cashSession.openingFloat || 0, currencySettings)}
                  </p>
                ) : null}
              </div>
              <div className="rounded-xl border border-border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-text-secondary">Cash theorique</p>
                <p className="mt-2 text-sm font-semibold text-text-primary">
                  {formatPrimaryAmount(cashSession.expectedCash || 0, currencySettings)}
                </p>
                {secondaryEnabled ? (
                  <p className="text-[11px] text-text-secondary">
                    {formatSecondaryAmount(cashSession.expectedCash || 0, currencySettings)}
                  </p>
                ) : null}
              </div>
              <div className="rounded-xl border border-border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-text-secondary">Ventes cash</p>
                <p className="mt-2 text-sm font-semibold text-text-primary">
                  {formatPrimaryAmount(cashSession.totalCashSales || 0, currencySettings)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-text-secondary">Ventes non cash</p>
                <p className="mt-2 text-sm font-semibold text-text-primary">
                  {formatPrimaryAmount(cashSession.totalNonCashSales || 0, currencySettings)}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {cashSession ? (
              <>
                <Button
                  type="button"
                  label="Entree caisse"
                  variant="default"
                  size="small"
                  onClick={() => {
                    setCashMovementType("IN");
                    setIsCashMovementModalOpen(true);
                  }}
                />
                <Button
                  type="button"
                  label="Sortie caisse"
                  variant="default"
                  size="small"
                  onClick={() => {
                    setCashMovementType("OUT");
                    setIsCashMovementModalOpen(true);
                  }}
                />
                <Button
                  type="button"
                  label="Cloturer la caisse"
                  variant="primary"
                  size="small"
                  onClick={() => setIsCloseCashModalOpen(true)}
                />
              </>
            ) : (
              <Button
                type="button"
                label="Ouvrir la caisse"
                variant="primary"
                size="small"
                onClick={() => setIsOpenCashModalOpen(true)}
                disabled={cashSessionLoading}
              />
            )}
          </div>
        </div>

        <div className={settingsCardClassName}>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-accent/20 p-3 text-primary">
              <Printer size={18} />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-text-primary">
                Parametres imprimante / caisse
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                Reglages reels utilises par la caisse pour l'impression et
                l'affichage secondaire.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-primary">
                Mode d'impression
              </label>
              <select
                value={printerForm.printerMode}
                onChange={(event) =>
                  setPrinterForm((current) => ({
                    ...current,
                    printerMode: event.target.value,
                  }))
                }
                className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent"
              >
                <option value="browser">Navigateur</option>
                <option value="local_service">Service local ESC/POS</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-primary">
                Nom de l'imprimante
              </label>
              <input
                type="text"
                value={printerForm.printerName}
                onChange={(event) =>
                  setPrinterForm((current) => ({
                    ...current,
                    printerName: event.target.value,
                  }))
                }
                placeholder="POS-80C"
                className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent"
              />
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-sm font-medium text-text-primary">
                URL du service local
              </label>
              <input
                type="text"
                value={printerForm.printerServiceUrl}
                onChange={(event) =>
                  setPrinterForm((current) => ({
                    ...current,
                    printerServiceUrl: event.target.value,
                  }))
                }
                placeholder="http://127.0.0.1:3211"
                className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent"
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="inline-flex items-center gap-3 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={printerForm.autoPrintReceipt}
                onChange={(event) =>
                  setPrinterForm((current) => ({
                    ...current,
                    autoPrintReceipt: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-border text-secondary accent-secondary"
              />
              Imprimer automatiquement le ticket apres la vente
            </label>
            <label className="inline-flex items-center gap-3 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={printerForm.showSecondaryAmounts}
                onChange={(event) =>
                  setPrinterForm((current) => ({
                    ...current,
                    showSecondaryAmounts: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-border text-secondary accent-secondary"
              />
              Afficher les equivalents en devise secondaire dans la caisse
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              label={preferenceSaving ? "Sauvegarde..." : "Sauvegarder"}
              variant="primary"
              size="small"
              disabled={preferenceSaving || preferenceLoading}
              onClick={handleSavePrinterSettings}
            />
          </div>
        </div>


      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={settingsCardClassName}>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-accent/20 p-3 text-primary">
              <Store size={18} />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-text-primary">
                Contexte de travail
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                Boutique, zone et tenant utilises par votre session.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {locationItems.map((item, index) => (
              <div
                key={item.label}
                className="rounded-xl border border-border bg-background px-4 py-3"
              >
                <div className="flex items-center gap-2 text-text-secondary">
                  {index === 0 ? <Store size={15} /> : <Warehouse size={15} />}
                  <span className="text-xs uppercase tracking-wide">{item.label}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-text-primary">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={settingsCardClassName}>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-secondary/15 p-3 text-secondary">
              <UserCog size={18} />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-text-primary">Raccourcis</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Accedez rapidement aux ecrans lies a votre compte.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <Link
              to="/profile"
              className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary transition hover:border-primary/40"
            >
              <div className="flex items-center gap-3">
                <UserCog size={16} />
                <span>Gerer mon profil</span>
              </div>
              <span className="text-text-secondary">Ouvrir</span>
            </Link>

            <Link
              to="/help"
              className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary transition hover:border-primary/40"
            >
              <div className="flex items-center gap-3">
                <CircleHelp size={16} />
                <span>Aide et assistance</span>
              </div>
              <span className="text-text-secondary">Ouvrir</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary transition hover:border-danger/40"
            >
              <div className="flex items-center gap-3">
                <LogOut size={16} />
                <span>Fermer la session</span>
              </div>
              <span className="text-text-secondary">Quitter</span>
            </button>
          </div>
        </div>
      </div>

      <CashSessionModal
        mode="open"
        isOpen={isOpenCashModalOpen}
        session={cashSession}
        currencySettings={currencySettings}
        submitting={cashSessionSubmitting}
        onClose={() => {
          if (cashSessionSubmitting) return;
          setIsOpenCashModalOpen(false);
        }}
        onSubmit={handleOpenCashSession}
      />
      <CashSessionModal
        mode="close"
        isOpen={isCloseCashModalOpen}
        session={cashSession}
        currencySettings={currencySettings}
        submitting={cashSessionSubmitting}
        onClose={() => {
          if (cashSessionSubmitting) return;
          setIsCloseCashModalOpen(false);
        }}
        onSubmit={handleCloseCashSession}
      />
      <CashMovementModal
        type={cashMovementType}
        isOpen={isCashMovementModalOpen}
        currencySettings={currencySettings}
        submitting={cashSessionSubmitting}
        onClose={() => {
          if (cashSessionSubmitting) return;
          setIsCashMovementModalOpen(false);
        }}
        onSubmit={handleCashMovement}
      />
    </section>
  );
}

export default Settings;
