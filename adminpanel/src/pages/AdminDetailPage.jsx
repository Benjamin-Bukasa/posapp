import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Pencil,
  Send,
  Upload,
  XCircle,
} from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, requestBlob, requestJson } from "../api/client";
import {
  findRouteByPath,
  getDetailPageConfig,
  getRouteActionPermissions,
} from "../routes/router";
import useAuthStore from "../stores/authStore";
import useCurrencyStore from "../stores/currencyStore";
import useToastStore from "../stores/toastStore";
import { formatMoney } from "../utils/currencyDisplay";
import { hasAnyPermission } from "../utils/permissions";

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const toNumber = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const formatPerson = (person) =>
  [person?.firstName, person?.lastName].filter(Boolean).join(" ") ||
  person?.email ||
  "--";

const statusLabels = {
  DRAFT: "Non valide",
  SUBMITTED: "En cours",
  APPROVED: "Valide",
  SENT: "Valide",
  ORDERED: "Commande creee",
  PENDING: "En attente",
  POSTED: "Comptabilise",
  REJECTED: "Rejete",
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
};

const pillTone = (value = "") => {
  const normalized = String(value).toUpperCase();

  if (
    [
      "APPROVED",
      "PAID",
      "RECEIVED",
      "POSTED",
      "COMPLETED",
      "ACTIVE",
      "TRUE",
    ].includes(normalized)
  ) {
    return "bg-success/10 text-success";
  }

  if (["PENDING", "DRAFT", "SUBMITTED", "SENT", "PARTIAL"].includes(normalized)) {
    return "bg-warning/10 text-warning";
  }

  if (["REJECTED", "INACTIVE", "FALSE", "CANCELED"].includes(normalized)) {
    return "bg-danger/10 text-danger";
  }

  return "bg-header/20 text-text-secondary";
};

const renderPill = (value) => (
  <span
    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${pillTone(
      value,
    )}`}
  >
    {statusLabels[value] || value || "--"}
  </span>
);

const DetailSection = ({ title, children }) => (
  <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
    <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
    <div className="mt-4">{children}</div>
  </section>
);

const DetailList = ({ items = [] }) => (
  <dl className="grid gap-3 text-sm">
    {items.map((item) => (
      <div
        key={item.label}
        className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
      >
        <dt className="text-text-secondary">{item.label}</dt>
        <dd className="max-w-full text-left font-medium text-text-primary sm:max-w-[60%] sm:text-right">
          {item.render ? item.render(item.value) : item.value || "--"}
        </dd>
      </div>
    ))}
  </dl>
);

const DataTable = ({ columns = [], rows = [], emptyMessage = "Aucune donnee." }) => (
  <div className="overflow-auto rounded-xl border border-border">
    <table className="min-w-[640px] w-full border-collapse text-sm xl:min-w-full">
      <thead className="bg-[#b0bbb7] dark:bg-[#1D473F]">
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              className="border-b border-border px-4 py-3 text-left font-medium text-text-primary"
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((row, index) => (
            <tr key={row.id || index} className="border-b border-border">
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3 text-text-primary">
                  {column.render ? column.render(row, index) : row[column.key] || "--"}
                </td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td
              colSpan={columns.length}
              className="px-4 py-6 text-center text-sm text-text-secondary"
            >
              {emptyMessage}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const approvalColumns = [
  { key: "stepOrder", label: "Niveau" },
  { key: "approverRole", label: "Role" },
  {
    key: "status",
    label: "Statut",
    render: (row) => renderPill(row.status),
  },
  {
    key: "decidedAt",
    label: "Decision",
    render: (row) => formatDate(row.decidedAt),
  },
  {
    key: "note",
    label: "Note",
    render: (row) => row.note || "--",
  },
];

const approvalItemsColumns = [
  {
    key: "product",
    label: "Produit",
    render: (row) => row.product?.name || "--",
  },
  {
    key: "unit",
    label: "Unite",
    render: (row) => row.unit?.symbol || row.unit?.name || "--",
  },
  {
    key: "quantity",
    label: "Quantite",
    render: (row) => toNumber(row.quantity),
  },
  {
    key: "note",
    label: "Note",
    render: (row) => row.note || "--",
  },
];

const purchaseOrderItemsColumns = [
  {
    key: "product",
    label: "Produit",
    render: (row) => row.product?.name || "--",
  },
  {
    key: "unit",
    label: "Unite",
    render: (row) => row.unit?.symbol || row.unit?.name || "--",
  },
  {
    key: "quantity",
    label: "Quantite",
    render: (row) => toNumber(row.quantity),
  },
  {
    key: "unitPrice",
    label: "Prix unitaire",
    render: (row) => formatMoney(row.unitPrice, row.currencyCode),
  },
  {
    key: "lineTotal",
    label: "Total ligne",
    render: (row) =>
      formatMoney(
        toNumber(row.quantity) * toNumber(row.unitPrice),
        row.currencyCode,
      ),
  },
];

const stockEntryItemsColumns = [
  {
    key: "product",
    label: "Produit",
    render: (row) => row.product?.name || "--",
  },
  {
    key: "unit",
    label: "Unite",
    render: (row) => row.unit?.symbol || row.unit?.name || "--",
  },
  {
    key: "quantity",
    label: "Quantite",
    render: (row) => toNumber(row.quantity),
  },
  {
    key: "unitCost",
    label: "Cout unitaire",
    render: (row) => formatMoney(row.unitCost, row.currencyCode),
  },
  {
    key: "lineTotal",
    label: "Total ligne",
    render: (row) =>
      formatMoney(
        toNumber(row.quantity) * toNumber(row.unitCost),
        row.currencyCode,
      ),
  },
];

const deliveryNoteColumns = [
  {
    key: "code",
    label: "Bon de reception",
    render: (row) => row.code || "--",
  },
  {
    key: "status",
    label: "Statut",
    render: (row) => renderPill(row.status),
  },
  {
    key: "receivedAt",
    label: "Reception",
    render: (row) => formatDate(row.receivedAt || row.createdAt),
  },
  {
    key: "note",
    label: "Note",
    render: (row) => row.note || "--",
  },
];

const approvalBaseByResource = {
  "/commande/demande-achat": "/api/purchase-requests",
  "/commande/requisitions": "/api/supply-requests",
};

const referencePrefixByKind = {
  "approval-request": "DOC",
  "purchase-order": "PO",
  "stock-entry": "SE",
};

const AdminDetailPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentRoute = findRouteByPath(location.pathname);
  const detailConfig = getDetailPageConfig(location.pathname);
  useCurrencyStore((state) => state.settings.primaryCurrencyCode);
  const recordId = searchParams.get("id") || "";
  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);
  const currentUser = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.showToast);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [pendingAction, setPendingAction] = useState("");

  const detailKind = detailConfig?.detailKind || null;
  const canAccessPage = hasAnyPermission(
    currentUser,
    detailConfig?.detailPermissions ||
      detailConfig?.requiredPermissions ||
      getRouteActionPermissions(detailConfig?.resourcePath || currentRoute.path, "detail"),
  );
  const isApprovalRequest = detailKind === "approval-request";
  const isPurchaseOrder = detailKind === "purchase-order";
  const isStockEntry = detailKind === "stock-entry";
  const approvalBase = approvalBaseByResource[detailConfig?.resourcePath] || null;
  const isAdminUser = ["SUPERADMIN", "ADMIN"].includes(currentUser?.role);
  const isSuperAdmin = currentUser?.role === "SUPERADMIN";
  const referencePrefix = useMemo(() => {
    if (detailConfig?.resourcePath === "/commande/demande-achat") return "PR";
    if (detailConfig?.resourcePath === "/commande/requisitions") return "REQ";
    return referencePrefixByKind[detailKind] || "DOC";
  }, [detailConfig?.resourcePath, detailKind]);

  const loadRecord = useCallback(async () => {
    if (!detailConfig || !recordId) {
      setError("Identifiant manquant.");
      setLoading(false);
      return;
    }

    if (!accessToken) {
      setError("Session manquante.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = await requestJson(detailConfig.detailEndpoint(recordId), {
        token: accessToken,
      });
      setRecord(payload);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }

      setError(requestError.message || "Impossible de charger le detail.");
      setRecord(null);
      showToast({
        title: "Erreur",
        message: requestError.message || "Impossible de charger le detail.",
        variant: "danger",
      });
    } finally {
      setLoading(false);
    }
  }, [accessToken, detailConfig, logout, navigate, recordId, showToast]);

  useEffect(() => {
    if (!canAccessPage) {
      setLoading(false);
      setError("");
      return undefined;
    }
    loadRecord();
  }, [canAccessPage, loadRecord]);

  const currentApproval = useMemo(() => {
    if (!isApprovalRequest) return null;

    return (
      (record?.approvals || [])
        .filter((approval) => approval.status === "PENDING")
        .sort((left, right) => (left.stepOrder || 0) - (right.stepOrder || 0))[0] ||
      null
    );
  }, [isApprovalRequest, record?.approvals]);

  const canDecideApproval = useMemo(() => {
    if (!isApprovalRequest || !currentApproval || !currentUser) return false;

    return (
      (currentApproval.approverId && currentApproval.approverId === currentUser.id) ||
      (currentApproval.approverRole &&
        currentApproval.approverRole === currentUser.role)
    );
  }, [currentApproval, currentUser, isApprovalRequest]);

  const canEdit =
    detailConfig?.canEdit?.(record) &&
    hasAnyPermission(
      currentUser,
      detailConfig?.editPermissions ||
        getRouteActionPermissions(detailConfig?.resourcePath || currentRoute.path, "edit"),
    );
  const canSendPurchaseOrder = isPurchaseOrder && record?.status === "DRAFT" && isAdminUser;
  const canApproveStockEntry =
    isStockEntry &&
    record?.sourceType === "DIRECT" &&
    record?.status === "PENDING" &&
    isSuperAdmin;
  const canPostStockEntry =
    isStockEntry && record?.status === "APPROVED" && isAdminUser;

  const runAction = async ({ key, endpoint, body, successMessage }) => {
    if (!recordId || !accessToken) {
      setError("Session ou document manquant.");
      return;
    }

    setPendingAction(key);
    setError("");
    setSuccess("");

    try {
      await requestJson(endpoint, {
        token: accessToken,
        method: "POST",
        body,
      });
      setSuccess(successMessage);
      showToast({
        title: "Operation reussie",
        message: successMessage,
        variant: "success",
      });
      if (key === "approve" || key === "reject") {
        setDecisionNote("");
      }
      await loadRecord();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }

      setError(requestError.message || "Impossible d'executer cette action.");
      showToast({
        title: "Erreur",
        message: requestError.message || "Impossible d'executer cette action.",
        variant: "danger",
      });
    } finally {
      setPendingAction("");
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

  const handleOpenPdf = async () => {
    if (!detailConfig?.pdfUrl || !record || !accessToken) return;

    const openedWindow = window.open("", "_blank", "noopener,noreferrer");
    setPendingAction("pdf");
    setError("");

    try {
      const blob = await requestBlob(detailConfig.pdfUrl(record), {
        token: accessToken,
      });
      const url = window.URL.createObjectURL(blob);
      if (!openedWindow) {
        window.URL.revokeObjectURL(url);
        throw new Error("Le navigateur a bloque l'ouverture du PDF.");
      }
      openedWindow.location.href = url;
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (requestError) {
      if (openedWindow) {
        openedWindow.close();
      }
      if (requestError instanceof ApiError && requestError.status === 401) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }

      setError(requestError.message || "Impossible d'ouvrir le PDF.");
      showToast({
        title: "Erreur",
        message: requestError.message || "Impossible d'ouvrir le PDF.",
        variant: "danger",
      });
    } finally {
      setPendingAction("");
    }
  };

  const approvalInfoItems = useMemo(() => {
    if (!isApprovalRequest || !record) return [];

    return [
      {
        label: "Reference",
        value: `${referencePrefix}-${record.id.slice(0, 8).toUpperCase()}`,
      },
      { label: "Statut", value: record.status, render: renderPill },
      { label: "Boutique", value: record.store?.name || "--" },
      ...(detailConfig?.resourcePath === "/commande/requisitions"
        ? [{ label: "Zone", value: record.storageZone?.name || "--" }]
        : []),
      { label: "Demandeur", value: formatPerson(record.requestedBy) },
      { label: "Date creation", value: formatDate(record.createdAt) },
      { label: "Note", value: record.note || "--" },
    ];
  }, [detailConfig?.resourcePath, isApprovalRequest, record, referencePrefix]);

  const purchaseOrderInfoItems = useMemo(() => {
    if (!isPurchaseOrder || !record) return [];

    return [
      {
        label: "Reference",
        value: record.code || `${referencePrefix}-${record.id.slice(0, 8).toUpperCase()}`,
      },
      { label: "Statut", value: record.status, render: renderPill },
      { label: "Fournisseur", value: record.supplier?.name || "--" },
      { label: "Boutique", value: record.store?.name || "--" },
      { label: "Demandeur", value: formatPerson(record.orderedBy) },
      { label: "Date commande", value: formatDate(record.orderDate || record.createdAt) },
      { label: "Date attendue", value: formatDate(record.expectedDate) },
      {
        label: "Demande source",
        value: record.purchaseRequest?.title || record.purchaseRequest?.id || "--",
      },
      { label: "Note", value: record.note || "--" },
    ];
  }, [isPurchaseOrder, record, referencePrefix]);

  const stockEntryInfoItems = useMemo(() => {
    if (!isStockEntry || !record) return [];

    return [
      {
        label: "Reference",
        value: `${referencePrefix}-${record.id.slice(0, 8).toUpperCase()}`,
      },
      { label: "Statut", value: record.status, render: renderPill },
      { label: "Type source", value: record.sourceType || "--" },
      { label: "Document source", value: record.sourceId || "--" },
      { label: "Boutique", value: record.store?.name || "--" },
      { label: "Zone", value: record.storageZone?.name || "--" },
      { label: "Cree par", value: formatPerson(record.createdBy) },
      { label: "Valide par", value: formatPerson(record.approvedBy) },
      { label: "Date creation", value: formatDate(record.createdAt) },
      { label: "Date validation", value: formatDate(record.approvedAt) },
      { label: "Date comptabilisation", value: formatDate(record.postedAt) },
      { label: "Note", value: record.note || "--" },
    ];
  }, [isStockEntry, record, referencePrefix]);

  if (loading) {
    return (
      <div className="layoutSection flex flex-col gap-4">
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <p className="text-sm text-text-secondary">Chargement...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="layoutSection flex flex-col gap-4">
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <span className="inline-flex rounded-full bg-header/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
              {currentRoute.sectionLabel}
            </span>
            <h2 className="mt-3 text-2xl font-semibold text-text-primary">
              {record?.title || record?.code || currentRoute.name}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {detailConfig?.description || currentRoute.summary}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={detailConfig?.resourcePath || "/dashboard"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-background sm:w-auto"
            >
              <ArrowLeft size={16} />
              Retour
            </Link>

            {detailConfig?.pdfUrl && record ? (
              <button
                type="button"
                onClick={handleOpenPdf}
                disabled={Boolean(pendingAction)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <Download size={16} />
                PDF
              </button>
            ) : null}

            {canEdit && detailConfig?.editPath ? (
              <Link
                to={`${detailConfig.editPath}?id=${record?.id}`}
                state={{ row: record }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 sm:w-auto"
              >
                <Pencil size={16} />
                Modifier
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {record ? (
        <>
          {isApprovalRequest ? (
            <>
              <section className="grid gap-4 lg:grid-cols-2">
                <DetailSection title="Informations generales">
                  <DetailList items={approvalInfoItems} />
                </DetailSection>

                <DetailSection title="Validation">
                  {currentApproval ? (
                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <p className="text-sm text-text-secondary">Etape courante</p>
                      <p className="mt-1 text-sm font-medium text-text-primary">
                        Niveau {currentApproval.stepOrder} - {currentApproval.approverRole || "Affectation utilisateur"}
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        Statut: {statusLabels[currentApproval.status] || currentApproval.status}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary">
                      Aucun niveau en attente.
                    </p>
                  )}

                  {canDecideApproval ? (
                    <div className="mt-4 space-y-3">
                      <textarea
                        rows={4}
                        value={decisionNote}
                        onChange={(event) => setDecisionNote(event.target.value)}
                        placeholder="Note de validation ou de rejet"
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-secondary"
                      />

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            runAction({
                              key: "approve",
                              endpoint: `${approvalBase}/${recordId}/approve`,
                              body: decisionNote ? { note: decisionNote } : undefined,
                              successMessage: "Document valide.",
                            })
                          }
                          disabled={Boolean(pendingAction)}
                          className="inline-flex items-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <CheckCircle2 size={16} />
                          Valider
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            runAction({
                              key: "reject",
                              endpoint: `${approvalBase}/${recordId}/reject`,
                              body: decisionNote ? { note: decisionNote } : undefined,
                              successMessage: "Document rejete.",
                            })
                          }
                          disabled={Boolean(pendingAction)}
                          className="inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <XCircle size={16} />
                          Rejeter
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-text-secondary">
                      Vous ne pouvez pas traiter ce niveau de validation.
                    </p>
                  )}
                </DetailSection>
              </section>

              <DetailSection title="Articles demandes">
                <DataTable
                  columns={approvalItemsColumns}
                  rows={record.items || []}
                  emptyMessage="Aucun article demande."
                />
              </DetailSection>

              <DetailSection title="Historique de validation">
                <DataTable
                  columns={approvalColumns}
                  rows={record.approvals || []}
                  emptyMessage="Aucun niveau de validation configure."
                />
              </DetailSection>
            </>
          ) : null}

          {isPurchaseOrder ? (
            <>
              <section className="grid gap-4 lg:grid-cols-2">
                <DetailSection title="Informations generales">
                  <DetailList items={purchaseOrderInfoItems} />
                </DetailSection>

                <DetailSection title="Actions metier">
                  {canSendPurchaseOrder ? (
                    <div className="space-y-3">
                      <p className="text-sm text-text-secondary">
                        Cette commande est encore en brouillon. Vous pouvez la valider pour autoriser la reception en stock.
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          runAction({
                            key: "send",
                            endpoint: `/api/purchase-orders/${recordId}/send`,
                            successMessage: "Commande validee.",
                          })
                        }
                        disabled={Boolean(pendingAction)}
                        className="inline-flex items-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Send size={16} />
                        Valider la commande
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary">
                      Aucune action disponible pour cette commande dans son etat actuel.
                    </p>
                  )}
                </DetailSection>
              </section>

              <DetailSection title="Lignes de commande">
                <DataTable
                  columns={purchaseOrderItemsColumns}
                  rows={record.items || []}
                  emptyMessage="Aucune ligne de commande."
                />
              </DetailSection>

              <DetailSection title="Bons de reception">
                <DataTable
                  columns={deliveryNoteColumns}
                  rows={record.deliveryNotes || []}
                  emptyMessage="Aucun bon de reception lie a cette commande."
                />
              </DetailSection>
            </>
          ) : null}

          {isStockEntry ? (
            <>
              <section className="grid gap-4 lg:grid-cols-2">
                <DetailSection title="Informations generales">
                  <DetailList items={stockEntryInfoItems} />
                </DetailSection>

                <DetailSection title="Actions metier">
                  <div className="space-y-3">
                    {canApproveStockEntry ? (
                      <button
                        type="button"
                        onClick={() =>
                          runAction({
                            key: "approve-stock-entry",
                            endpoint: `/api/stock-entries/${recordId}/approve`,
                            successMessage: "Entree de stock validee.",
                          })
                        }
                        disabled={Boolean(pendingAction)}
                        className="inline-flex items-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle2 size={16} />
                        Valider
                      </button>
                    ) : null}

                    {canPostStockEntry ? (
                      <button
                        type="button"
                        onClick={() =>
                          runAction({
                            key: "post-stock-entry",
                            endpoint: `/api/stock-entries/${recordId}/post`,
                            successMessage: "Entree de stock comptabilisee.",
                          })
                        }
                        disabled={Boolean(pendingAction)}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Upload size={16} />
                        Poster
                      </button>
                    ) : null}

                    {!canApproveStockEntry && !canPostStockEntry ? (
                      <p className="text-sm text-text-secondary">
                        Aucune action disponible pour cette entree de stock dans son etat actuel.
                      </p>
                    ) : null}
                  </div>
                </DetailSection>
              </section>

              <DetailSection title="Lignes d'entree stock">
                <DataTable
                  columns={stockEntryItemsColumns}
                  rows={record.items || []}
                  emptyMessage="Aucune ligne d'entree stock."
                />
              </DetailSection>
            </>
          ) : null}
        </>
      ) : (
        <DetailSection title="Detail">
          <p className="text-sm text-text-secondary">
            Aucun detail disponible pour ce document.
          </p>
        </DetailSection>
      )}
    </div>
  );
};

export default AdminDetailPage;
