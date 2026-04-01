import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CreditCard,
  EllipsisVertical,
  History,
  Pencil,
  Receipt,
  TrendingUp,
  Trash2,
  Users,
} from "lucide-react";
import DataTable from "../components/ui/datatable";
import DropdownAction from "../components/ui/dropdownAction";
import Badge from "../components/ui/badge";
import StatCard from "../components/ui/statCard";
import Modal from "../components/ui/modal";
import SaleEditModal from "../components/ui/saleEditModal";
import SaleHistoryModal from "../components/ui/saleHistoryModal";
import useToastStore from "../stores/toastStore";
import useCurrencyStore from "../stores/currencyStore";
import { apiDelete, apiGet, apiPatch } from "../services/apiClient";
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

const mapPaymentMethod = (method) => {
  if (!method) return "N/A";
  if (method === "CASH") return "Cash";
  if (method === "CARD") return "Carte";
  if (method === "MOBILE_MONEY") return "Mobile Money";
  if (method === "TRANSFER") return "Transfert";
  return method;
};

const mapSaleStatus = (status) => {
  if (status === "PAID") return "Paye";
  if (status === "CANCELED") return "Annule";
  if (status === "PARTIAL") return "En attente";
  return "En attente";
};

const resolveSaleVariant = (status) => {
  const normalized = status?.toLowerCase?.() ?? "";
  if (normalized.includes("paye")) return "success";
  if (normalized.includes("attente")) return "warning";
  if (normalized.includes("annule")) return "danger";
  return "neutral";
};

function Sales() {
  const refreshTick = useRealtimeRefetch([
    "sale:created",
    "sale:updated",
    "payment:created",
  ]);
  const displayCurrencyCode = useCurrencyStore(
    (state) => state.settings.primaryCurrencyCode,
  );
  const currencySettings = useCurrencyStore((state) => state.settings);
  const showToast = useToastStore((state) => state.showToast);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useSyncedQuerySearch("q");
  const [filterValues, setFilterValues] = useState(null);
  const [sortValues, setSortValues] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [selectedSale, setSelectedSale] = useState(null);
  const [historySale, setHistorySale] = useState(null);
  const [deleteSale, setDeleteSale] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [submittingDelete, setSubmittingDelete] = useState(false);

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

  const salesRows = useMemo(
    () =>
      orders.map((order) => {
        const items = order.items?.length
          ? order.items
              .map(
                (item) =>
                  `${item.product?.name || "Produit"} (${item.quantity || 0})`
              )
              .join(", ")
          : "";

        const firstPayment = order.payments?.[0];
        const paymentMethod = mapPaymentMethod(firstPayment?.method);

        return {
          id: order.id,
          raw: order,
          saleId: `#SALE-${shortId(order.id)}`,
          cashier: order.createdBy
            ? formatName(order.createdBy)
            : "N/A",
          customer: order.customer
            ? formatName(order.customer)
            : "Client comptoir",
          date: formatDate(order.createdAt),
          items,
          total: formatAmount(order.total, order.currencyCode),
          paymentMethod,
          status: mapSaleStatus(order.status),
        };
      }),
    [orders, displayCurrencyCode]
  );

  const filteredSales = useMemo(() => {
    let results = [...salesRows];

    const keyword = search.trim().toLowerCase();
    if (keyword) {
      results = results.filter((row) =>
        [row.saleId, row.customer, row.cashier, row.items]
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
  }, [salesRows, search, filterValues, sortValues]);

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

  const stats = useMemo(() => {
    const now = new Date();
    const currentRange = getMonthRange(now);
    const previousRange = getPreviousMonthRange(now);

    const paidOrders = orders.filter((order) => order.status === "PAID");
    const paidOrdersCurrent = paidOrders.filter((order) =>
      isWithinRange(order.createdAt, currentRange.start, currentRange.end)
    );
    const paidOrdersPrevious = paidOrders.filter((order) =>
      isWithinRange(order.createdAt, previousRange.start, previousRange.end)
    );

    const revenueTotal = paidOrders.reduce(
      (sum, order) => sum + toDisplayAmount(order.total, order.currencyCode),
      0
    );
    const revenueMonth = paidOrdersCurrent.reduce(
      (sum, order) => sum + toDisplayAmount(order.total, order.currencyCode),
      0
    );
    const revenuePrevious = paidOrdersPrevious.reduce(
      (sum, order) => sum + toDisplayAmount(order.total, order.currencyCode),
      0
    );

    const uniqueCustomers = new Set(
      paidOrders.map((order) => order.customerId).filter(Boolean)
    );
    const currentCustomers = new Set(
      paidOrdersCurrent.map((order) => order.customerId).filter(Boolean)
    );
    const previousCustomers = new Set(
      paidOrdersPrevious.map((order) => order.customerId).filter(Boolean)
    );

    const allPayments = orders.flatMap((order) =>
      (order.payments || []).map((payment) => ({
        ...payment,
        orderCreatedAt: order.createdAt,
      }))
    );

    const paymentsCurrent = allPayments.filter((payment) =>
      isWithinRange(
        payment.paidAt || payment.createdAt || payment.orderCreatedAt,
        currentRange.start,
        currentRange.end
      )
    );
    const paymentsPrevious = allPayments.filter((payment) =>
      isWithinRange(
        payment.paidAt || payment.createdAt || payment.orderCreatedAt,
        previousRange.start,
        previousRange.end
      )
    );

    const paymentsValidated = allPayments.filter(
      (payment) => payment.status === "COMPLETED"
    ).length;
    const paymentsValidatedCurrent = paymentsCurrent.filter(
      (payment) => payment.status === "COMPLETED"
    ).length;
    const paymentsValidatedPrevious = paymentsPrevious.filter(
      (payment) => payment.status === "COMPLETED"
    ).length;

    return {
      totalSales: paidOrders.length,
      revenueTotal,
      revenueMonth,
      customers: uniqueCustomers.size,
      paymentsValidated,
      change: {
        totalSales: percentChange(
          paidOrdersCurrent.length,
          paidOrdersPrevious.length
        ),
        revenueMonth: percentChange(revenueMonth, revenuePrevious),
        customers: percentChange(currentCustomers.size, previousCustomers.size),
        paymentsValidated: percentChange(
          paymentsValidatedCurrent,
          paymentsValidatedPrevious
        ),
      },
    };
  }, [orders, displayCurrencyCode]);

  const salesCards = useMemo(
    () => [
      {
        title: "Ventes totales",
        value: stats.totalSales.toString(),
        subtitle: "Depuis la semaine",
        icon: Receipt,
        change: stats.change.totalSales,
        highlight: true,
        amountLabel: "Revenus generes",
        amountValue: formatDisplayAmount(stats.revenueTotal),
      },
      {
        title: "Revenus du mois",
        value: formatDisplayAmount(stats.revenueMonth),
        subtitle: "Ce mois-ci",
        icon: TrendingUp,
        change: stats.change.revenueMonth,
        amountLabel: "Objectif atteint",
        amountValue: "72%",
      },
      {
        title: "Clients servis",
        value: stats.customers.toString(),
        subtitle: "Depuis le debut du mois",
        icon: Users,
        change: stats.change.customers,
        amountLabel: "Satisfaction",
        amountValue: "4.7/5",
      },
      {
        title: "Paiements valides",
        value: stats.paymentsValidated.toString(),
        subtitle: "Transactions reussies",
        icon: BadgeCheck,
        change: stats.change.paymentsValidated,
        amountLabel: "Taux de reussite",
        amountValue: "92%",
      },
    ],
    [stats, displayCurrencyCode]
  );

  const columns = useMemo(
    () => [
      { header: "Vente ID", accessor: "saleId" },
      { header: "Caissier", accessor: "cashier" },
      { header: "Client", accessor: "customer" },
      { header: "Date", accessor: "date" },
      { header: "Produits", accessor: "items" },
      { header: "Montant", accessor: "total" },
      {
        header: "Paiement",
        accessor: "paymentMethod",
        render: (row) => (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <CreditCard size={14} />
            <span className="text-text-primary">{row.paymentMethod}</span>
          </div>
        ),
      },
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

  const handleEditSale = async (payload) => {
    if (!selectedSale?.raw?.id) return;
    setSubmittingEdit(true);
    try {
      await apiPatch(`/api/orders/${selectedSale.raw.id}`, payload);
      const data = await apiGet("/api/orders");
      const list = Array.isArray(data?.data) ? data.data : data;
      setOrders(Array.isArray(list) ? list : []);
      setSelectedSale(null);
      showToast({
        title: "Vente modifiee",
        message: "La vente a ete mise a jour et historisee.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        title: "Modification impossible",
        message: error.message || "Impossible de modifier cette vente.",
        variant: "danger",
      });
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteSale = async () => {
    if (!deleteSale?.raw?.id) return;
    setSubmittingDelete(true);
    try {
      await apiDelete(`/api/orders/${deleteSale.raw.id}`, {
        reason: deleteReason,
      });

      const data = await apiGet("/api/orders");
      const list = Array.isArray(data?.data) ? data.data : data;
      setOrders(Array.isArray(list) ? list : []);
      setDeleteSale(null);
      setDeleteReason("");
      showToast({
        title: "Vente supprimee",
        message: "La vente a ete annulee et historisee.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        title: "Suppression impossible",
        message: error.message || "Impossible de supprimer cette vente.",
        variant: "danger",
      });
    } finally {
      setSubmittingDelete(false);
    }
  };

  return (
    <section className="w-full h-full flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Ventes</h1>
        <p className="text-sm text-text-secondary">
          Suivez les ventes realisees en boutique.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {salesCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <DataTable
        title="Historique des ventes"
        description="Toutes les transactions en caisse"
        columns={columns}
        data={pagedSales}
        emptyMessage={loading ? "Chargement..." : "Aucune donnee"}
        enableSelection={false}
        actionsHeader="Action"
        renderActions={(row) => (
          <DropdownAction
            label={<EllipsisVertical size={18} strokeWidth={1.5} />}
            items={[
              {
                id: "edit",
                label: "Modifier",
                icon: Pencil,
                disabled: row.raw?.status === "CANCELED",
                onClick: () => setSelectedSale(row),
              },
              {
                id: "delete",
                label: "Supprimer",
                icon: Trash2,
                variant: "danger",
                disabled: row.raw?.status === "CANCELED",
                onClick: () => {
                  setDeleteSale(row);
                  setDeleteReason("");
                },
              },
              {
                id: "history",
                label: "Historique",
                icon: History,
                onClick: () => setHistorySale(row),
              },
            ]}
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
        tableMaxHeightClass="max-h-[45vh]"
      />

      <SaleEditModal
        isOpen={Boolean(selectedSale)}
        onClose={() => setSelectedSale(null)}
        sale={selectedSale?.raw || null}
        currencySettings={currencySettings}
        onSubmit={handleEditSale}
        submitting={submittingEdit}
      />

      <SaleHistoryModal
        isOpen={Boolean(historySale)}
        onClose={() => setHistorySale(null)}
        saleId={historySale?.raw?.id || null}
      />

      <Modal
        isOpen={Boolean(deleteSale)}
        title="Supprimer la vente"
        description="La vente sera annulee, le stock sera restitue et l'action sera historisee."
        confirmLabel={submittingDelete ? "Suppression..." : "Supprimer"}
        cancelLabel="Annuler"
        onCancel={() => {
          if (submittingDelete) return;
          setDeleteSale(null);
          setDeleteReason("");
        }}
        onConfirm={handleDeleteSale}
        confirmButtonClassName="bg-red-600 hover:bg-red-700"
      >
        <label className="flex flex-col gap-2 text-sm text-text-primary">
          <span>Motif</span>
          <textarea
            value={deleteReason}
            onChange={(event) => setDeleteReason(event.target.value)}
            rows={3}
            className="rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
            placeholder="Expliquez la suppression pour l'historique"
          />
        </label>
      </Modal>
    </section>
  );
}

export default Sales;
