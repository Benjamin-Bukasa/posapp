import React, { useEffect, useMemo, useState } from "react";
import Button from "./button";

const DISMISS_KEY = "ios-install-hint-dismissed";

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
    ? "Sur iPhone/iPad, touchez Partager puis Sur l’écran d’accueil pour installer POSapp."
    : "Pour installer POSapp sur iPhone/iPad, ouvrez cette page dans Safari puis touchez Partager > Sur l’écran d’accueil.";

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
        <Button
          type="button"
          variant="default"
          size="small"
          className="shrink-0"
          label="Fermer"
          onClick={handleDismiss}
        />
      </div>
    </div>
  );
}

export default IosInstallHint;
