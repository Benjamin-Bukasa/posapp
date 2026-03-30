import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Package,
  Store,
  WalletCards,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AdminDataTable from "../components/ui/AdminDataTable";
import StatCard from "../components/ui/StatCard";
import { ApiError, requestJson } from "../api/client";
import useAuthStore from "../stores/authStore";
import useCurrencyStore from "../stores/currencyStore";
import { formatMoney } from "../utils/currencyDisplay";

const chartPalette = ["#1D473F", "#B0BBB7", "#D8F274", "#F59E0B", "#3B82F6", "#EF4444"];

const compactNumberFormatter = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

const toNumber = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const formatNumber = (value) => numberFormatter.format(toNumber(value));
const formatCompactNumber = (value) => compactNumberFormatter.format(toNumber(value));

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const resolveAccessor = (row, accessor) => {
  if (typeof accessor === "function") return accessor(row);
  if (!accessor) return undefined;

  return String(accessor)
    .split(".")
    .reduce((value, segment) => (value == null ? value : value[segment]), row);
};

const compareValues = (left, right) => {
  const leftNumber = Number(left);
  const rightNumber = Number(right);

  if (
    Number.isFinite(leftNumber) &&
    Number.isFinite(rightNumber) &&
    String(left).trim() !== "" &&
    String(right).trim() !== ""
  ) {
    return leftNumber - rightNumber;
  }

  return String(left ?? "").localeCompare(String(right ?? ""), "fr", {
    sensitivity: "base",
    numeric: true,
  });
};

const percentChange = (currentValue, previousValue) => {
  const current = toNumber(currentValue);
  const previous = toNumber(previousValue);

  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  const change = ((current - previous) / Math.abs(previous)) * 100;
  return Number(change.toFixed(1));
};

const EmptyChartState = ({ message }) => (
  <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-border bg-background/40 px-6 py-8 text-center text-sm text-text-secondary">
    {message}
  </div>
);

const DonutChart = ({ data, size = 180, centerLabel = "", centerValue = "" }) => {
  const radius = 14;
  const stroke = 7;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, item) => sum + toNumber(item.value), 0) || 1;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox="0 0 36 36" className="shrink-0">
      <circle
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        stroke="#E5E7EB"
        strokeWidth={stroke}
      />
      {data.map((item) => {
        const dash = (toNumber(item.value) / total) * circumference;
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
      <text
        x="18"
        y="16.2"
        textAnchor="middle"
        fontSize="3.2"
        fill="#6B7280"
      >
        {centerLabel}
      </text>
      <text
        x="18"
        y="21.1"
        textAnchor="middle"
        fontSize="4.2"
        fontWeight="700"
        fill="#1D473F"
      >
        {centerValue}
      </text>
    </svg>
  );
};

const GroupedBarChart = ({ data = [], valueKeyIn, valueKeyOut, formatter }) => {
  if (!data.length) {
    return <EmptyChartState message="Aucune donnee disponible sur les 3 derniers mois." />;
  }

  const maxValue = Math.max(
    ...data.flatMap((item) => [toNumber(item[valueKeyIn]), toNumber(item[valueKeyOut])]),
    1,
  );
  const width = 520;
  const height = 250;
  const baseY = 190;
  const topY = 26;
  const chartHeight = baseY - topY;
  const groupWidth = width / data.length;
  const barWidth = 32;
  const groupGap = 10;
  const gridValues = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3;
    return maxValue - ratio * maxValue;
  });

  return (
    <div className="overflow-x-auto">
      <svg
        width="100%"
        height="260"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {gridValues.map((value, index) => {
          const y = topY + (index / 3) * chartHeight;
          return (
            <g key={`grid-${value}`}>
              <line
                x1="18"
                y1={y}
                x2={width - 12}
                y2={y}
                stroke="#E5E7EB"
                strokeDasharray="4 4"
              />
              <text x="0" y={y + 4} fontSize="10" fill="#6B7280">
                {formatter(value)}
              </text>
            </g>
          );
        })}

        {data.map((item, index) => {
          const groupCenter = groupWidth * index + groupWidth / 2;
          const entryValue = toNumber(item[valueKeyIn]);
          const outputValue = toNumber(item[valueKeyOut]);
          const entryHeight = (entryValue / maxValue) * chartHeight;
          const outputHeight = (outputValue / maxValue) * chartHeight;
          const startX = groupCenter - barWidth - groupGap / 2;

          return (
            <g key={item.monthKey || item.label}>
              <rect
                x={startX}
                y={baseY - entryHeight}
                width={barWidth}
                height={entryHeight}
                rx="10"
                fill="#1D473F"
              />
              <rect
                x={startX + barWidth + groupGap}
                y={baseY - outputHeight}
                width={barWidth}
                height={outputHeight}
                rx="10"
                fill="#B0BBB7"
              />
              <text
                x={groupCenter}
                y={222}
                textAnchor="middle"
                fontSize="12"
                fill="#111827"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const LineChart = ({ data = [] }) => {
  if (!data.length) {
    return <EmptyChartState message="Aucune donnee disponible sur les 3 derniers mois." />;
  }

  const width = 540;
  const height = 220;
  const paddingX = 24;
  const paddingY = 24;
  const maxValue = Math.max(...data.map((item) => toNumber(item.value)), 1);
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2 - 18;
  const step = data.length > 1 ? usableWidth / (data.length - 1) : usableWidth;

  const points = data
    .map((item, index) => {
      const x = paddingX + index * step;
      const y = height - paddingY - (toNumber(item.value) / maxValue) * usableHeight - 18;
      return `${x},${y}`;
    })
    .join(" ");

  const areaPath = `M${paddingX},${height - paddingY - 18} ${points} L${
    paddingX + usableWidth
  },${height - paddingY - 18} Z`;

  return (
    <div className="overflow-x-auto">
      <svg
        width="100%"
        height="230"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="dashboardLineGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1D473F" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#1D473F" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3].map((index) => {
          const y = paddingY + index * (usableHeight / 3);
          return (
            <line
              key={`line-grid-${index}`}
              x1={paddingX}
              y1={y}
              x2={width - paddingX}
              y2={y}
              stroke="#E5E7EB"
              strokeDasharray="4 4"
            />
          );
        })}

        <path d={areaPath} fill="url(#dashboardLineGradient)" />
        <polyline
          fill="none"
          stroke="#1D473F"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />

        {data.map((item, index) => {
          const x = paddingX + index * step;
          const y = height - paddingY - (toNumber(item.value) / maxValue) * usableHeight - 18;

          return (
            <g key={item.monthKey || item.label}>
              <circle cx={x} cy={y} r="4.5" fill="#1D473F" />
              <text
                x={x}
                y={height - 4}
                textAnchor="middle"
                fontSize="12"
                fill="#111827"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

function Dashboard() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);
  const displayCurrencyCode = useCurrencyStore(
    (state) => state.settings.primaryCurrencyCode,
  );
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState({
    flowComparison: [],
    storeDistribution: [],
    soldCostVariation: [],
    summary: null,
  });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metricMode, setMetricMode] = useState("quantity");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    category: "all",
    family: "all",
    isActive: "all",
  });
  const [sort, setSort] = useState({
    sortBy: "name",
    sortDir: "asc",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let ignore = false;

    const loadDashboard = async () => {
      if (!accessToken) {
        setDashboard({
          flowComparison: [],
          storeDistribution: [],
          soldCostVariation: [],
          summary: null,
        });
        setProducts([]);
        setLoading(false);
        setError("Session manquante.");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const [dashboardPayload, productsPayload] = await Promise.all([
          requestJson("/api/admin-dashboard", { token: accessToken }),
          requestJson("/api/products", {
            token: accessToken,
            query: { kind: "ARTICLE" },
          }),
        ]);

        if (ignore) return;

        setDashboard({
          flowComparison: Array.isArray(dashboardPayload?.flowComparison)
            ? dashboardPayload.flowComparison
            : [],
          storeDistribution: Array.isArray(dashboardPayload?.storeDistribution)
            ? dashboardPayload.storeDistribution
            : [],
          soldCostVariation: Array.isArray(dashboardPayload?.soldCostVariation)
            ? dashboardPayload.soldCostVariation
            : [],
          summary: dashboardPayload?.summary || null,
        });
        setProducts(Array.isArray(productsPayload) ? productsPayload : []);
      } catch (requestError) {
        if (ignore) return;

        if (requestError instanceof ApiError && requestError.status === 401) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }

        setDashboard({
          flowComparison: [],
          storeDistribution: [],
          soldCostVariation: [],
          summary: null,
        });
        setProducts([]);
        setError(
          requestError.message || "Impossible de charger les indicateurs du dashboard.",
        );
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      ignore = true;
    };
  }, [accessToken, logout, navigate]);

  const summary = dashboard.summary || {};
  const latestFlow = dashboard.flowComparison?.[dashboard.flowComparison.length - 1] || {};
  const previousFlow = dashboard.flowComparison?.[dashboard.flowComparison.length - 2] || {};
  const latestSoldCost =
    dashboard.soldCostVariation?.[dashboard.soldCostVariation.length - 1] || {};
  const previousSoldCost =
    dashboard.soldCostVariation?.[dashboard.soldCostVariation.length - 2] || {};

  const summaryCards = useMemo(
    () => [
      {
        title: "Articles actifs",
        value: formatNumber(summary.activeProducts),
        subtitle: "Dans le systeme",
        icon: Package,
        change: 0,
        highlight: true,
        amountLabel: "Boutiques actives",
        amountValue: formatNumber(summary.stockedStores),
      },
      {
        title: "Boutiques",
        value: formatNumber(summary.stores),
        subtitle: "Locales configurees",
        icon: Store,
        change: 0,
        amountLabel: "Avec stock",
        amountValue: formatNumber(summary.stockedStores),
      },
      {
        title: "Entrees stock",
        value: formatNumber(latestFlow.entryQuantity),
        subtitle: "Ce mois-ci",
        icon: ArrowDownToLine,
        change: percentChange(latestFlow.entryQuantity, previousFlow.entryQuantity),
        amountLabel: "Valeur entree",
        amountValue: formatMoney(latestFlow.entryValue),
      },
      {
        title: "Sorties stock",
        value: formatNumber(latestFlow.outputQuantity),
        subtitle: "Ce mois-ci",
        icon: ArrowUpFromLine,
        change: percentChange(latestFlow.outputQuantity, previousFlow.outputQuantity),
        amountLabel: "Valeur sortie",
        amountValue: formatMoney(latestFlow.outputValue),
      },
      {
        title: "CMV estime",
        value: formatMoney(latestSoldCost.value),
        subtitle: "Ce mois-ci",
        icon: WalletCards,
        change: percentChange(latestSoldCost.value, previousSoldCost.value),
        amountLabel: "Cumul 3 mois",
        amountValue: formatMoney(summary.soldCost),
      },
    ],
    [
      displayCurrencyCode,
      latestFlow.entryQuantity,
      latestFlow.entryValue,
      latestFlow.outputQuantity,
      latestFlow.outputValue,
      latestSoldCost.value,
      previousFlow.entryQuantity,
      previousFlow.outputQuantity,
      previousSoldCost.value,
      summary.activeProducts,
      summary.soldCost,
      summary.stockedStores,
      summary.stores,
    ],
  );

  const flowChart = useMemo(() => {
    const items = Array.isArray(dashboard.flowComparison) ? dashboard.flowComparison : [];

    if (metricMode === "value") {
      return {
        data: items,
        inKey: "entryValue",
        outKey: "outputValue",
        entryTotal: items.reduce((sum, item) => sum + toNumber(item.entryValue), 0),
        outputTotal: items.reduce((sum, item) => sum + toNumber(item.outputValue), 0),
        formatter: formatMoney,
      };
    }

    return {
      data: items,
      inKey: "entryQuantity",
      outKey: "outputQuantity",
      entryTotal: items.reduce((sum, item) => sum + toNumber(item.entryQuantity), 0),
      outputTotal: items.reduce((sum, item) => sum + toNumber(item.outputQuantity), 0),
      formatter: formatNumber,
    };
  }, [dashboard.flowComparison, metricMode]);

  const storeChartData = useMemo(
    () =>
      (dashboard.storeDistribution || []).map((item, index) => ({
        ...item,
        color: chartPalette[index % chartPalette.length],
      })),
    [dashboard.storeDistribution],
  );

  const storeDistributionTotal = useMemo(
    () => storeChartData.reduce((sum, item) => sum + toNumber(item.value), 0),
    [storeChartData],
  );

  const productColumns = useMemo(
    () => [
      {
        key: "name",
        header: "Article",
        accessor: "name",
        render: (row) => (
          <div>
            <p className="font-medium text-text-primary">{row.name || "--"}</p>
            <p className="text-xs text-text-secondary">{row.description || "Sans description"}</p>
          </div>
        ),
      },
      {
        key: "sku",
        header: "SKU",
        accessor: "sku",
        render: (row) => row.sku || "--",
      },
      {
        key: "category",
        header: "Categorie",
        accessor: "category.name",
        render: (row) => row.category?.name || "--",
      },
      {
        key: "family",
        header: "Famille",
        accessor: "family.name",
        render: (row) => row.family?.name || "--",
      },
      {
        key: "managementUnit",
        header: "Unite gestion",
        accessor: "managementUnit.name",
        render: (row) => row.managementUnit?.name || row.saleUnit?.name || "--",
      },
      {
        key: "unitPrice",
        header: "Prix",
        accessor: "unitPrice",
        render: (row) => formatMoney(row.unitPrice, row.currencyCode),
      },
      {
        key: "isActive",
        header: "Etat",
        accessor: "isActive",
        render: (row) => (
          <span
            className={[
              "inline-flex rounded-full px-3 py-1 text-xs font-medium",
              row.isActive
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger",
            ].join(" ")}
          >
            {row.isActive ? "Actif" : "Inactif"}
          </span>
        ),
      },
    ],
    [],
  );

  const productFilterSections = useMemo(() => {
    const categoryOptions = Array.from(
      new Map(
        products
          .filter((item) => item.category?.name)
          .map((item) => [item.category.name, item.category.name]),
      ).entries(),
    ).map(([value, label]) => ({ value, label }));

    const familyOptions = Array.from(
      new Map(
        products
          .filter((item) => item.family?.name)
          .map((item) => [item.family.name, item.family.name]),
      ).entries(),
    ).map(([value, label]) => ({ value, label }));

    return [
      {
        id: "category",
        label: "Categorie",
        type: "select",
        value: filters.category,
        options: [{ value: "all", label: "Toutes" }, ...categoryOptions],
      },
      {
        id: "family",
        label: "Famille",
        type: "select",
        value: filters.family,
        options: [{ value: "all", label: "Toutes" }, ...familyOptions],
      },
      {
        id: "isActive",
        label: "Etat",
        type: "select",
        value: filters.isActive,
        options: [
          { value: "all", label: "Tous" },
          { value: "true", label: "Actif" },
          { value: "false", label: "Inactif" },
        ],
      },
    ];
  }, [filters.category, filters.family, filters.isActive, products]);

  const productSortItems = useMemo(
    () => [
      { id: "name", label: "Article", accessor: "name" },
      { id: "sku", label: "SKU", accessor: "sku" },
      { id: "category.name", label: "Categorie", accessor: "category.name" },
      { id: "family.name", label: "Famille", accessor: "family.name" },
      { id: "unitPrice", label: "Prix", accessor: "unitPrice" },
      { id: "isActive", label: "Etat", accessor: "isActive" },
    ],
    [],
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    return products.filter((product) => {
      const haystack = normalizeText([
        product.name,
        product.sku,
        product.description,
        product.category?.name,
        product.family?.name,
        product.managementUnit?.name || product.saleUnit?.name,
      ].join(" "));

      if (normalizedSearch && !haystack.includes(normalizedSearch)) {
        return false;
      }

      if (filters.category !== "all" && product.category?.name !== filters.category) {
        return false;
      }

      if (filters.family !== "all" && product.family?.name !== filters.family) {
        return false;
      }

      if (filters.isActive !== "all" && String(Boolean(product.isActive)) !== filters.isActive) {
        return false;
      }

      return true;
    });
  }, [filters.category, filters.family, filters.isActive, products, search]);

  const sortedProducts = useMemo(() => {
    const accessor = sort.sortBy || "name";
    const direction = sort.sortDir === "desc" ? -1 : 1;

    return [...filteredProducts].sort((left, right) => {
      const result = compareValues(
        resolveAccessor(left, accessor),
        resolveAccessor(right, accessor),
      );
      return result * direction;
    });
  }, [filteredProducts, sort.sortBy, sort.sortDir]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return sortedProducts.slice(startIndex, startIndex + pageSize);
  }, [page, pageSize, sortedProducts]);

  const productPagination = useMemo(() => {
    const total = sortedProducts.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      page,
      pageSize,
      total,
      totalPages,
      onPageChange: (nextPage) => {
        if (nextPage < 1 || nextPage > totalPages) return;
        setPage(nextPage);
      },
      onPageSizeChange: (nextPageSize) => {
        setPageSize(nextPageSize);
        setPage(1);
      },
    };
  }, [page, pageSize, sortedProducts.length]);

  return (
    <div className="layoutSection flex flex-col gap-4">
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <span className="inline-flex rounded-full bg-header/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
              Pilotage central
            </span>
            <h2 className="mt-3 text-2xl font-semibold text-text-primary">
              Dashboard des commandes, stocks et articles
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              Vue des 3 derniers mois sur les entrees, les sorties, la repartition
              des produits par boutique et la variation du cout des marchandises
              vendues.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              to="/mouvement/entree-stock"
              className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-surface sm:w-auto"
            >
              Entrees stock
            </Link>
            <Link
              to="/configurations/articles/articles"
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 sm:w-auto"
            >
              Articles de vente
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">
                Entrees vs sorties de stock
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                Comparaison mensuelle des quantites et des valeurs sur les 3 derniers mois.
              </p>
            </div>

            <div className="inline-flex rounded-xl border border-border bg-background p-1">
              <button
                type="button"
                onClick={() => setMetricMode("quantity")}
                className={[
                  "rounded-lg px-3 py-2 text-sm font-medium transition",
                  metricMode === "quantity"
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:text-text-primary",
                ].join(" ")}
              >
                Quantite
              </button>
              <button
                type="button"
                onClick={() => setMetricMode("value")}
                className={[
                  "rounded-lg px-3 py-2 text-sm font-medium transition",
                  metricMode === "value"
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:text-text-primary",
                ].join(" ")}
              >
                Valeur
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-text-secondary">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#1D473F]" />
              Entrees: {flowChart.formatter(flowChart.entryTotal)}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#B0BBB7]" />
              Sorties: {flowChart.formatter(flowChart.outputTotal)}
            </span>
          </div>

          <div className="mt-5">
            {loading ? (
              <EmptyChartState message="Chargement des donnees de stock..." />
            ) : (
              <GroupedBarChart
                data={flowChart.data}
                valueKeyIn={flowChart.inKey}
                valueKeyOut={flowChart.outKey}
                formatter={flowChart.formatter}
              />
            )}
          </div>
        </article>

        <article className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">
                Repartition par boutique
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                Nombre de produits presents en stock par boutique.
              </p>
            </div>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
              <Boxes size={20} strokeWidth={1.8} />
            </span>
          </div>

          <div className="mt-5 flex flex-col items-center gap-5">
            {loading ? (
              <EmptyChartState message="Chargement de la repartition..." />
            ) : storeChartData.length ? (
              <>
                <DonutChart
                  data={storeChartData}
                  centerLabel="Produits"
                  centerValue={formatNumber(storeDistributionTotal)}
                />
                <div className="w-full space-y-3">
                  {storeChartData.map((item) => (
                    <div
                      key={item.storeId || item.label}
                      className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background/40 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="mt-1 h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <div>
                          <p className="font-medium text-text-primary">{item.label}</p>
                          <p className="text-xs text-text-secondary">
                            Quantite totale: {formatCompactNumber(item.quantity)}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-text-primary">
                        {formatNumber(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyChartState message="Aucune boutique avec stock disponible." />
            )}
          </div>
        </article>

        <article className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">
                Variation du cout des marchandises vendues
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                Estimation mensuelle basee sur le dernier cout unitaire d'entree disponible.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/50 px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                Total 3 mois
              </p>
              <p className="mt-1 text-xl font-semibold text-text-primary">
                {formatMoney(summary.soldCost)}
              </p>
            </div>
          </div>

          <div className="mt-5">
            {loading ? (
              <EmptyChartState message="Chargement de la variation du CMV..." />
            ) : (
              <LineChart data={dashboard.soldCostVariation || []} />
            )}
          </div>
        </article>
      </section>

      <AdminDataTable
        title="Tous les articles de vente du systeme"
        description="Catalogue complet des articles de vente avec categorie, famille, unite de vente et etat."
        columns={productColumns}
        rows={paginatedProducts}
        loading={loading}
        error=""
        emptyMessage="Aucun article de vente a afficher."
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Rechercher un article, SKU, categorie ou famille"
        filterSections={productFilterSections}
        onFilterApply={(nextFilters) => {
          setFilters(nextFilters);
          setPage(1);
        }}
        onFilterReset={(nextFilters) => {
          setFilters(nextFilters);
          setPage(1);
        }}
        sortItems={productSortItems}
        sortValue={sort}
        onSortApply={(nextSort) => {
          setSort({
            sortBy: nextSort.sortBy || "name",
            sortDir: nextSort.sortDir || "asc",
          });
          setPage(1);
        }}
        onSortReset={() => {
          setSort({ sortBy: "name", sortDir: "asc" });
          setPage(1);
        }}
        pagination={productPagination}
        enableSelection={false}
      />
    </div>
  );
}

export default Dashboard;
