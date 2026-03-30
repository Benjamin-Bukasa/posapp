import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Search } from "lucide-react";
import DropdownAction from "./dropdownAction";
import DropdownFilter from "./dropdownFilter";
import DropdownSort from "./dropdownSort";

const resolveAccessor = (row, accessor) => {
  if (typeof accessor === "function") return accessor(row);
  if (!accessor) return "";

  return String(accessor)
    .split(".")
    .reduce((value, segment) => (value == null ? value : value[segment]), row);
};

const getPaginationItems = (current, total) => {
  if (total <= 5) {
    return Array.from({ length: total }, (_, index) => ({
      type: "page",
      value: index + 1,
    }));
  }

  const items = [];
  const addPage = (value) => items.push({ type: "page", value });
  const addEllipsis = (key) => items.push({ type: "ellipsis", key });

  addPage(1);

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) addEllipsis("left");

  for (let value = start; value <= end; value += 1) {
    addPage(value);
  }

  if (end < total - 1) addEllipsis("right");

  addPage(total);
  return items;
};

const defaultExportItems = [
  { id: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { id: "csv", label: "CSV", icon: FileText },
  { id: "pdf", label: "PDF", icon: FileText },
];

const AdminDataTable = ({
  title,
  description,
  columns = [],
  rows = [],
  rowKey = "id",
  loading = false,
  error = "",
  emptyMessage = "Aucune donnee a afficher.",
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Rechercher...",
  pagination,
  actionSlot = null,
  enableSelection = true,
  onSelectionChange,
  renderActions,
  actionsHeader = "Actions",
  filterSections = [],
  filterLabel = "Filtrer",
  onFilterApply,
  onFilterReset,
  sortItems = [],
  sortValue,
  sortLabel = "Trier",
  onSortApply,
  onSortReset,
  exportItems,
  exportLabel = "Exporter",
  onExportSelect,
  exportDisabled = false,
}) => {
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const headerCheckboxRef = useRef(null);

  const getRowKey = (row, index) =>
    typeof rowKey === "function" ? rowKey(row, index) : row?.[rowKey] ?? index;

  const allKeys = useMemo(
    () => rows.map((row, index) => getRowKey(row, index)),
    [rowKey, rows],
  );
  const allKeySet = useMemo(() => new Set(allKeys), [allKeys]);
  const selectedCount = selectedKeys.size;
  const allSelected =
    allKeys.length > 0 && allKeys.every((key) => selectedKeys.has(key));
  const someSelected = allKeys.some((key) => selectedKeys.has(key));
  const showSelection = enableSelection;
  const showActions = typeof renderActions === "function";
  const resolvedExportItems = exportItems?.length ? exportItems : defaultExportItems;
  const colSpan =
    columns.length + (showSelection ? 1 : 0) + (showActions ? 1 : 0);

  useEffect(() => {
    if (!headerCheckboxRef.current) return;
    headerCheckboxRef.current.indeterminate = someSelected && !allSelected;
  }, [allSelected, someSelected]);

  useEffect(() => {
    setSelectedKeys((previous) => {
      const next = new Set();
      previous.forEach((key) => {
        if (allKeySet.has(key)) next.add(key);
      });
      return next;
    });
  }, [allKeySet]);

  useEffect(() => {
    if (typeof onSelectionChange !== "function") return;
    const selectedRows = rows.filter((row, index) =>
      selectedKeys.has(getRowKey(row, index)),
    );
    onSelectionChange(selectedRows, Array.from(selectedKeys));
  }, [getRowKey, onSelectionChange, rows, selectedKeys]);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          {title ? (
            <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
          ) : null}
          {description ? (
            <p className="mt-1 text-sm text-text-secondary">{description}</p>
          ) : null}
          {showSelection && selectedCount ? (
            <p className="mt-3 text-sm font-medium text-secondary">
              {selectedCount} ligne(s) selectionnee(s)
            </p>
          ) : null}
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:w-auto xl:justify-end">
          {onSearchChange ? (
            <label className="relative w-full sm:min-w-[260px] sm:flex-1 xl:w-[320px] xl:flex-none">
              <Search
                size={16}
                strokeWidth={1.5}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
              />
              <input
                type="text"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-text-primary outline-none transition focus:border-secondary"
              />
            </label>
          ) : null}

          <DropdownFilter
            label={filterLabel}
            sections={filterSections}
            onApply={onFilterApply}
            onReset={onFilterReset}
          />

          <DropdownSort
            label={sortLabel}
            items={sortItems}
            value={sortValue}
            onApply={onSortApply}
            onReset={onSortReset}
          />

          {typeof onExportSelect === "function" ? (
            <DropdownAction
              label={
                <div className="flex items-center gap-2">
                  <span>{exportLabel}</span>
                  <Download size={18} strokeWidth={1.5} />
                </div>
              }
              items={resolvedExportItems}
              onSelect={(item) => onExportSelect(item)}
              disabled={exportDisabled}
              buttonClassName="rounded-lg border border-border bg-surface px-4 py-2 font-medium text-text-primary hover:bg-background dark:bg-surface dark:hover:bg-background/70"
            />
          ) : null}

          {pagination ? (
            <label className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-secondary sm:w-auto sm:justify-start">
              <span>Afficher</span>
              <select
                value={pagination.pageSize}
                onChange={(event) =>
                  pagination.onPageSizeChange?.(Number(event.target.value))
                }
                className="bg-transparent text-text-primary outline-none"
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {actionSlot}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="table-scroll mt-4 overflow-auto rounded-xl border border-border bg-surface">
        <table className="min-w-[780px] w-full border-collapse text-sm xl:min-w-full">
          <thead className="sticky top-0 z-10 bg-[#b0bbb7] dark:bg-[#1D473F]">
            <tr>
              {showSelection ? (
                <th className="border-b border-border px-4 py-4 text-left">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    className="h-4 w-4 rounded border-border bg-surface text-primary accent-primary"
                    checked={allSelected}
                    onChange={() => {
                      setSelectedKeys(() =>
                        allSelected ? new Set() : new Set(allKeys),
                      );
                    }}
                    aria-label="Selectionner toutes les lignes"
                  />
                </th>
              ) : null}

              {columns.map((column) => (
                <th
                  key={column.key || column.header}
                  className={[
                    "border-b border-border px-4 py-4 text-left font-medium text-text-primary",
                    column.headerClassName || "",
                  ].join(" ")}
                >
                  {column.header}
                </th>
              ))}

              {showActions ? (
                <th className="border-b border-border px-4 py-4 text-left font-medium text-text-primary">
                  {actionsHeader}
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-4 py-10 text-center text-sm text-text-secondary"
                >
                  Chargement...
                </td>
              </tr>
            ) : null}

            {!loading && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-4 py-10 text-center text-sm text-text-secondary"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : null}

            {!loading && rows.length
              ? rows.map((row, index) => (
                  <tr
                    key={getRowKey(row, index)}
                    className="border-b border-border transition hover:bg-background/60"
                  >
                    {showSelection ? (
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border bg-surface text-primary accent-primary"
                          checked={selectedKeys.has(getRowKey(row, index))}
                          onChange={() => {
                            const key = getRowKey(row, index);
                            setSelectedKeys((previous) => {
                              const next = new Set(previous);
                              if (next.has(key)) {
                                next.delete(key);
                              } else {
                                next.add(key);
                              }
                              return next;
                            });
                          }}
                          aria-label={`Selectionner la ligne ${index + 1}`}
                        />
                      </td>
                    ) : null}

                    {columns.map((column) => (
                      <td
                        key={column.key || column.header}
                        className={[
                          "px-4 py-3 align-top text-text-primary",
                          column.className || "",
                        ].join(" ")}
                      >
                        {column.render
                          ? column.render(row, index)
                          : resolveAccessor(row, column.accessor) ?? "--"}
                      </td>
                    ))}

                    {showActions ? (
                      <td className="px-4 py-3 align-top">
                        {renderActions(row, index)}
                      </td>
                    ) : null}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      {pagination ? (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-text-secondary sm:max-w-[60%]">
            {pagination.total
              ? `${pagination.total} element(s) - page ${pagination.page} / ${pagination.totalPages}`
              : `Page ${pagination.page} / ${pagination.totalPages}`}
            {typeof pagination.visibleTotal === "number" &&
            pagination.visibleTotal !== pagination.total
              ? ` - ${pagination.visibleTotal} visible(s)`
              : ""}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {getPaginationItems(
              pagination.page ?? 1,
              pagination.totalPages ?? 1,
            ).map((item) => {
              if (item.type === "ellipsis") {
                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary"
                  >
                    ...
                  </button>
                );
              }

              const isActive = item.value === (pagination.page ?? 1);
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => pagination.onPageChange?.(item.value)}
                  className={[
                    "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                    isActive
                      ? "border-[#b0bbb7] bg-[#b0bbb7] text-text-primary dark:border-[#1D473F] dark:bg-[#1D473F] dark:text-white"
                      : "border-border bg-surface text-text-primary hover:bg-background",
                  ].join(" ")}
                >
                  {item.value}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default AdminDataTable;
