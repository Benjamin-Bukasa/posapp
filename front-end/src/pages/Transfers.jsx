import React, { useEffect, useMemo, useState } from "react";
import DataTable from "../components/ui/datatable";
import Badge from "../components/ui/badge";
import Button from "../components/ui/button";
import useToastStore from "../stores/toastStore";
import useAuthStore from "../stores/authStore";
import { apiGet, buildQuery } from "../services/apiClient";
import { formatDate, formatName, shortId } from "../utils/formatters";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";

const resolveStatusVariant = (status) => {
  const normalized = status?.toLowerCase?.() ?? "";
  if (normalized.includes("complete")) return "success";
  if (normalized.includes("cancel") || normalized.includes("reject")) return "danger";
  if (normalized.includes("partial") || normalized.includes("pending")) return "warning";
  return "neutral";
};

const mapStatusLabel = (status) => {
  if (status === "COMPLETED") return "Termine";
  if (status === "CANCELED") return "Annule";
  if (status === "PARTIAL") return "Partiel";
  if (status === "DRAFT") return "Brouillon";
  return "En cours";
};

function Transfers() {
  const refreshTick = useRealtimeRefetch([
    "transfer:created",
    "transfer:completed",
  ]);
  const showToast = useToastStore((state) => state.showToast);
  const user = useAuthStore((state) => state.user);
  const storeId = user?.storeId || null;
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(6);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        let list = [];
        if (storeId) {
          const fromQuery = buildQuery({ fromStoreId: storeId });
          const toQuery = buildQuery({ toStoreId: storeId });
          const [fromData, toData] = await Promise.all([
            apiGet(`/api/transfers?${fromQuery}`),
            apiGet(`/api/transfers?${toQuery}`),
          ]);
          const fromList = Array.isArray(fromData?.data) ? fromData.data : fromData;
          const toList = Array.isArray(toData?.data) ? toData.data : toData;
          const merged = new Map();
          [...(fromList || []), ...(toList || [])].forEach((item) => {
            if (!item?.id) return;
            merged.set(item.id, item);
          });
          list = Array.from(merged.values());
        } else {
          const data = await apiGet("/api/transfers");
          list = Array.isArray(data?.data) ? data.data : data;
        }
        if (!isMounted) return;
        setTransfers(Array.isArray(list) ? list : []);
      } catch (error) {
        showToast({
          title: "Erreur",
          message: error.message || "Impossible de charger les transferts.",
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
      (transfers || []).map((transfer) => ({
        id: transfer.id,
        reference: `#TRF-${shortId(transfer.id)}`,
        fromStore: transfer.fromStore?.name || "N/A",
        toStore: transfer.toStore?.name || "N/A",
        fromZone: transfer.fromZone?.name || "N/A",
        toZone: transfer.toZone?.name || "N/A",
        requestedBy: transfer.requestedBy
          ? formatName(transfer.requestedBy)
          : "N/A",
        items: String(transfer.items?.length || 0),
        status: mapStatusLabel(transfer.status),
        rawStatus: transfer.status,
        date: formatDate(transfer.createdAt),
      })),
    [transfers]
  );

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) =>
      [
        row.reference,
        row.fromStore,
        row.toStore,
        row.fromZone,
        row.toZone,
        row.requestedBy,
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
      { header: "Source", accessor: "fromStore" },
      { header: "Destination", accessor: "toStore" },
      { header: "Zone source", accessor: "fromZone" },
      { header: "Zone cible", accessor: "toZone" },
      { header: "Demandeur", accessor: "requestedBy" },
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Transferts</h1>
          <p className="text-sm text-text-secondary">
            Suivi des transferts entre boutiques et zones.
          </p>
        </div>
        <Button
          type="button"
          label="Nouveau transfert"
          variant="primary"
          size="small"
          className="w-full whitespace-nowrap sm:w-auto"
        />
      </div>

      <DataTable
        title="Liste des transferts"
        description="Transferts internes de stock"
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

export default Transfers;
