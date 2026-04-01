import React from "react";

const HELP_ITEMS = [
  {
    title: "Créer une vente",
    description:
      "Accédez à la Caisse, ajoutez les produits, puis validez le paiement.",
  },
  {
    title: "Suivre les stocks",
    description:
      "Utilisez la page Produits pour contrôler les niveaux et repérer les ruptures.",
  },
  {
    title: "Gérer les réquisitions",
    description:
      "Créez et suivez les demandes d’approvisionnement depuis les rapports.",
  },
  {
    title: "Exporter les rapports",
    description:
      "Dans Rapports, cliquez sur Exporter Excel pour récupérer vos données.",
  },
];

function Help() {
  return (
    <section className="w-full h-full flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Aide</h1>
        <p className="text-sm text-text-secondary">
          Guides rapides pour utiliser POSapp.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {HELP_ITEMS.map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <p className="text-sm font-semibold text-text-primary">
              {item.title}
            </p>
            <p className="mt-2 text-xs text-text-secondary">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-text-primary">
          Besoin d’assistance ?
        </p>
        <p className="mt-2 text-xs text-text-secondary">
          Contactez votre administrateur ou l’équipe support pour un
          accompagnement personnalisé.
        </p>
      </div>
    </section>
  );
}

export default Help;
