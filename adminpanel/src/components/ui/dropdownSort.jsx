import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, SlidersHorizontal, X } from "lucide-react";
import DropdownAction from "./dropdownAction";

const getDefaultValues = (items = [], value = {}) => ({
  sortBy: value.sortBy ?? items[0]?.id ?? "",
  sortDir: value.sortDir ?? "desc",
});

const DropdownSort = ({
  label = "Trier",
  items = [],
  value,
  onApply,
  onReset,
  buttonClassName = "",
}) => {
  const defaults = useMemo(() => getDefaultValues(items, value), [items, value]);
  const [values, setValues] = useState(defaults);

  useEffect(() => {
    setValues(defaults);
  }, [defaults]);

  if (!items.length) {
    return null;
  }

  const handleReset = () => {
    const next = { sortBy: "", sortDir: "desc" };
    setValues(next);
    if (onReset) {
      onReset(next);
      return;
    }
    onApply?.(next);
  };

  return (
    <DropdownAction
      label={
        <div className="flex items-center gap-2">
          <span>{label}</span>
          <SlidersHorizontal size={18} strokeWidth={1.5} />
        </div>
      }
      buttonClassName={[
        "rounded-lg bg-transparent px-4 py-2 font-medium text-text-primary hover:bg-surface/70 dark:bg-transparent dark:hover:bg-surface/70",
        buttonClassName,
      ].join(" ")}
      menuClassName="w-[320px] shadow-xl"
      menuBodyClassName="p-0"
    >
      {({ closeMenu }) => (
        <div className="w-full">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <SlidersHorizontal size={16} strokeWidth={1.5} />
              <span>{label}</span>
            </div>
            <button
              type="button"
              onClick={closeMenu}
              className="rounded-md p-1 text-text-secondary hover:bg-background hover:text-text-primary"
              aria-label="Fermer"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div className="grid gap-4 px-4 py-4 text-sm">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                Colonne
              </span>
              <select
                value={values.sortBy}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, sortBy: event.target.value }))
                }
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-secondary"
              >
                <option value="">Aucun tri</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                Sens
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setValues((prev) => ({ ...prev, sortDir: "asc" }))
                  }
                  className={[
                    "inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                    values.sortDir === "asc"
                      ? "border-secondary bg-secondary/10 text-secondary"
                      : "border-border bg-surface text-text-primary hover:bg-background",
                  ].join(" ")}
                >
                  <ArrowUp size={16} strokeWidth={1.5} />
                  Croissant
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setValues((prev) => ({ ...prev, sortDir: "desc" }))
                  }
                  className={[
                    "inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                    values.sortDir === "desc"
                      ? "border-secondary bg-secondary/10 text-secondary"
                      : "border-border bg-surface text-text-primary hover:bg-background",
                  ].join(" ")}
                >
                  <ArrowDown size={16} strokeWidth={1.5} />
                  Decroissant
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border bg-background/30 px-4 py-3">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-background"
            >
              Reinitialiser
            </button>
            <button
              type="button"
              onClick={() => {
                onApply?.(values);
                closeMenu();
              }}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              Appliquer
            </button>
          </div>
        </div>
      )}
    </DropdownAction>
  );
};

export default DropdownSort;
