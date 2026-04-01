import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  ClipboardList,
  TrendingUp,
  UserRound,
  Activity,
} from "lucide-react";
import ProductsList from "./../features/ProductsList";
import StatCard from "../components/ui/statCard";
import useToastStore from "../stores/toastStore";
import { apiGet, buildQuery } from "../services/apiClient";
import {
  formatAmount,
  formatDisplayAmount,
  formatName,
  shortId,
  toDisplayAmount,
} from "../utils/formatters";
import { useProductsData } from "../hooks/useProductsData";
import useAuthStore from "../stores/authStore";
import useCurrencyStore from "../stores/currencyStore";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";

const sumOrderItems = (order) =>
  (order?.items || []).reduce(
    (sum, item) => sum + Number(item?.quantity || 0),
    0
  );

const calcChange = (current, previous) => {
  if (!previous) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

const formatRelativeTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "À l'instant";
  if (diffMs < hour) return `Il y a ${Math.floor(diffMs / minute)} min`;
  if (diffMs < day) return `Il y a ${Math.floor(diffMs / hour)} h`;
  return `Il y a ${Math.floor(diffMs / day)} j`;
};

const mapRequestStatus = (status) => {
  if (status === "APPROVED") return "Approuvée";
  if (status === "REJECTED") return "Rejetée";
  if (status === "FULFILLED") return "Terminée";
  return "En attente";
};

function Dashboard() {
  const showToast = useToastStore((state) => state.showToast);
  const user = useAuthStore((state) => state.user);
  const displayCurrencyCode = useCurrencyStore(
    (state) => state.settings.primaryCurrencyCode,
  );
  const storeId = user?.storeId || null;
  const refreshTick = useRealtimeRefetch([
    "sale:created",
    "sale:updated",
    "stock:entry:created",
    "stock:entry:posted",
    "supply:request:created",
    "supply:request:approved",
  ]);
  const { products } = useProductsData({ storeId });
  const [orders, setOrders] = useState([]);
  const [stockEntries, setStockEntries] = useState([]);
  const [supplyRequests, setSupplyRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const query = buildQuery(storeId ? { storeId } : {});
        const suffix = query ? `?${query}` : "";
        const [ordersData, stockData, requestsData] = await Promise.all([
          apiGet(`/api/orders${suffix}`),
          apiGet(`/api/stock-entries${suffix}`),
          apiGet(`/api/supply-requests${suffix}`),
        ]);
        if (!isMounted) return;
        const ordersList = Array.isArray(ordersData?.data)
          ? ordersData.data
          : ordersData;
        const stockList = Array.isArray(stockData?.data)
          ? stockData.data
          : stockData;
        const requestList = Array.isArray(requestsData?.data)
          ? requestsData.data
          : requestsData;
        setOrders(Array.isArray(ordersList) ? ordersList : []);
        setStockEntries(Array.isArray(stockList) ? stockList : []);
        setSupplyRequests(Array.isArray(requestList) ? requestList : []);
      } catch (error) {
        showToast({
          title: "Erreur",
          message: error.message || "Impossible de charger le tableau.",
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

  const stats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const prevWeekStart = new Date(now);
    prevWeekStart.setDate(now.getDate() - 14);

    const paidOrders = orders.filter((order) => order.status === "PAID");
    const paidMonth = paidOrders.filter(
      (order) => new Date(order.createdAt) >= startOfMonth
    );
    const paidPrevMonth = paidOrders.filter((order) => {
      const date = new Date(order.createdAt);
      return date >= startOfPrevMonth && date < startOfMonth;
    });
    const paidWeek = paidOrders.filter(
      (order) => new Date(order.createdAt) >= weekStart
    );
    const paidPrevWeek = paidOrders.filter((order) => {
      const date = new Date(order.createdAt);
      return date >= prevWeekStart && date < weekStart;
    });

    const monthSold = paidMonth.reduce(
      (sum, order) => sum + sumOrderItems(order),
      0
    );
    const prevMonthSold = paidPrevMonth.reduce(
      (sum, order) => sum + sumOrderItems(order),
      0
    );
    const weekSold = paidWeek.reduce(
      (sum, order) => sum + sumOrderItems(order),
      0
    );
    const prevWeekSold = paidPrevWeek.reduce(
      (sum, order) => sum + sumOrderItems(order),
      0
    );
    const monthRevenue = paidMonth.reduce(
      (sum, order) => sum + toDisplayAmount(order.total, order.currencyCode),
      0
    );
    const weekRevenue = paidWeek.reduce(
      (sum, order) => sum + toDisplayAmount(order.total, order.currencyCode),
      0
    );
    const userOrders = paidOrders.filter(
      (order) =>
        order.createdById === user?.id || order.createdBy?.id === user?.id
    );
    const userRevenue = userOrders.reduce(
      (sum, order) => sum + toDisplayAmount(order.total, order.currencyCode),
      0
    );

    const totalQuantity = products.reduce(
      (sum, product) => sum + Number(product.quantity || 0),
      0
    );
    const totalValue = products.reduce(
      (sum, product) =>
        sum +
        Number(product.quantity || 0) *
          toDisplayAmount(product.price || 0, product.currencyCode),
      0
    );

    return {
      totalQuantity,
      totalValue,
      monthSold,
      prevMonthSold,
      weekSold,
      prevWeekSold,
      monthRevenue,
      weekRevenue,
      userOrders: userOrders.length,
      userRevenue,
    };
  }, [orders, products, user?.id, displayCurrencyCode]);

  const productCards = useMemo(
    () => [
      {
        title: "Produits en stock",
        value: stats.totalQuantity.toString(),
        subtitle: storeId ? "Total boutique" : "Total pharmacie",
        icon: Boxes,
        change: 0,
        amountLabel: "Valeur estimée",
        amountValue: formatDisplayAmount(stats.totalValue),
      },
      {
        title: "Produits vendus (mois)",
        value: stats.monthSold.toString(),
        subtitle: "Depuis le début du mois",
        icon: TrendingUp,
        change: calcChange(stats.monthSold, stats.prevMonthSold),
        amountLabel: "Revenus générés",
        amountValue: formatDisplayAmount(stats.monthRevenue),
      },
      {
        title: "Produits vendus (semaine)",
        value: stats.weekSold.toString(),
        subtitle: "Depuis le début de la semaine",
        icon: CalendarDays,
        change: calcChange(stats.weekSold, stats.prevWeekSold),
        amountLabel: "Revenus générés",
        amountValue: formatDisplayAmount(stats.weekRevenue),
      },
      {
        title: "Ventes par utilisateur",
        value: stats.userOrders.toString(),
        subtitle: "Vos ventes",
        icon: UserRound,
        change: 0,
        amountLabel: "Revenus générés",
        amountValue: formatDisplayAmount(stats.userRevenue),
      },
    ],
    [stats, storeId, displayCurrencyCode]
  );

  const recentActivities = useMemo(() => {
    const activities = [];
    orders.forEach((order) => {
      const customerName = order.customer
        ? formatName(order.customer)
        : "Client comptoir";
      activities.push({
        id: `order-${order.id}`,
        date: order.createdAt,
        title: `Vente #SALE-${shortId(order.id)}`,
        subtitle: `${customerName} • ${formatAmount(
          order.total,
          order.currencyCode,
        )}`,
      });
    });
    stockEntries.forEach((entry) => {
      const itemsCount = entry.items?.length || 0;
      const zoneName =
        entry.store?.name || entry.storageZone?.name || "Stock";
      activities.push({
        id: `stock-${entry.id}`,
        date: entry.postedAt || entry.approvedAt || entry.createdAt,
        title: "Réception stock",
        subtitle: `${zoneName} • ${itemsCount} articles`,
      });
    });
    supplyRequests.forEach((request) => {
      const storeName = request.store?.name || "Boutique";
      activities.push({
        id: `req-${request.id}`,
        date: request.createdAt,
        title: `Réquisition ${request.title}`,
        subtitle: `${storeName} • ${mapRequestStatus(request.status)}`,
      });
    });

    return activities
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3)
      .map((item) => ({
        ...item,
        time: formatRelativeTime(item.date),
      }));
  }, [orders, stockEntries, supplyRequests, displayCurrencyCode]);

  const pendingRequisitions = useMemo(() => {
    const pending = supplyRequests.filter((request) =>
      ["DRAFT", "SUBMITTED"].includes(request.status)
    );
    return pending
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3)
      .map((item) => ({
        id: `REQ-${shortId(item.id)}`,
        store: item.store?.name || "Boutique",
        status: mapRequestStatus(item.status),
        date: formatRelativeTime(item.createdAt),
      }));
  }, [supplyRequests]);

  const stockAlerts = useMemo(() => {
    const alerts = products
      .map((product) => ({
        id: product.id,
        name: product.product,
        quantity: Number(product.quantity || 0),
        stockLabel: product.stock || "",
      }))
      .filter((item) => {
        const label = item.stockLabel.toLowerCase();
        return label.includes("faible") || label.includes("épuis") || item.quantity <= 0;
      })
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        name: item.name,
        stock: `Stock: ${item.quantity}`,
        level: item.quantity <= 0 ? "Critique" : "Faible",
      }));

    return alerts;
  }, [products]);

  return (
    <section className="sectionDashboard">
      <div className="mainBloc gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {productCards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>
        <ProductsList storeId={storeId} />
      </div>
  
    </section>
  );
}

export default Dashboard;
