import React, { useMemo, useState } from "react";
import { ListFilter, Search, X } from "lucide-react";
import DropdownAction from "./dropdownAction";

const defaultStocks = [
  { id: "all", label: "Tous" },
  { id: "en stock", label: "En stock" },
  { id: "faible", label: "Faible" },
  { id: "epuise", label: "Epuise" },
];

const defaultCategories = [{ id: "all", label: "Toutes" }];

const defaultStatuses = [
  { id: "all", label: "Tous" },
  { id: "actif", label: "Actif" },
  { id: "inactif", label: "Inactif" },
  { id: "annule", label: "Annule" },
];

const renderSelectBlock = ({
  title,
  value,
  options,
  onChange,
  onReset,
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold uppercase text-text-secondary">{title}</p>
      <button
        type="button"
        className="text-xs text-secondary hover:underline dark:text-accent"
        onClick={onReset}
      >
        Reinitialiser
      </button>
    </div>
    <select
      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
      value={value}
      onChange={onChange}
    >
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const DropdownFilter = ({
  label = "Filtrer",
  items,
  statusItems,
  categoryItems,
  familyItems,
  subFamilyItems,
  collectionItems,
  initialValues,
  onApply,
  onReset,
  buttonClassName = "",
  showDateRange = true,
  showCategory = false,
  showFamily = false,
  showSubFamily = false,
  showCollection = false,
  ...props
}) => {
  const resolvedStocks = items?.length ? items : defaultStocks;
  const resolvedStatuses = statusItems?.length ? statusItems : defaultStatuses;
  const resolvedCategories = categoryItems?.length ? categoryItems : defaultCategories;
  const resolvedFamilies = familyItems?.length
    ? familyItems
    : [{ id: "all", label: "Toutes" }];
  const resolvedSubFamilies = subFamilyItems?.length
    ? subFamilyItems
    : [{ id: "all", label: "Toutes" }];
  const resolvedCollections = collectionItems?.length
    ? collectionItems
    : [{ id: "all", label: "Toutes" }];

  const defaults = useMemo(
    () => ({
      from: "",
      to: "",
      stock: resolvedStocks[0]?.id ?? "",
      status: resolvedStatuses[0]?.id ?? "",
      category: resolvedCategories[0]?.id ?? "",
      family: resolvedFamilies[0]?.id ?? "",
      subFamily: resolvedSubFamilies[0]?.id ?? "",
      collection: resolvedCollections[0]?.id ?? "",
      keyword: "",
      ...initialValues,
    }),
    [
      initialValues,
      resolvedStocks,
      resolvedStatuses,
      resolvedCategories,
      resolvedFamilies,
      resolvedSubFamilies,
      resolvedCollections,
    ],
  );

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
          <ListFilter size={18} strokeWidth={1.5} />
        </div>
      }
      buttonClassName={[
        "rounded-lg px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2",
        "bg-transparent text-text-primary hover:bg-surface/70 focus:ring-secondary/40",
        "dark:bg-transparent dark:text-text-primary dark:hover:bg-surface/70 dark:focus:ring-neutral-600/50",
        buttonClassName,
      ].join(" ")}
      menuClassName="w-[320px] shadow-xl"
      menuBodyClassName="p-0"
      {...props}
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
              className="rounded-md p-1 text-text-secondary hover:bg-surface/70 hover:text-text-primary"
              aria-label="Fermer"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div className="space-y-4 px-4 py-3 text-sm">
            {showDateRange ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-text-secondary">
                    Plage de dates
                  </p>
                  <button
                    type="button"
                    className="text-xs text-secondary hover:underline dark:text-accent"
                    onClick={() => setValues((prev) => ({ ...prev, from: "", to: "" }))}
                  >
                    Reinitialiser
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-xs text-text-secondary">
                    Du
                    <input
                      type="date"
                      value={values.from}
                      onChange={(event) =>
                        setValues((prev) => ({ ...prev, from: event.target.value }))
                      }
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-text-secondary">
                    Au
                    <input
                      type="date"
                      value={values.to}
                      onChange={(event) =>
                        setValues((prev) => ({ ...prev, to: event.target.value }))
                      }
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {showCollection
              ? renderSelectBlock({
                  title: "Collection",
                  value: values.collection,
                  options: resolvedCollections,
                  onChange: (event) =>
                    setValues((prev) => ({ ...prev, collection: event.target.value })),
                  onReset: () =>
                    setValues((prev) => ({
                      ...prev,
                      collection: resolvedCollections[0]?.id ?? "",
                    })),
                })
              : null}

            {showCategory
              ? renderSelectBlock({
                  title: "Categorie",
                  value: values.category,
                  options: resolvedCategories,
                  onChange: (event) =>
                    setValues((prev) => ({ ...prev, category: event.target.value })),
                  onReset: () =>
                    setValues((prev) => ({
                      ...prev,
                      category: resolvedCategories[0]?.id ?? "",
                    })),
                })
              : null}

            {showFamily
              ? renderSelectBlock({
                  title: "Famille",
                  value: values.family,
                  options: resolvedFamilies,
                  onChange: (event) =>
                    setValues((prev) => ({ ...prev, family: event.target.value })),
                  onReset: () =>
                    setValues((prev) => ({
                      ...prev,
                      family: resolvedFamilies[0]?.id ?? "",
                    })),
                })
              : null}

            {showSubFamily
              ? renderSelectBlock({
                  title: "Sous-famille",
                  value: values.subFamily,
                  options: resolvedSubFamilies,
                  onChange: (event) =>
                    setValues((prev) => ({ ...prev, subFamily: event.target.value })),
                  onReset: () =>
                    setValues((prev) => ({
                      ...prev,
                      subFamily: resolvedSubFamilies[0]?.id ?? "",
                    })),
                })
              : null}

            {renderSelectBlock({
              title: "Stock",
              value: values.stock,
              options: resolvedStocks,
              onChange: (event) =>
                setValues((prev) => ({ ...prev, stock: event.target.value })),
              onReset: () =>
                setValues((prev) => ({ ...prev, stock: resolvedStocks[0]?.id ?? "" })),
            })}

            {renderSelectBlock({
              title: "Statut",
              value: values.status,
              options: resolvedStatuses,
              onChange: (event) =>
                setValues((prev) => ({ ...prev, status: event.target.value })),
              onReset: () =>
                setValues((prev) => ({
                  ...prev,
                  status: resolvedStatuses[0]?.id ?? "",
                })),
            })}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-text-secondary">
                  Recherche
                </p>
                <button
                  type="button"
                  className="text-xs text-secondary hover:underline dark:text-accent"
                  onClick={() => setValues((prev) => ({ ...prev, keyword: "" }))}
                >
                  Reinitialiser
                </button>
              </div>
              <div className="relative">
                <Search
                  size={16}
                  strokeWidth={1.5}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
                />
                <input
                  type="text"
                  value={values.keyword}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, keyword: event.target.value }))
                  }
                  placeholder="Rechercher..."
                  className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-4 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border bg-surface/80 px-4 py-3">
            <button
              type="button"
              onClick={handleResetAll}
              className="rounded-lg bg-background px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface dark:border dark:border-border dark:bg-surface dark:hover:bg-surface/70"
            >
              Reinitialiser
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

export default DropdownFilter;
