import { useEffect, useMemo, useRef, useState } from "react";
import { loadGoogleIdentityScript } from "../../utils/googleIdentity";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const GoogleSignInButton = ({
  onCredential,
  onError,
  disabled = false,
  className = "",
}) => {
  const buttonRef = useRef(null);
  const callbackRef = useRef(onCredential);
  const errorRef = useRef(onError);
  const [isReady, setIsReady] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);

  const isDisabled = disabled || isWorking || !GOOGLE_CLIENT_ID;

  const renderButton = useMemo(
    () => () => {
      if (!buttonRef.current || !window.google?.accounts?.id || !GOOGLE_CLIENT_ID) {
        return;
      }

      const width = Math.max(240, Math.round(buttonRef.current.offsetWidth || 320));
      buttonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: String(width),
      });
      setIsReady(true);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    let resizeObserver = null;

    if (!GOOGLE_CLIENT_ID) {
      setIsReady(false);
      return undefined;
    }

    loadGoogleIdentityScript()
      .then((google) => {
        if (cancelled || !google?.accounts?.id) {
          return;
        }

        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            if (!response?.credential) {
              errorRef.current?.("Reponse Google invalide.");
              return;
            }

            setIsWorking(true);
            try {
              await callbackRef.current?.(response.credential);
            } finally {
              setIsWorking(false);
            }
          },
        });

        renderButton();
        resizeObserver = new ResizeObserver(() => renderButton());
        if (buttonRef.current) {
          resizeObserver.observe(buttonRef.current);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          errorRef.current?.(error.message || "Connexion Google indisponible.");
        }
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
    };
  }, [renderButton]);

  return (
    <div className={className}>
      <div
        ref={buttonRef}
        className={`min-h-[44px] w-full overflow-hidden rounded-lg ${
          isDisabled ? "pointer-events-none opacity-60" : ""
        }`}
      />
      {!GOOGLE_CLIENT_ID ? (
        <p className="mt-2 text-xs text-danger">
          VITE_GOOGLE_CLIENT_ID manquant pour activer Google.
        </p>
      ) : null}
      {GOOGLE_CLIENT_ID && !isReady ? (
        <p className="mt-2 text-xs text-text-secondary">
          Chargement de Google...
        </p>
      ) : null}
    </div>
  );
};

export default GoogleSignInButton;
