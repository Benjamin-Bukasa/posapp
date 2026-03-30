import React, { useEffect, useMemo, useState } from "react";
import {
  Crown,
  EllipsisVertical,
  Eye,
  MessageCircle,
  Plus,
  Star,
  Users,
  UserX,
} from "lucide-react";
import DataTable from "../components/ui/datatable";
import DropdownAction from "../components/ui/dropdownAction";
import Badge from "../components/ui/badge";
import StatCard from "../components/ui/statCard";
import CustomerCreateModal from "../components/ui/customerCreateModal";
import useToastStore from "../stores/toastStore";
import { apiGet, apiPost } from "../services/apiClient";
import { formatDate } from "../utils/formatters";
import { getMonthRange, percentChange } from "../utils/metrics";
import useSyncedQuerySearch from "../hooks/useSyncedQuerySearch";

const resolveStatusVariant = (status) => {
  const normalized = status?.toLowerCase?.() ?? "";
  if (normalized.includes("actif")) return "success";
  if (normalized.includes("inactif")) return "danger";
  return "neutral";
};

const resolveSegmentVariant = (segment) => {
  const normalized = segment?.toLowerCase?.() ?? "";
  if (normalized.includes("vip")) return "success";
  if (normalized.includes("fid")) return "warning";
  if (normalized.includes("nouveau")) return "neutral";
  return "neutral";
};

const computeSegment = (points) => {
  if (points >= 700) return "VIP";
  if (points >= 300) return "Fidele";
  return "Nouveau";
};

const computeStatusAt = (lastPurchaseAt, referenceDate) => {
  if (!lastPurchaseAt) return "Inactif";
  const lastDate = new Date(lastPurchaseAt);
  if (Number.isNaN(lastDate.getTime())) return "Inactif";
  const diffDays = Math.floor(
    (referenceDate - lastDate) / (1000 * 60 * 60 * 24)
  );
  return diffDays <= 30 ? "Actif" : "Inactif";
};

const computeStatus = (lastPurchaseAt) =>
  computeStatusAt(lastPurchaseAt, new Date());

function Customers() {
  const showToast = useToastStore((state) => state.showToast);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useSyncedQuerySearch("q");
  const [filterValues, setFilterValues] = useState(null);
  const [sortValues, setSortValues] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await apiGet("/api/customers");
        if (!isMounted) return;
        const list = Array.isArray(data?.data) ? data.data : data;
        setCustomers(Array.isArray(list) ? list : []);
      } catch (error) {
        showToast({
          title: "Erreur",
          message: error.message || "Impossible de charger les clients.",
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
      customers.map((customer) => {
        const lastPurchaseAt = customer.lastPurchaseAt;
        const points = Number(customer.points || 0);
        return {
          id: customer.id,
          name: [customer.firstName, customer.lastName]
            .filter(Boolean)
            .join(" "),
          phone: customer.phone || "",
          email: customer.email || "",
          score: points,
          segment: computeSegment(points),
          lastPurchase: formatDate(lastPurchaseAt),
          status: computeStatus(lastPurchaseAt),
        };
      }),
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    let results = [...rows];

    const keyword = search.trim().toLowerCase();
    if (keyword) {
      results = results.filter((row) =>
        [row.name, row.phone, row.email]
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
        const rowDate = new Date(row.lastPurchase);
        if (fromDate && rowDate < fromDate) return false;
        if (toDate && rowDate > toDate) return false;
        return true;
      });
    }

    if (filterValues?.status && filterValues.status !== "all") {
      if (filterValues.status === "actif") {
        results = results.filter((row) =>
          row.status.toLowerCase().includes("actif")
        );
      }
      if (filterValues.status === "inactif") {
        results = results.filter((row) =>
          row.status.toLowerCase().includes("inactif")
        );
      }
    }

    const sort = sortValues ?? { date: "asc", activity: "az", name: "az" };
    if (sort?.date) {
      results.sort((a, b) => {
        const aDate = new Date(a.lastPurchase);
        const bDate = new Date(b.lastPurchase);
        return sort.date === "asc" ? aDate - bDate : bDate - aDate;
      });
    }
    if (sort?.name) {
      results.sort((a, b) => {
        const compare = a.name.localeCompare(b.name);
        return sort.name === "az" ? compare : -compare;
      });
    }

    return results;
  }, [rows, search, filterValues, sortValues]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedCustomers = filteredCustomers.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );
  const rangeStart = filteredCustomers.length
    ? (safePage - 1) * pageSize + 1
    : 0;
  const rangeEnd = Math.min(filteredCustomers.length, safePage * pageSize);
  const rangeLabel = `Affichage ${rangeStart}-${rangeEnd} sur ${filteredCustomers.length}`;

  const stats = useMemo(() => {
    const active = rows.filter((row) => row.status === "Actif").length;
    const inactive = rows.filter((row) => row.status === "Inactif").length;
    const vip = rows.filter((row) => row.segment === "VIP").length;
    const total = rows.length;

    const now = new Date();
    const previousReference = getMonthRange(now).start;

    const buildSnapshot = (referenceDate) => {
      const activeCustomers = customers.filter(
        (customer) =>
          computeStatusAt(customer.lastPurchaseAt, referenceDate) === "Actif"
      );
      const vipActive = activeCustomers.filter(
        (customer) => computeSegment(Number(customer.points || 0)) === "VIP"
      );
      const avgPoints =
        activeCustomers.reduce(
          (sum, customer) => sum + Number(customer.points || 0),
          0
        ) / (activeCustomers.length || 1);

      return {
        active: activeCustomers.length,
        inactive: customers.length - activeCustomers.length,
        vip: vipActive.length,
        avgPoints,
      };
    };

    

    const currentSnapshot = buildSnapshot(now);
    const previousSnapshot = buildSnapshot(previousReference);

    return {
      active,
      inactive,
      vip,
      total,
      change: {
        active: percentChange(currentSnapshot.active, previousSnapshot.active),
        vip: percentChange(currentSnapshot.vip, previousSnapshot.vip),
        satisfaction: percentChange(
          currentSnapshot.avgPoints,
          previousSnapshot.avgPoints
        ),
        inactive: percentChange(
          currentSnapshot.inactive,
          previousSnapshot.inactive
        ),
      },
    };
  }, [customers, rows]);

  const customerCards = useMemo(
    () => [
      {
        title: "Clients actifs",
        value: stats.active.toString(),
        subtitle: "Depuis le debut du mois",
        icon: Users,
        change: stats.change.active,
        highlight: true,
        amountLabel: "Nouveaux clients",
        amountValue: Math.max(0, stats.total - stats.active).toString(),
      },
      {
        title: "Clients fideles",
        value: stats.vip.toString(),
        subtitle: "Abonnes au programme",
        icon: Crown,
        change: stats.change.vip,
        amountLabel: "Taux de retention",
        amountValue: stats.total
          ? `${Math.round((stats.vip / stats.total) * 100)}%`
          : "0%",
      },
      {
        title: "Satisfaction",
        value: "4.8/5",
        subtitle: "Avis clients",
        icon: Star,
        change: stats.change.satisfaction,
        amountLabel: "Feedbacks",
        amountValue: "315",
      },
      {
        title: "Comptes inactifs",
        value: stats.inactive.toString(),
        subtitle: "A relancer",
        icon: UserX,
        change: stats.change.inactive,
        amountLabel: "Relances prevues",
        amountValue: Math.max(0, stats.inactive).toString(),
      },
    ],
    [stats]
  );

  const columns = useMemo(
    () => [
      { header: "Client", accessor: "name" },
      { header: "Telephone", accessor: "phone" },
      { header: "Email", accessor: "email" },
      { header: "Points", accessor: "score" },
      {
        header: "Segment",
        accessor: "segment",
        render: (row) => (
          <Badge label={row.segment} variant={resolveSegmentVariant(row.segment)} />
        ),
      },
      { header: "Dernier achat", accessor: "lastPurchase" },
      {
        header: "Statut",
        accessor: "status",
        render: (row) => (
          <Badge label={row.status} variant={resolveStatusVariant(row.status)} />
        ),
      },
    ],
    []
  );

  const actionItems = [
    { id: "view", label: "Voir", icon: Eye },
    { id: "message", label: "Envoyer un message", icon: MessageCircle },
  ];

  return (
    <section className="w-full h-full flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Clients</h1>
          <p className="text-sm text-text-secondary">
            Suivez vos clients et leur niveau de fidelite.
          </p>
        </div>
        <button 
          type="button"
          onClick={() => setIsCreateOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white hover:bg-secondary/90 sm:w-auto">
          <Plus size={16} />
          Nouveau client
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {customerCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <DataTable
        title="Liste des clients"
        description="Tous les clients enregistres"
        columns={columns}
        data={pagedCustomers}
        emptyMessage={loading ? "Chargement..." : "Aucune donnee"}
        enableSelection={false}
        actionsHeader="Action"
        renderActions={() => (
          <DropdownAction
            label={<EllipsisVertical size={18} strokeWidth={1.5} />}
            items={actionItems}
            buttonClassName="p-1 bg-transparent text-text-primary rounded-lg hover:bg-[#b0bbb7]"
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

      <CustomerCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        nextSequence={customers.length + 1}
        onSubmit={async (payload) => {
          const created = await apiPost("/api/customers", payload);
          setCustomers((prev) => [created, ...prev]);
          setIsCreateOpen(false);
          showToast({
            title: "Client cree",
            message: "Le client a ete enregistre avec succes.",
            variant: "success",
          });
          return created;
        }}
      />
    </section>
  );
}

export default Customers;
