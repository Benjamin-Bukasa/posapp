import { useEffect, useMemo, useState } from "react";

const DISMISS_KEY = "adminpanel-ios-install-hint-dismissed";

const detectIos = () => {
  if (typeof window === "undefined") return false;
  const platform = window.navigator?.platform || "";
  const userAgent = window.navigator?.userAgent || "";
  return /iPad|iPhone|iPod/.test(platform) ||
    (/Mac/.test(platform) && "ontouchend" in document) ||
    /iPad|iPhone|iPod/.test(userAgent);
};

const detectStandalone = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator?.standalone === true;
};

const detectSafari = () => {
  if (typeof window === "undefined") return false;
  const userAgent = window.navigator?.userAgent || "";
  return /Safari/i.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(userAgent);
};

function IosInstallHint() {
  const [visible, setVisible] = useState(false);

  const hint = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        isIos: false,
        isStandalone: false,
        isSafari: false,
      };
    }

    return {
      isIos: detectIos(),
      isStandalone: detectStandalone(),
      isSafari: detectSafari(),
    };
  }, []);

  useEffect(() => {
    if (!hint.isIos || hint.isStandalone) return;
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(DISMISS_KEY) === "true";
    setVisible(!dismissed);
  }, [hint.isIos, hint.isStandalone]);

  if (!hint.isIos || hint.isStandalone || !visible) {
    return null;
  }

  const message = hint.isSafari
    ? "Sur iPhone/iPad, touchez Partager puis Sur l'ecran d'accueil pour installer POSapp Admin."
    : "Pour installer POSapp Admin sur iPhone/iPad, ouvrez cette page dans Safari puis touchez Partager > Sur l'ecran d'accueil.";

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "true");
    }
    setVisible(false);
  };

  return (
    <div className="border-b border-border bg-secondary/10 px-4 py-3 text-sm text-text-primary">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="leading-6">
          <strong className="font-semibold">Installer sur iPhone/iPad :</strong>{" "}
          {message}
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

export default IosInstallHint;
