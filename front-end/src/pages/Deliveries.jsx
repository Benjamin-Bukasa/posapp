import React, { useEffect, useMemo, useState } from "react";
import DataTable from "../components/ui/datatable";
import Badge from "../components/ui/badge";
import useToastStore from "../stores/toastStore";
import useAuthStore from "../stores/authStore";
import { apiGet } from "../services/apiClient";
import { formatDate, formatName, shortId } from "../utils/formatters";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import useSyncedQuerySearch from "../hooks/useSyncedQuerySearch";

const resolveStatusVariant = (status) => {
  const normalized = status?.toLowerCase?.() ?? "";
  if (normalized.includes("received")) return "success";
  if (normalized.includes("canceled") || normalized.includes("reject"))
    return "danger";
  if (normalized.includes("partial") || normalized.includes("pending"))
    return "warning";
  return "neutral";
};

const mapStatusLabel = (status) => {
  if (status === "RECEIVED") return "Recue";
  if (status === "PARTIAL") return "Partielle";
  if (status === "CANCELED") return "Annulee";
  return "En attente";
};

function Deliveries() {
  const refreshTick = useRealtimeRefetch([
    "delivery:note:created",
    "delivery:note:received",
  ]);
  const showToast = useToastStore((state) => state.showToast);
  const user = useAuthStore((state) => state.user);
  const storeId = user?.storeId || null;
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useSyncedQuerySearch("q");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(6);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await apiGet("/api/delivery-notes");
        if (!isMounted) return;
        const list = Array.isArray(data?.data) ? data.data : data;
        setNotes(Array.isArray(list) ? list : []);
      } catch (error) {
        showToast({
          title: "Erreur",
          message: error.message || "Impossible de charger les livraisons.",
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

  const visibleNotes = useMemo(() => {
    if (!storeId) return notes;
    return (notes || []).filter(
      (note) => note.purchaseOrder?.storeId === storeId
    );
  }, [notes, storeId]);

  const rows = useMemo(
    () =>
      (visibleNotes || []).map((note) => ({
        id: note.id,
        reference: note.code || `#LIV-${shortId(note.id)}`,
        supplier: note.supplier?.name || "N/A",
        order:
          note.purchaseOrder?.code ||
          (note.purchaseOrderId ? `#PO-${shortId(note.purchaseOrderId)}` : "N/A"),
        receivedBy: note.receivedBy ? formatName(note.receivedBy) : "N/A",
        items: String(note.items?.length || 0),
        status: mapStatusLabel(note.status),
        rawStatus: note.status,
        date: formatDate(note.receivedAt || note.createdAt),
      })),
    [visibleNotes]
  );

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) =>
      [row.reference, row.supplier, row.order, row.receivedBy, row.status]
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
      { header: "Fournisseur", accessor: "supplier" },
      { header: "Commande", accessor: "order" },
      { header: "Reception", accessor: "receivedBy" },
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
        <h1 className="text-2xl font-semibold text-text-primary">Livraisons</h1>
        <p className="text-sm text-text-secondary">
          Suivi des bons de livraison fournisseurs.
        </p>
      </div>

      <DataTable
        title="Liste des livraisons"
        description="Livraisons en attente ou recues"
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

export default Deliveries;
