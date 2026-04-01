import React, { useEffect, useMemo, useState } from "react";
import { ListFilter, X } from "lucide-react";
import DropdownAction from "./dropdownAction";

const getDefaultValues = (sections = []) =>
  sections.reduce((accumulator, section) => {
    const fallbackValue =
      section.type === "select" ? section.options?.[0]?.value ?? "" : "";

    return {
      ...accumulator,
      [section.id]: section.value ?? fallbackValue,
    };
  }, {});

const DropdownFilter = ({
  label = "Filtrer",
  sections = [],
  onApply,
  onReset,
  buttonClassName = "",
}) => {
  const defaults = useMemo(() => getDefaultValues(sections), [sections]);
  const [values, setValues] = useState(defaults);

  useEffect(() => {
    setValues(defaults);
  }, [defaults]);

  if (!sections.length) {
    return null;
  }

  const handleResetAll = () => {
    setValues(defaults);
    if (onReset) {
      onReset(defaults);
      return;
    }
    onApply?.(defaults);
  };

  return (
    <DropdownAction
      label={
        <div className="flex items-center gap-2">
          <span>{label}</span>
          <ListFilter size={18} strokeWidth={1.5} />
        </div>
      }
      buttonClassName={[
        "rounded-lg bg-transparent px-4 py-2 font-medium text-text-primary hover:bg-surface/70 dark:bg-transparent dark:hover:bg-surface/70",
        buttonClassName,
      ].join(" ")}
      menuClassName="w-[340px] shadow-xl"
      menuBodyClassName="p-0"
    >
      {({ closeMenu }) => (
        <div className="w-full">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <ListFilter size={16} strokeWidth={1.5} />
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
            {sections.map((section) => (
              <label key={section.id} className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  {section.label}
                </span>

                {section.type === "select" ? (
                  <select
                    value={values[section.id] ?? ""}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        [section.id]: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-secondary"
                  >
                    {section.options?.map((option) => (
                      <option key={`${section.id}:${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={section.type || "text"}
                    value={values[section.id] ?? ""}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        [section.id]: event.target.value,
                      }))
                    }
                    placeholder={section.placeholder || ""}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-secondary"
                  />
                )}
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-border bg-background/30 px-4 py-3">
            <button
              type="button"
              onClick={handleResetAll}
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

export default DropdownFilter;
