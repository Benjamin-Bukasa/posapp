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

const resolveSupplyVariant = (status) => {
  const normalized = status?.toLowerCase?.() ?? "";
  if (normalized.includes("livre")) return "success";
  if (normalized.includes("attente")) return "warning";
  if (normalized.includes("annule")) return "danger";
  return "neutral";
};

const mapSupplyStatus = (status) => {
  if (status === "POSTED" || status === "RECEIVED") return "Livre";
  if (status === "REJECTED") return "Annule";
  return "En attente";
};

const mapSupplierLabel = (sourceType) => {
  if (sourceType === "TRANSFER") return "Transfert";
  if (sourceType === "DIRECT") return "Appro direct";
  return "Fournisseur";
};

function ReportsSupplyTable() {
  const currentUser = useMemo(() => getCurrentUser(), []);
  const displayCurrencyCode = useCurrencyStore(
    (state) => state.settings.primaryCurrencyCode,
  );
  const refreshTick = useRealtimeRefetch([
    "stock:entry:created",
    "stock:entry:posted",
    "supply:request:created",
    "supply:request:submitted",
    "supply:request:approved",
    "supply:request:rejected",
    "purchase:order:created",
    "purchase:order:sent",
    "delivery:note:created",
    "delivery:note:received",
    "transfer:created",
    "transfer:completed",
  ]);
  const showToast = useToastStore((state) => state.showToast);
  const [entries, setEntries] = useState([]);
  const [requests, setRequests] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
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
        const [stockData, requestData, orderData] = await Promise.all([
          apiGet("/api/stock-entries"),
          apiGet("/api/supply-requests"),
          apiGet("/api/purchase-orders"),
        ]);
        if (!isMounted) return;
        setEntries(Array.isArray(stockData?.data) ? stockData.data : stockData);
        setRequests(
          Array.isArray(requestData?.data) ? requestData.data : requestData
        );
        setPurchaseOrders(
          Array.isArray(orderData?.data) ? orderData.data : orderData
        );
      } catch (error) {
        showToast({
          title: "Erreur",
          message: error.message || "Impossible de charger le rapport.",
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

  const purchaseOrderById = useMemo(() => {
    const map = new Map();
    purchaseOrders.forEach((order) => {
      if (order?.id) map.set(order.id, order);
    });
    return map;
  }, [purchaseOrders]);

  const supplyRows = useMemo(() => {
    const stockRows = (entries || []).flatMap((entry) => {
      const purchaseOrder = entry.sourceId
        ? purchaseOrderById.get(entry.sourceId)
        : null;
      const supplierName =
        purchaseOrder?.supplier?.name ||
        mapSupplierLabel(entry.sourceType) ||
        "N/A";
      const receivedBy = entry.store?.name || entry.storageZone?.name || "N/A";
      const requestedBy = entry.createdBy ? formatName(entry.createdBy) : "N/A";
      return (entry.items || []).map((item) => ({
        id: `${entry.id}-${item.id}`,
        supplyId: entry.sourceId
          ? `#PO-${shortId(entry.sourceId)}`
          : `#SE-${shortId(entry.id)}`,
        supplier: supplierName,
        date: formatDate(entry.createdAt),
        product: item.product?.name || "Produit",
        quantity: Number(item.quantity || 0),
        cost:
          item.unitCost !== null && item.unitCost !== undefined
            ? formatAmount(
                Number(item.unitCost || 0) * Number(item.quantity || 0),
                item.currencyCode,
              )
            : "-",
        receivedBy,
        requestedBy,
        status: mapSupplyStatus(entry.status),
      }));
    });

    const requestRows = (requests || []).flatMap((request) => {
      const receivedBy = request.store?.name || request.storageZone?.name || "N/A";
      const requestedBy = request.requestedBy
        ? formatName(request.requestedBy)
        : "N/A";
      return (request.items || []).map((item) => ({
        id: `${request.id}-${item.id}`,
        supplyId: `#REQ-${shortId(request.id)}`,
        supplier: "Requisition",
        date: formatDate(request.createdAt),
        product: item.product?.name || "Produit",
        quantity: Number(item.quantity || 0),
        cost: "-",
        receivedBy,
        requestedBy,
        status: mapSupplyStatus(request.status),
      }));
    });

    return [...stockRows, ...requestRows];
  }, [entries, requests, purchaseOrderById, displayCurrencyCode]);

  const filteredSupplies = useMemo(() => {
    let results = [...supplyRows];
    const normalizedUser = currentUser.name.toLowerCase();
    const normalizedStore = currentUser.store.toLowerCase();

    results = results.filter((row) => {
      const matchesStore =
        row.receivedBy?.toLowerCase?.() === normalizedStore;
      const matchesRequester =
        row.requestedBy?.toLowerCase?.() === normalizedUser;
      return matchesStore || matchesRequester;
    });

    const keyword = search.trim().toLowerCase();
    if (keyword) {
      results = results.filter((row) =>
        [row.supplyId, row.supplier, row.product, row.receivedBy, row.requestedBy]
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
          row.status.toLowerCase().includes("livre")
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
        const compare = a.supplier.localeCompare(b.supplier);
        return sort.name === "az" ? compare : -compare;
      });
    }

    return results;
  }, [
    supplyRows,
    search,
    filterValues,
    sortValues,
    currentUser.name,
    currentUser.store,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredSupplies.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedSupplies = filteredSupplies.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );
  const rangeStart = filteredSupplies.length
    ? (safePage - 1) * pageSize + 1
    : 0;
  const rangeEnd = Math.min(filteredSupplies.length, safePage * pageSize);
  const rangeLabel = `Affichage ${rangeStart}-${rangeEnd} sur ${filteredSupplies.length}`;

  const columns = useMemo(
    () => [
      { header: "Reference", accessor: "supplyId" },
      { header: "Fournisseur", accessor: "supplier" },
      { header: "Date", accessor: "date" },
      { header: "Produit", accessor: "product" },
      { header: "Quantite", accessor: "quantity" },
      { header: "Cout", accessor: "cost" },
      { header: "Reception", accessor: "receivedBy" },
      { header: "Demandeur", accessor: "requestedBy" },
      {
        header: "Statut",
        accessor: "status",
        render: (row) => (
          <Badge label={row.status} variant={resolveSupplyVariant(row.status)} />
        ),
      },
    ],
    []
  );

  return (
    <DataTable
      title="Rapport d'approvisionnement"
      description="Approvisionnement de la boutique et requisitions"
      columns={columns}
      data={pagedSupplies}
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

export default ReportsSupplyTable;
