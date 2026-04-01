import React, { useEffect, useMemo, useState } from "react";
import Modal from "./modal";
import {
  buildSecondaryRateLabel,
  formatPrimaryAmount,
  formatSecondaryAmount,
  hasSecondaryCurrency,
} from "../../utils/currency";

const configByType = {
  IN: {
    title: "Entree de caisse",
    description: "Enregistrez un ajout manuel de cash dans la caisse ouverte.",
    confirmLabel: "Enregistrer l'entree",
    reasonPlaceholder: "Ex. Approvisionnement de caisse",
    notePlaceholder: "Observation sur l'entree de caisse...",
  },
  OUT: {
    title: "Sortie de caisse",
    description: "Enregistrez une sortie manuelle de cash de la caisse ouverte.",
    confirmLabel: "Enregistrer la sortie",
    reasonPlaceholder: "Ex. Retrait, depense, depot bancaire",
    notePlaceholder: "Observation sur la sortie de caisse...",
  },
};

const CashMovementModal = ({
  type = "IN",
  isOpen,
  currencySettings,
  submitting = false,
  onClose,
  onSubmit,
}) => {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setAmount("");
    setReason("");
    setNote("");
  }, [isOpen, type]);

  const config = configByType[type] || configByType.IN;
  const secondaryEnabled = hasSecondaryCurrency(currencySettings);
  const exchangeRateLabel = buildSecondaryRateLabel(currencySettings);
  const numericAmount = useMemo(() => {
    const parsed = Number(String(amount || "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amount]);

  return (
    <Modal
      isOpen={isOpen}
      title={config.title}
      description={config.description}
      confirmLabel={submitting ? "Enregistrement..." : config.confirmLabel}
      cancelLabel="Annuler"
      onConfirm={() => {
        if (submitting) return;
        onSubmit?.({
          type,
          amount: numericAmount,
          reason: reason.trim(),
          note: note.trim(),
        });
      }}
      onCancel={onClose}
    >
      <div className="space-y-4">
        {exchangeRateLabel ? (
          <p className="text-xs text-text-secondary">{exchangeRateLabel}</p>
        ) : null}

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            Montant
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="0.00"
          />
          <div className="mt-1 text-xs text-text-secondary">
            {formatPrimaryAmount(numericAmount, currencySettings)}
            {secondaryEnabled ? ` - ${formatSecondaryAmount(numericAmount, currencySettings)}` : ""}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            Motif
          </label>
          <input
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder={config.reasonPlaceholder}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            Note
          </label>
          <textarea
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder={config.notePlaceholder}
          />
        </div>
      </div>
    </Modal>
  );
};

export default CashMovementModal;
