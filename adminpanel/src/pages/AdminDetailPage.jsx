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

const formatDateOnly = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
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
  CLOSED: "Cloture",
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
      <thead className="bg-header dark:bg-secondary">
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
    key: "batchNumber",
    label: "Lot",
    render: (row) => row.batchNumber || "Sans lot",
  },
  {
    key: "expiryDate",
    label: "Expiration",
    render: (row) => formatDateOnly(row.expiryDate),
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
  transfer: "TRF",
  "supplier-return": "SRF",
  "cash-session": "CSH",
  "inventory-session": "INV",
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
  const isTransfer = detailKind === "transfer";
  const isSupplierReturn = detailKind === "supplier-return";
  const isCashSession = detailKind === "cash-session";
  const isInventorySession = detailKind === "inventory-session";
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
  const currentPurchaseOrderApproval = useMemo(() => {
    if (!isPurchaseOrder) return null;
    return (
      (record?.approvals || [])
        .filter((approval) => approval.status === "PENDING")
        .sort((left, right) => (left.stepOrder || 0) - (right.stepOrder || 0))[0] ||
      null
    );
  }, [isPurchaseOrder, record?.approvals]);
  const canDecidePurchaseOrderApproval = useMemo(() => {
    if (!isPurchaseOrder || !currentPurchaseOrderApproval || !currentUser) return false;
    return (
      (currentPurchaseOrderApproval.approverId &&
        currentPurchaseOrderApproval.approverId === currentUser.id) ||
      (currentPurchaseOrderApproval.approverRole &&
        currentPurchaseOrderApproval.approverRole === currentUser.role)
    );
  }, [currentPurchaseOrderApproval, currentUser, isPurchaseOrder]);
  const canSendPurchaseOrder =
    isPurchaseOrder &&
    ["DRAFT", "REJECTED"].includes(record?.status) &&
    hasAnyPermission(
      currentUser,
      detailConfig?.editPermissions ||
        getRouteActionPermissions(detailConfig?.resourcePath || currentRoute.path, "edit"),
    );
  const currentStockEntryApproval = useMemo(() => {
    if (!isStockEntry) return null;
    return (
      (record?.approvals || [])
        .filter((approval) => approval.status === "PENDING")
        .sort((left, right) => (left.stepOrder || 0) - (right.stepOrder || 0))[0] ||
      null
    );
  }, [isStockEntry, record?.approvals]);
  const canDecideStockEntryApproval = useMemo(() => {
    if (!isStockEntry || !currentStockEntryApproval || !currentUser) return false;
    return (
      (currentStockEntryApproval.approverId &&
        currentStockEntryApproval.approverId === currentUser.id) ||
      (currentStockEntryApproval.approverRole &&
        currentStockEntryApproval.approverRole === currentUser.role)
    );
  }, [currentStockEntryApproval, currentUser, isStockEntry]);
  const canApproveStockEntry =
    isStockEntry &&
    ((record?.approvals?.length
      ? canDecideStockEntryApproval
      : record?.sourceType === "DIRECT" && record?.status === "PENDING" && isSuperAdmin));
  const canRejectStockEntry =
    isStockEntry && Boolean(record?.approvals?.length) && canDecideStockEntryApproval;
  const canPostStockEntry =
    isStockEntry && record?.status === "APPROVED" && isAdminUser;
  const currentTransferApproval = useMemo(() => {
    if (!isTransfer) return null;
    return (
      (record?.approvals || [])
        .filter((approval) => approval.status === "PENDING")
        .sort((left, right) => (left.stepOrder || 0) - (right.stepOrder || 0))[0] ||
      null
    );
  }, [isTransfer, record?.approvals]);
  const canDecideTransferApproval = useMemo(() => {
    if (!isTransfer || !currentTransferApproval || !currentUser) return false;
    return (
      (currentTransferApproval.approverId &&
        currentTransferApproval.approverId === currentUser.id) ||
      (currentTransferApproval.approverRole &&
        currentTransferApproval.approverRole === currentUser.role)
    );
  }, [currentTransferApproval, currentUser, isTransfer]);
  const canSubmitTransfer =
    isTransfer &&
    ["DRAFT", "REJECTED"].includes(record?.status) &&
    hasAnyPermission(
      currentUser,
      detailConfig?.editPermissions ||
        getRouteActionPermissions(detailConfig?.resourcePath || currentRoute.path, "edit"),
    );
  const currentSupplierReturnApproval = useMemo(() => {
    if (!isSupplierReturn) return null;
    return (
      (record?.approvals || [])
        .filter((approval) => approval.status === "PENDING")
        .sort((left, right) => (left.stepOrder || 0) - (right.stepOrder || 0))[0] ||
      null
    );
  }, [isSupplierReturn, record?.approvals]);
  const canDecideSupplierReturnApproval = useMemo(() => {
    if (!isSupplierReturn || !currentSupplierReturnApproval || !currentUser) return false;
    return (
      (currentSupplierReturnApproval.approverId &&
        currentSupplierReturnApproval.approverId === currentUser.id) ||
      (currentSupplierReturnApproval.approverRole &&
        currentSupplierReturnApproval.approverRole === currentUser.role)
    );
  }, [currentSupplierReturnApproval, currentUser, isSupplierReturn]);
  const canSubmitSupplierReturn =
    isSupplierReturn &&
    ["DRAFT", "REJECTED"].includes(record?.status) &&
    hasAnyPermission(
      currentUser,
      detailConfig?.editPermissions ||
        getRouteActionPermissions(detailConfig?.resourcePath || currentRoute.path, "edit"),
    );
  const canPostSupplierReturn =
    isSupplierReturn &&
    record?.status === "APPROVED" &&
    hasAnyPermission(
      currentUser,
      detailConfig?.editPermissions ||
        getRouteActionPermissions(detailConfig?.resourcePath || currentRoute.path, "edit"),
    );
  const currentInventoryApproval = useMemo(() => {
    if (!isInventorySession) return null;

    return (
      (record?.approvals || [])
        .filter((approval) => approval.status === "PENDING")
        .sort((left, right) => (left.stepOrder || 0) - (right.stepOrder || 0))[0] ||
      null
    );
  }, [isInventorySession, record?.approvals]);
  const canDecideInventoryApproval = useMemo(() => {
    if (!isInventorySession || !currentInventoryApproval || !currentUser) return false;

    return (
      (currentInventoryApproval.approverId &&
        currentInventoryApproval.approverId === currentUser.id) ||
      (currentInventoryApproval.approverRole &&
        currentInventoryApproval.approverRole === currentUser.role)
    );
  }, [currentInventoryApproval, currentUser, isInventorySession]);
  const canSubmitInventorySession =
    isInventorySession &&
    ["DRAFT", "REJECTED"].includes(record?.status) &&
    hasAnyPermission(
      currentUser,
      detailConfig?.editPermissions ||
        getRouteActionPermissions(detailConfig?.resourcePath || currentRoute.path, "edit"),
    );
  const canCloseInventorySession =
    isInventorySession &&
    record?.status === "APPROVED" &&
    hasAnyPermission(
      currentUser,
      detailConfig?.editPermissions ||
        getRouteActionPermissions(detailConfig?.resourcePath || currentRoute.path, "edit"),
    );

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

  const transferInfoItems = useMemo(() => {
    if (!isTransfer || !record) return [];

    return [
      {
        label: "Reference",
        value: record.code || `${referencePrefix}-${record.id.slice(0, 8).toUpperCase()}`,
      },
      { label: "Statut", value: record.status, render: renderPill },
      { label: "Boutique source", value: record.fromStore?.name || "--" },
      { label: "Zone source", value: record.fromZone?.name || "--" },
      { label: "Boutique cible", value: record.toStore?.name || "--" },
      { label: "Zone cible", value: record.toZone?.name || "--" },
      { label: "Demandeur", value: formatPerson(record.requestedBy) },
      { label: "Date creation", value: formatDate(record.createdAt) },
      { label: "Note", value: record.note || "--" },
    ];
  }, [isTransfer, record, referencePrefix]);

  const supplierReturnInfoItems = useMemo(() => {
    if (!isSupplierReturn || !record) return [];
    return [
      {
        label: "Reference",
        value: record.code || `${referencePrefix}-${record.id.slice(0, 8).toUpperCase()}`,
      },
      { label: "Statut", value: record.status, render: renderPill },
      { label: "Fournisseur", value: record.supplier?.name || "--" },
      { label: "Boutique", value: record.store?.name || "--" },
      { label: "Zone", value: record.storageZone?.name || "--" },
      { label: "Demandeur", value: formatPerson(record.requestedBy) },
      { label: "Valide par", value: formatPerson(record.approvedBy) },
      { label: "Date creation", value: formatDate(record.createdAt) },
      { label: "Date validation", value: formatDate(record.approvedAt) },
      { label: "Date comptabilisation", value: formatDate(record.postedAt) },
      { label: "Note", value: record.note || "--" },
    ];
  }, [isSupplierReturn, record, referencePrefix]);

  const cashSessionInfoItems = useMemo(() => {
    if (!isCashSession || !record) return [];

    return [
      {
        label: "Reference",
        value: `${referencePrefix}-${record.id.slice(0, 8).toUpperCase()}`,
      },
      { label: "Statut", value: record.status, render: renderPill },
      { label: "Boutique", value: record.storeName || "--" },
      { label: "Caissier", value: record.userName || "--" },
      { label: "Zone", value: record.storageZoneName || "--" },
      { label: "Fonds initial", value: formatMoney(record.openingFloat, record.currencyCode) },
      { label: "Ventes cash", value: formatMoney(record.totalCashSales, record.currencyCode) },
      {
        label: "Ventes non cash",
        value: formatMoney(record.totalNonCashSales, record.currencyCode),
      },
      { label: "Entrees cash", value: formatMoney(record.totalCashIn, record.currencyCode) },
      { label: "Sorties cash", value: formatMoney(record.totalCashOut, record.currencyCode) },
      { label: "Cash theorique", value: formatMoney(record.expectedCash, record.currencyCode) },
      {
        label: "Cash compte",
        value:
          record.closingCounted == null
            ? "--"
            : formatMoney(record.closingCounted, record.currencyCode),
      },
      {
        label: "Ecart",
        value:
          record.variance == null ? "--" : formatMoney(record.variance, record.currencyCode),
      },
      { label: "Ouverte le", value: formatDate(record.openedAt) },
      { label: "Cloturee le", value: formatDate(record.closedAt) },
      { label: "Note ouverture", value: record.openingNote || "--" },
      { label: "Note cloture", value: record.closingNote || "--" },
    ];
  }, [isCashSession, record, referencePrefix]);

  const inventorySessionInfoItems = useMemo(() => {
    if (!isInventorySession || !record) return [];

    return [
      {
        label: "Reference",
        value: record.code || `${referencePrefix}-${record.id.slice(0, 8).toUpperCase()}`,
      },
      { label: "Statut", value: record.status, render: renderPill },
      { label: "Boutique", value: record.store?.name || "--" },
      { label: "Zone", value: record.storageZone?.name || "--" },
      { label: "Demandeur", value: formatPerson(record.requestedBy) },
      { label: "Lignes", value: record.itemsCount ?? 0 },
      { label: "Ecarts", value: record.discrepancyCount ?? 0 },
      { label: "Niveaux", value: record.approvalsCount ?? 0 },
      { label: "Cree le", value: formatDate(record.createdAt) },
      { label: "Cloture le", value: formatDate(record.closedAt) },
      { label: "Cloture par", value: formatPerson(record.closedBy) },
      { label: "Note", value: record.note || "--" },
    ];
  }, [isInventorySession, record, referencePrefix]);

const cashSessionMovementColumns = useMemo(
    () => [
      {
        key: "type",
        label: "Type",
        render: (row) => renderPill(row.type),
      },
      {
        key: "amount",
        label: "Montant",
        render: (row) => formatMoney(row.amount, row.currencyCode || record?.currencyCode),
      },
      {
        key: "reason",
        label: "Motif",
        render: (row) => row.reason || "--",
      },
      {
        key: "note",
        label: "Note",
        render: (row) => row.note || "--",
      },
      {
        key: "createdByName",
        label: "Cree par",
        render: (row) => row.createdByName || "--",
      },
      {
        key: "createdAt",
        label: "Date",
        render: (row) => formatDate(row.createdAt),
      },
    ],
    [record?.currencyCode],
  );

  const inventorySessionItemsColumns = useMemo(
    () => [
      {
        key: "product",
        label: "Produit",
        render: (row) => row.product?.name || "--",
      },
      {
        key: "productSku",
        label: "Code",
        render: (row) => row.product?.sku || "--",
      },
      {
        key: "systemQuantity",
        label: "Qte systeme",
        render: (row) => toNumber(row.systemQuantity),
      },
      {
        key: "batchNumber",
        label: "Lot",
        render: (row) => row.batchNumber || "Sans lot",
      },
      {
        key: "expiryDate",
        label: "Expiration",
        render: (row) => formatDateOnly(row.expiryDate),
      },
      {
        key: "physicalQuantity",
        label: "Qte physique",
        render: (row) =>
          row.physicalQuantity == null ? "--" : toNumber(row.physicalQuantity),
      },
      {
        key: "varianceQuantity",
        label: "Ecart",
        render: (row) =>
          row.varianceQuantity == null ? "--" : toNumber(row.varianceQuantity),
      },
      {
        key: "note",
        label: "Note",
        render: (row) => row.note || "--",
      },
    ],
    [],
  );

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

                <DetailSection title="Workflow">
                  <div className="space-y-3">
                    {currentPurchaseOrderApproval ? (
                      <div className="rounded-xl border border-border bg-background/40 p-4">
                        <p className="text-sm text-text-secondary">Etape courante</p>
                        <p className="mt-1 text-sm font-medium text-text-primary">
                          Niveau {currentPurchaseOrderApproval.stepOrder} -{" "}
                          {currentPurchaseOrderApproval.approverRole || "Affectation utilisateur"}
                        </p>
                        <p className="mt-1 text-sm text-text-secondary">
                          Statut:{" "}
                          {statusLabels[currentPurchaseOrderApproval.status] ||
                            currentPurchaseOrderApproval.status}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-text-secondary">
                        Aucun niveau en attente.
                      </p>
                    )}

                    {canSendPurchaseOrder || canDecidePurchaseOrderApproval ? (
                      <div className="space-y-3">
                        <textarea
                          rows={4}
                          value={decisionNote}
                          onChange={(event) => setDecisionNote(event.target.value)}
                          placeholder="Note de workflow"
                          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-secondary"
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          {canSendPurchaseOrder ? (
                            <button
                              type="button"
                              onClick={() =>
                                runAction({
                                  key: "send",
                                  endpoint: `/api/purchase-orders/${recordId}/send`,
                                  successMessage: "Commande soumise au workflow.",
                                })
                              }
                              disabled={Boolean(pendingAction)}
                              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Send size={16} />
                              Soumettre
                            </button>
                          ) : null}

                          {canDecidePurchaseOrderApproval ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  runAction({
                                    key: "approve-purchase-order",
                                    endpoint: `/api/purchase-orders/${recordId}/approve`,
                                    body: decisionNote ? { note: decisionNote } : undefined,
                                    successMessage: "Commande validee.",
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
                                    key: "reject-purchase-order",
                                    endpoint: `/api/purchase-orders/${recordId}/reject`,
                                    body: decisionNote ? { note: decisionNote } : undefined,
                                    successMessage: "Commande rejetee.",
                                  })
                                }
                                disabled={Boolean(pendingAction)}
                                className="inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <XCircle size={16} />
                                Rejeter
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-text-secondary">
                        Aucune action disponible pour cette commande dans son etat actuel.
                      </p>
                    )}
                  </div>
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

              <DetailSection title="Historique de validation">
                <DataTable
                  columns={approvalColumns}
                  rows={record.approvals || []}
                  emptyMessage="Aucun niveau de validation configure."
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
                    {currentStockEntryApproval ? (
                      <div className="rounded-xl border border-border bg-background/40 p-4">
                        <p className="text-sm text-text-secondary">Etape courante</p>
                        <p className="mt-1 text-sm font-medium text-text-primary">
                          Niveau {currentStockEntryApproval.stepOrder} -{" "}
                          {currentStockEntryApproval.approverRole || "Affectation utilisateur"}
                        </p>
                        <p className="mt-1 text-sm text-text-secondary">
                          Statut:{" "}
                          {statusLabels[currentStockEntryApproval.status] ||
                            currentStockEntryApproval.status}
                        </p>
                      </div>
                    ) : null}

                    {canRejectStockEntry ? (
                      <textarea
                        rows={4}
                        value={decisionNote}
                        onChange={(event) => setDecisionNote(event.target.value)}
                        placeholder="Note de workflow"
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-secondary"
                      />
                    ) : null}

                    {canApproveStockEntry ? (
                      <button
                        type="button"
                        onClick={() =>
                          runAction({
                            key: "approve-stock-entry",
                            endpoint: `/api/stock-entries/${recordId}/approve`,
                            body: decisionNote ? { note: decisionNote } : undefined,
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

                    {canRejectStockEntry ? (
                      <button
                        type="button"
                        onClick={() =>
                          runAction({
                            key: "reject-stock-entry",
                            endpoint: `/api/stock-entries/${recordId}/reject`,
                            body: decisionNote ? { note: decisionNote } : undefined,
                            successMessage: "Entree de stock rejetee.",
                          })
                        }
                        disabled={Boolean(pendingAction)}
                        className="inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <XCircle size={16} />
                        Rejeter
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

              <DetailSection title="Historique de validation">
                <DataTable
                  columns={approvalColumns}
                  rows={record.approvals || []}
                  emptyMessage="Aucun niveau de validation configure."
                />
              </DetailSection>
            </>
          ) : null}

          {isTransfer ? (
            <>
              <section className="grid gap-4 lg:grid-cols-2">
                <DetailSection title="Informations generales">
                  <DetailList items={transferInfoItems} />
                </DetailSection>

                <DetailSection title="Workflow">
                  <div className="space-y-3">
                    {currentTransferApproval ? (
                      <div className="rounded-xl border border-border bg-background/40 p-4">
                        <p className="text-sm text-text-secondary">Etape courante</p>
                        <p className="mt-1 text-sm font-medium text-text-primary">
                          Niveau {currentTransferApproval.stepOrder} -{" "}
                          {currentTransferApproval.approverRole || "Affectation utilisateur"}
                        </p>
                        <p className="mt-1 text-sm text-text-secondary">
                          Statut:{" "}
                          {statusLabels[currentTransferApproval.status] ||
                            currentTransferApproval.status}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-text-secondary">
                        Aucun niveau en attente.
                      </p>
                    )}

                    {canSubmitTransfer || canDecideTransferApproval ? (
                      <div className="space-y-3">
                        <textarea
                          rows={4}
                          value={decisionNote}
                          onChange={(event) => setDecisionNote(event.target.value)}
                          placeholder="Note de workflow"
                          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-secondary"
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          {canSubmitTransfer ? (
                            <button
                              type="button"
                              onClick={() =>
                                runAction({
                                  key: "submit-transfer",
                                  endpoint: `/api/transfers/${recordId}/complete`,
                                  successMessage: "Transfert soumis au workflow.",
                                })
                              }
                              disabled={Boolean(pendingAction)}
                              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Send size={16} />
                              Soumettre
                            </button>
                          ) : null}

                          {canDecideTransferApproval ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  runAction({
                                    key: "approve-transfer",
                                    endpoint: `/api/transfers/${recordId}/approve`,
                                    body: decisionNote ? { note: decisionNote } : undefined,
                                    successMessage: "Transfert valide.",
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
                                    key: "reject-transfer",
                                    endpoint: `/api/transfers/${recordId}/reject`,
                                    body: decisionNote ? { note: decisionNote } : undefined,
                                    successMessage: "Transfert rejete.",
                                  })
                                }
                                disabled={Boolean(pendingAction)}
                                className="inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <XCircle size={16} />
                                Rejeter
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-text-secondary">
                        Aucune action disponible pour ce transfert dans son etat actuel.
                      </p>
                    )}
                  </div>
                </DetailSection>
              </section>

              <DetailSection title="Lignes de transfert">
                <DataTable
                  columns={approvalItemsColumns}
                  rows={record.items || []}
                  emptyMessage="Aucune ligne de transfert."
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

          {isSupplierReturn ? (
            <>
              <section className="grid gap-4 lg:grid-cols-2">
                <DetailSection title="Informations generales">
                  <DetailList items={supplierReturnInfoItems} />
                </DetailSection>

                <DetailSection title="Workflow">
                  <div className="space-y-3">
                    {currentSupplierReturnApproval ? (
                      <div className="rounded-xl border border-border bg-background/40 p-4">
                        <p className="text-sm text-text-secondary">Etape courante</p>
                        <p className="mt-1 text-sm font-medium text-text-primary">
                          Niveau {currentSupplierReturnApproval.stepOrder} -{" "}
                          {currentSupplierReturnApproval.approverRole || "Affectation utilisateur"}
                        </p>
                        <p className="mt-1 text-sm text-text-secondary">
                          Statut:{" "}
                          {statusLabels[currentSupplierReturnApproval.status] ||
                            currentSupplierReturnApproval.status}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-text-secondary">Aucun niveau en attente.</p>
                    )}

                    {canSubmitSupplierReturn ||
                    canDecideSupplierReturnApproval ||
                    canPostSupplierReturn ? (
                      <div className="space-y-3">
                        <textarea
                          rows={4}
                          value={decisionNote}
                          onChange={(event) => setDecisionNote(event.target.value)}
                          placeholder="Note de workflow"
                          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-secondary"
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          {canSubmitSupplierReturn ? (
                            <button
                              type="button"
                              onClick={() =>
                                runAction({
                                  key: "submit-supplier-return",
                                  endpoint: `/api/supplier-returns/${recordId}/submit`,
                                  successMessage: "Retour fournisseur soumis au workflow.",
                                })
                              }
                              disabled={Boolean(pendingAction)}
                              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Send size={16} />
                              Soumettre
                            </button>
                          ) : null}

                          {canDecideSupplierReturnApproval ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  runAction({
                                    key: "approve-supplier-return",
                                    endpoint: `/api/supplier-returns/${recordId}/approve`,
                                    body: decisionNote ? { note: decisionNote } : undefined,
                                    successMessage: "Retour fournisseur valide.",
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
                                    key: "reject-supplier-return",
                                    endpoint: `/api/supplier-returns/${recordId}/reject`,
                                    body: decisionNote ? { note: decisionNote } : undefined,
                                    successMessage: "Retour fournisseur rejete.",
                                  })
                                }
                                disabled={Boolean(pendingAction)}
                                className="inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <XCircle size={16} />
                                Rejeter
                              </button>
                            </>
                          ) : null}

                          {canPostSupplierReturn ? (
                            <button
                              type="button"
                              onClick={() =>
                                runAction({
                                  key: "post-supplier-return",
                                  endpoint: `/api/supplier-returns/${recordId}/post`,
                                  successMessage: "Retour fournisseur comptabilise.",
                                })
                              }
                              disabled={Boolean(pendingAction)}
                              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Upload size={16} />
                              Poster
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-text-secondary">
                        Aucune action disponible pour ce retour fournisseur dans son etat actuel.
                      </p>
                    )}
                  </div>
                </DetailSection>
              </section>

              <DetailSection title="Lignes de retour fournisseur">
                <DataTable
                  columns={approvalItemsColumns}
                  rows={record.items || []}
                  emptyMessage="Aucune ligne de retour fournisseur."
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

          {isCashSession ? (
            <>
              <DetailSection title="Informations generales">
                <DetailList items={cashSessionInfoItems} />
              </DetailSection>

              <DetailSection title="Mouvements de caisse">
                <DataTable
                  columns={cashSessionMovementColumns}
                  rows={record.movements || []}
                  emptyMessage="Aucun mouvement IN/OUT enregistre sur cette session."
                />
              </DetailSection>
            </>
          ) : null}

          {isInventorySession ? (
            <>
              <section className="grid gap-4 lg:grid-cols-2">
                <DetailSection title="Informations generales">
                  <DetailList items={inventorySessionInfoItems} />
                </DetailSection>

                <DetailSection title="Workflow">
                  <div className="space-y-3">
                    {currentInventoryApproval ? (
                      <div className="rounded-xl border border-border bg-background/40 p-4">
                        <p className="text-sm text-text-secondary">Etape courante</p>
                        <p className="mt-1 text-sm font-medium text-text-primary">
                          Niveau {currentInventoryApproval.stepOrder} -{" "}
                          {currentInventoryApproval.approverRole || "Affectation utilisateur"}
                        </p>
                        <p className="mt-1 text-sm text-text-secondary">
                          Statut:{" "}
                          {statusLabels[currentInventoryApproval.status] ||
                            currentInventoryApproval.status}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-text-secondary">
                        Aucun niveau en attente.
                      </p>
                    )}

                    {canSubmitInventorySession || canDecideInventoryApproval || canCloseInventorySession ? (
                      <div className="space-y-3">
                        <textarea
                          rows={4}
                          value={decisionNote}
                          onChange={(event) => setDecisionNote(event.target.value)}
                          placeholder="Note de workflow"
                          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-secondary"
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          {canSubmitInventorySession ? (
                            <button
                              type="button"
                              onClick={() =>
                                runAction({
                                  key: "submit-inventory",
                                  endpoint: `/api/inventory/sessions/${recordId}/submit`,
                                  successMessage: "Inventaire soumis a validation.",
                                })
                              }
                              disabled={Boolean(pendingAction)}
                              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Send size={16} />
                              Soumettre
                            </button>
                          ) : null}

                          {canDecideInventoryApproval ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  runAction({
                                    key: "approve-inventory",
                                    endpoint: `/api/inventory/sessions/${recordId}/approve`,
                                    body: decisionNote ? { note: decisionNote } : undefined,
                                    successMessage: "Inventaire valide.",
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
                                    key: "reject-inventory",
                                    endpoint: `/api/inventory/sessions/${recordId}/reject`,
                                    body: decisionNote ? { note: decisionNote } : undefined,
                                    successMessage: "Inventaire rejete.",
                                  })
                                }
                                disabled={Boolean(pendingAction)}
                                className="inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <XCircle size={16} />
                                Rejeter
                              </button>
                            </>
                          ) : null}

                          {canCloseInventorySession ? (
                            <button
                              type="button"
                              onClick={() =>
                                runAction({
                                  key: "close-inventory",
                                  endpoint: `/api/inventory/sessions/${recordId}/close`,
                                  body: decisionNote ? { note: decisionNote } : undefined,
                                  successMessage: "Inventaire cloture.",
                                })
                              }
                              disabled={Boolean(pendingAction)}
                              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <CheckCircle2 size={16} />
                              Cloturer
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-text-secondary">
                        Aucune action disponible pour cet inventaire dans son etat actuel.
                      </p>
                    )}
                  </div>
                </DetailSection>
              </section>

              <DetailSection title="Lignes d'inventaire">
                <DataTable
                  columns={inventorySessionItemsColumns}
                  rows={record.items || []}
                  emptyMessage="Aucune ligne d'inventaire."
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
