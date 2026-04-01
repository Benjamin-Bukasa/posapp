import React from "react";

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  change,
  highlight = false,
  amountLabel,
  amountValue,
}) => {
  const hasChange =
    change !== undefined && change !== null && String(change).trim() !== "";
  const numericChange = Number(change);
  const hasNumericChange = Number.isFinite(numericChange);
  const isPositive = hasNumericChange ? numericChange >= 0 : true;
  const badgeText = hasNumericChange
    ? `${isPositive ? "+" : ""}${numericChange}%`
    : String(change ?? "");

  return (
    <div
      className={[
        "rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md",
        highlight
          ? "border-transparent bg-secondary text-white"
          : "border-border bg-surface text-text-primary",
      ].join(" ")}
    >
      <div className="flex items-start justify-between">
        <div>
          <p
            className={[
              "text-xs",
              highlight ? "text-white/70" : "text-text-secondary",
            ].join(" ")}
          >
            {title}
          </p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <div
          className={[
            "flex h-10 w-10 items-center justify-center rounded-xl",
            highlight ? "bg-white/15 text-white" : "bg-background text-secondary",
          ].join(" ")}
        >
          {Icon ? <Icon size={20} /> : null}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p
          className={[
            "text-xs",
            highlight ? "text-white/70" : "text-text-secondary",
          ].join(" ")}
        >
          {subtitle}
        </p>
        {hasChange ? (
          <span
            className={[
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              highlight
                ? "bg-white/15 text-white"
                : isPositive
                  ? "bg-success/15 text-success"
                  : "bg-red-100 text-red-500 dark:bg-red-500/15 dark:text-red-300",
            ].join(" ")}
          >
            {badgeText}
          </span>
        ) : null}
      </div>
      {amountLabel || amountValue ? (
        <div className="mt-2 flex items-center justify-between text-xs">
          <span
            className={[
              highlight ? "text-white/70" : "text-text-secondary",
            ].join(" ")}
          >
            {amountLabel}
          </span>
          <span
            className={[
              "font-medium",
              highlight ? "text-white" : "text-text-primary",
            ].join(" ")}
          >
            {amountValue}
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default StatCard;
