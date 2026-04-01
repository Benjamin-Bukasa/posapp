import React, { useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import DropdownAction from "./dropdownAction";

const defaultSorts = {
  date: "asc",
  activity: "az",
  name: "az",
};

const DropdownSort = ({
  label = "Trier",
  items,
  initialValues,
  onApply,
  onReset,
  buttonClassName = "",
  ...props
}) => {
  const defaults = useMemo(() => ({ ...defaultSorts, ...initialValues }), [initialValues]);
  const [values, setValues] = useState(defaults);

  const handleResetAll = () => {
    setValues(defaults);
    onReset?.(defaults);
    onApply?.(defaults);
  };

  return (
    <DropdownAction
      label={
        <div className="flex items-center gap-2">
          <p>{label}</p>
          <SlidersHorizontal size={18} strokeWidth={1.5} />
        </div>
      }
      buttonClassName={[
        "px-4 py-2 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2",
        "bg-transparent text-text-primary hover:bg-surface/70 focus:ring-secondary/40",
        "dark:bg-transparent dark:text-text-primary dark:hover:bg-surface/70 dark:focus:ring-neutral-600/50",
        buttonClassName,
      ].join(" ")}
      menuClassName="w-[260px] shadow-xl"
      menuBodyClassName="p-0"
      {...props}
      variant="default"
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
              className="rounded-md p-1 text-text-secondary hover:bg-surface/70 hover:text-text-primary"
              aria-label="Fermer"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div className="space-y-4 px-4 py-3 text-sm">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-text-secondary">
                Date
              </p>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sort-date"
                  value="asc"
                  checked={values.date === "asc"}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, date: event.target.value }))
                  }
                  className="h-4 w-4 accent-secondary"
                />
                <span>Ascendant</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sort-date"
                  value="desc"
                  checked={values.date === "desc"}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, date: event.target.value }))
                  }
                  className="h-4 w-4 accent-secondary"
                />
                <span>Descendant</span>
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-text-secondary">
                Activité
              </p>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sort-activity"
                  value="az"
                  checked={values.activity === "az"}
                  onChange={(event) =>
                    setValues((prev) => ({
                      ...prev,
                      activity: event.target.value,
                    }))
                  }
                  className="h-4 w-4 accent-secondary"
                />
                <span>A-Z</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sort-activity"
                  value="za"
                  checked={values.activity === "za"}
                  onChange={(event) =>
                    setValues((prev) => ({
                      ...prev,
                      activity: event.target.value,
                    }))
                  }
                  className="h-4 w-4 accent-secondary"
                />
                <span>Z-A</span>
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-text-secondary">
                Nom
              </p>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sort-name"
                  value="az"
                  checked={values.name === "az"}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="h-4 w-4 accent-secondary"
                />
                <span>A-Z</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sort-name"
                  value="za"
                  checked={values.name === "za"}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="h-4 w-4 accent-secondary"
                />
                <span>Z-A</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border bg-surface/80 px-4 py-3">
            <button
              type="button"
              onClick={handleResetAll}
              className="rounded-lg bg-background px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface dark:bg-surface dark:border dark:border-border dark:hover:bg-surface/70"
            >
              Réinitialiser
            </button>
            <button
              type="button"
              onClick={() => {
                onApply?.(values);
                closeMenu();
              }}
              className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-white hover:bg-secondary/90"
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
