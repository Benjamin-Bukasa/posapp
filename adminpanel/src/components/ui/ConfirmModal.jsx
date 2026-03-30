import { useEffect } from "react";
import { X } from "lucide-react";

const ConfirmModal = ({
  isOpen,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  onConfirm,
  onCancel,
  loading = false,
  confirmTone = "danger",
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const confirmClassName =
    confirmTone === "danger"
      ? "bg-danger text-white hover:bg-danger/90"
      : "bg-primary text-white hover:opacity-90";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="Fermer la fenetre"
        onClick={loading ? undefined : onCancel}
        disabled={loading}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-black/5"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              {title ? (
                <h3 className="text-xl font-semibold text-text-primary">{title}</h3>
              ) : null}
              {description ? (
                <p className="mt-2 text-sm text-text-secondary">{description}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-lg p-2 text-text-secondary hover:bg-background hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Fermer"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          {children ? <div className="mt-4">{children}</div> : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border bg-surface/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${confirmClassName}`}
          >
            {loading ? "Suppression..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
