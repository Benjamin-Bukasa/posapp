import React, { useEffect, useMemo, useState } from "react";
import {
  EllipsisVertical,
  Eye,
  PackageCheck,
  PackageOpen,
  PackageX,
  ShoppingBag,
  XCircle,
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
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import useSyncedQuerySearch from "../hooks/useSyncedQuerySearch";

const normalizeOrders = (orders = []) =>
  orders.map((order) => {
    const products = order.items?.length
      ? order.items
          .map(
            (item) => `${item.product?.name || "Produit"} (${item.quantity || 0})`
          )
          .join(", ")
      : "";
    const paymentStatus = (() => {
      const statuses = (order.payments || []).map((p) => p.status);
      if (statuses.includes("COMPLETED")) return "Paye";
      if (statuses.includes("FAILED")) return "Echoue";
      return "En attente";
    })();

    const orderStatus = (() => {
      if (order.status === "PAID") return "Livre";
      if (order.status === "CANCELED") return "Annule";
      if (order.status === "PARTIAL") return "En cours";
      return "En attente";
    })();

    return {
      id: order.id,
      orderId: `#ORD-${shortId(order.id)}`,
      customer: order.customer
        ? formatName(order.customer)
        : "Client comptoir",
      date: formatDate(order.createdAt),
      products,
      total: formatAmount(order.total, order.currencyCode),
      paymentStatus,
      orderStatus,
    };
  });

const resolvePaymentVariant = (status) => {
  const normalized = status?.toLowerCase?.() ?? "";
  if (normalized.includes("paye")) return "success";
  if (normalized.includes("attente")) return "warning";
  if (normalized.includes("echoue")) return "danger";
  return "neutral";
};

const resolveOrderVariant = (status) => {
  const normalized = status?.toLowerCase?.() ?? "";
  if (normalized.includes("livre")) return "success";
  if (normalized.includes("en cours")) return "warning";
  if (normalized.includes("annule")) return "danger";
  return "neutral";
};

function Orders() {
  const refreshTick = useRealtimeRefetch([
    "order:created",
    "order:updated",
    "payment:created",
  ]);
  const displayCurrencyCode = useCurrencyStore(
    (state) => state.settings.primaryCurrencyCode,
  );
  const showToast = useToastStore((state) => state.showToast);
  const [orders, setOrders] = useState([]);
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
        const data = await apiGet("/api/orders");
        if (!isMounted) return;
        const list = Array.isArray(data?.data) ? data.data : data;
        setOrders(Array.isArray(list) ? list : []);
      } catch (error) {
        showToast({
          title: "Erreur",
          message: error.message || "Impossible de charger les commandes.",
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
  }, [refreshTick, showToast]);

  const rows = useMemo(() => normalizeOrders(orders), [orders, displayCurrencyCode]);

  const filteredOrders = useMemo(() => {
    let results = [...rows];

    const keyword = search.trim().toLowerCase();
    if (keyword) {
      results = results.filter((row) =>
        [row.orderId, row.customer, row.products]
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
          row.orderStatus.toLowerCase().includes("annule")
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

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedOrders = filteredOrders.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );
  const rangeStart = filteredOrders.length
    ? (safePage - 1) * pageSize + 1
    : 0;
  const rangeEnd = Math.min(filteredOrders.length, safePage * pageSize);
  const rangeLabel = `Affichage ${rangeStart}-${rangeEnd} sur ${filteredOrders.length}`;

  const stats = useMemo(() => {
    const now = new Date();
    const currentRange = getMonthRange(now);
    const previousRange = getPreviousMonthRange(now);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const ordersCurrent = orders.filter((order) =>
      isWithinRange(order.createdAt, currentRange.start, currentRange.end)
    );
    const ordersPrevious = orders.filter((order) =>
      isWithinRange(order.createdAt, previousRange.start, previousRange.end)
    );

    const countByStatus = (list, statuses) =>
      list.filter((order) => statuses.includes(order.status)).length;

    const paidOrders = orders.filter((order) => order.status === "PAID");
    const paidThisMonth = ordersCurrent.filter(
      (order) => order.status === "PAID"
    );
    const paidPreviousMonth = ordersPrevious.filter(
      (order) => order.status === "PAID"
    );

    const totalRevenue = paidOrders.reduce(
      (sum, order) => sum + toDisplayAmount(order.total, order.currencyCode),
      0
    );

    const currentStats = {
      total: ordersCurrent.length,
      inDelivery: countByStatus(ordersCurrent, ["PARTIAL", "DRAFT"]),
      paid: paidThisMonth.length,
      canceled: countByStatus(ordersCurrent, ["CANCELED"]),
    };

    const previousStats = {
      total: ordersPrevious.length,
      inDelivery: countByStatus(ordersPrevious, ["PARTIAL", "DRAFT"]),
      paid: paidPreviousMonth.length,
      canceled: countByStatus(ordersPrevious, ["CANCELED"]),
    };

    return {
      total: orders.length,
      inDelivery: countByStatus(orders, ["PARTIAL", "DRAFT"]),
      paidMonth: paidThisMonth.length,
      canceled: countByStatus(orders, ["CANCELED"]),
      revenue: totalRevenue,
      weekCount: orders.filter(
        (order) => new Date(order.createdAt) >= sevenDaysAgo
      ).length,
      change: {
        total: percentChange(currentStats.total, previousStats.total),
        inDelivery: percentChange(
          currentStats.inDelivery,
          previousStats.inDelivery
        ),
        paidMonth: percentChange(currentStats.paid, previousStats.paid),
        canceled: percentChange(currentStats.canceled, previousStats.canceled),
      },
    };
  }, [orders, displayCurrencyCode]);

  const cards = useMemo(
    () => [
      {
        title: "Total des commandes",
        value: stats.total.toString(),
        subtitle: "Depuis la semaine",
        icon: ShoppingBag,
        change: stats.change.total,
        highlight: true,
        amountLabel: "Revenus generes",
        amountValue: formatDisplayAmount(stats.revenue),
      },
      {
        title: "Commandes en cours",
        value: stats.inDelivery.toString(),
        subtitle: "Depuis la semaine",
        icon: PackageOpen,
        change: stats.change.inDelivery,
        amountLabel: "Commandes semaine",
        amountValue: stats.weekCount.toString(),
      },
      {
        title: "Commandes vendues (mois)",
        value: stats.paidMonth.toString(),
        subtitle: "Ce mois-ci",
        icon: PackageCheck,
        change: stats.change.paidMonth,
        amountLabel: "Revenus generes",
        amountValue: formatDisplayAmount(stats.revenue),
      },
      {
        title: "Commandes annulees",
        value: stats.canceled.toString(),
        subtitle: "Depuis la semaine",
        icon: PackageX,
        change: stats.change.canceled,
        amountLabel: "Revenus perdus",
        amountValue: formatDisplayAmount(0),
      },
    ],
    [stats, displayCurrencyCode]
  );

  const columns = useMemo(
    () => [
      { header: "Order ID", accessor: "orderId" },
      { header: "Client", accessor: "customer" },
      { header: "Date", accessor: "date" },
      { header: "Produits", accessor: "products" },
      { header: "Montant", accessor: "total" },
      {
        header: "Paiement",
        accessor: "paymentStatus",
        render: (row) => (
          <Badge
            label={row.paymentStatus}
            variant={resolvePaymentVariant(row.paymentStatus)}
          />
        ),
      },
      {
        header: "Statut",
        accessor: "orderStatus",
        render: (row) => (
          <Badge
            label={row.orderStatus}
            variant={resolveOrderVariant(row.orderStatus)}
          />
        ),
      },
    ],
    []
  );

  const actionItems = [
    { id: "view", label: "Voir", icon: Eye },
    { id: "deliver", label: "Marquer livre", icon: PackageCheck },
    { id: "cancel", label: "Annuler", icon: XCircle, variant: "danger" },
  ];

  return (
    <section className="w-full h-full flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Commandes</h1>
        <p className="text-sm text-text-secondary">
          Liste des commandes passees en ligne.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <DataTable
        title="Liste des commandes"
        description="Toutes les commandes passees en ligne"
        columns={columns}
        data={pagedOrders}
        emptyMessage={loading ? "Chargement..." : "Aucune donnee"}
        tableMaxHeightClass="max-h-[46vh]"
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
      />
    </section>
  );
}

export default Orders;
