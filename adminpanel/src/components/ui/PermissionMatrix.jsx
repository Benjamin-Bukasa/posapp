import { useEffect, useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";

const PermissionMatrix = ({
  value = {},
  onChange,
  catalog = [],
  disabled = false,
}) => {
  const selectedCount = Object.values(value).filter(Boolean).length;
  const [openModules, setOpenModules] = useState({});

  useEffect(() => {
    setOpenModules((current) => {
      const nextState = {};

      catalog.forEach((moduleItem, index) => {
        const hasSelection = moduleItem.actions.some((action) => Boolean(value[action.code]));
        nextState[moduleItem.key] =
          current[moduleItem.key] ?? (hasSelection || index === 0);
      });

      return nextState;
    });
  }, [catalog, value]);

  const toggleCode = (code, checked) => {
    onChange({
      ...value,
      [code]: checked,
    });
  };

  const toggleModule = (moduleItem, checked) => {
    const nextValue = { ...value };
    moduleItem.actions.forEach((action) => {
      nextValue[action.code] = checked;
    });
    onChange(nextValue);
  };

  const toggleModulePanel = (moduleKey) => {
    setOpenModules((current) => ({
      ...current,
      [moduleKey]: !current[moduleKey],
    }));
  };

  const setAllPanels = (isOpen) => {
    setOpenModules(
      catalog.reduce(
        (accumulator, moduleItem) => ({
          ...accumulator,
          [moduleItem.key]: isOpen,
        }),
        {},
      ),
    );
  };

  return (
    <div className="space-y-4 rounded-[28px] border border-border bg-gradient-to-br from-surface via-background to-surface/80 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/80 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-header/15 text-text-primary">
            <ShieldCheck size={18} strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Matrice des permissions
            </p>
            <p className="text-xs text-text-secondary">
              Ouvrez chaque bloc pour choisir les operations autorisees par module.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-text-secondary">
            {selectedCount} permission(s)
          </span>
          <button
            type="button"
            disabled={disabled || !catalog.length}
            onClick={() => setAllPanels(true)}
            className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-text-secondary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            Tout ouvrir
          </button>
          <button
            type="button"
            disabled={disabled || !catalog.length}
            onClick={() => setAllPanels(false)}
            className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-text-secondary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            Tout fermer
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {catalog.map((moduleItem) => {
          const selectedModuleCount = moduleItem.actions.filter((action) =>
            Boolean(value[action.code]),
          ).length;
          const totalModuleCount = moduleItem.actions.length;
          const allChecked =
            totalModuleCount > 0 &&
            moduleItem.actions.every((action) => Boolean(value[action.code]));
          const isOpen = Boolean(openModules[moduleItem.key]);

          return (
            <section
              key={moduleItem.key}
              className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggleModulePanel(moduleItem.key)}
                className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition hover:bg-background/60 sm:px-5"
                aria-expanded={isOpen}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary">
                      {moduleItem.label}
                    </p>
                    <span
                      className={[
                        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium",
                        selectedModuleCount
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-background text-text-secondary",
                      ].join(" ")}
                    >
                      {selectedModuleCount}/{totalModuleCount}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {moduleItem.description}
                  </p>
                </div>

                <span className="flex items-center gap-2">
                  <span className="hidden rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-text-secondary sm:inline-flex">
                    {allChecked ? "Complet" : selectedModuleCount ? "Partiel" : "Aucun"}
                  </span>
                  <ChevronDown
                    size={18}
                    strokeWidth={1.8}
                    className={[
                      "mt-0.5 shrink-0 text-text-secondary transition-transform",
                      isOpen ? "rotate-180" : "",
                    ].join(" ")}
                  />
                </span>
              </button>

              {isOpen ? (
                <div className="border-t border-border bg-background/60 px-4 py-4 sm:px-5">
                  <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-surface/90 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                        Bloc d'actions
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        Active rapidement toutes les permissions de ce module si besoin.
                      </p>
                    </div>

                    <label className="inline-flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        disabled={disabled}
                        onChange={(event) =>
                          toggleModule(moduleItem, event.target.checked)
                        }
                      />
                      <span className="font-medium">Tout cocher</span>
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {moduleItem.actions.map((action) => {
                      const checked = Boolean(value[action.code]);

                      return (
                        <label
                          key={action.code}
                          className={[
                            "group inline-flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition",
                            checked
                              ? "border-emerald-500/40 bg-emerald-500/10 text-text-primary shadow-sm"
                              : "border-border bg-surface text-text-primary hover:border-header/30 hover:bg-background",
                            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                          ].join(" ")}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={(event) =>
                              toggleCode(action.code, event.target.checked)
                            }
                            className="mt-1"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{action.label}</p>
                              <span
                                className={[
                                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                                  checked
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                    : "bg-background text-text-secondary",
                                ].join(" ")}
                              >
                                {checked ? "Activee" : "Inactive"}
                              </span>
                            </div>
                            <p className="mt-1 break-all text-xs text-text-secondary">
                              {action.code}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default PermissionMatrix;
