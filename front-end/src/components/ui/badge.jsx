import React from "react";

const STATUS_TO_VARIANT = {
  "en stock": "success",
  disponible: "success",
  faible: "warning",
  "faible stock": "warning",
  "épuisé": "danger",
  epuisé: "danger",
  rupture: "danger",
  actif: "active",
  active: "active",
  inactif: "inactive",
  inactive: "inactive",
};

const VARIANT_CLASSES = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-danger/15 text-danger border-danger/30",
  active:
    "bg-header text-text-primary border-header dark:bg-success/15 dark:text-success dark:border-success/30",
  inactive:
    "bg-background text-text-primary border-border dark:bg-danger/15 dark:text-danger dark:border-danger/30",
  neutral: "bg-surface/80 text-text-secondary border-border",
};

const Badge = ({
  label,
  status,
  variant,
  className = "",
}) => {
  const normalizedStatus = status?.toLowerCase?.().trim?.() ?? "";
  const resolvedVariant =
    variant ||
    (normalizedStatus ? STATUS_TO_VARIANT[normalizedStatus] : undefined) ||
    "neutral";

  const content = label ?? status ?? "";

  return (
    <span
      className={[
        "inline-flex items-center rounded-lg border px-2.5 py-0 text-[10px] font-medium",
        VARIANT_CLASSES[resolvedVariant] ?? VARIANT_CLASSES.neutral,
        className,
      ].join(" ")}
    >
      {content}
    </span>
  );
};

export default Badge;
