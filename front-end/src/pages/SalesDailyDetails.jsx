import React, { useMemo } from "react";
import { Clock3, Package2, Store, UserRound } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { formatDate, formatDisplayAmount, formatName, toDisplayAmount } from "../utils/formatters";

const startOfDay = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const isToday = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= startOfDay() && date < new Date(startOfDay().getTime() + 24 * 60 * 60 * 1000);
};

const aggregateDailyDetails = (orders = [], cashSessions = []) => {
  const paidToday = orders.filter(
    (order) => order.status === "PAID" && isToday(order.createdAt),
  );

  const byStoreMap = new Map();
  const bySellerMap = new Map();
  const byProductMap = new Map();

  paidToday.forEach((order) => {
    const total = toDisplayAmount(order.total, order.currencyCode);
    const storeKey = order.store?.id || order.storeId || "unknown-store";
    const storeName = order.store?.name || order.storeName || "Boutique non definie";
    const sellerKey = order.createdBy?.id || order.createdById || "unknown-seller";
    const sellerName = order.createdBy ? formatName(order.createdBy) : "Vendeur inconnu";

    const storeBucket = byStoreMap.get(storeKey) || {
      id: storeKey,
      label: storeName,
      orders: 0,
      amount: 0,
      quantity: 0,
    };
    storeBucket.orders += 1;
    storeBucket.amount += total;

    const sellerBucket = bySellerMap.get(sellerKey) || {
      id: sellerKey,
      label: sellerName,
      store: storeName,
      orders: 0,
      amount: 0,
      quantity: 0,
    };
    sellerBucket.orders += 1;
    sellerBucket.amount += total;

    (order.items || []).forEach((item) => {
      const quantity = Number(item.quantity || 0);
      storeBucket.quantity += quantity;
      sellerBucket.quantity += quantity;

      const productKey = item.product?.id || item.productId || `${item.product?.name || "unknown-product"}`;
      const productName = item.product?.name || "Produit";
      const productBucket = byProductMap.get(productKey) || {
        id: productKey,
        label: productName,
        sku: item.product?.sku || "",
        quantity: 0,
        amount: 0,
        orders: 0,
      };
      productBucket.quantity += quantity;
      productBucket.amount += toDisplayAmount(item.total, item.currencyCode || order.currencyCode);
      productBucket.orders += 1;
      byProductMap.set(productKey, productBucket);
    });

    byStoreMap.set(storeKey, storeBucket);
    bySellerMap.set(sellerKey, sellerBucket);
  });

  const sortByAmount = (left, right) =>
    right.amount - left.amount || right.quantity - left.quantity || left.label.localeCompare(right.label);
  const sortByQuantity = (left, right) =>
    right.quantity - left.quantity || right.amount - left.amount || left.label.localeCompare(right.label);

  const openSellers = (cashSessions || [])
    .filter((session) => session.status === "OPEN")
    .sort((left, right) => new Date(left.openedAt || 0) - new Date(right.openedAt || 0))
    .map((session) => ({
      id: session.id,
      seller: session.userName || "Vendeur inconnu",
      store: session.storeName || "Boutique non definie",
      zone: session.storageZoneName || "--",
      openedAt: session.openedAt,
      expectedCash: Number(session.expectedCash || 0),
      totalCashSales: Number(session.totalCashSales || 0),
      totalNonCashSales: Number(session.totalNonCashSales || 0),
    }));

  return {
    paidTodayCount: paidToday.length,
    byStore: Array.from(byStoreMap.values()).sort(sortByAmount),
    bySeller: Array.from(bySellerMap.values()).sort(sortByAmount),
    byProduct: Array.from(byProductMap.values()).sort(sortByQuantity),
    openSellers,
  };
};

const SectionCard = ({ title, icon: Icon, children, subtitle }) => (
  <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-text-secondary">{subtitle}</p> : null}
      </div>
      {Icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background text-secondary">
          <Icon size={18} />
        </div>
      ) : null}
    </div>
    {children}
  </div>
);

const SimpleTable = ({ columns, rows, emptyMessage }) => {
  if (!rows.length) {
    return <p className="text-sm text-text-secondary">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-text-secondary">
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-2 font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border/70 text-text-primary">
              {columns.map((column) => (
                <td key={column.key} className="px-3 py-2 align-top">
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function SalesDailyDetails() {
  const { orders, cashSessions } = useOutletContext();

  const details = useMemo(
    () => aggregateDailyDetails(orders, cashSessions),
    [orders, cashSessions],
  );

  const topProduct = details.byProduct[0] || null;

  return (
    <section className="mt-4 flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-background/60 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Détail des ventes du jour
            </h2>
            <p className="text-sm text-text-secondary">
              Répartition par boutique, vendeur et produit sur la journée en cours.
            </p>
          </div>
          <div className="rounded-xl bg-surface px-4 py-3 text-sm text-text-primary shadow-sm">
            <span className="text-text-secondary">Ventes payées aujourd&apos;hui :</span>{" "}
            <strong>{details.paidTodayCount}</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard
          title="Ventes par boutique"
          subtitle="Montant et volume par point de vente aujourd'hui"
          icon={Store}
        >
          <SimpleTable
            emptyMessage="Aucune vente payée aujourd'hui."
            columns={[
              { key: "label", label: "Boutique" },
              { key: "orders", label: "Ventes" },
              { key: "quantity", label: "Qté" },
              {
                key: "amount",
                label: "Montant",
                render: (row) => formatDisplayAmount(row.amount),
              },
            ]}
            rows={details.byStore}
          />
        </SectionCard>

        <SectionCard
          title="Ventes par vendeur"
          subtitle="Suivi des performances vendeurs de la journée"
          icon={UserRound}
        >
          <SimpleTable
            emptyMessage="Aucun vendeur n'a encore enregistré de vente aujourd'hui."
            columns={[
              { key: "label", label: "Vendeur" },
              { key: "store", label: "Boutique" },
              { key: "orders", label: "Ventes" },
              {
                key: "amount",
                label: "Montant",
                render: (row) => formatDisplayAmount(row.amount),
              },
            ]}
            rows={details.bySeller}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr,0.9fr]">
        <SectionCard
          title="Ventes par produit"
          subtitle="Produits écoulés aujourd'hui, triés par quantité"
          icon={Package2}
        >
          <SimpleTable
            emptyMessage="Aucun produit vendu aujourd'hui."
            columns={[
              { key: "label", label: "Produit" },
              { key: "sku", label: "Code" },
              { key: "quantity", label: "Qté" },
              {
                key: "amount",
                label: "Montant",
                render: (row) => formatDisplayAmount(row.amount),
              },
            ]}
            rows={details.byProduct}
          />
        </SectionCard>

        <div className="flex flex-col gap-4">
          <SectionCard
            title="Produit le plus vendu"
            subtitle="Leader de la journée"
            icon={Package2}
          >
            {topProduct ? (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-text-primary">{topProduct.label}</h3>
                <p className="text-sm text-text-secondary">
                  Code: {topProduct.sku || "--"}
                </p>
                <p className="text-sm text-text-primary">
                  Quantité vendue: <strong>{topProduct.quantity}</strong>
                </p>
                <p className="text-sm text-text-primary">
                  Montant généré: <strong>{formatDisplayAmount(topProduct.amount)}</strong>
                </p>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">Aucun produit vendu aujourd&apos;hui.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Vendeurs ouverts"
            subtitle="Sessions de caisse actuellement ouvertes"
            icon={Clock3}
          >
            {details.openSellers.length ? (
              <div className="space-y-3">
                {details.openSellers.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-xl border border-border bg-background px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-text-primary">{session.seller}</p>
                        <p className="text-sm text-text-secondary">{session.store}</p>
                        <p className="text-xs text-text-secondary">
                          Zone: {session.zone} · Ouverte le {formatDate(session.openedAt)}
                        </p>
                      </div>
                      <span className="rounded-full bg-success/15 px-2 py-1 text-xs font-medium text-success">
                        Ouverte
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-text-primary sm:grid-cols-3">
                      <div>
                        <span className="text-text-secondary">Cash</span>
                        <p className="font-medium">{formatDisplayAmount(session.totalCashSales)}</p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Non cash</span>
                        <p className="font-medium">{formatDisplayAmount(session.totalNonCashSales)}</p>
                      </div>
                      <div>
                        <span className="text-text-secondary">Cash théorique</span>
                        <p className="font-medium">{formatDisplayAmount(session.expectedCash)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                Aucune caisse ouverte pour le moment.
              </p>
            )}
          </SectionCard>
        </div>
      </div>
    </section>
  );
}

export default SalesDailyDetails;
