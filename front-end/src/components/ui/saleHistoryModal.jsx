import React, { useEffect, useMemo, useState } from "react";
import Modal from "./modal";
import { apiGet } from "../../services/apiClient";
import useToastStore from "../../stores/toastStore";
import { formatDate } from "../../utils/formatters";

const ACTION_LABELS = {
  UPDATED: "Modification",
  DELETED: "Suppression",
};

const stringifyValue = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === "object") {
          return `${item.productName || item.productId || "Article"} x ${item.quantity || 0}`;
        }
        return String(item ?? "");
      })
      .join(", ");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value ?? "--");
};

const SaleHistoryModal = ({ isOpen, onClose, saleId }) => {
  const showToast = useToastStore((state) => state.showToast);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!isOpen || !saleId) return;

    let mounted = true;
    const loadHistory = async () => {
      setLoading(true);
      try {
        const data = await apiGet(`/api/orders/${saleId}/history`);
        if (!mounted) return;
        setHistory(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!mounted) return;
        showToast({
          title: "Erreur",
          message: error.message || "Impossible de charger l'historique de la vente.",
          variant: "danger",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadHistory();
    return () => {
      mounted = false;
    };
  }, [isOpen, saleId, showToast]);

  const content = useMemo(() => {
    if (loading) {
      return <p className="text-sm text-text-secondary">Chargement...</p>;
    }

    if (!history.length) {
      return <p className="text-sm text-text-secondary">Aucun historique pour cette vente.</p>;
    }

    return (
      <div className="space-y-4">
        {history.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-border bg-surface/70 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {ACTION_LABELS[entry.action] || entry.action}
                </p>
                <p className="text-xs text-text-secondary">
                  {entry.actorName || "Utilisateur"} • {formatDate(entry.createdAt)}
                </p>
              </div>
              {entry.reason ? (
                <p className="text-xs text-text-secondary sm:text-right">{entry.reason}</p>
              ) : null}
            </div>

            {entry.details?.changes?.length ? (
              <div className="mt-3 space-y-2">
                {entry.details.changes.map((change, index) => (
                  <div
                    key={`${entry.id}-${change.field}-${index}`}
                    className="rounded-lg border border-border/70 bg-surface px-3 py-2 text-xs text-text-secondary"
                  >
                    <p className="font-semibold text-text-primary">{change.label}</p>
                    <p>Avant: {stringifyValue(change.before)}</p>
                    <p>Apres: {stringifyValue(change.after)}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  }, [history, loading]);

  return (
    <Modal
      isOpen={isOpen}
      title="Historique de la vente"
      description="Trace des modifications et suppressions enregistrees."
      confirmLabel="Fermer"
      cancelLabel="Fermer"
      onConfirm={onClose}
      onCancel={onClose}
    >
      {content}
    </Modal>
  );
};

export default SaleHistoryModal;
