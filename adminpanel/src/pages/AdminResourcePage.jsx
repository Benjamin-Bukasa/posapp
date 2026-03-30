import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AdminDataTable from "../components/ui/AdminDataTable";
import ConfirmModal from "../components/ui/ConfirmModal";
import DropdownAction from "../components/ui/dropdownAction";
import ImportXlsxModal from "../components/ui/ImportXlsxModal";
import { ApiError, requestBlob, requestFormData, requestJson } from "../api/client";
import {
  findRouteByPath,
  getCreateConfig,
  getRouteActionPermissions,
  getResourceConfig,
  getTableActionConfig,
} from "../routes/router";
import useAuthStore from "../stores/authStore";
import useCurrencyStore from "../stores/currencyStore";
import useToastStore from "../stores/toastStore";
import { hasAnyPermission } from "../utils/permissions";
import useSyncedQuerySearch from "../hooks/useSyncedQuerySearch";

const toRows = (payload) => {
  if (Array.isArray(payload)) {
    return { rows: payload, meta: null };
  }

  if (Array.isArray(payload?.data)) {
    return { rows: payload.data, meta: payload.meta || null };
  }

  return { rows: [], meta: null };
};

const resolveAccessor = (row, accessor) => {
  if (typeof accessor === "function") return accessor(row);
  if (!accessor) return undefined;

  return String(accessor)
    .split(".")
    .reduce((value, segment) => (value == null ? value : value[segment]), row);
};

const statusLabels = {
  DRAFT: "Non valide",
  SUBMITTED: "En cours",
  APPROVED: "Valide",
  SENT: "Valide",
  ORDERED: "Commande creee",
};

const filterDefinitions = [
  {
    id: "status",
    label: "Statut",
    accessor: "status",
    queryKey: "status",
    formatLabel: (value) => statusLabels[value] || value,
  },
  {
    id: "role",
    label: "Role",
    accessor: "role",
    queryKey: "role",
  },
  {
    id: "movementType",
    label: "Type mouvement",
    accessor: "movementType",
    queryKey: "movementType",
  },
  {
    id: "sourceType",
    label: "Source",
    accessor: "sourceType",
    queryKey: "sourceType",
  },
  {
    id: "type",
    label: "Type",
    accessor: "type",
    queryKey: "type",
  },
  {
    id: "zoneType",
    label: "Type zone",
    accessor: "zoneType",
    queryKey: "zoneType",
  },
  {
    id: "isActive",
    label: "Etat",
    accessor: "isActive",
    queryKey: "isActive",
    options: [
      { value: "true", label: "Actif" },
      { value: "false", label: "Inactif" },
    ],
    serialize: (value) => String(Boolean(value)),
    formatLabel: (value) =>
      String(value) === "true" || value === true ? "Actif" : "Inactif",
  },
];

const isEmptyValue = (value) =>
  value === undefined || value === null || value === "";

const toDateComparable = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }

  if (typeof value !== "string") {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}/.test(value) && !value.includes("T")) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const compareValues = (left, right) => {
  if (isEmptyValue(left) && isEmptyValue(right)) return 0;
  if (isEmptyValue(left)) return 1;
  if (isEmptyValue(right)) return -1;

  if (typeof left === "boolean" || typeof right === "boolean") {
    return Number(Boolean(left)) - Number(Boolean(right));
  }

  const leftDate = toDateComparable(left);
  const rightDate = toDateComparable(right);
  if (leftDate !== null && rightDate !== null) {
    return leftDate - rightDate;
  }

  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (
    Number.isFinite(leftNumber) &&
    Number.isFinite(rightNumber) &&
    String(left).trim() !== "" &&
    String(right).trim() !== ""
  ) {
    return leftNumber - rightNumber;
  }

  return String(left).localeCompare(String(right), "fr", {
    sensitivity: "base",
    numeric: true,
  });
};

const getRowDate = (row) =>
  row?.receivedAt || row?.orderDate || row?.createdAt || row?.updatedAt || null;

const buildSortItems = (columns = []) => {
  const seen = new Set();

  return columns.reduce((accumulator, column) => {
    const accessor = column.sortBy || column.accessor;
    if (typeof accessor !== "string" || !accessor) {
      return accumulator;
    }

    if (seen.has(accessor)) {
      return accumulator;
    }

    seen.add(accessor);
    accumulator.push({
      id: accessor,
      label: column.header,
      accessor,
      serverField: accessor.includes(".") ? null : accessor,
    });
    return accumulator;
  }, []);
};

const toPlainValue = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const buildCsvContent = (columns = [], rows = []) => {
  const escapeCell = (value) => `"${toPlainValue(value).replace(/"/g, '""')}"`;
  const header = columns.map((column) => escapeCell(column.header)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((column) => {
        const value = column.accessor
          ? resolveAccessor(row, column.accessor)
          : undefined;
        return escapeCell(value);
      })
      .join(","),
  );

  return [header, ...lines].join("\n");
};

const downloadBlob = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
};

const slugify = (value = "export") => {
  const normalized = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "export";
};

const resolveDeleteLabel = (row) =>
  row?.name ||
  row?.title ||
  row?.code ||
  row?.sku ||
  row?.email ||
  row?.id ||
  "cet element";

const AdminResourcePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentRoute = findRouteByPath(location.pathname);
  useCurrencyStore((state) => state.settings.primaryCurrencyCode);
  const loadCurrencySettings = useCurrencyStore((state) => state.loadSettings);
  const resource = getResourceConfig(currentRoute.path);
  const createConfig = getCreateConfig(currentRoute.path);
  const tableActionConfig = getTableActionConfig(currentRoute.path);
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const showToast = useToastStore((state) => state.showToast);
  const [rows, setRows] = useState(resource?.staticRows || []);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(Boolean(resource?.endpoint));
  const [error, setError] = useState("");
  const [search, setSearch] = useSyncedQuerySearch("q");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(resource?.pageSize || 10);
  const [refreshTick, setRefreshTick] = useState(0);
  const [pendingActionKey, setPendingActionKey] = useState("");
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState({ sortBy: "", sortDir: "desc" });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [hardDeleteTarget, setHardDeleteTarget] = useState(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [activeImportConfig, setActiveImportConfig] = useState(null);
  const [importSelectionValue, setImportSelectionValue] = useState("");
  const [importSelectionOptions, setImportSelectionOptions] = useState([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const canAccessPage = hasAnyPermission(
    user,
    resource?.requiredPermissions ||
      currentRoute.requiredPermissions ||
      getRouteActionPermissions(currentRoute.path, "read"),
  );
  const canCreate = Boolean(
    createConfig &&
      hasAnyPermission(
        user,
        createConfig.requiredPermissions ||
          getRouteActionPermissions(currentRoute.path, "create"),
      ),
  );
  const canUseImport = Boolean(
    resource?.importConfig &&
      hasAnyPermission(
        user,
        resource.importConfig.requiredPermissions ||
          createConfig?.requiredPermissions ||
          getRouteActionPermissions(currentRoute.path, "create"),
      ),
  );

  useEffect(() => {
    setPage(1);
    setFilters({});
    setSort({ sortBy: "", sortDir: "desc" });
    setError("");
    setPageSize(resource?.pageSize || 10);
    setDeleteTarget(null);
    setHardDeleteTarget(null);
    setIsImportOpen(false);
    setActiveImportConfig(null);
    setImportSelectionValue("");
    setImportSelectionOptions([]);
    setTemplateLoading(false);
    setImportLoading(false);
    setImportResult(null);
  }, [location.pathname, resource?.pageSize]);

  const sortItems = useMemo(
    () => buildSortItems(resource?.columns || []),
    [resource?.columns],
  );

  const activeSortItem = useMemo(
    () => sortItems.find((item) => item.id === sort.sortBy) || null,
    [sort.sortBy, sortItems],
  );

  const buildQuery = useCallback(
    ({ includePagination = true, exportType } = {}) => {
      const query = {
        ...(resource?.defaultQuery || {}),
        ...(search ? { search } : {}),
        ...(filters.createdFrom ? { createdFrom: filters.createdFrom } : {}),
        ...(filters.createdTo ? { createdTo: filters.createdTo } : {}),
      };

      filterDefinitions.forEach((definition) => {
        const selectedValue = filters[definition.id];
        if (!selectedValue || selectedValue === "all") {
          return;
        }

        query[definition.queryKey || definition.id] = selectedValue;
      });

      if (activeSortItem?.serverField) {
        query.sortBy = activeSortItem.serverField;
        query.sortDir = sort.sortDir;
      }

      if (includePagination) {
        query.paginate = true;
        query.page = page;
        query.pageSize = pageSize;
      }

      if (exportType) {
        query.export = exportType;
      }

      return query;
    },
    [activeSortItem?.serverField, filters, page, pageSize, resource?.defaultQuery, search, sort.sortDir],
  );

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      if (!canAccessPage) {
        setRows([]);
        setMeta(null);
        setLoading(false);
        setError("");
        return;
      }

      if (!resource) {
        setRows([]);
        setMeta(null);
        setLoading(false);
        setError("");
        return;
      }

      if (!resource.endpoint) {
        setRows(resource.staticRows || []);
        setMeta(null);
        setLoading(false);
        setError(resource.notice || "");
        return;
      }

      if (!accessToken) {
        setRows([]);
        setMeta(null);
        setLoading(false);
        setError("Session manquante.");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const payload = await requestJson(resource.endpoint, {
          token: accessToken,
          query: buildQuery(),
        });

        if (ignore) return;

        const { rows: nextRows, meta: nextMeta } = toRows(payload);
        setRows(resource.transformRows ? resource.transformRows(nextRows) : nextRows);
        setMeta(nextMeta);
      } catch (requestError) {
        if (ignore) return;

        if (requestError instanceof ApiError && requestError.status === 401) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }

        setRows([]);
        setMeta(null);
        setError(requestError.message || "Impossible de charger les donnees.");
        showToast({
          title: "Erreur",
          message: requestError.message || "Impossible de charger les donnees.",
          variant: "danger",
        });
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      ignore = true;
    };
  }, [
    accessToken,
    buildQuery,
    canAccessPage,
    logout,
    navigate,
    refreshTick,
    resource,
    showToast,
  ]);

  const displayedRows = useMemo(() => {
    const filteredRows = rows.filter((row) => {
      const rowDate = getRowDate(row);

      if (filters.createdFrom) {
        const fromDate = new Date(filters.createdFrom);
        if (!Number.isNaN(fromDate.getTime())) {
          const rowTimestamp = rowDate ? new Date(rowDate).getTime() : null;
          if (rowTimestamp !== null && rowTimestamp < fromDate.getTime()) {
            return false;
          }
        }
      }

      if (filters.createdTo) {
        const toDate = new Date(filters.createdTo);
        toDate.setHours(23, 59, 59, 999);
        if (!Number.isNaN(toDate.getTime())) {
          const rowTimestamp = rowDate ? new Date(rowDate).getTime() : null;
          if (rowTimestamp !== null && rowTimestamp > toDate.getTime()) {
            return false;
          }
        }
      }

      return filterDefinitions.every((definition) => {
        const selectedValue = filters[definition.id];
        if (!selectedValue || selectedValue === "all") {
          return true;
        }

        const rawValue = resolveAccessor(row, definition.accessor);
        const serializedValue = definition.serialize
          ? definition.serialize(rawValue)
          : toPlainValue(rawValue);

        return serializedValue === selectedValue;
      });
    });

    if (!activeSortItem) {
      return filteredRows;
    }

    return [...filteredRows].sort((leftRow, rightRow) => {
      const leftValue = resolveAccessor(leftRow, activeSortItem.accessor);
      const rightValue = resolveAccessor(rightRow, activeSortItem.accessor);
      const result = compareValues(leftValue, rightValue);
      return sort.sortDir === "asc" ? result : -result;
    });
  }, [activeSortItem, filters, rows, sort.sortDir]);

  const filterSections = useMemo(() => {
    const sections = [];
    const shouldShowDate = Boolean(resource?.endpoint) || rows.some((row) => getRowDate(row));

    if (shouldShowDate) {
      sections.push(
        {
          id: "createdFrom",
          label: "Date du",
          type: "date",
          value: filters.createdFrom || "",
        },
        {
          id: "createdTo",
          label: "Date au",
          type: "date",
          value: filters.createdTo || "",
        },
      );
    }

    filterDefinitions.forEach((definition) => {
      const optionsMap = new Map();

      if (Array.isArray(definition.options) && definition.options.length) {
        definition.options.forEach((option) => {
          optionsMap.set(option.value, option.label);
        });
      } else {
        rows.forEach((row) => {
          const rawValue = resolveAccessor(row, definition.accessor);
          if (isEmptyValue(rawValue)) {
            return;
          }

          const serializedValue = definition.serialize
            ? definition.serialize(rawValue)
            : toPlainValue(rawValue);
          const label = definition.formatLabel
            ? definition.formatLabel(rawValue)
            : toPlainValue(rawValue);
          optionsMap.set(serializedValue, label);
        });
      }

      const selectedValue = filters[definition.id];
      if (selectedValue && selectedValue !== "all" && !optionsMap.has(selectedValue)) {
        const restoredLabel = definition.formatLabel
          ? definition.formatLabel(selectedValue)
          : selectedValue;
        optionsMap.set(selectedValue, restoredLabel);
      }

      if (!optionsMap.size) {
        return;
      }

      sections.push({
        id: definition.id,
        label: definition.label,
        type: "select",
        value: selectedValue || "all",
        options: [
          { value: "all", label: "Tous" },
          ...Array.from(optionsMap.entries()).map(([value, label]) => ({
            value,
            label,
          })),
        ],
      });
    });

    return sections;
  }, [filters, resource?.endpoint, rows]);

  const pagination = useMemo(() => {
    if (!resource?.endpoint) return null;

    return {
      page: meta?.page || page,
      pageSize: meta?.pageSize || pageSize,
      totalPages: meta?.totalPages || 1,
      total: meta?.total || rows.length,
      visibleTotal: displayedRows.length,
      onPageChange: (nextPage) => {
        if (nextPage < 1) return;
        if (meta?.totalPages && nextPage > meta.totalPages) return;
        setPage(nextPage);
      },
      onPageSizeChange: (nextSize) => {
        setPageSize(nextSize);
        setPage(1);
      },
    };
  }, [displayedRows.length, meta, page, pageSize, resource?.endpoint, rows.length]);

  const importConfigs = useMemo(
    () => [resource?.importConfig, ...(resource?.extraImportConfigs || [])].filter(Boolean),
    [resource?.extraImportConfigs, resource?.importConfig],
  );

  useEffect(() => {
    let ignore = false;

    const loadImportSelectionOptions = async () => {
      const selectionConfig = activeImportConfig?.selectionConfig;
      if (!selectionConfig || !isImportOpen) {
        setImportSelectionOptions([]);
        return;
      }

      if (Array.isArray(selectionConfig.options)) {
        setImportSelectionOptions(selectionConfig.options);
        return;
      }

      if (!selectionConfig.endpoint || !accessToken) {
        setImportSelectionOptions([]);
        return;
      }

      try {
        const payload = await requestJson(selectionConfig.endpoint, {
          token: accessToken,
          query: selectionConfig.query,
        });
        if (ignore) return;

        const { rows: optionRows } = toRows(payload);
        const options = optionRows.map((row) => ({
          value: row.id,
          label:
            selectionConfig.mapOptionLabel?.(row) ||
            row.name ||
            row.title ||
            row.code ||
            row.id,
        }));
        setImportSelectionOptions(options);
      } catch (_error) {
        if (ignore) return;
        setImportSelectionOptions([]);
      }
    };

    loadImportSelectionOptions();

    return () => {
      ignore = true;
    };
  }, [accessToken, activeImportConfig, isImportOpen]);

  const handleRowAction = useCallback(
    async (action, row) => {
      if (!accessToken) {
        setError("Session manquante.");
        return;
      }

      setPendingActionKey(`${action.id}:${row.id}`);
      setError("");

      try {
        const endpoint = action.endpoint(row);
        await requestJson(endpoint, {
          token: accessToken,
          method: action.method || "POST",
          body: action.body ? action.body(row) : undefined,
        });

        if (String(endpoint).startsWith("/api/currency-settings")) {
          await loadCurrencySettings({ token: accessToken, force: true });
        }

        showToast({
          title: "Operation reussie",
          message: `${action.label} execute avec succes.`,
          variant: "success",
        });
        setRefreshTick((current) => current + 1);
      } catch (requestError) {
        if (requestError instanceof ApiError && requestError.status === 401) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }

        setError(requestError.message || "Impossible d'executer cette action.");
        showToast({
          title: "Erreur",
          message: requestError.message || "Impossible d'executer cette action.",
          variant: "danger",
        });
      } finally {
        setPendingActionKey("");
      }
    },
    [accessToken, loadCurrencySettings, logout, navigate, showToast],
  );

  const openDeleteConfirm = useCallback((row) => {
    if (!tableActionConfig.deleteRequest) return;
    setHardDeleteTarget(null);
    setDeleteTarget(row);
    setError("");
  }, [tableActionConfig]);

  const closeDeleteConfirm = useCallback(() => {
    if (pendingActionKey.startsWith("delete:")) return;
    setDeleteTarget(null);
  }, [pendingActionKey]);

  const openHardDeleteConfirm = useCallback((row) => {
    if (!tableActionConfig.hardDeleteRequest) return;
    setDeleteTarget(null);
    setHardDeleteTarget(row);
    setError("");
  }, [tableActionConfig]);

  const closeHardDeleteConfirm = useCallback(() => {
    if (pendingActionKey.startsWith("hard-delete:")) return;
    setHardDeleteTarget(null);
  }, [pendingActionKey]);

  const handleDelete = useCallback(
    async (row) => {
      if (!tableActionConfig.deleteRequest || !accessToken) return;

      setPendingActionKey(`delete:${row.id}`);
      setError("");

      try {
        const request = tableActionConfig.deleteRequest(row.id, row);
        await requestJson(request.endpoint, {
          token: accessToken,
          method: request.method || "DELETE",
          body: request.body,
        });
        if (String(request.endpoint).startsWith("/api/currency-settings")) {
          await loadCurrencySettings({ token: accessToken, force: true });
        }
        showToast({
          title: tableActionConfig.deleteLabel || "Suppression reussie",
          message: `${resolveDeleteLabel(row)} a ete traite avec succes.`,
          variant: "success",
        });
        setDeleteTarget(null);
        setRefreshTick((current) => current + 1);
      } catch (requestError) {
        if (requestError instanceof ApiError && requestError.status === 401) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }

        setError(requestError.message || "Impossible de supprimer cette ligne.");
        showToast({
          title: "Erreur",
          message: requestError.message || "Impossible de supprimer cette ligne.",
          variant: "danger",
        });
      } finally {
        setPendingActionKey("");
      }
    },
    [accessToken, loadCurrencySettings, logout, navigate, showToast, tableActionConfig],
  );

  const handleHardDelete = useCallback(
    async (row) => {
      if (!tableActionConfig.hardDeleteRequest || !accessToken) return;

      setPendingActionKey(`hard-delete:${row.id}`);
      setError("");

      try {
        const request = tableActionConfig.hardDeleteRequest(row.id, row);
        await requestJson(request.endpoint, {
          token: accessToken,
          method: request.method || "DELETE",
          body: request.body,
        });
        showToast({
          title: tableActionConfig.hardDeleteLabel || "Suppression definitive reussie",
          message: `${resolveDeleteLabel(row)} a ete supprime definitivement.`,
          variant: "success",
        });
        setHardDeleteTarget(null);
        setRefreshTick((current) => current + 1);
      } catch (requestError) {
        if (requestError instanceof ApiError && requestError.status === 401) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }

        setError(
          requestError.message || "Impossible de supprimer definitivement cette ligne.",
        );
        showToast({
          title: "Erreur",
          message:
            requestError.message ||
            "Impossible de supprimer definitivement cette ligne.",
          variant: "danger",
        });
      } finally {
        setPendingActionKey("");
      }
    },
    [accessToken, logout, navigate, showToast, tableActionConfig],
  );

  const handlePdfOpen = useCallback(
    async (row) => {
      if (!tableActionConfig.pdfUrl || !accessToken) return;

      const pdfPath = tableActionConfig.pdfUrl(row);
      if (!pdfPath) return;
      const openedWindow = window.open("", "_blank", "noopener,noreferrer");

      setPendingActionKey(`pdf:${row.id}`);
      setError("");

      try {
        const blob = await requestBlob(pdfPath, { token: accessToken });
        const url = window.URL.createObjectURL(blob);
        if (!openedWindow) {
          window.URL.revokeObjectURL(url);
          throw new Error("Le navigateur a bloque l'ouverture du PDF.");
        }
        openedWindow.location.href = url;
        window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      } catch (requestError) {
        if (openedWindow) {
          openedWindow.close();
        }
        if (requestError instanceof ApiError && requestError.status === 401) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }

        setError(requestError.message || "Impossible d'ouvrir le PDF.");
        showToast({
          title: "Erreur",
          message: requestError.message || "Impossible d'ouvrir le PDF.",
          variant: "danger",
        });
      } finally {
        setPendingActionKey("");
      }
    },
    [accessToken, logout, navigate, showToast, tableActionConfig],
  );

  const handleExport = useCallback(
    async (item) => {
      if (!item?.id) {
        return;
      }

      setError("");

      try {
        if (resource?.endpoint) {
          if (!accessToken) {
            setError("Session manquante.");
            return;
          }

          const blob = await requestBlob(resource.endpoint, {
            token: accessToken,
            query: buildQuery({ includePagination: false, exportType: item.id }),
          });
          downloadBlob(blob, `${slugify(currentRoute.name)}.${item.id}`);
          showToast({
            title: "Export termine",
            message: `Le fichier ${item.label} a ete genere.`,
            variant: "success",
          });
          return;
        }

        if (item.id !== "csv") {
          setError("L'export local est disponible uniquement en CSV.");
          return;
        }

        const csv = buildCsvContent(resource?.columns || [], displayedRows);
        downloadBlob(
          new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" }),
          `${slugify(currentRoute.name)}.csv`,
        );
        showToast({
          title: "Export termine",
          message: "Le fichier CSV a ete genere.",
          variant: "success",
        });
      } catch (requestError) {
        if (requestError instanceof ApiError && requestError.status === 401) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }

        setError(requestError.message || "Impossible d'exporter les donnees.");
        showToast({
          title: "Erreur",
          message: requestError.message || "Impossible d'exporter les donnees.",
          variant: "danger",
        });
      }
    },
    [
      accessToken,
      buildQuery,
      currentRoute.name,
      displayedRows,
      logout,
      navigate,
      resource,
      showToast,
    ],
  );

  const handleTemplateDownload = useCallback(async (importConfig) => {
    const targetImportConfig = importConfig || activeImportConfig || resource?.importConfig;
    if (!targetImportConfig?.templatePath) {
      return;
    }

    if (!accessToken) {
      setError("Session manquante.");
      return;
    }

    setTemplateLoading(true);
    setError("");

    try {
      const blob = await requestBlob(targetImportConfig.templatePath, {
        token: accessToken,
        query:
          targetImportConfig.selectionConfig?.fieldName && importSelectionValue
            ? { [targetImportConfig.selectionConfig.fieldName]: importSelectionValue }
            : undefined,
      });
      downloadBlob(blob, targetImportConfig.templateFileName || "template.xlsx");
      showToast({
        title: "Template telecharge",
        message:
          targetImportConfig.templateSuccessMessage ||
          "Le template XLSX a ete telecharge.",
        variant: "success",
      });
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }

      setError(requestError.message || "Impossible de telecharger le template.");
      showToast({
        title: "Erreur",
        message: requestError.message || "Impossible de telecharger le template.",
        variant: "danger",
      });
    } finally {
      setTemplateLoading(false);
    }
  }, [
    accessToken,
    activeImportConfig,
    importSelectionValue,
    logout,
    navigate,
    resource?.importConfig,
    showToast,
  ]);

  const handleImportSubmit = useCallback(
    async (file, importConfig, selectionValue) => {
      const targetImportConfig = importConfig || activeImportConfig || resource?.importConfig;
      if (!targetImportConfig?.importPath || !file) {
        return;
      }

      if (!accessToken) {
        setError("Session manquante.");
        return;
      }

      const formData = new FormData();
      formData.append(targetImportConfig.fileField || "file", file);
      if (targetImportConfig.selectionConfig?.fieldName && selectionValue) {
        formData.append(targetImportConfig.selectionConfig.fieldName, selectionValue);
      }

      setImportLoading(true);
      setError("");
      setImportResult(null);

      try {
        const payload = await requestFormData(targetImportConfig.importPath, {
          token: accessToken,
          formData,
        });
        setImportResult(payload);

        const created = Number(payload?.created || 0);
        const failed = Number(payload?.failed || 0);
        const message =
          failed > 0
            ? `${created} ligne(s) importee(s), ${failed} en erreur.`
            : targetImportConfig.importSuccessMessage ||
              `${created} ligne(s) importee(s) avec succes.`;

        showToast({
          title: failed > 0 ? "Import termine avec erreurs" : "Import termine",
          message,
          variant: failed > 0 ? "warning" : "success",
          duration: failed > 0 ? 5200 : 3600,
        });

        if (Array.isArray(payload?.errors) && payload.errors.length) {
          const firstError = payload.errors[0];
          showToast({
            title: "Premiere erreur detectee",
            message:
              firstError?.message ||
              "Certaines lignes n'ont pas pu etre importees.",
            variant: "danger",
            duration: 5200,
          });
        }

        if (!failed) {
          setIsImportOpen(false);
          setActiveImportConfig(null);
        }
        setRefreshTick((current) => current + 1);
      } catch (requestError) {
        if (requestError instanceof ApiError && requestError.status === 401) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }

        setError(requestError.message || "Impossible d'importer le fichier.");
        showToast({
          title: "Erreur",
          message: requestError.message || "Impossible d'importer le fichier.",
          variant: "danger",
        });
      } finally {
        setImportLoading(false);
      }
    },
    [accessToken, activeImportConfig, logout, navigate, resource?.importConfig, showToast],
  );

  const renderActions = useCallback(
    (row) => {
      const customActions = (resource?.rowActions || []).filter(
        (action) =>
          (!action.visible || action.visible(row)) &&
          hasAnyPermission(user, action.requiredPermissions || []),
      );
      const canEdit =
        tableActionConfig.canEdit?.(row) &&
        hasAnyPermission(
          user,
          tableActionConfig.editPermissions ||
            getRouteActionPermissions(currentRoute.path, "edit"),
        );
      const canDelete =
        tableActionConfig.canDelete?.(row) &&
        hasAnyPermission(
          user,
          tableActionConfig.deletePermissions ||
            getRouteActionPermissions(currentRoute.path, "delete"),
        );
      const canHardDelete =
        tableActionConfig.canHardDelete?.(row) &&
        hasAnyPermission(
          user,
          tableActionConfig.hardDeletePermissions ||
            getRouteActionPermissions(currentRoute.path, "delete"),
        );
      const detailPath = tableActionConfig.detailPath;
      const canViewDetail = hasAnyPermission(
        user,
        tableActionConfig.detailPermissions ||
          getRouteActionPermissions(currentRoute.path, "detail"),
      );
      const pdfPath = canViewDetail ? tableActionConfig.pdfUrl?.(row) : null;
      const items = [];

      if (pdfPath) {
        items.push({
          id: `pdf:${row.id}`,
          label: "Ouvrir le PDF",
          icon: FileText,
          disabled: Boolean(pendingActionKey),
          onClick: () => handlePdfOpen(row),
        });
      }

      if (canEdit && tableActionConfig.editPath) {
        items.push({
          id: `edit:${row.id}`,
          label: "Modifier",
          icon: Pencil,
          disabled: Boolean(pendingActionKey),
          onClick: () =>
            navigate(`${tableActionConfig.editPath}?id=${row.id}`, {
              state: { row },
            }),
        });
      }

      if (canDelete && tableActionConfig.deleteRequest) {
        items.push({
          id: `delete:${row.id}`,
          label: tableActionConfig.deleteLabel || "Supprimer",
          icon: Trash2,
          variant: "danger",
          disabled: Boolean(pendingActionKey),
          onClick: () => openDeleteConfirm(row),
        });
      }

      if (canHardDelete && tableActionConfig.hardDeleteRequest) {
        items.push({
          id: `hard-delete:${row.id}`,
          label: tableActionConfig.hardDeleteLabel || "Supprimer definitivement",
          icon: Trash2,
          variant: "danger",
          disabled: Boolean(pendingActionKey),
          onClick: () => openHardDeleteConfirm(row),
        });
      }

      if (detailPath && canViewDetail) {
        items.push({
          id: `detail:${row.id}`,
          label: "Detail",
          icon: Eye,
          disabled: Boolean(pendingActionKey),
          onClick: () =>
            navigate(`${detailPath}?id=${row.id}`, {
              state: { row },
            }),
        });
      }

      customActions.forEach((action) => {
        const isPending = pendingActionKey === `${action.id}:${row.id}`;
        items.push({
          id: `${action.id}:${row.id}`,
          label: isPending ? `${action.label}...` : action.label,
          icon: action.tone === "danger" ? XCircle : CheckCircle2,
          variant: action.tone === "danger" ? "danger" : undefined,
          disabled: Boolean(pendingActionKey),
          onClick: () => handleRowAction(action, row),
        });
      });

      if (!items.length) {
        items.push({
          id: `empty:${row.id}`,
          label: "Aucune action disponible",
          disabled: true,
        });
      }

      return (
        <DropdownAction
          label={<MoreHorizontal size={16} strokeWidth={1.5} />}
          items={items}
          disabled={Boolean(pendingActionKey)}
          buttonClassName="rounded-lg border border-border bg-background/70 p-2 hover:bg-background dark:bg-background/40"
          menuClassName="min-w-[220px]"
        />
      );
    },
    [
      handleDelete,
      handleHardDelete,
      handlePdfOpen,
      handleRowAction,
      navigate,
      openDeleteConfirm,
      openHardDeleteConfirm,
      pendingActionKey,
      resource?.rowActions,
      showToast,
      tableActionConfig,
      user,
      currentRoute.path,
    ],
  );

  const actionSlot =
    resource?.actionSlot || canCreate || canUseImport ? (
      <div className="flex flex-wrap items-center gap-2">
        {resource?.actionSlot}
        {canUseImport
          ? importConfigs.map((importConfig) => {
              const importKey =
                importConfig.importPath || importConfig.templatePath || importConfig.modalTitle;
              const isCurrentImportConfig = activeImportConfig === importConfig;

              return (
                <div key={importKey} className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveImportConfig(importConfig);
                      handleTemplateDownload(importConfig);
                    }}
                    disabled={templateLoading || importLoading}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FileText size={16} />
                    {templateLoading && isCurrentImportConfig
                      ? "Template..."
                      : importConfig.templateButtonLabel || "Template XLSX"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveImportConfig(importConfig);
                      setImportResult(null);
                      setImportSelectionValue("");
                      setIsImportOpen(true);
                    }}
                    disabled={templateLoading || importLoading}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus size={16} />
                    {importConfig.importButtonLabel || "Importer XLSX"}
                  </button>
                </div>
              );
            })
          : null}
        {canCreate ? (
          <Link
            to={createConfig.createPath}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            <Plus size={16} />
            Nouveau
          </Link>
        ) : null}
      </div>
    ) : null;

  if (!canAccessPage) {
    return (
      <div className="layoutSection flex flex-col gap-4">
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <p className="text-sm font-medium text-danger">
            Vous n'avez pas la permission d'acceder a cette page.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="layoutSection flex flex-col gap-4">
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <span className="inline-flex rounded-full bg-header/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
              {currentRoute.sectionLabel}
            </span>
            <h2 className="mt-3 text-2xl font-semibold text-text-primary">
              {currentRoute.name}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {resource?.description || currentRoute.summary}
            </p>
          </div>
        </div>
      </section>

      <AdminDataTable
        title={resource?.tableTitle || `Tableau ${currentRoute.name.toLowerCase()}`}
        description={resource?.tableDescription || currentRoute.summary}
        columns={resource?.columns || []}
        rows={displayedRows}
        loading={loading}
        emptyMessage={
          resource?.emptyMessage || "Aucune donnee disponible pour cette vue."
        }
        searchValue={search}
        onSearchChange={resource?.searchEnabled === false ? undefined : setSearch}
        searchPlaceholder={
          resource?.searchPlaceholder ||
          `Rechercher dans ${currentRoute.name.toLowerCase()}`
        }
        filterSections={filterSections}
        onFilterApply={(nextFilters) => {
          setFilters(nextFilters);
          setPage(1);
        }}
        onFilterReset={(nextFilters) => {
          setFilters(nextFilters);
          setPage(1);
        }}
        sortItems={sortItems}
        sortValue={sort}
        onSortApply={(nextSort) => {
          setSort({
            sortBy: nextSort.sortBy || "",
            sortDir: nextSort.sortDir || "desc",
          });
          setPage(1);
        }}
        onSortReset={() => {
          setSort({ sortBy: "", sortDir: "desc" });
          setPage(1);
        }}
        onExportSelect={handleExport}
        exportItems={resource?.endpoint ? undefined : [{ id: "csv", label: "CSV" }]}
        exportDisabled={!resource?.endpoint && displayedRows.length === 0}
        pagination={pagination}
        actionSlot={actionSlot}
        enableSelection
        renderActions={renderActions}
        actionsHeader="Actions"
      />

      <ImportXlsxModal
        isOpen={isImportOpen}
        title={activeImportConfig?.modalTitle || resource?.importConfig?.modalTitle}
        description={
          activeImportConfig?.modalDescription || resource?.importConfig?.modalDescription
        }
        templateLabel={
          activeImportConfig?.templateButtonLabel ||
          resource?.importConfig?.templateButtonLabel
        }
        importLabel={
          activeImportConfig?.importButtonLabel || resource?.importConfig?.importButtonLabel
        }
        selectionConfig={
          activeImportConfig?.selectionConfig
            ? {
                ...activeImportConfig.selectionConfig,
                options: importSelectionOptions,
              }
            : null
        }
        selectionValue={importSelectionValue}
        onSelectionChange={setImportSelectionValue}
        loading={importLoading}
        templateLoading={templateLoading}
        result={importResult}
        onClose={() => {
          if (importLoading) return;
          setImportResult(null);
          setIsImportOpen(false);
          setActiveImportConfig(null);
          setImportSelectionValue("");
        }}
        onDownloadTemplate={() =>
          handleTemplateDownload(activeImportConfig || resource?.importConfig)
        }
        onImport={(file, selectionValue) =>
          handleImportSubmit(
            file,
            activeImportConfig || resource?.importConfig,
            selectionValue,
          )
        }
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title={
          typeof tableActionConfig.deleteConfirmTitle === "function"
            ? tableActionConfig.deleteConfirmTitle(deleteTarget)
            : tableActionConfig.deleteConfirmTitle || "Confirmer la suppression"
        }
        description={
          typeof tableActionConfig.deleteConfirmDescription === "function"
            ? tableActionConfig.deleteConfirmDescription(deleteTarget)
            : tableActionConfig.deleteConfirmDescription ||
              `Voulez-vous vraiment supprimer ${resolveDeleteLabel(
                deleteTarget,
              )} ? Cette action peut etre irreversible.`
        }
        confirmLabel={tableActionConfig.deleteLabel || "Supprimer"}
        cancelLabel="Annuler"
        loading={pendingActionKey === `delete:${deleteTarget?.id}`}
        onCancel={closeDeleteConfirm}
        onConfirm={() => {
          if (!deleteTarget) return;
          handleDelete(deleteTarget);
        }}
      />

      <ConfirmModal
        isOpen={Boolean(hardDeleteTarget)}
        title={
          typeof tableActionConfig.hardDeleteConfirmTitle === "function"
            ? tableActionConfig.hardDeleteConfirmTitle(hardDeleteTarget)
            : tableActionConfig.hardDeleteConfirmTitle ||
              "Confirmer la suppression definitive"
        }
        description={
          typeof tableActionConfig.hardDeleteConfirmDescription === "function"
            ? tableActionConfig.hardDeleteConfirmDescription(hardDeleteTarget)
            : tableActionConfig.hardDeleteConfirmDescription ||
              `Voulez-vous vraiment supprimer definitivement ${resolveDeleteLabel(
                hardDeleteTarget,
              )} ? Cette action est irreversible.`
        }
        confirmLabel={tableActionConfig.hardDeleteLabel || "Supprimer definitivement"}
        cancelLabel="Annuler"
        loading={pendingActionKey === `hard-delete:${hardDeleteTarget?.id}`}
        onCancel={closeHardDeleteConfirm}
        onConfirm={() => {
          if (!hardDeleteTarget) return;
          handleHardDelete(hardDeleteTarget);
        }}
      />
    </div>
  );
};

export default AdminResourcePage;
