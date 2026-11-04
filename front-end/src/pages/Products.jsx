import React, { useEffect, useState } from "react";
import { BadgeCheck, Boxes, PackageMinus, PackageX } from "lucide-react";
import ProductsList from "../features/ProductsList";
import StatCard from "../components/ui/statCard";
import { apiGet } from "../services/apiClient";
import useAuthStore from "../stores/authStore";
import { getProductStatistics } from "../utils/productStatistics.js";

const cards = [
  { key: "total", title: "Produits totaux", subtitle: "Articles actifs", icon: Boxes, highlight: true },
  { key: "inStock", title: "En stock", subtitle: "Quantité disponible positive", icon: BadgeCheck },
  { key: "lowStock", title: "Stock faible", subtitle: "Stock positif au seuil minimum ou en dessous", icon: PackageMinus },
  { key: "outOfStock", title: "Rupture", subtitle: "Aucune quantité disponible", icon: PackageX },
];

function Products() {
  const tenantId = useAuthStore((state) => state.user?.tenantId);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const products = await apiGet("/api/products/cashier/articles");
        const data = getProductStatistics(products);
        if (!cancelled) {
          setResult({ tenantId, data });
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setResult(null);
          setError(err.message || "Impossible de charger les statistiques.");
        }
      }
    };
    if (tenantId) refresh();
    const onFocus = () => { if (tenantId) refresh(); };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [tenantId]);

  const statistics = result?.tenantId === tenantId ? result?.data : null;

  return (
    <section className="w-full h-full flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Produits</h1>
        <p className="text-sm text-text-secondary">
          Gérez le catalogue et suivez l’état des stocks.
        </p>
      </div>
      {error ? <p role="alert" className="text-sm text-red-500">{error}</p> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy={!statistics && !error}>
        {cards.map(({ key, ...card }) => (
          <StatCard key={key} {...card} value={statistics ? statistics[key].toLocaleString("fr-FR") : "—"} />
        ))}
      </div>
      <ProductsList />
    </section>
  );
}

export default Products;
