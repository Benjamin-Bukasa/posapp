import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Save, Send } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError, requestBlob, requestJson } from "../api/client";
import SearchSelect from "../components/ui/SearchSelect";
import { findRouteByPath, getCreatePageConfig, getRouteActionPermissions } from "../routes/router";
import useAuthStore from "../stores/authStore";
import useToastStore from "../stores/toastStore";
import { hasAnyPermission } from "../utils/permissions";

const pickRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const STATUS_LABELS = {
  DRAFT: "Brouillon",
  SUBMITTED: "En validation",
  APPROVED: "Valide",
  REJECTED: "Rejete",
  CLOSED: "Cloture",
};

const statusPillClassName = (status) => {
  const normalized = String(status || "").toUpperCase();
  if (["APPROVED", "CLOSED"].includes(normalized)) {
    return "bg-success/10 text-success";
  }
  if (normalized === "REJECTED") {
    return "bg-danger/10 text-danger";
  }
  if (normalized === "SUBMITTED") {
    return "bg-warning/10 text-warning";
  }
  return "bg-header/20 text-text-secondary";
};

const renderVariance = (amount) => {
  if (amount === null || amount === undefined || amount === "") {
    return <span className="text-text-secondary">--</span>;
  }

  const value = Number(amount || 0);
  if (value === 0) {
    return (
      <span className="inline-flex rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
        Conforme
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
      {value > 0 ? `Surplus ${value}` : `Manquant ${Math.abs(value)}`}
    </span>
  );
};

const AdminInventoryCountPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const route = findRouteByPath(location.pathname);
  const pageConfig = getCreatePageConfig(location.pathname);
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const showToast = useToastStore((state) => state.showToast);
  const canAccessPage = hasAnyPermission(
    currentUser,
    pageConfig?.requiredPermissions ||
      getRouteActionPermissions("/inventaire/inventaire", "create"),
  );

  const [stores, setStores] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(currentUser?.storeId || "");
  const [selectedZoneId, setSelectedZoneId] = useState(currentUser?.defaultStorageZoneId || "");
  const [openingNote, setOpeningNote] = useState("");
  const [session, setSession] = useState(null);
  const [draftItems, setDraftItems] = useState({});
  const [search, setSearch] = useState("");
  const [onlyDiscrepancies, setOnlyDiscrepancies] = useState(false);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState("");

  const handleUnauthorized = useCallback(async () => {
    await logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

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

  const loadLookupData = useCallback(async () => {
    if (!accessToken) return;

    try {
      const [storesPayload, zonesPayload] = await Promise.all([
        requestJson("/api/stores", { token: accessToken }),
        requestJson("/api/storage-zones", { token: accessToken }),
      ]);

      const nextStores = pickRows(storesPayload);
      const nextZones = pickRows(zonesPayload);
      setStores(nextStores);
      setZones(nextZones);

      if (!selectedStoreId && currentUser?.storeId) {
        setSelectedStoreId(currentUser.storeId);
      }

      if (!selectedZoneId && currentUser?.defaultStorageZoneId) {
        setSelectedZoneId(currentUser.defaultStorageZoneId);
      }

      if (!selectedZoneId && nextZones.length === 1) {
        setSelectedZoneId(nextZones[0].id);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await handleUnauthorized();
        return;
      }

      showToast({
        title: "Erreur",
        message: error.message || "Impossible de charger les zones de stockage.",
        variant: "danger",
      });
    }
  }, [
    accessToken,
    currentUser?.defaultStorageZoneId,
    currentUser?.storeId,
    handleUnauthorized,
    selectedStoreId,
    selectedZoneId,
    showToast,
  ]);

  const loadSession = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await requestJson("/api/inventory/sessions/current", {
        token: accessToken,
      });
      setSession(data);
      hydrateDrafts(data);
      if (data?.storeId) {
        setSelectedStoreId(data.storeId);
      }
      if (data?.storageZoneId) {
        setSelectedZoneId(data.storageZoneId);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setSession(null);
        setDraftItems({});
        return;
      }

      if (error instanceof ApiError && error.status === 401) {
        await handleUnauthorized();
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
  }, [accessToken, handleUnauthorized, hydrateDrafts, showToast]);

  useEffect(() => {
    if (!canAccessPage) {
      setLoading(false);
      return;
    }

    loadLookupData();
    loadSession();
  }, [canAccessPage, loadLookupData, loadSession]);

  const zoneOptions = useMemo(() => {
    const filtered = selectedStoreId
      ? zones.filter((zone) => String(zone.storeId || zone.store?.id || "") === String(selectedStoreId))
      : zones;

    return filtered.map((zone) => ({
      value: zone.id,
      label: zone.store?.name ? `${zone.name} - ${zone.store.name}` : zone.name,
    }));
  }, [selectedStoreId, zones]);

  const storeOptions = useMemo(
    () =>
      stores.map((store) => ({
        value: store.id,
        label: store.name,
      })),
    [stores],
  );

  useEffect(() => {
    if (!selectedZoneId) return;
    const exists = zoneOptions.some((option) => String(option.value) === String(selectedZoneId));
    if (!exists) {
      setSelectedZoneId("");
    }
  }, [selectedZoneId, zoneOptions]);

  const canCount = ["DRAFT", "REJECTED"].includes(session?.status);

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

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    let rows = session?.items || [];

    if (onlyDiscrepancies) {
      rows = rows.filter((row) => Number(row.varianceQuantity || 0) !== 0);
    }

    if (!keyword) return rows;

    return rows.filter((row) =>
      [row.product?.name, row.product?.sku, row.batchNumber, row.note]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [onlyDiscrepancies, search, session?.items]);

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
    if (!selectedStoreId || !selectedZoneId) {
      showToast({
        title: "Zone requise",
        message: "Selectionnez une boutique et une zone de stockage a inventorier.",
        variant: "warning",
      });
      return;
    }

    setOpening(true);
    try {
      const created = await requestJson("/api/inventory/sessions", {
        token: accessToken,
        method: "POST",
        body: {
          storeId: selectedStoreId,
          storageZoneId: selectedZoneId,
          note: openingNote || undefined,
        },
      });
      setSession(created);
      hydrateDrafts(created);
      showToast({
        title: "Inventaire ouvert",
        message: "La session d'inventaire a ete creee pour la zone selectionnee.",
        variant: "success",
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await handleUnauthorized();
        return;
      }

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
      const updated = await requestJson(`/api/inventory/sessions/${session.id}/counts`, {
        token: accessToken,
        method: "PATCH",
        body: { items: buildCountPayload() },
      });
      setSession(updated);
      hydrateDrafts(updated);
      showToast({
        title: "Comptage enregistre",
        message: "Les quantites physiques ont ete sauvegardees.",
        variant: "success",
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await handleUnauthorized();
        return;
      }

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
      const saved = await requestJson(`/api/inventory/sessions/${session.id}/counts`, {
        token: accessToken,
        method: "PATCH",
        body: { items: buildCountPayload() },
      });
      const submitted = await requestJson(`/api/inventory/sessions/${session.id}/submit`, {
        token: accessToken,
        method: "POST",
      });
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
      if (error instanceof ApiError && error.status === 401) {
        await handleUnauthorized();
        return;
      }

      showToast({
        title: "Erreur",
        message: error.message || "Impossible de soumettre l'inventaire.",
        variant: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  };

  const handleExport = async (format) => {
    if (!session?.id || !accessToken) return;

    setExporting(format);
    try {
      const blob = await requestBlob(
        `/api/inventory/sessions/${session.id}/export?export=${format}`,
        { token: accessToken },
      );
      const baseName = session.code || `inventaire-${session.id}`;
      downloadBlob(blob, `${baseName}.${format === "pdf" ? "pdf" : "xlsx"}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await handleUnauthorized();
        return;
      }

      showToast({
        title: "Erreur",
        message: error.message || "Impossible d'exporter cet inventaire.",
        variant: "danger",
      });
    } finally {
      setExporting("");
    }
  };

  if (!canAccessPage) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm font-medium text-danger">
          Vous n'avez pas la permission d'acceder a cette page.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
              {route.sectionLabel || "Inventaire"}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-text-primary">
              {pageConfig?.title || "Faire l'inventaire"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Selectionnez une zone de stockage, chargez les quantites systeme puis
              saisissez les quantites physiques pour calculer automatiquement les ecarts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/inventaire/inventaire"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-background"
            >
              <ArrowLeft size={16} />
              Retour a la liste
            </Link>
            {session ? (
              <>
                <Link
                  to={`/inventaire/inventaire/detail?id=${session.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-background"
                >
                  Aller au detail workflow
                </Link>
                <button
                  type="button"
                  onClick={() => handleExport("xlsx")}
                  disabled={Boolean(exporting)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download size={16} />
                  {exporting === "xlsx" ? "Export XLSX..." : "Exporter XLSX"}
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("pdf")}
                  disabled={Boolean(exporting)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download size={16} />
                  {exporting === "pdf" ? "Export PDF..." : "Exporter PDF"}
                </button>
              </>
            ) : null}
            {session && canCount ? (
              <>
                <button
                  type="button"
                  onClick={handleSaveCounts}
                  disabled={saving || submitting}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={handleSubmitInventory}
                  disabled={saving || submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={16} />
                  {submitting ? "Soumission..." : "Soumettre"}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {!session ? (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-primary">
                Boutique
              </label>
              <SearchSelect
                name="storeId"
                value={selectedStoreId}
                onChange={setSelectedStoreId}
                options={storeOptions}
                required
                placeholder="Rechercher une boutique..."
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-primary">
                Zone de stockage
              </label>
              <SearchSelect
                name="storageZoneId"
                value={selectedZoneId}
                onChange={setSelectedZoneId}
                options={zoneOptions}
                required
                placeholder="Rechercher une zone..."
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label className="block text-sm font-medium text-text-primary">
              Note d'ouverture
            </label>
            <textarea
              rows={4}
              value={openingNote}
              onChange={(event) => setOpeningNote(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-secondary"
              placeholder="Commentaire d'inventaire"
            />
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleOpenInventory}
              disabled={opening || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {opening ? "Ouverture..." : "Ouvrir l'inventaire"}
            </button>
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
              <span
                className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusPillClassName(
                  session.status,
                )}`}
              >
                {STATUS_LABELS[session.status] || session.status}
              </span>
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
                {[
                  session.requestedBy?.firstName,
                  session.requestedBy?.lastName,
                ]
                  .filter(Boolean)
                  .join(" ") || session.requestedBy?.email || "--"}
              </p>
            </article>
          </section>

          {session.note ? (
            <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-text-secondary">Note</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-text-primary">
                {session.note}
              </p>
            </section>
          ) : null}

          {!canCount ? (
            <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-text-secondary">
                Cet inventaire est en lecture seule. Les ecarts ont deja ete soumis
                dans le workflow de validation.
              </p>
            </section>
          ) : null}

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  Lignes d'inventaire
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Quantite systeme, quantite physique et ecart par produit et par lot.
                </p>
              </div>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un produit ou un lot..."
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-secondary lg:max-w-xs"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-3 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={onlyDiscrepancies}
                  onChange={(event) => setOnlyDiscrepancies(event.target.checked)}
                  className="h-4 w-4 rounded border-border text-secondary accent-secondary"
                />
                Afficher seulement les ecarts
              </label>
              <span className="text-sm text-text-secondary">
                {filteredItems.length} ligne(s) affichee(s)
              </span>
            </div>

            <div className="mt-4 overflow-auto rounded-xl border border-border">
              <table className="min-w-[920px] w-full border-collapse text-sm xl:min-w-full">
                <thead className="bg-header dark:bg-secondary">
                  <tr>
                    <th className="border-b border-border px-4 py-3 text-left font-medium text-text-primary">
                      Produit
                    </th>
                    <th className="border-b border-border px-4 py-3 text-left font-medium text-text-primary">
                      Qte systeme
                    </th>
                    <th className="border-b border-border px-4 py-3 text-left font-medium text-text-primary">
                      Lot
                    </th>
                    <th className="border-b border-border px-4 py-3 text-left font-medium text-text-primary">
                      Expiration
                    </th>
                    <th className="border-b border-border px-4 py-3 text-left font-medium text-text-primary">
                      Qte physique
                    </th>
                    <th className="border-b border-border px-4 py-3 text-left font-medium text-text-primary">
                      Ecart
                    </th>
                    <th className="border-b border-border px-4 py-3 text-left font-medium text-text-primary">
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length ? (
                    filteredItems.map((row) => {
                      const draft = draftItems[row.id] || {};
                      const draftValue = draft.physicalQuantity;
                      const computedVariance =
                        draftValue === "" || draftValue === undefined
                          ? row.varianceQuantity
                          : Number(draftValue || 0) - Number(row.systemQuantity || 0);

                      return (
                        <tr key={row.id} className="border-b border-border">
                          <td className="px-4 py-3 text-text-primary">
                            <div className="flex flex-col">
                              <span className="font-medium">{row.product?.name || "--"}</span>
                              <span className="text-xs text-text-secondary">
                                {row.product?.sku || "--"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-text-primary">
                            {Number(row.systemQuantity || 0)}
                          </td>
                          <td className="px-4 py-3 text-text-primary">
                            {row.batchNumber || "Sans lot"}
                          </td>
                          <td className="px-4 py-3 text-text-primary">
                            {row.expiryDate
                              ? new Intl.DateTimeFormat("fr-FR", {
                                  dateStyle: "medium",
                                }).format(new Date(row.expiryDate))
                              : "--"}
                          </td>
                          <td className="px-4 py-3 text-text-primary">
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              disabled={!canCount}
                              value={draft.physicalQuantity ?? ""}
                              onChange={(event) =>
                                setDraftItems((current) => ({
                                  ...current,
                                  [row.id]: {
                                    ...(current[row.id] || {}),
                                    physicalQuantity: event.target.value,
                                  },
                                }))
                              }
                              className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none transition focus:border-secondary disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </td>
                          <td className="px-4 py-3 text-text-primary">
                            {renderVariance(computedVariance)}
                          </td>
                          <td className="px-4 py-3 text-text-primary">
                            <input
                              type="text"
                              disabled={!canCount}
                              value={draft.note ?? ""}
                              onChange={(event) =>
                                setDraftItems((current) => ({
                                  ...current,
                                  [row.id]: {
                                    ...(current[row.id] || {}),
                                    note: event.target.value,
                                  },
                                }))
                              }
                              className="min-w-44 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none transition focus:border-secondary disabled:cursor-not-allowed disabled:opacity-60"
                              placeholder="Observation"
                            />
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-6 text-center text-sm text-text-secondary"
                      >
                        {loading
                          ? "Chargement..."
                          : "Aucune ligne d'inventaire disponible pour cette zone."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default AdminInventoryCountPage;
