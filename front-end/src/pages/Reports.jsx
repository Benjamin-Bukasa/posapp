import React, { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3,
  Download,
  LineChart,
  PackageCheck,
  ShoppingCart,
  Users,
  WalletCards,
} from "lucide-react";
import Button from "../components/ui/button";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import useToastStore from "../stores/toastStore";
import { apiGet, buildQuery } from "../services/apiClient";
import useAuthStore from "../stores/authStore";
import useCurrencyStore from "../stores/currencyStore";
import { formatDisplayAmount, toDisplayAmount } from "../utils/formatters";

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

const sumOrderItems = (order) =>
  (order?.items || []).reduce(
    (sum, item) => sum + Number(item?.quantity || 0),
    0
  );

const buildLastDays = (count) => {
  const days = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    date.setHours(0, 0, 0, 0);
    days.push(date);
  }
  return days;
};

const isSameDay = (date, compare) =>
  date.getFullYear() === compare.getFullYear() &&
  date.getMonth() === compare.getMonth() &&
  date.getDate() === compare.getDate();

const getWeekStart = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  return start;
};

const buildWeeklySeries = (orders, weeksCount, valueFn) => {
  const series = Array.from({ length: weeksCount }, () => 0);
  const now = new Date();
  const currentWeekStart = getWeekStart(now);

  orders.forEach((order) => {
    const date = new Date(order.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const orderWeekStart = getWeekStart(date);
    const diffMs = currentWeekStart - orderWeekStart;
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    if (diffWeeks < 0 || diffWeeks >= weeksCount) return;
    const index = weeksCount - diffWeeks - 1;
    series[index] += valueFn(order);
  });

  return series;
};

const buildWeeklyCustomerSeries = (orders, weeksCount) => {
  const buckets = Array.from({ length: weeksCount }, () => new Set());
  const now = new Date();
  const currentWeekStart = getWeekStart(now);

  orders.forEach((order) => {
    const customerId = order.customerId;
    if (!customerId) return;
    const date = new Date(order.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const orderWeekStart = getWeekStart(date);
    const diffMs = currentWeekStart - orderWeekStart;
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    if (diffWeeks < 0 || diffWeeks >= weeksCount) return;
    const index = weeksCount - diffWeeks - 1;
    buckets[index].add(customerId);
  });

  return buckets.map((bucket) => bucket.size);
};

const buildHtmlTable = (rows, columns, title) => {
  const headerRow = columns.map((col) => `<th>${col}</th>`).join("");
  const bodyRows = rows
    .map((row) => {
      const cells = columns.map((col) => `<td>${row[col]}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `
    <h3>${title}</h3>
    <table>
      <thead><tr>${headerRow}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
};

const StackedBarChart = ({ data }) => {
  const total = data.reduce((acc, item) => acc + item.value, 0) || 1;
  return (
    <div className="w-full">
      <div className="flex h-3 overflow-hidden rounded-full bg-background">
        {data.map((item) => (
          <div
            key={item.label}
            style={{
              width: `${(item.value / total) * 100}%`,
              backgroundColor: item.color,
            }}
          />
        ))}
      </div>
      <div className="mt-4 space-y-2 text-sm">
        {data.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-text-primary">{item.label}</span>
            <span className="text-text-secondary">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const DonutChart = ({ data, size = 160, centerLabel }) => {
  const radius = 14;
  const stroke = 7;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((acc, item) => acc + item.value, 0) || 1;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      <circle
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        stroke="#E5E7EB"
        strokeWidth={stroke}
      />
      {data.map((item) => {
        const dash = (item.value / total) * circumference;
        const strokeDasharray = `${dash} ${circumference - dash}`;
        const strokeDashoffset = circumference - offset;
        offset += dash;
        return (
          <circle
            key={item.label}
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke={item.color}
            strokeWidth={stroke}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        );
      })}
      {centerLabel ? (
        <text
          x="18"
          y="18"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="4"
          fill="#1D473F"
        >
          {centerLabel}
        </text>
      ) : null}
    </svg>
  );
};

const AreaChart = ({ data, color = "#1D473F" }) => {
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const width = 210;
  const height = 80;
  const step = width / (data.length - 1);
  const points = data
    .map((item, index) => {
      const x = index * step;
      const y = height - (item.value / maxValue) * (height - 10) - 5;
      return `${x},${y}`;
    })
    .join(" ");
  const areaPath = `M0,${height} L${points} L${width},${height} Z`;

  return (
    <svg width="100%" height="120" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#areaGradient)" />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="3"
        points={points}
        strokeLinecap="round"
      />
      {data.map((item, index) => {
        const x = index * step;
        const y = height - (item.value / maxValue) * (height - 10) - 5;
        return <circle key={item.label} cx={x} cy={y} r="3" fill={color} />;
      })}
    </svg>
  );
};

const SparklineArea = ({ data, color = "#1D473F" }) => {
  const maxValue = Math.max(...data, 1);
  const width = 210;
  const height = 60;
  const step = width / (data.length - 1);
  const gradientId = `spark-${String(color).replace(/[^a-z0-9]/gi, "")}`;
  const points = data
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / maxValue) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");
  const areaPath = `M0,${height} L${points} L${width},${height} Z`;

  return (
    <svg width="100%" height="70" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        points={points}
        strokeLinecap="round"
      />
    </svg>
  );
};

const DualLineChart = ({ data }) => {
  const maxValue = Math.max(
    ...data.flatMap((item) => [item.in, item.out]),
    1
  );
  const width = 210;
  const height = 80;
  const step = width / (data.length - 1);
  const buildLine = (key) =>
    data
      .map((item, index) => {
        const x = index * step;
        const y = height - (item[key] / maxValue) * (height - 10) - 5;
        return `${x},${y}`;
      })
      .join(" ");

  const inPoints = buildLine("in");
  const outPoints = buildLine("out");

  return (
    <svg width="100%" height="120" viewBox={`0 0 ${width} ${height}`}>
      <polyline
        fill="none"
        stroke="#1D473F"
        strokeWidth="3"
        points={inPoints}
        strokeLinecap="round"
      />
      <polyline
        fill="none"
        stroke="#b0bbb7"
        strokeWidth="3"
        points={outPoints}
        strokeLinecap="round"
      />
      {data.map((item, index) => {
        const x = index * step;
        const yIn = height - (item.in / maxValue) * (height - 10) - 5;
        const yOut = height - (item.out / maxValue) * (height - 10) - 5;
        return (
          <g key={item.label}>
            <circle cx={x} cy={yIn} r="3" fill="#1D473F" />
            <circle cx={x} cy={yOut} r="3" fill="#b0bbb7" />
          </g>
        );
      })}
    </svg>
  );
};

function Reports() {
  const showToast = useToastStore((state) => state.showToast);
  const user = useAuthStore((state) => state.user);
  const displayCurrencyCode = useCurrencyStore(
    (state) => state.settings.primaryCurrencyCode,
  );
  const storeId = user?.storeId || null;
  const storeName = user?.storeName || "Toutes pharmacies";
  const refreshTick = useRealtimeRefetch([
    "sale:created",
    "sale:updated",
    "stock:entry:created",
    "stock:entry:posted",
    "supply:request:approved",
    "purchase:order:created",
    "delivery:note:received",
    "transfer:completed",
  ]);
  const [orders, setOrders] = useState([]);
  const [stockEntries, setStockEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const query = buildQuery(storeId ? { storeId } : {});
        const suffix = query ? `?${query}` : "";
        const [ordersData, stockData] = await Promise.all([
          apiGet(`/api/orders${suffix}`),
          apiGet(`/api/stock-entries${suffix}`),
        ]);
        if (!isMounted) return;
        const ordersList = Array.isArray(ordersData?.data)
          ? ordersData.data
          : ordersData;
        const stockList = Array.isArray(stockData?.data)
          ? stockData.data
          : stockData;
        setOrders(Array.isArray(ordersList) ? ordersList : []);
        setStockEntries(Array.isArray(stockList) ? stockList : []);
      } catch (error) {
        showToast({
          title: "Erreur",
          message: error.message || "Impossible de charger les rapports.",
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

  const paidOrders = useMemo(
    () => orders.filter((order) => order.status === "PAID"),
    [orders]
  );

  const salesStatusData = useMemo(() => {
    const paid = paidOrders.length;
    const canceled = orders.filter((order) => order.status === "CANCELED")
      .length;
    const failed = orders.filter(
      (order) =>
        order.payments?.some((payment) => payment.status === "FAILED") &&
        order.status !== "PAID"
    ).length;
    const total = orders.length;
    const pending = Math.max(total - paid - canceled - failed, 0);

    return [
      { label: "Réussies", value: paid, color: "#1D473F" },
      { label: "Annulées", value: canceled, color: "#F59E0B" },
      { label: "Échouées", value: failed, color: "#EF4444" },
      { label: "En attente", value: pending, color: "#b0bbb7" },
    ];
  }, [orders, paidOrders.length]);

  const salesQuantityData = useMemo(() => {
    const days = buildLastDays(7);
    return days.map((day) => {
      const value = paidOrders
        .filter((order) => isSameDay(new Date(order.createdAt), day))
        .reduce((sum, order) => sum + sumOrderItems(order), 0);
      return {
        label: DAY_LABELS[day.getDay()],
        value,
      };
    });
  }, [paidOrders]);

  const paymentMethodData = useMemo(() => {
    const payments = orders.flatMap((order) => order.payments || []);
    const total = payments.length || 1;
    const counts = payments.reduce(
      (acc, payment) => {
        const method = payment.method || "OTHER";
        acc[method] = (acc[method] || 0) + 1;
        return acc;
      },
      {}
    );

    const getPercent = (count) =>
      total ? Math.round((count / total) * 100) : 0;

    return [
      {
        label: "Cash",
        value: getPercent(counts.CASH || 0),
        color: "#1D473F",
      },
      {
        label: "Mobile Money",
        value: getPercent(counts.MOBILE_MONEY || 0),
        color: "#D8F274",
      },
      {
        label: "Carte",
        value: getPercent(counts.CARD || 0),
        color: "#b0bbb7",
      },
    ];
  }, [orders]);

  const ordersTrend = useMemo(
    () =>
      buildWeeklySeries(orders, 8, () => 1),
    [orders]
  );

  const clientTrend = useMemo(
    () => buildWeeklyCustomerSeries(orders, 8),
    [orders]
  );

  const stockFlow = useMemo(() => {
    const days = buildLastDays(7);
    return days.map((day) => {
      const inValue = stockEntries
        .filter(
          (entry) =>
            entry.status === "POSTED" &&
            isSameDay(new Date(entry.postedAt || entry.createdAt), day)
        )
        .reduce((sum, entry) => {
          const qty = (entry.items || []).reduce(
            (acc, item) => acc + Number(item.quantity || 0),
            0
          );
          return sum + qty;
        }, 0);

      const outValue = paidOrders
        .filter((order) => isSameDay(new Date(order.createdAt), day))
        .reduce((sum, order) => sum + sumOrderItems(order), 0);

      return {
        label: DAY_LABELS[day.getDay()],
        in: inValue,
        out: outValue,
      };
    });
  }, [paidOrders, stockEntries]);

  const summaryCards = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthSales = paidOrders
      .filter((order) => new Date(order.createdAt) >= startOfMonth)
      .reduce(
        (sum, order) => sum + toDisplayAmount(order.total, order.currencyCode),
        0,
      );
    const monthOrders = orders.filter(
      (order) => new Date(order.createdAt) >= startOfMonth
    ).length;
    const activeCustomers = new Set(
      orders
        .filter((order) => new Date(order.createdAt) >= startOfMonth)
        .map((order) => order.customerId)
        .filter(Boolean)
    ).size;
    const validatedPayments = orders
      .flatMap((order) => order.payments || [])
      .filter((payment) => payment.status === "COMPLETED").length;

    return [
      {
        title: "Ventes du mois",
        value: formatDisplayAmount(monthSales),
        subtitle: storeId ? `Boutique: ${storeName}` : "Toutes pharmacies",
        icon: BarChart3,
      },
      {
        title: "Commandes",
        value: monthOrders.toString(),
        subtitle: "Depuis le début du mois",
        icon: ShoppingCart,
      },
      {
        title: "Clients actifs",
        value: activeCustomers.toString(),
        subtitle: "Clients récurrents",
        icon: Users,
      },
      {
        title: "Paiements validés",
        value: validatedPayments.toString(),
        subtitle: "Transactions réussies",
        icon: WalletCards,
      },
    ];
  }, [orders, paidOrders, storeId, storeName, displayCurrencyCode]);

  const salesTotal = useMemo(
    () => salesStatusData.reduce((acc, item) => acc + item.value, 0),
    [salesStatusData]
  );

  const paymentStats = useMemo(() => {
    const payments = orders.flatMap((order) => order.payments || []);
    return {
      completed: payments.filter((payment) => payment.status === "COMPLETED")
        .length,
      pending: payments.filter((payment) => payment.status === "PENDING").length,
      failed: payments.filter((payment) => payment.status === "FAILED").length,
    };
  }, [orders]);

  const downloadExcel = useCallback(() => {
    const tables = [
      buildHtmlTable(
        salesStatusData.map((item) => ({
          Statut: item.label,
          Valeur: item.value,
        })),
        ["Statut", "Valeur"],
        "Rapport de vente"
      ),
      buildHtmlTable(
        paymentMethodData.map((item) => ({
          Méthode: item.label,
          "Part (%)": item.value,
        })),
        ["Méthode", "Part (%)"],
        "Rapport de paiement"
      ),
      buildHtmlTable(
        stockFlow.map((item) => ({
          Jour: item.label,
          Entrées: item.in,
          Sorties: item.out,
        })),
        ["Jour", "Entrées", "Sorties"],
        "Entrées / sorties stock"
      ),
    ];

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: "Poppins", Arial, sans-serif; padding: 16px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px 10px; font-size: 12px; }
            th { background: #f3f4f6; text-align: left; }
            h3 { margin: 16px 0 8px; }
          </style>
        </head>
        <body>
          ${tables.join("")}
        </body>
      </html>
    `;

    const blob = new Blob(["\uFEFF" + html], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "neo-reports.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }, [paymentMethodData, salesStatusData, stockFlow]);

  const navLinkClass = ({ isActive }) =>
    [
      "px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
      isActive
        ? "bg-secondary text-white border-secondary"
        : "bg-surface text-text-primary border-border hover:bg-surface/70",
    ].join(" ");

  return (
    <section className="w-full h-full flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Rapports</h1>
          <p className="text-sm text-text-secondary">
            Suivi des ventes, paiements, commandes et stocks.
          </p>
        </div>
        <Button
          label={
            <div className="flex items-center gap-2">
              <Download size={16} />
              Exporter Excel
            </div>
          }
          variant="default"
          size="default"
          className="w-full bg-neutral-300 text-text-primary hover:bg-neutral-300/80 sm:w-auto"
          onClick={downloadExcel}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-text-secondary">{card.title}</p>
                  <p className="mt-2 text-2xl font-semibold text-text-primary">
                    {card.value}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {card.subtitle}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background text-secondary">
                  <Icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Rapport de vente
              </p>
              <p className="text-xs text-text-secondary">
                Statut des ventes et quantité vendue
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <PackageCheck size={16} />
              {salesTotal} ventes
            </div>
          </div>
          <div className="mt-4">
            <StackedBarChart data={salesStatusData} />
          </div>
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase text-text-secondary">
              Quantité vendue (7 jours)
            </p>
            <AreaChart data={salesQuantityData} color="#1D473F" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Rapport de paiement
              </p>
              <p className="text-xs text-text-secondary">
                Répartition par méthode
              </p>
            </div>
            <WalletCards size={18} className="text-secondary" />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <DonutChart data={paymentMethodData} centerLabel="100%" />
            <div className="space-y-3 text-sm">
              {paymentMethodData.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-text-primary">{item.label}</span>
                  <span className="text-text-secondary">{item.value}%</span>
                </div>
              ))}
              <div className="mt-4 space-y-2 text-xs text-text-secondary">
                <p>Transactions réussies : {paymentStats.completed}</p>
                <p>En attente : {paymentStats.pending}</p>
                <p>Échouées : {paymentStats.failed}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Commandes & clients
              </p>
              <p className="text-xs text-text-secondary">
                Suivi hebdomadaire
              </p>
            </div>
            <LineChart size={18} className="text-secondary" />
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase text-text-secondary">
                Commandes
              </p>
              <SparklineArea data={ordersTrend} color="#1D473F" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-text-secondary">
                Clients
              </p>
              <SparklineArea data={clientTrend} color="#b0bbb7" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Entrées / sorties de stock
            </p>
            <p className="text-xs text-text-secondary">
              {storeId ? `Boutique: ${storeName}` : "Toutes pharmacies"}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-text-secondary">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-secondary" />
              Entrées
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#b0bbb7]" />
              Sorties
            </span>
          </div>
        </div>
        <div className="mt-4">
          <DualLineChart data={stockFlow} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Tableaux de rapports
            </p>
            <p className="text-xs text-text-secondary">
              Ventes et approvisionnement
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <NavLink to="sales" className={navLinkClass}>
              Ventes
            </NavLink>
            <NavLink to="approvisionnement" className={navLinkClass}>
              Approvisionnement
            </NavLink>
          </div>
        </div>
        {loading ? (
          <p className="text-xs text-text-secondary">Chargement...</p>
        ) : null}
        <Outlet />
      </div>
    </section>
  );
}

export default Reports;
