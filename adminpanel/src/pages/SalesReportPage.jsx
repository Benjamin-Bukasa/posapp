import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CalendarRange,
  Package,
  ReceiptText,
  RefreshCcw,
  RotateCcw,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import AdminDataTable from "../components/ui/AdminDataTable";
import DropdownAction from "../components/ui/dropdownAction";
import StatCard from "../components/ui/StatCard";
import { ApiError, requestBlob, requestJson } from "../api/client";
import useAuthStore from "../stores/authStore";
import useToastStore from "../stores/toastStore";
import { formatMoney } from "../utils/currencyDisplay";
import { shouldSkipPermissionToast } from "../utils/permissionErrors";
import { hasAnyPermission } from "../utils/permissions";

const VIEW_OPTIONS = [
  { id: "period", label: "Par periode" },
  { id: "by-item", label: "Vente par article" },
  { id: "by-customer", label: "Vente par client" },
  { id: "by-date", label: "Vente par date" },
  { id: "cancellations", label: "Annulation" },
  { id: "refunds", label: "Remboursement" },
  { id: "by-cashier", label: "Vente par caissier" },
  { id: "by-store", label: "Vente par boutique" },
  { id: "top-items", label: "Articles plus vendus" },
  { id: "least-items", label: "Articles moins vendus" },
];

const formatDateValue = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
};

const formatDateTimeValue = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatCount = (value) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    Number(value || 0),
  );

const resolveAccessor = (row, accessor) => {
  if (typeof accessor === "function") return accessor(row);
  if (!accessor) return "";

  return String(accessor)
    .split(".")
    .reduce((value, segment) => (value == null ? value : value[segment]), row);
};

const toPlainValue = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  return String(value);
};

const buildMonthStart = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
};

const buildToday = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function SalesReportPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const showToast = useToastStore((state) => state.showToast);
  const canAccessPage = hasAnyPermission(user, ["sales.read"]);
  const [view, setView] = useState("period");
  const [createdFrom, setCreatedFrom] = useState(buildMonthStart);
  const [createdTo, setCreatedTo] = useState(buildToday);
  const [report, setReport] = useState({
    rows: [],
    summary: {
      totalAmount: 0,
      orderCount: 0,
      quantityTotal: 0,
      customerCount: 0,
      cancellationCount: 0,
      refundCount: 0,
      cashAmount: 0,
      nonCashAmount: 0,
    },
    currencyCode: "USD",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshTick, setRefreshTick] = useState(0);
  const [exporting, setExporting] = useState("");

  useEffect(() => {
    setPage(1);
  }, [view, search, createdFrom, createdTo]);

  useEffect(() => {
    let ignore = false;

    const loadReport = async () => {
      if (!canAccessPage) {
        setReport((current) => ({ ...current, rows: [] }));
        setLoading(false);
        setError("");
        return;
      }

      if (!accessToken) {
        setLoading(false);
        setError("Session manquante.");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const payload = await requestJson("/api/reports/sales-report", {
          token: accessToken,
          query: {
            view,
            createdFrom,
            createdTo,
          },
        });

        if (ignore) return;

        setReport({
          rows: Array.isArray(payload?.rows) ? payload.rows : [],
          summary: payload?.summary || {
            totalAmount: 0,
            orderCount: 0,
            quantityTotal: 0,
            customerCount: 0,
            cancellationCount: 0,
            refundCount: 0,
            cashAmount: 0,
            nonCashAmount: 0,
          },
          currencyCode: payload?.currencyCode || "USD",
        });
      } catch (requestError) {
        if (ignore) return;

        if (requestError instanceof ApiError && requestError.status === 401) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }

        if (shouldSkipPermissionToast(requestError)) {
          setReport((current) => ({ ...current, rows: [] }));
          setError("");
          return;
        }
        setReport((current) => ({ ...current, rows: [] }));
        setError(requestError.message || "Impossible de charger le rapport de vente.");
        showToast({
          title: "Erreur",
          message: requestError.message || "Impossible de charger le rapport de vente.",
          variant: "danger",
        });
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadReport();

    return () => {
      ignore = true;
    };
  }, [
    accessToken,
    canAccessPage,
    createdFrom,
    createdTo,
    logout,
    navigate,
    refreshTick,
    showToast,
    view,
  ]);

  const columns = useMemo(() => {
    const amountColumn = (header, accessor = "amount") => ({
      key: accessor,
      header,
      accessor,
      render: (row) => formatMoney(row[accessor], report.currencyCode),
      className: "whitespace-nowrap",
    });

    switch (view) {
      case "by-item":
      case "top-items":
      case "least-items":
        return [
          ...(view === "top-items" || view === "least-items"
            ? [
                {
                  key: "rank",
                  header: "Rang",
                  accessor: "rank",
                  render: (row) => `#${row.rank || "--"}`,
                },
              ]
            : []),
          {
            key: "productName",
            header: "Article",
            accessor: "productName",
            render: (row) => (
              <div>
                <p className="font-medium text-text-primary">{row.productName || "--"}</p>
                <p className="text-xs text-text-secondary">{row.sku || "Sans SKU"}</p>
              </div>
            ),
          },
          {
            key: "quantity",
            header: "Quantite",
            accessor: "quantity",
            render: (row) => formatCount(row.quantity),
          },
          {
            key: "orderCount",
            header: "Tickets",
            accessor: "orderCount",
            render: (row) => formatCount(row.orderCount),
          },
          amountColumn("Chiffre d'affaires"),
          {
            key: "averagePrice",
            header: "Prix moyen",
            accessor: "averagePrice",
            render: (row) => formatMoney(row.averagePrice, report.currencyCode),
          },
        ];
      case "by-customer":
        return [
          {
            key: "customerName",
            header: "Client",
            accessor: "customerName",
            render: (row) => (
              <div>
                <p className="font-medium text-text-primary">{row.customerName || "--"}</p>
                <p className="text-xs text-text-secondary">
                  {row.phone || row.email || "Sans coordonnees"}
                </p>
              </div>
            ),
          },
          {
            key: "orderCount",
            header: "Tickets",
            accessor: "orderCount",
            render: (row) => formatCount(row.orderCount),
          },
          {
            key: "quantity",
            header: "Articles",
            accessor: "quantity",
            render: (row) => formatCount(row.quantity),
          },
          amountColumn("Montant"),
        ];
      case "by-date":
        return [
          {
            key: "date",
            header: "Date",
            accessor: "date",
            render: (row) => formatDateValue(row.date),
          },
          {
            key: "orderCount",
            header: "Tickets",
            accessor: "orderCount",
            render: (row) => formatCount(row.orderCount),
          },
          {
            key: "customerCount",
            header: "Clients",
            accessor: "customerCount",
            render: (row) => formatCount(row.customerCount),
          },
          {
            key: "quantity",
            header: "Articles",
            accessor: "quantity",
            render: (row) => formatCount(row.quantity),
          },
          amountColumn("Montant"),
          {
            key: "cancellations",
            header: "Annulations",
            accessor: "cancellations",
            render: (row) => formatCount(row.cancellations),
          },
          {
            key: "refunds",
            header: "Remboursements",
            accessor: "refunds",
            render: (row) => formatCount(row.refunds),
          },
        ];
      case "cancellations":
      case "refunds":
        return [
          {
            key: "createdAt",
            header: "Date",
            accessor: "createdAt",
            render: (row) => formatDateTimeValue(row.createdAt),
          },
          {
            key: "orderId",
            header: "Vente",
            accessor: "orderId",
          },
          {
            key: "customerName",
            header: "Client",
            accessor: "customerName",
          },
          {
            key: "cashierName",
            header: "Caissier",
            accessor: "cashierName",
          },
          {
            key: "storeName",
            header: "Boutique",
            accessor: "storeName",
          },
          amountColumn("Montant"),
          {
            key: "reason",
            header: "Motif",
            accessor: "reason",
            render: (row) => row.reason || "--",
          },
        ];
      case "by-cashier":
        return [
          {
            key: "cashierName",
            header: "Caissier",
            accessor: "cashierName",
          },
          {
            key: "storeName",
            header: "Boutique",
            accessor: "storeName",
          },
          {
            key: "orderCount",
            header: "Tickets",
            accessor: "orderCount",
            render: (row) => formatCount(row.orderCount),
          },
          {
            key: "customerCount",
            header: "Clients",
            accessor: "customerCount",
            render: (row) => formatCount(row.customerCount),
          },
          {
            key: "quantity",
            header: "Articles",
            accessor: "quantity",
            render: (row) => formatCount(row.quantity),
          },
          amountColumn("Montant"),
        ];
      case "by-store":
        return [
          {
            key: "storeName",
            header: "Boutique",
            accessor: "storeName",
          },
          {
            key: "cashierCount",
            header: "Caissiers",
            accessor: "cashierCount",
            render: (row) => formatCount(row.cashierCount),
          },
          {
            key: "customerCount",
            header: "Clients",
            accessor: "customerCount",
            render: (row) => formatCount(row.customerCount),
          },
          {
            key: "orderCount",
            header: "Tickets",
            accessor: "orderCount",
            render: (row) => formatCount(row.orderCount),
          },
          {
            key: "quantity",
            header: "Articles",
            accessor: "quantity",
            render: (row) => formatCount(row.quantity),
          },
          amountColumn("Montant"),
        ];
      case "period":
      default:
        return [
          {
            key: "periodLabel",
            header: "Periode",
            accessor: "periodLabel",
          },
          {
            key: "orderCount",
            header: "Tickets",
            accessor: "orderCount",
            render: (row) => formatCount(row.orderCount),
          },
          {
            key: "customerCount",
            header: "Clients",
            accessor: "customerCount",
            render: (row) => formatCount(row.customerCount),
          },
          {
            key: "quantityTotal",
            header: "Articles",
            accessor: "quantityTotal",
            render: (row) => formatCount(row.quantityTotal),
          },
          amountColumn("Ventes", "totalAmount"),
          amountColumn("Cash", "cashAmount"),
          amountColumn("Non cash", "nonCashAmount"),
          amountColumn("Panier moyen", "averageTicket"),
          {
            key: "cancellationCount",
            header: "Annulations",
            accessor: "cancellationCount",
            render: (row) => formatCount(row.cancellationCount),
          },
          {
            key: "refundCount",
            header: "Remboursements",
            accessor: "refundCount",
            render: (row) => formatCount(row.refundCount),
          },
        ];
    }
  }, [report.currencyCode, view]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = String(search || "").trim().toLowerCase();
    if (!normalizedSearch) return report.rows || [];

    return (report.rows || []).filter((row) =>
      columns.some((column) =>
        toPlainValue(resolveAccessor(row, column.accessor))
          .toLowerCase()
          .includes(normalizedSearch),
      ),
    );
  }, [columns, report.rows, search]);

  const paginatedRows = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, page, pageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [filteredRows.length, page, pageSize]);

  const pagination = useMemo(() => {
    const total = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      page,
      pageSize,
      total,
      totalPages,
      onPageChange: (nextPage) => {
        if (nextPage < 1 || nextPage > totalPages) return;
        setPage(nextPage);
      },
      onPageSizeChange: (nextPageSize) => {
        setPageSize(nextPageSize);
        setPage(1);
      },
    };
  }, [filteredRows.length, page, pageSize]);

  const summaryCards = useMemo(
    () => [
      {
        title: "Chiffre d'affaires",
        value: formatMoney(report.summary.totalAmount, report.currencyCode),
        subtitle: "Sur la periode selectionnee",
        icon: BadgeDollarSign,
        highlight: true,
      },
      {
        title: "Tickets",
        value: formatCount(report.summary.orderCount),
        subtitle: "Ventes finalisees",
        icon: ReceiptText,
      },
      {
        title: "Articles",
        value: formatCount(report.summary.quantityTotal),
        subtitle: "Quantites vendues",
        icon: Package,
      },
      {
        title: "Clients",
        value: formatCount(report.summary.customerCount),
        subtitle: "Clients servis",
        icon: Users,
      },
      {
        title: "Annulations",
        value: formatCount(report.summary.cancellationCount),
        subtitle: "Ventes annulees",
        icon: RefreshCcw,
      },
      {
        title: "Remboursements",
        value: formatCount(report.summary.refundCount),
        subtitle: "Clients rembourses",
        icon: RotateCcw,
      },
    ],
    [report.currencyCode, report.summary],
  );

  const selectedViewLabel =
    VIEW_OPTIONS.find((option) => option.id === view)?.label || "Type de rapport";

  const handleExport = async (item) => {
    if (!item?.id || !accessToken) {
      return;
    }

    setExporting(item.id);
    setError("");

    try {
      const blob = await requestBlob("/api/reports/sales-report", {
        token: accessToken,
        query: {
          view,
          createdFrom,
          createdTo,
          export: item.id,
        },
      });

      downloadBlob(blob, `rapport-vente-${view}.${item.id}`);
      showToast({
        title: "Export termine",
        message: `Le fichier ${item.label} a ete genere.`,
        variant: "success",
      });
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }

      setError(requestError.message || "Impossible d'exporter le rapport.");
      showToast({
        title: "Erreur",
        message: requestError.message || "Impossible d'exporter le rapport.",
        variant: "danger",
      });
    } finally {
      setExporting("");
    }
  };

  if (!canAccessPage) {
    return (
      <div className="layoutSection flex flex-col gap-4">
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <p className="text-sm font-medium text-danger">
            Vous n'avez pas la permission d'acceder a ce rapport.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="layoutSection flex flex-col gap-4">
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <span className="inline-flex rounded-full bg-header/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
              Rapports
            </span>
            <h2 className="mt-3 text-2xl font-semibold text-text-primary">
              Rapport de vente
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              Analysez les ventes par article, client, date, caissier, boutique,
              ainsi que les annulations, remboursements et tendances de la periode.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRefreshTick((current) => current + 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-surface"
            >
              <RefreshCcw size={16} />
              Actualiser
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </section>

      {error ? (
        <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <AdminDataTable
        title={VIEW_OPTIONS.find((option) => option.id === view)?.label || "Rapport"}
        description="Les montants sont normalises dans la devise principale du tenant."
        columns={columns}
        rows={paginatedRows}
        loading={loading}
        emptyMessage="Aucune donnee disponible pour cette vue sur la periode selectionnee."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Rechercher dans le rapport"
        pagination={pagination}
        enableSelection={false}
        toolbarSlot={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <DropdownAction
              label={
                <div className="flex items-center gap-2">
                  <span>{selectedViewLabel}</span>
                </div>
              }
              items={VIEW_OPTIONS.map((option) => ({
                id: option.id,
                label: option.label,
              }))}
              onSelect={(item) => setView(item.id)}
              buttonClassName="rounded-lg border border-border bg-background/70 px-4 py-2 font-medium text-text-primary hover:bg-background dark:bg-background/40 dark:hover:bg-surface/70"
              menuClassName="min-w-[260px]"
            />

            <label className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-secondary sm:w-auto sm:justify-start">
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <CalendarRange size={15} />
                Du
              </span>
              <input
                type="date"
                value={createdFrom}
                onChange={(event) => setCreatedFrom(event.target.value)}
                className="min-w-[132px] bg-transparent text-text-primary outline-none"
              />
            </label>

            <label className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-secondary sm:w-auto sm:justify-start">
              <span className="whitespace-nowrap">Au</span>
              <input
                type="date"
                value={createdTo}
                onChange={(event) => setCreatedTo(event.target.value)}
                className="min-w-[132px] bg-transparent text-text-primary outline-none"
              />
            </label>
          </div>
        }
        exportItems={[
          { id: "xlsx", label: "Excel" },
          { id: "pdf", label: "PDF" },
        ]}
        exportLabel={exporting ? "Export..." : "Exporter"}
        onExportSelect={handleExport}
        exportDisabled={loading || Boolean(exporting) || filteredRows.length === 0}
      />
    </div>
  );
}

export default SalesReportPage;
