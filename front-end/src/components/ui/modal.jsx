import React, { useEffect } from "react";
import { X } from "lucide-react";

const Modal = ({
  isOpen,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  onConfirm,
  onCancel,
  confirmButtonClassName = "",
  cancelButtonClassName = "",
  dialogClassName = "",
  contentClassName = "",
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="Fermer la fenetre"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={[
          "relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface shadow-2xl ring-1 ring-black/5",
          dialogClassName,
        ].join(" ")}
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              {title ? (
                <h3 className="text-xl font-semibold text-text-primary">
                  {title}
                </h3>
              ) : null}
              {description ? (
                <p className="mt-2 text-sm text-text-secondary">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg p-2 text-text-secondary hover:bg-surface/70 hover:text-text-primary"
              aria-label="Fermer"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
          {children ? <div className={["mt-4", contentClassName].join(" ")}>{children}</div> : null}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border bg-surface/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className={[
              "w-full rounded-lg bg-background px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface dark:bg-surface dark:border dark:border-border dark:hover:bg-surface/70 sm:w-auto",
              cancelButtonClassName,
            ].join(" ")}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={[
              "w-full rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white hover:bg-secondary/90 sm:w-auto",
              confirmButtonClassName,
            ].join(" ")}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
