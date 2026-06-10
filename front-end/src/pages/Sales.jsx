import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CreditCard,
  Eye,
  EllipsisVertical,
  History,
  Pencil,
  Receipt,
  Store,
  Trash2,
  Users,
} from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import DataTable from "../components/ui/datatable";
import DropdownAction from "../components/ui/dropdownAction";
import Badge from "../components/ui/badge";
import StatCard from "../components/ui/statCard";
import Modal from "../components/ui/modal";
import SaleEditModal from "../components/ui/saleEditModal";
import SaleHistoryModal from "../components/ui/saleHistoryModal";
import useToastStore from "../stores/toastStore";
import useCurrencyStore from "../stores/currencyStore";
import useAuthStore from "../stores/authStore";
import { apiDelete, apiGet, apiPatch } from "../services/apiClient";
import {
  formatAmount,
  formatDisplayAmount,
  formatName,
  shortId,
  toDisplayAmount,
} from "../utils/formatters";
import { percentChange } from "../utils/metrics";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import useSyncedQuerySearch from "../hooks/useSyncedQuerySearch";
import { hasAnyPermission } from "../utils/permissions";

const startOfDay = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value = new Date()) => {
  const date = startOfDay(value);
  date.setDate(date.getDate() + 1);
  return date;
};

const sumOrderItems = (order) =>
  (order?.items || []).reduce(
    (sum, item) => sum + Number(item?.quantity || 0),
    0,
  );

const isWithinPeriod = (value, start, end) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date < end;
};

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
  const navigate = useNavigate();
  const location = useLocation();
  const refreshTick = useRealtimeRefetch([
    "sale:created",
    "sale:updated",
    "payment:created",
    "cash:session:opened",
    "cash:session:closed",
    "cash:session:movement",
  ]);
  const currencySettings = useCurrencyStore((state) => state.settings);
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.showToast);
  const [orders, setOrders] = useState([]);
  const [cashSessions, setCashSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useSyncedQuerySearch("q");
  const [filterValues, setFilterValues] = useState(null);
  const [sortValues, setSortValues] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [selectedSale, setSelectedSale] = useState(null);
  const [detailSale, setDetailSale] = useState(null);
  const [historySale, setHistorySale] = useState(null);
  const [deleteSale, setDeleteSale] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const isDetailOpen = location.pathname.endsWith("/details");
  const canEditSales = hasAnyPermission(user, ["sales.update"]);
  const canCancelSales = hasAnyPermission(user, ["sales.cancel"]);
  const canReadSales = hasAnyPermission(user, ["sales.read"]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [ordersData, cashSessionsData] = await Promise.all([
          apiGet("/api/orders"),
          apiGet("/api/cash-sessions?paginate=false&status=OPEN"),
        ]);

        if (!isMounted) return;

        const ordersList = Array.isArray(ordersData?.data) ? ordersData.data : ordersData;
        const sessionList = Array.isArray(cashSessionsData?.data)
          ? cashSessionsData.data
          : cashSessionsData;

        setOrders(Array.isArray(ordersList) ? ordersList : []);
        setCashSessions(Array.isArray(sessionList) ? sessionList : []);
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
                  `${item.product?.name || "Produit"} (${item.quantity || 0})`,
              )
              .join(", ")
          : "";

        const firstPayment = order.payments?.[0];
        const paymentMethod = mapPaymentMethod(firstPayment?.method);

        return {
          id: order.id,
          raw: order,
          saleId: `#SALE-${shortId(order.id)}`,
          cashier: order.createdBy ? formatName(order.createdBy) : "N/A",
          customer: order.customer ? formatName(order.customer) : "Client comptoir",
          dateValue: order.createdAt,
          dateLabel: new Date(order.createdAt).toLocaleString("fr-FR"),
          items,
          itemsList:
            order.items?.map((item) => ({
              id: item.id,
              name: item.product?.name || "Produit",
              quantity: Number(item.quantity || 0),
              unitPrice: Number(item.unitPrice || 0),
              total: Number(item.total || 0),
              isGift: Boolean(item.isGift),
            })) || [],
          total: formatAmount(order.total, order.currencyCode),
          paymentMethod,
          status: mapSaleStatus(order.status),
        };
      }),
    [orders],
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
          .includes(keyword),
      );
    }

    if (filterValues?.from || filterValues?.to) {
      const fromDate = filterValues.from ? new Date(filterValues.from) : null;
      const toDate = filterValues.to ? endOfDay(filterValues.to) : null;
      results = results.filter((row) => {
        const rowDate = new Date(row.dateValue);
        if (fromDate && rowDate < fromDate) return false;
        if (toDate && rowDate >= toDate) return false;
        return true;
      });
    }

    if (filterValues?.status && filterValues.status !== "all") {
      if (filterValues.status === "annule") {
        results = results.filter((row) => row.status.toLowerCase().includes("annule"));
      }
      if (filterValues.status === "actif") {
        results = results.filter((row) => row.status.toLowerCase().includes("paye"));
      }
      if (filterValues.status === "inactif") {
        results = results.filter((row) => row.status.toLowerCase().includes("attente"));
      }
    }

    const sort = sortValues ?? { date: "desc", name: "az" };
    if (sort?.date) {
      results.sort((a, b) => {
        const aDate = new Date(a.dateValue);
        const bDate = new Date(b.dateValue);
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
    safePage * pageSize,
  );
  const rangeStart = filteredSales.length ? (safePage - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(filteredSales.length, safePage * pageSize);
  const rangeLabel = `Affichage ${rangeStart}-${rangeEnd} sur ${filteredSales.length}`;

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const tomorrowStart = endOfDay(now);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const paidOrders = orders.filter((order) => order.status === "PAID");
    const paidToday = paidOrders.filter((order) =>
      isWithinPeriod(order.createdAt, todayStart, tomorrowStart),
    );
    const paidYesterday = paidOrders.filter((order) =>
      isWithinPeriod(order.createdAt, yesterdayStart, todayStart),
    );
    const paidMonth = paidOrders.filter((order) =>
      isWithinPeriod(order.createdAt, currentMonthStart, tomorrowStart),
    );

    const revenueTotal = paidOrders.reduce(
      (sum, order) => sum + toDisplayAmount(order.total, order.currencyCode),
      0,
    );
    const revenueDay = paidToday.reduce(
      (sum, order) => sum + toDisplayAmount(order.total, order.currencyCode),
      0,
    );
    const revenueYesterday = paidYesterday.reduce(
      (sum, order) => sum + toDisplayAmount(order.total, order.currencyCode),
      0,
    );

    const uniqueCustomers = new Set(
      paidMonth.map((order) => order.customerId).filter(Boolean),
    );
    const currentDayCustomers = new Set(
      paidToday.map((order) => order.customerId).filter(Boolean),
    );
    const previousDayCustomers = new Set(
      paidYesterday.map((order) => order.customerId).filter(Boolean),
    );

    const allPayments = orders.flatMap((order) =>
      (order.payments || []).map((payment) => ({
        ...payment,
        orderCreatedAt: order.createdAt,
      })),
    );

    const paymentsToday = allPayments.filter((payment) =>
      isWithinPeriod(
        payment.paidAt || payment.createdAt || payment.orderCreatedAt,
        todayStart,
        tomorrowStart,
      ),
    );
    const paymentsYesterday = allPayments.filter((payment) =>
      isWithinPeriod(
        payment.paidAt || payment.createdAt || payment.orderCreatedAt,
        yesterdayStart,
        todayStart,
      ),
    );

    const paymentsValidated = allPayments.filter(
      (payment) => payment.status === "COMPLETED",
    ).length;
    const paymentsValidatedCurrent = paymentsToday.filter(
      (payment) => payment.status === "COMPLETED",
    ).length;
    const paymentsValidatedPrevious = paymentsYesterday.filter(
      (payment) => payment.status === "COMPLETED",
    ).length;

    return {
      totalSales: paidOrders.length,
      revenueTotal,
      revenueDay,
      salesToday: paidToday.length,
      openSellers: cashSessions.length,
      customers: uniqueCustomers.size,
      paymentsValidated,
      change: {
        totalSales: percentChange(paidToday.length, paidYesterday.length),
        revenueDay: percentChange(revenueDay, revenueYesterday),
        customers: percentChange(
          currentDayCustomers.size,
          previousDayCustomers.size,
        ),
        paymentsValidated: percentChange(
          paymentsValidatedCurrent,
          paymentsValidatedPrevious,
        ),
      },
    };
  }, [orders, cashSessions]);

  const salesCards = useMemo(
    () => [
      {
        title: "Ventes totales",
        value: stats.totalSales.toString(),
        subtitle: "Historique cumule",
        icon: Receipt,
        change: stats.change.totalSales,
        highlight: true,
        amountLabel: "Revenus generes",
        amountValue: formatDisplayAmount(stats.revenueTotal),
      },
      {
        title: "Ventes du jour",
        value: formatDisplayAmount(stats.revenueDay),
        subtitle: "Toutes les boutiques aujourd'hui",
        icon: Store,
        change: stats.change.revenueDay,
        amountLabel: "Tickets payes",
        amountValue: stats.salesToday.toString(),
        actionLabel: isDetailOpen ? "Masquer le detail" : "Voir detail",
      },
      {
        title: "Clients servis",
        value: stats.customers.toString(),
        subtitle: "Depuis le debut du mois",
        icon: Users,
        change: stats.change.customers,
        amountLabel: "Caisses ouvertes",
        amountValue: stats.openSellers.toString(),
      },
      {
        title: "Paiements valides",
        value: stats.paymentsValidated.toString(),
        subtitle: "Transactions reussies",
        icon: BadgeCheck,
        change: stats.change.paymentsValidated,
        amountLabel: "Temps reel",
        amountValue: "Aujourd'hui",
      },
    ],
    [isDetailOpen, stats],
  );

  const columns = useMemo(
    () => [
      { header: "Vente ID", accessor: "saleId" },
      { header: "Caissier", accessor: "cashier" },
      { header: "Client", accessor: "customer" },
      { header: "Date", accessor: "dateLabel" },
      {
        header: "Produits",
        accessor: "items",
        render: (row) => (
          <div
            className="max-w-md overflow-hidden text-sm text-text-primary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
            title={row.items}
          >
            {row.items || "Aucun produit"}
          </div>
        ),
      },
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
    [],
  );

  const reloadOrders = async () => {
    const data = await apiGet("/api/orders");
    const list = Array.isArray(data?.data) ? data.data : data;
    setOrders(Array.isArray(list) ? list : []);
  };

  const handleEditSale = async (payload) => {
    if (!selectedSale?.raw?.id) return;
    setSubmittingEdit(true);
    try {
      await apiPatch(`/api/orders/${selectedSale.raw.id}`, payload);
      await reloadOrders();
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

      await reloadOrders();
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

  const handleToggleDetails = () => {
    navigate(isDetailOpen ? "/sales" : "/sales/details");
  };

  return (
    <section className="flex h-full w-full flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Ventes</h1>
        <p className="text-sm text-text-secondary">
          Suivez les ventes realisees en boutique et la performance du jour.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {salesCards.map((card) => (
          <StatCard
            key={card.title}
            {...card}
            onAction={card.title === "Ventes du jour" ? handleToggleDetails : undefined}
          />
        ))}
      </div>

      <DataTable
        title="Historique des ventes"
        description="Toutes les transactions en caisse"
        columns={columns}
        data={pagedSales}
        emptyMessage={
          !canReadSales
            ? "Vous n'avez pas la permission de consulter les ventes."
            : loading
              ? "Chargement..."
              : "Aucune donnee"
        }
        enableSelection={false}
        actionsHeader="Action"
        renderActions={(row) => (
          <DropdownAction
            label={<EllipsisVertical size={18} strokeWidth={1.5} />}
            items={[
              {
                id: "detail",
                label: "Detail",
                icon: Eye,
                onClick: () => setDetailSale(row),
              },
              ...(canEditSales
                ? [
                    {
                      id: "edit",
                      label: "Modifier",
                      icon: Pencil,
                      disabled: row.raw?.status === "CANCELED",
                      onClick: () => setSelectedSale(row),
                    },
                  ]
                : []),
              ...(canCancelSales
                ? [
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
                  ]
                : []),
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

      <Outlet
        context={{
          orders,
          cashSessions,
          currencySettings,
        }}
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
        isOpen={Boolean(detailSale)}
        title={detailSale?.saleId || "Detail de la vente"}
        description="Consultez tous les articles de cette vente."
        confirmLabel="Fermer"
        cancelButtonClassName="hidden"
        onConfirm={() => setDetailSale(null)}
        onCancel={() => setDetailSale(null)}
      >
        <div className="space-y-4">
          <div className="grid gap-3 rounded-xl border border-border bg-surface/70 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-text-secondary">Caissier</p>
              <p className="text-sm font-medium text-text-primary">
                {detailSale?.cashier || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Client</p>
              <p className="text-sm font-medium text-text-primary">
                {detailSale?.customer || "Client comptoir"}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Date</p>
              <p className="text-sm font-medium text-text-primary">
                {detailSale?.dateLabel || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Montant</p>
              <p className="text-sm font-medium text-text-primary">
                {detailSale?.total || "0"}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-background">
            <div className="grid grid-cols-[minmax(0,1.8fr)_100px_120px_120px] gap-3 border-b border-border bg-surface/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              <span>Produit</span>
              <span className="text-right">Qte</span>
              <span className="text-right">PU</span>
              <span className="text-right">Total</span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {(detailSale?.itemsList || []).length ? (
                detailSale.itemsList.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1.8fr)_100px_120px_120px] gap-3 border-b border-border/70 px-4 py-3 text-sm last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text-primary">
                        {item.name}
                      </p>
                      {item.isGift ? (
                        <p className="text-xs text-success">Offert</p>
                      ) : null}
                    </div>
                    <span className="text-right text-text-primary">{item.quantity}</span>
                    <span className="text-right text-text-primary">
                      {formatAmount(item.unitPrice, detailSale?.raw?.currencyCode)}
                    </span>
                    <span className="text-right text-text-primary">
                      {formatAmount(item.total, detailSale?.raw?.currencyCode)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-6 text-sm text-text-secondary">
                  Aucun article sur cette vente.
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

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
