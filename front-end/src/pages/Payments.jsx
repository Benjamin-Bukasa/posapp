import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  CreditCard,
  EllipsisVertical,
  Eye,
  Smartphone,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import DataTable from "../components/ui/datatable";
import DropdownAction from "../components/ui/dropdownAction";
import Badge from "../components/ui/badge";
import StatCard from "../components/ui/statCard";
import useToastStore from "../stores/toastStore";
import useCurrencyStore from "../stores/currencyStore";
import { apiGet } from "../services/apiClient";
import {
  formatAmount,
  formatDate,
  formatDisplayAmount,
  formatName,
  shortId,
  toDisplayAmount,
} from "../utils/formatters";
import {
  getMonthRange,
  getPreviousMonthRange,
  isWithinRange,
  percentChange,
} from "../utils/metrics";
import useSyncedQuerySearch from "../hooks/useSyncedQuerySearch";

const mapPaymentStatus = (status) => {
  if (status === "COMPLETED") return "Paye";
  if (status === "FAILED") return "Echoue";
  return "En attente";
};

const mapPaymentMethod = (method) => {
  if (method === "CASH") return "Cash";
  if (method === "MOBILE_MONEY") return "Mobile Money";
  if (method === "CARD") return "Carte";
  if (method === "TRANSFER") return "Transfert";
  return method || "N/A";
};

const resolvePaymentVariant = (status) => {
  const normalized = status?.toLowerCase?.() ?? "";
  if (normalized.includes("paye")) return "success";
  if (normalized.includes("attente")) return "warning";
  if (normalized.includes("echoue")) return "danger";
  return "neutral";
};

const resolveMethodIcon = (method) => {
  const normalized = method?.toLowerCase?.() ?? "";
  if (normalized.includes("cash")) return Banknote;
  if (normalized.includes("mobile")) return Smartphone;
  return CreditCard;
};

function Payments() {
  const displayCurrencyCode = useCurrencyStore(
    (state) => state.settings.primaryCurrencyCode,
  );
  const showToast = useToastStore((state) => state.showToast);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useSyncedQuerySearch("q");
  const [filterValues, setFilterValues] = useState(null);
  const [sortValues, setSortValues] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await apiGet("/api/payments");
        if (!isMounted) return;
        const list = Array.isArray(data?.data) ? data.data : data;
        setPayments(Array.isArray(list) ? list : []);
      } catch (error) {
        showToast({
          title: "Erreur",
          message: error.message || "Impossible de charger les paiements.",
          variant: "danger",
        });
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [showToast]);

  const rows = useMemo(
    () =>
      payments.map((payment) => ({
        id: payment.id,
        paymentId: `#PAY-${shortId(payment.id)}`,
        orderId: payment.orderId
          ? `#ORD-${shortId(payment.orderId)}`
          : "N/A",
        customer: payment.order?.customer
          ? formatName(payment.order.customer)
          : "Client comptoir",
        method: mapPaymentMethod(payment.method),
        amount: formatAmount(payment.amount, payment.currencyCode),
        status: mapPaymentStatus(payment.status),
        date: formatDate(payment.createdAt),
      })),
    [payments, displayCurrencyCode]
  );

  const filteredPayments = useMemo(() => {
    let results = [...rows];

    const keyword = search.trim().toLowerCase();
    if (keyword) {
      results = results.filter((row) =>
        [row.paymentId, row.orderId, row.customer, row.method]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword)
      );
    }

    if (filterValues?.from || filterValues?.to) {
      const fromDate = filterValues.from ? new Date(filterValues.from) : null;
      const toDate = filterValues.to ? new Date(filterValues.to) : null;
      results = results.filter((row) => {
        const rowDate = new Date(row.date);
        if (fromDate && rowDate < fromDate) return false;
        if (toDate && rowDate > toDate) return false;
        return true;
      });
    }

    if (filterValues?.status && filterValues.status !== "all") {
      if (filterValues.status === "annule") {
        results = results.filter((row) =>
          row.status.toLowerCase().includes("echoue")
        );
      }
      if (filterValues.status === "actif") {
        results = results.filter((row) =>
          row.status.toLowerCase().includes("paye")
        );
      }
      if (filterValues.status === "inactif") {
        results = results.filter((row) =>
          row.status.toLowerCase().includes("attente")
        );
      }
    }

    const sort = sortValues ?? { date: "asc", activity: "az", name: "az" };
    if (sort?.date) {
      results.sort((a, b) => {
        const aDate = new Date(a.date);
        const bDate = new Date(b.date);
        return sort.date === "asc" ? aDate - bDate : bDate - aDate;
      });
    }
    if (sort?.name) {
      results.sort((a, b) => {
        const compare = a.customer.localeCompare(b.customer);
        return sort.name === "az" ? compare : -compare;
      });
    }

    return results;
  }, [rows, search, filterValues, sortValues]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedPayments = filteredPayments.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );
  const rangeStart = filteredPayments.length
    ? (safePage - 1) * pageSize + 1
    : 0;
  const rangeEnd = Math.min(filteredPayments.length, safePage * pageSize);
  const rangeLabel = `Affichage ${rangeStart}-${rangeEnd} sur ${filteredPayments.length}`;

  const stats = useMemo(() => {
    const now = new Date();
    const currentRange = getMonthRange(now);
    const previousRange = getPreviousMonthRange(now);

    const paymentDate = (payment) => payment.paidAt || payment.createdAt;

    const currentPayments = payments.filter((payment) =>
      isWithinRange(paymentDate(payment), currentRange.start, currentRange.end)
    );
    const previousPayments = payments.filter((payment) =>
      isWithinRange(paymentDate(payment), previousRange.start, previousRange.end)
    );

    const completed = payments.filter((p) => p.status === "COMPLETED");
    const completedAmount = completed.reduce(
      (sum, p) => sum + toDisplayAmount(p.amount, p.currencyCode),
      0
    );

    const mobileMoneyCount = payments.filter(
      (p) => p.method === "MOBILE_MONEY"
    ).length;
    const cashCount = payments.filter((p) => p.method === "CASH").length;

    const completedCurrent = currentPayments.filter(
      (p) => p.status === "COMPLETED"
    );
    const completedPrevious = previousPayments.filter(
      (p) => p.status === "COMPLETED"
    );

    const mobileMoneyCurrent = currentPayments.filter(
      (p) => p.method === "MOBILE_MONEY"
    ).length;
    const mobileMoneyPrevious = previousPayments.filter(
      (p) => p.method === "MOBILE_MONEY"
    ).length;

    const cashCurrent = currentPayments.filter((p) => p.method === "CASH").length;
    const cashPrevious = previousPayments.filter((p) => p.method === "CASH").length;

    return {
      total: payments.length,
      completed: completed.length,
      completedAmount,
      mobileMoney: mobileMoneyCount,
      cash: cashCount,
      change: {
        total: percentChange(currentPayments.length, previousPayments.length),
        completed: percentChange(completedCurrent.length, completedPrevious.length),
        mobileMoney: percentChange(mobileMoneyCurrent, mobileMoneyPrevious),
        cash: percentChange(cashCurrent, cashPrevious),
      },
    };
  }, [payments, displayCurrencyCode]);

  const paymentCards = useMemo(
    () => [
      {
        title: "Transactions totales",
        value: stats.total.toString(),
        subtitle: "Depuis la semaine",
        icon: WalletCards,
        change: stats.change.total,
        highlight: true,
        amountLabel: "Montant collecte",
        amountValue: formatDisplayAmount(stats.completedAmount),
      },
      {
        title: "Paiements valides",
        value: stats.completed.toString(),
        subtitle: "Transactions reussies",
        icon: BadgeCheck,
        change: stats.change.completed,
        amountLabel: "Taux de succes",
        amountValue: stats.total
          ? `${Math.round((stats.completed / stats.total) * 100)}%`
          : "0%",
      },
      {
        title: "Mobile Money",
        value: stats.mobileMoney.toString(),
        subtitle: "Transactions du mois",
        icon: Smartphone,
        change: stats.change.mobileMoney,
        amountLabel: "Transactions",
        amountValue: stats.mobileMoney.toString(),
      },
      {
        title: "Paiements en especes",
        value: stats.cash.toString(),
        subtitle: "Transactions du mois",
        icon: Banknote,
        change: stats.change.cash,
        amountLabel: "Transactions",
        amountValue: stats.cash.toString(),
      },
    ],
    [stats, displayCurrencyCode]
  );

  const columns = useMemo(
    () => [
      { header: "Paiement", accessor: "paymentId" },
      { header: "Commande", accessor: "orderId" },
      { header: "Client", accessor: "customer" },
      {
        header: "Methode",
        accessor: "method",
        render: (row) => {
          const Icon = resolveMethodIcon(row.method);
          return (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Icon size={14} />
              <span className="text-text-primary">{row.method}</span>
            </div>
          );
        },
      },
      { header: "Montant", accessor: "amount" },
      {
        header: "Statut",
        accessor: "status",
        render: (row) => (
          <Badge label={row.status} variant={resolvePaymentVariant(row.status)} />
        ),
      },
      { header: "Date", accessor: "date" },
    ],
    []
  );

  const actionItems = [
    { id: "view", label: "Voir", icon: Eye },
    { id: "refund", label: "Rembourser", icon: TrendingUp },
  ];

  return (
    <section className="w-full h-full flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Paiements</h1>
        <p className="text-sm text-text-secondary">
          Suivez les paiements recus et leur statut.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {paymentCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <DataTable
        title="Historique des paiements"
        description="Toutes les transactions enregistrees"
        columns={columns}
        data={pagedPayments}
        emptyMessage={loading ? "Chargement..." : "Aucune donnee"}
        enableSelection={false}
        actionsHeader="Action"
        renderActions={() => (
          <DropdownAction
            label={<EllipsisVertical size={18} strokeWidth={1.5} />}
            items={actionItems}
            buttonClassName="rounded-lg bg-transparent p-1 text-text-primary hover:bg-header"
          />
        )}
        searchInput={{
          name: "search",
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
          placeholder: "Rechercher...",
          type: "text",
        }}
        onFilterSelect={(values) => {
          setFilterValues(values);
          setPage(1);
        }}
        onSortSelect={(values) => {
          setSortValues(values);
          setPage(1);
        }}
        onExportSelect={() => {}}
        pagination={{
          page: safePage,
          totalPages,
          label: rangeLabel,
          onPageChange: (value) => setPage(value),
          onPrev: () => setPage((prev) => Math.max(1, prev - 1)),
          onNext: () => setPage((prev) => Math.min(totalPages, prev + 1)),
          disablePrev: safePage <= 1,
          disableNext: safePage >= totalPages,
        }}
        pageSizeSelect={{
          value: pageSize,
          options: [5, 10, 20, 50],
          onChange: (value) => {
            setPageSize(value);
            setPage(1);
          },
          label: "Afficher",
        }}
        tableMaxHeightClass="max-h-[46vh]"
      />
    </section>
  );
}

export default Payments;
