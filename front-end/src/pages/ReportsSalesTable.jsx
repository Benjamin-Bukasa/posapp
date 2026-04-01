import React, { useEffect, useMemo, useState } from "react";
import DataTable from "../components/ui/datatable";
import Badge from "../components/ui/badge";
import { getCurrentUser } from "../utils/currentUser";
import { apiGet } from "../services/apiClient";
import { formatAmount, formatDate, formatName, shortId } from "../utils/formatters";
import useToastStore from "../stores/toastStore";
import useCurrencyStore from "../stores/currencyStore";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import useSyncedQuerySearch from "../hooks/useSyncedQuerySearch";

const resolveSaleVariant = (status) => {
  const normalized = status?.toLowerCase?.() ?? "";
  if (normalized.includes("paye")) return "success";
  if (normalized.includes("attente")) return "warning";
  if (normalized.includes("annule")) return "danger";
  return "neutral";
};

const mapPaymentMethod = (method) => {
  if (method === "CASH") return "Cash";
  if (method === "CARD") return "Carte";
  if (method === "MOBILE_MONEY") return "Mobile Money";
  if (method === "TRANSFER") return "Transfert";
  return method || "N/A";
};

const mapSaleStatus = (status) => {
  if (status === "PAID") return "Paye";
  if (status === "CANCELED") return "Annule";
  if (status === "PARTIAL") return "En attente";
  return "En attente";
};

function ReportsSalesTable() {
  const currentUser = useMemo(() => getCurrentUser(), []);
  const displayCurrencyCode = useCurrencyStore(
    (state) => state.settings.primaryCurrencyCode,
  );
  const refreshTick = useRealtimeRefetch([
    "sale:created",
    "sale:updated",
    "payment:created",
  ]);
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
          message: error.message || "Impossible de charger les ventes.",
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

  const salesRows = useMemo(() => {
    return orders.map((order) => {
      const items = order.items?.length
        ? order.items
            .map(
              (item) => `${item.product?.name || "Produit"} (${item.quantity || 0})`
            )
            .join(", ")
        : "";
      const quantity = order.items?.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      );
      const paymentMethod = mapPaymentMethod(order.payments?.[0]?.method);
      return {
        id: order.id,
        saleId: `#REP-SALE-${shortId(order.id)}`,
        customer: order.customer
          ? formatName(order.customer)
          : "Client comptoir",
        cashier: order.createdBy ? formatName(order.createdBy) : "N/A",
        date: formatDate(order.createdAt),
        items,
        quantity: quantity || 0,
        total: formatAmount(order.total, order.currencyCode),
        paymentMethod,
        status: mapSaleStatus(order.status),
      };
    });
  }, [orders, displayCurrencyCode]);

  const filteredSales = useMemo(() => {
    let results = [...salesRows];
    const normalizedUser = currentUser.name.toLowerCase();

    results = results.filter(
      (row) => row.cashier?.toLowerCase?.() === normalizedUser
    );

    const keyword = search.trim().toLowerCase();
    if (keyword) {
      results = results.filter((row) =>
        [row.saleId, row.customer, row.cashier, row.items, row.paymentMethod]
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
          row.status.toLowerCase().includes("annule")
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

    const sort = sortValues ?? { date: "desc", activity: "az", name: "az" };
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
  }, [salesRows, search, filterValues, sortValues, currentUser.name]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedSales = filteredSales.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );
  const rangeStart = filteredSales.length
    ? (safePage - 1) * pageSize + 1
    : 0;
  const rangeEnd = Math.min(filteredSales.length, safePage * pageSize);
  const rangeLabel = `Affichage ${rangeStart}-${rangeEnd} sur ${filteredSales.length}`;

  const columns = useMemo(
    () => [
      { header: "Vente ID", accessor: "saleId" },
      { header: "Client", accessor: "customer" },
      { header: "Caissier", accessor: "cashier" },
      { header: "Date", accessor: "date" },
      { header: "Articles", accessor: "items" },
      { header: "Quantite", accessor: "quantity" },
      { header: "Montant", accessor: "total" },
      { header: "Paiement", accessor: "paymentMethod" },
      {
        header: "Statut",
        accessor: "status",
        render: (row) => (
          <Badge label={row.status} variant={resolveSaleVariant(row.status)} />
        ),
      },
    ],
    []
  );

  return (
    <DataTable
      title="Rapport de vente"
      description="Ventes du caissier connecte"
      columns={columns}
      data={pagedSales}
      emptyMessage={loading ? "Chargement..." : "Aucune donnee"}
      enableSelection={false}
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
      tableMaxHeightClass="max-h-[45vh]"
    />
  );
}

export default ReportsSalesTable;
