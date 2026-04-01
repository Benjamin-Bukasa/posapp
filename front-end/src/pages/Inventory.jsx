import React, { useCallback, useEffect, useMemo, useState } from "react";
import Badge from "../components/ui/badge";
import Button from "../components/ui/button";
import DataTable from "../components/ui/datatable";
import useToastStore from "../stores/toastStore";
import useAuthStore from "../stores/authStore";
import { apiGet, apiPatch, apiPost } from "../services/apiClient";
import { formatDate } from "../utils/formatters";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import useSyncedQuerySearch from "../hooks/useSyncedQuerySearch";

const STATUS_LABELS = {
  DRAFT: "Brouillon",
  SUBMITTED: "En validation",
  APPROVED: "Valide",
  REJECTED: "Rejete",
  CLOSED: "Cloture",
};

const formatDateOnly = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(date);
};

const statusVariant = (status) => {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "APPROVED" || normalized === "CLOSED") return "success";
  if (normalized === "REJECTED") return "danger";
  if (normalized === "SUBMITTED") return "warning";
  return "neutral";
};

const varianceBadge = (value) => {
  if (value === null || value === undefined) {
    return <Badge label="Non compte" variant="neutral" />;
  }

  const amount = Number(value || 0);
  if (amount === 0) {
    return <Badge label="Conforme" variant="success" />;
  }

  return (
    <Badge
      label={amount > 0 ? `Surplus ${amount}` : `Manquant ${Math.abs(amount)}`}
      variant="warning"
    />
  );
};

const Inventory = () => {
  const refreshTick = useRealtimeRefetch([
    "inventory:session:created",
    "inventory:session:updated",
    "inventory:session:submitted",
    "inventory:session:approved",
    "inventory:session:rejected",
    "inventory:session:closed",
  ]);
  const showToast = useToastStore((state) => state.showToast);
  const user = useAuthStore((state) => state.user);
  const [session, setSession] = useState(null);
  const [draftItems, setDraftItems] = useState({});
  const [openingNote, setOpeningNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useSyncedQuerySearch("q");

  const hydrateDrafts = useCallback((nextSession) => {
    const nextDrafts = {};
    (nextSession?.items || []).forEach((item) => {
      nextDrafts[item.id] = {
        physicalQuantity:
          item.physicalQuantity === null || item.physicalQuantity === undefined
            ? ""
            : String(item.physicalQuantity),
        note: item.note || "",
      };
    });
    setDraftItems(nextDrafts);
  }, []);

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet("/api/inventory/sessions/current");
      setSession(data);
      hydrateDrafts(data);
    } catch (error) {
      if (error.status === 404) {
        setSession(null);
        setDraftItems({});
        return;
      }
      showToast({
        title: "Erreur",
        message: error.message || "Impossible de charger l'inventaire actif.",
        variant: "danger",
      });
    } finally {
      setLoading(false);
    }
  }, [hydrateDrafts, showToast]);

  useEffect(() => {
    loadSession();
  }, [loadSession, refreshTick]);

  const canCount = ["DRAFT", "REJECTED"].includes(session?.status);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const rows = session?.items || [];
    if (!keyword) return rows;

    return rows.filter((row) =>
      [row.product?.name, row.product?.sku, row.batchNumber, row.note]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [search, session?.items]);

  const summary = useMemo(() => {
    const rows = session?.items || [];
    const countedRows = rows.filter((row) => row.physicalQuantity !== null).length;
    const discrepancies = rows.filter(
      (row) =>
        row.physicalQuantity !== null &&
        Number(row.varianceQuantity || 0) !== 0,
    ).length;

    return {
      totalRows: rows.length,
      countedRows,
      discrepancies,
    };
  }, [session?.items]);

  const buildCountPayload = useCallback(() => {
    return (session?.items || []).map((item) => {
      const draft = draftItems[item.id] || {};
      const rawPhysical = draft.physicalQuantity;
      return {
        itemId: item.id,
        physicalQuantity:
          rawPhysical === "" || rawPhysical === null || rawPhysical === undefined
            ? null
            : Number(rawPhysical),
        note: draft.note || "",
      };
    });
  }, [draftItems, session?.items]);

  const handleOpenInventory = async () => {
    setOpening(true);
    try {
      const created = await apiPost("/api/inventory/sessions", {
        note: openingNote || undefined,
      });
      setSession(created);
      hydrateDrafts(created);
      setOpeningNote("");
      showToast({
        title: "Inventaire ouvert",
        message: "La session d'inventaire a ete creee.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        title: "Erreur",
        message: error.message || "Impossible d'ouvrir l'inventaire.",
        variant: "danger",
      });
    } finally {
      setOpening(false);
    }
  };

  const handleSaveCounts = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const updated = await apiPatch(`/api/inventory/sessions/${session.id}/counts`, {
        items: buildCountPayload(),
      });
      setSession(updated);
      hydrateDrafts(updated);
      showToast({
        title: "Comptage enregistre",
        message: "Les quantites physiques ont ete sauvegardees.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        title: "Erreur",
        message: error.message || "Impossible d'enregistrer le comptage.",
        variant: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitInventory = async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      const saved = await apiPatch(`/api/inventory/sessions/${session.id}/counts`, {
        items: buildCountPayload(),
      });
      const submitted = await apiPost(`/api/inventory/sessions/${session.id}/submit`);
      setSession(submitted);
      hydrateDrafts(submitted);
      showToast({
        title: "Inventaire soumis",
        message:
          saved?.id === submitted?.id
            ? "Le comptage a ete soumis a validation."
            : "L'inventaire a ete soumis a validation.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        title: "Erreur",
        message: error.message || "Impossible de soumettre l'inventaire.",
        variant: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        header: "Produit",
        accessor: "product",
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-medium text-text-primary">{row.product?.name || "N/A"}</span>
            <span className="text-xs text-text-secondary">{row.product?.sku || "--"}</span>
          </div>
        ),
      },
      {
        header: "Qte systeme",
        accessor: "systemQuantity",
        render: (row) => Number(row.systemQuantity || 0),
      },
      {
        header: "Lot",
        accessor: "batchNumber",
        render: (row) => row.batchNumber || "Sans lot",
      },
      {
        header: "Expiration",
        accessor: "expiryDate",
        render: (row) => formatDateOnly(row.expiryDate),
      },
      {
        header: "Qte physique",
        accessor: "physicalQuantity",
        render: (row) => (
          <input
            type="number"
            min="0"
            step="0.0001"
            disabled={!canCount}
            value={draftItems[row.id]?.physicalQuantity ?? ""}
            onChange={(event) =>
              setDraftItems((current) => ({
                ...current,
                [row.id]: {
                  ...(current[row.id] || {}),
                  physicalQuantity: event.target.value,
                },
              }))
            }
            className="w-28 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
          />
        ),
      },
      {
        header: "Ecart",
        accessor: "varianceQuantity",
        render: (row) => {
          const draftValue = draftItems[row.id]?.physicalQuantity;
          const computed =
            draftValue === "" || draftValue === undefined
              ? row.varianceQuantity
              : Number(draftValue || 0) - Number(row.systemQuantity || 0);
          return varianceBadge(computed);
        },
      },
      {
        header: "Note",
        accessor: "note",
        render: (row) => (
          <input
            type="text"
            disabled={!canCount}
            value={draftItems[row.id]?.note ?? ""}
            onChange={(event) =>
              setDraftItems((current) => ({
                ...current,
                [row.id]: {
                  ...(current[row.id] || {}),
                  note: event.target.value,
                },
              }))
            }
            className="w-full min-w-40 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="Observation"
          />
        ),
      },
    ],
    [canCount, draftItems],
  );

  return (
    <section className="w-full h-full flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Inventaire</h1>
          <p className="text-sm text-text-secondary">
            Comptage physique du stock et validation des ecarts.
          </p>
        </div>
        {session ? (
          <div className="flex flex-wrap gap-2">
            {canCount ? (
              <>
                <Button
                  type="button"
                  label={saving ? "Enregistrement..." : "Enregistrer le comptage"}
                  variant="default"
                  size="small"
                  onClick={handleSaveCounts}
                  disabled={saving || submitting}
                />
                <Button
                  type="button"
                  label={submitting ? "Soumission..." : "Soumettre a validation"}
                  variant="primary"
                  size="small"
                  onClick={handleSubmitInventory}
                  disabled={saving || submitting}
                />
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {!session ? (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Aucun inventaire actif
              </h2>
              <p className="text-sm text-text-secondary">
                Un seul inventaire peut etre actif a la fois. Ouvrez une session pour
                charger toutes les quantites systeme du stock courant.
              </p>
            </div>

            <textarea
              rows={4}
              value={openingNote}
              onChange={(event) => setOpeningNote(event.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
              placeholder="Note d'ouverture de l'inventaire"
            />

            <div className="flex justify-end">
              <Button
                type="button"
                label={opening ? "Ouverture..." : "Ouvrir l'inventaire"}
                variant="primary"
                size="small"
                onClick={handleOpenInventory}
                disabled={opening || loading || !user?.storeId}
              />
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-4">
            <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-text-secondary">Reference</p>
              <p className="mt-2 text-lg font-semibold text-text-primary">
                {session.code || session.id}
              </p>
              <p className="mt-2">
                <Badge
                  label={STATUS_LABELS[session.status] || session.status}
                  variant={statusVariant(session.status)}
                />
              </p>
            </article>
            <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-text-secondary">Boutique / zone</p>
              <p className="mt-2 text-base font-semibold text-text-primary">
                {session.store?.name || "--"}
              </p>
              <p className="text-sm text-text-secondary">
                {session.storageZone?.name || "--"}
              </p>
            </article>
            <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-text-secondary">Progression</p>
              <p className="mt-2 text-base font-semibold text-text-primary">
                {summary.countedRows}/{summary.totalRows} comptes
              </p>
              <p className="text-sm text-text-secondary">
                {summary.discrepancies} ligne(s) avec ecart
              </p>
            </article>
            <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-text-secondary">Ouverture</p>
              <p className="mt-2 text-base font-semibold text-text-primary">
                {formatDate(session.createdAt)}
              </p>
              <p className="text-sm text-text-secondary">
                {session.requestedBy
                  ? `${session.requestedBy.firstName || ""} ${session.requestedBy.lastName || ""}`.trim()
                  : "--"}
              </p>
            </article>
          </section>

          {session.note ? (
            <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-text-secondary">Note</p>
              <p className="mt-2 text-sm text-text-primary whitespace-pre-wrap">
                {session.note}
              </p>
            </section>
          ) : null}

          {!canCount ? (
            <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-text-secondary">
                Cet inventaire est en lecture seule. Le comptage est termine et suit
                maintenant le circuit de validation.
              </p>
            </section>
          ) : null}

          <DataTable
            title="Lignes d'inventaire"
            description="Toutes les quantites systeme sont chargees automatiquement. Saisissez la quantite physique comptee pour calculer l'ecart."
            columns={columns}
            data={filteredItems}
            emptyMessage={loading ? "Chargement..." : "Aucune ligne d'inventaire"}
            enableSelection={false}
            searchInput={{
              name: "search",
              value: search,
              onChange: setSearch,
              placeholder: "Rechercher un produit...",
              type: "text",
            }}
          />

          <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-text-primary">
              Historique de validation
            </h2>
            <div className="mt-4 overflow-auto rounded-xl border border-border">
              <table className="min-w-[640px] w-full border-collapse text-sm xl:min-w-full">
                <thead className="bg-header dark:bg-secondary">
                  <tr>
                    <th className="border-b border-border px-4 py-3 text-left font-medium text-text-primary">
                      Niveau
                    </th>
                    <th className="border-b border-border px-4 py-3 text-left font-medium text-text-primary">
                      Role
                    </th>
                    <th className="border-b border-border px-4 py-3 text-left font-medium text-text-primary">
                      Statut
                    </th>
                    <th className="border-b border-border px-4 py-3 text-left font-medium text-text-primary">
                      Decision
                    </th>
                    <th className="border-b border-border px-4 py-3 text-left font-medium text-text-primary">
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(session.approvals || []).length ? (
                    session.approvals.map((approval) => (
                      <tr key={approval.id} className="border-b border-border">
                        <td className="px-4 py-3 text-text-primary">{approval.stepOrder}</td>
                        <td className="px-4 py-3 text-text-primary">
                          {approval.approverRole || "--"}
                        </td>
                        <td className="px-4 py-3 text-text-primary">
                          <Badge
                            label={STATUS_LABELS[approval.status] || approval.status}
                            variant={statusVariant(approval.status)}
                          />
                        </td>
                        <td className="px-4 py-3 text-text-primary">
                          {formatDate(approval.decidedAt)}
                        </td>
                        <td className="px-4 py-3 text-text-primary">{approval.note || "--"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-sm text-text-secondary"
                      >
                        Aucun niveau de validation configure.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </section>
  );
};

export default Inventory;
