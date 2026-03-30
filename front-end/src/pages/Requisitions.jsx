import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/ui/datatable";
import Badge from "../components/ui/badge";
import Button from "../components/ui/button";
import useToastStore from "../stores/toastStore";
import useAuthStore from "../stores/authStore";
import { apiGet, buildQuery } from "../services/apiClient";
import { formatDate, formatName, shortId } from "../utils/formatters";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import useSyncedQuerySearch from "../hooks/useSyncedQuerySearch";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const resolveStatusVariant = (status) => {
  const normalized = status?.toLowerCase?.() ?? "";
  if (normalized.includes("approved") || normalized.includes("fulfilled"))
    return "success";
  if (normalized.includes("rejected") || normalized.includes("canceled"))
    return "danger";
  if (normalized.includes("submitted") || normalized.includes("partial"))
    return "warning";
  return "neutral";
};

const mapStatusLabel = (status) => {
  if (status === "APPROVED") return "Approuve";
  if (status === "SUBMITTED") return "Soumise";
  if (status === "REJECTED") return "Rejetee";
  if (status === "FULFILLED") return "Livree";
  if (status === "CANCELED") return "Annulee";
  if (status === "PARTIAL") return "Partielle";
  return "Brouillon";
};

function Requisitions() {
  const refreshTick = useRealtimeRefetch([
    "supply:request:created",
    "supply:request:submitted",
    "supply:request:approved",
    "supply:request:rejected",
  ]);
  const showToast = useToastStore((state) => state.showToast);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const storeId = user?.storeId || null;
  const [requests, setRequests] = useState([]);
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
        const data = await apiGet(`/api/supply-requests${suffix}`);
        if (!isMounted) return;
        const list = Array.isArray(data?.data) ? data.data : data;
        setRequests(Array.isArray(list) ? list : []);
      } catch (error) {
        showToast({
          title: "Erreur",
          message: error.message || "Impossible de charger les requisitions.",
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
      (requests || []).map((request) => {
        const rawTitle = String(request.title || "").trim();
        const reference = /^REQ\s*\d+/i.test(rawTitle)
          ? rawTitle
          : `REQ-${shortId(request.id)}`;
        return {
          id: request.id,
          reference,
          title: rawTitle || reference,
          store: request.store?.name || request.storageZone?.name || "N/A",
          requestedBy: request.requestedBy
            ? formatName(request.requestedBy)
            : "N/A",
          status: mapStatusLabel(request.status),
          rawStatus: request.status,
          date: formatDate(request.createdAt),
          pdfAvailable: Boolean(request.pdfAvailable),
          pdfFileName: request.pdfFileName,
        };
      }),
    [requests]
  );

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) =>
      [row.reference, row.title, row.store, row.requestedBy, row.status]
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

  const handleDownload = async (row) => {
    if (!row.pdfAvailable) {
      showToast({
        title: "PDF indisponible",
        message: "Le PDF n'est pas encore genere.",
        variant: "warning",
      });
      return;
    }
    try {
      const token = window.localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/supply-requests/${row.id}/pdf`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!response.ok) {
        throw new Error("Telechargement impossible.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = row.pdfFileName || `requisition-${row.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showToast({
        title: "Erreur",
        message: error.message || "Impossible de telecharger le PDF.",
        variant: "danger",
      });
    }
  };

  const columns = useMemo(
    () => [
      { header: "Reference", accessor: "reference" },
      { header: "Titre", accessor: "title" },
      { header: "Boutique", accessor: "store" },
      { header: "Demandeur", accessor: "requestedBy" },
      { header: "Date", accessor: "date" },
      {
        header: "Statut",
        accessor: "status",
        render: (row) => (
          <Badge label={row.status} variant={resolveStatusVariant(row.rawStatus)} />
        ),
      },
      {
        header: "PDF",
        accessor: "pdf",
        render: (row) => (
          <Button
            label={row.pdfAvailable ? "Telecharger" : "Indisponible"}
            variant="default"
            size="small"
            disabled={!row.pdfAvailable}
            onClick={() => handleDownload(row)}
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
          <h1 className="text-2xl font-semibold text-text-primary">Requisitions</h1>
          <p className="text-sm text-text-secondary">
            Suivez les demandes de stock et leurs documents.
          </p>
        </div>
        <Button
          type="button"
          label="Nouvelle requisition"
          variant="primary"
          size="small"
          className="w-full whitespace-nowrap sm:w-auto"
          onClick={() => navigate("/operations/requisitions/nouvelle")}
        />
      </div>

      <DataTable
        title="Liste des requisitions"
        description="Toutes les requisitions de stock"
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

export default Requisitions;
