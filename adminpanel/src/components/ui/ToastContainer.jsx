import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";
import useToastStore from "../../stores/toastStore";

const VARIANT_STYLES = {
  success: {
    icon: CheckCircle2,
    accent: "border-success/40 text-success",
  },
  info: {
    icon: Info,
    accent: "border-secondary/40 text-secondary",
  },
  warning: {
    icon: AlertTriangle,
    accent: "border-warning/40 text-warning",
  },
  danger: {
    icon: XCircle,
    accent: "border-danger/40 text-danger",
  },
};

const ToastItem = ({ toast, onClose }) => {
  const style = VARIANT_STYLES[toast.variant] ?? VARIANT_STYLES.info;
  const Icon = style.icon;
  const actions = Array.isArray(toast.actions) ? toast.actions : [];

  return (
    <div className="toast-enter relative flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface p-4 text-text-primary shadow-lg">
      <div className={`mt-0.5 rounded-lg border p-2 ${style.accent}`}>
        <Icon size={18} strokeWidth={1.6} />
      </div>
      <div className="flex-1">
        {toast.title ? (
          <p className="text-sm font-semibold text-text-primary">{toast.title}</p>
        ) : null}
        {toast.message ? (
          <p className="mt-1 text-xs text-text-secondary">{toast.message}</p>
        ) : null}
        {actions.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {actions.map((action) => (
              <button
                key={action.id ?? action.label}
                type="button"
                onClick={() => {
                  if (typeof action.onClick === "function") {
                    action.onClick(toast);
                  }
                  if (action.closeOnClick !== false) {
                    onClose(toast.id);
                  }
                }}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-medium",
                  action.variant === "outline"
                    ? "border border-border text-text-primary hover:bg-surface/70"
                    : "bg-background text-text-primary hover:bg-surface dark:border dark:border-border dark:bg-surface dark:hover:bg-surface/70",
                ].join(" ")}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="rounded-md p-1 text-text-secondary hover:bg-surface/70 hover:text-text-primary"
        aria-label="Fermer"
      >
        <X size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
};

const ToastContainer = ({ position = "top-right", className = "" }) => {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  const positionClasses = {
    "top-right": "top-6 right-6 items-end",
    "top-left": "top-6 left-6 items-start",
    "bottom-right": "bottom-6 right-6 items-end",
    "bottom-left": "bottom-6 left-6 items-start",
  };

  const groupedToasts = toasts.reduce((accumulator, toast) => {
    const key = toast.position ?? position;
    if (!accumulator[key]) accumulator[key] = [];
    accumulator[key].push(toast);
    return accumulator;
  }, {});

  return (
    <>
      {Object.entries(groupedToasts).map(([groupKey, groupToasts]) => (
        <div
          key={groupKey}
          className={[
            "pointer-events-none fixed z-[9999] flex w-full max-w-sm flex-col gap-3",
            positionClasses[groupKey] ?? positionClasses["top-right"],
            className,
          ].join(" ")}
        >
          {groupToasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onClose={removeToast} />
            </div>
          ))}
        </div>
      ))}
    </>
  );
};

export default ToastContainer;
