import React, { useEffect, useMemo, useState } from "react";
import DataTable from "../components/ui/datatable";
import Badge from "../components/ui/badge";
import Button from "../components/ui/button";
import useToastStore from "../stores/toastStore";
import useAuthStore from "../stores/authStore";
import { apiGet, buildQuery } from "../services/apiClient";
import { formatDate } from "../utils/formatters";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";

const resolveStockStatus = (quantity, minLevel) => {
  const qty = Number(quantity || 0);
  const min = Number(minLevel || 0);
  if (qty <= 0) return { label: "Rupture", variant: "danger" };
  if (min > 0 && qty <= min) return { label: "Faible", variant: "warning" };
  return { label: "OK", variant: "success" };
};

function Inventory() {
  const refreshTick = useRealtimeRefetch([
    "stock:entry:created",
    "stock:entry:approved",
    "stock:entry:posted",
  ]);
  const showToast = useToastStore((state) => state.showToast);
  const user = useAuthStore((state) => state.user);
  const storeId = user?.storeId || null;
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(6);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const query = buildQuery(storeId ? { storeId } : {});
        const suffix = query ? `?${query}` : "";
        const data = await apiGet(`/api/inventory${suffix}`);
        if (!isMounted) return;
        const list = Array.isArray(data?.data) ? data.data : data;
        setInventory(Array.isArray(list) ? list : []);
      } catch (error) {
        showToast({
          title: "Erreur",
          message: error.message || "Impossible de charger l'inventaire.",
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
      (inventory || []).map((item) => {
        const stockStatus = resolveStockStatus(item.quantity, item.minLevel);
        return {
          id: item.id,
          product: item.product?.name || "N/A",
          store: item.store?.name || "N/A",
          zone: item.storageZone?.name || "N/A",
          quantity: Number(item.quantity || 0),
          minLevel: Number(item.minLevel || 0),
          status: stockStatus.label,
          statusVariant: stockStatus.variant,
          updatedAt: formatDate(item.updatedAt),
        };
      }),
    [inventory]
  );

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) =>
      [row.product, row.store, row.zone, row.status]
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
      { header: "Produit", accessor: "product" },
      { header: "Boutique", accessor: "store" },
      { header: "Zone", accessor: "zone" },
      { header: "Quantite", accessor: "quantity" },
      { header: "Seuil", accessor: "minLevel" },
      {
        header: "Statut",
        accessor: "status",
        render: (row) => (
          <Badge label={row.status} variant={row.statusVariant} />
        ),
      },
      { header: "Maj", accessor: "updatedAt" },
    ],
    []
  );

  return (
    <section className="w-full h-full flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Inventaire</h1>
          <p className="text-sm text-text-secondary">
            Stock de la boutique connectee.
          </p>
        </div>
        <Button
          type="button"
          label="Nouvel inventaire"
          variant="primary"
          size="small"
          className="w-full whitespace-nowrap sm:w-auto"
        />
      </div>

      <DataTable
        title="Inventaire"
        description="Etat des stocks par zone"
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

export default Inventory;
