import React from "react";
import {
  BadgeCheck,
  Boxes,
  PackageMinus,
  PackageX,
} from "lucide-react";
import ProductsList from "../features/ProductsList";
import StatCard from "../components/ui/statCard";

const productCards = [
  {
    title: "Produits totaux",
    value: "1 240",
    subtitle: "Références actives",
    icon: Boxes,
    change: 2.4,
    highlight: true,
    amountLabel: "Valeur estimée",
    amountValue: "$48 200",
  },
  {
    title: "En stock",
    value: "980",
    subtitle: "Disponibles",
    icon: BadgeCheck,
    change: 1.6,
    amountLabel: "Articles vendables",
    amountValue: "79%",
  },
  {
    title: "Stock faible",
    value: "180",
    subtitle: "À réapprovisionner",
    icon: PackageMinus,
    change: -0.8,
    amountLabel: "Alertes",
    amountValue: "23",
  },
  {
    title: "Rupture",
    value: "80",
    subtitle: "Indisponibles",
    icon: PackageX,
    change: -1.4,
    amountLabel: "Perte estimée",
    amountValue: "$2 100",
  },
];

function Products() {
  return (
    <section className="w-full h-full flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Produits</h1>
        <p className="text-sm text-text-secondary">
          Gérez le catalogue et suivez l’état des stocks.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {productCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <ProductsList />
    </section>
  );
}

export default Products;
