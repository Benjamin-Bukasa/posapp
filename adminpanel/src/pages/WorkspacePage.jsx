import { Link, useLocation } from "react-router-dom";
import StatCard from "../components/ui/StatCard";
import { findRouteByPath } from "../routes/router";

const buildChecklist = (label) => [
  `Ajouter le tableau principal pour ${label.toLowerCase()}.`,
  "Connecter les filtres, badges et indicateurs aux vraies donnees.",
  "Brancher les actions metier et les droits utilisateurs.",
];

function WorkspacePage() {
  const location = useLocation();
  const currentRoute = findRouteByPath(location.pathname);
  const checklist = buildChecklist(currentRoute.name);

  return (
    <div className="layoutSection flex flex-col gap-4">
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-header/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
              {currentRoute.sectionLabel}
            </span>
            <h2 className="mt-3 text-2xl font-semibold text-text-primary">
              {currentRoute.name}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">{currentRoute.summary}</p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-text-primary"
          >
            Retour dashboard
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Etat" tone="green" value="Structure creee" />
        <StatCard label="Donnees" tone="amber" value="A brancher" />
        <StatCard label="Actions" tone="blue" value="A definir" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-text-primary">Zone de travail</h3>
            <span className="rounded-full bg-header/20 px-3 py-1 text-xs font-medium text-text-secondary">
              Placeholder
            </span>
          </div>
          <p className="text-sm text-text-secondary">
            Cette page sert de socle pour l'ecran <strong>{currentRoute.name}</strong>.
            La structure React Router est en place pour accueillir tableau,
            filtres, formulaires et vues detaillees.
          </p>
        </article>

        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-text-primary">Prochaines integrations</h3>
            <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
              A faire
            </span>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-sm text-text-secondary">
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}

export default WorkspacePage;
