import React, { useEffect, useMemo, useState } from "react";
import DataTable from "../components/ui/datatable";
import Badge from "../components/ui/badge";
import useToastStore from "../stores/toastStore";
import useAuthStore from "../stores/authStore";
import { apiGet, buildQuery } from "../services/apiClient";
import { formatDate, formatName, shortId } from "../utils/formatters";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import useSyncedQuerySearch from "../hooks/useSyncedQuerySearch";

const resolveStatusVariant = (status) => {
  const normalized = status?.toLowerCase?.() ?? "";
  if (normalized.includes("posted") || normalized.includes("approved"))
    return "success";
  if (normalized.includes("rejected") || normalized.includes("canceled"))
    return "danger";
  if (normalized.includes("pending")) return "warning";
  return "neutral";
};

const mapStatusLabel = (status) => {
  if (status === "POSTED") return "Postee";
  if (status === "APPROVED") return "Approuvee";
  if (status === "REJECTED") return "Rejetee";
  return "En attente";
};

const mapSourceLabel = (sourceType) => {
  if (sourceType === "PURCHASE_ORDER") return "Commande";
  if (sourceType === "TRANSFER") return "Transfert";
  if (sourceType === "DIRECT") return "Direct";
  return "Autre";
};

function Receptions() {
  const refreshTick = useRealtimeRefetch([
    "stock:entry:created",
    "stock:entry:approved",
    "stock:entry:posted",
  ]);
  const showToast = useToastStore((state) => state.showToast);
  const user = useAuthStore((state) => state.user);
  const storeId = user?.storeId || null;
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useSyncedQuerySearch("q");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(6);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const query = buildQuery(storeId ? { storeId } : {});
        const suffix = query ? `?${query}` : "";
        const data = await apiGet(`/api/stock-entries${suffix}`);
        if (!isMounted) return;
        const list = Array.isArray(data?.data) ? data.data : data;
        setEntries(Array.isArray(list) ? list : []);
      } catch (error) {
        showToast({
          title: "Erreur",
          message: error.message || "Impossible de charger les receptions.",
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
  }, [refreshTick, showToast, storeId]);

  const rows = useMemo(
    () =>
      (entries || []).map((entry) => ({
        id: entry.id,
        reference: `#REC-${shortId(entry.id)}`,
        source: mapSourceLabel(entry.sourceType),
        store: entry.store?.name || "N/A",
        zone: entry.storageZone?.name || "N/A",
        createdBy: entry.createdBy ? formatName(entry.createdBy) : "N/A",
        approvedBy: entry.approvedBy ? formatName(entry.approvedBy) : "N/A",
        items: String(entry.items?.length || 0),
        status: mapStatusLabel(entry.status),
        rawStatus: entry.status,
        date: formatDate(entry.postedAt || entry.approvedAt || entry.createdAt),
      })),
    [entries]
  );

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) =>
      [
        row.reference,
        row.source,
        row.store,
        row.zone,
        row.createdBy,
        row.approvedBy,
        row.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );
  const rangeStart = filteredRows.length
    ? (safePage - 1) * pageSize + 1
    : 0;
  const rangeEnd = Math.min(filteredRows.length, safePage * pageSize);
  const rangeLabel = `Affichage ${rangeStart}-${rangeEnd} sur ${filteredRows.length}`;

  const columns = useMemo(
    () => [
      { header: "Reference", accessor: "reference" },
      { header: "Source", accessor: "source" },
      { header: "Boutique", accessor: "store" },
      { header: "Zone", accessor: "zone" },
      { header: "Cree par", accessor: "createdBy" },
      { header: "Approuve par", accessor: "approvedBy" },
      { header: "Articles", accessor: "items" },
      { header: "Date", accessor: "date" },
      {
        header: "Statut",
        accessor: "status",
        render: (row) => (
          <Badge
            label={row.status}
            variant={resolveStatusVariant(row.rawStatus)}
          />
        ),
      },
    ],
    []
  );

  return (
    <section className="w-full h-full flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Receptions</h1>
        <p className="text-sm text-text-secondary">
          Suivi des entrees de stock et receptions.
        </p>
      </div>

      <DataTable
        title="Liste des receptions"
        description="Entrees de stock valides pour la boutique"
        columns={columns}
        data={pagedRows}
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
      />
    </section>
  );
}

export default Receptions;
