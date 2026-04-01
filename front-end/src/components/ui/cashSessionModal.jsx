import React, { useEffect, useMemo, useState } from "react";
import Modal from "./modal";
import {
  buildSecondaryRateLabel,
  formatPrimaryAmount,
  formatSecondaryAmount,
  hasSecondaryCurrency,
} from "../../utils/currency";

const CashSessionModal = ({
  mode = "open",
  isOpen,
  session = null,
  currencySettings,
  submitting = false,
  onClose,
  onSubmit,
}) => {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (mode === "close") {
      setAmount(
        session?.expectedCash != null ? Number(session.expectedCash).toFixed(2) : "",
      );
      setNote("");
      return;
    }

    setAmount("0.00");
    setNote("");
  }, [isOpen, mode, session]);

  const numericAmount = useMemo(() => {
    const parsed = Number(String(amount || "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amount]);

  const secondaryEnabled = hasSecondaryCurrency(currencySettings);
  const exchangeRateLabel = buildSecondaryRateLabel(currencySettings);
  const isCloseMode = mode === "close";

  const title = isCloseMode ? "Cloturer la caisse" : "Ouvrir la caisse";
  const description = isCloseMode
    ? "Saisissez le montant reellement compte en fin de service."
    : "Definissez le fonds de caisse initial avant d'enregistrer des ventes.";

  const handleConfirm = () => {
    if (submitting) return;
    onSubmit?.({
      amount: numericAmount,
      note,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      description={description}
      confirmLabel={
        submitting
          ? isCloseMode
            ? "Cloture..."
            : "Ouverture..."
          : isCloseMode
            ? "Cloturer"
            : "Ouvrir"
      }
      cancelLabel="Annuler"
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <div className="space-y-4">
        {exchangeRateLabel ? (
          <p className="text-xs text-text-secondary">{exchangeRateLabel}</p>
        ) : null}

        {isCloseMode && session ? (
          <div className="grid gap-3 rounded-xl border border-border bg-surface/70 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-text-secondary">Fonds initial</p>
              <p className="text-sm font-semibold text-text-primary">
                {formatPrimaryAmount(session.openingFloat || 0, currencySettings)}
              </p>
              {secondaryEnabled ? (
                <p className="text-[10px] text-text-secondary">
                  {formatSecondaryAmount(session.openingFloat || 0, currencySettings)}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs text-text-secondary">Ventes cash</p>
              <p className="text-sm font-semibold text-text-primary">
                {formatPrimaryAmount(session.totalCashSales || 0, currencySettings)}
              </p>
              {secondaryEnabled ? (
                <p className="text-[10px] text-text-secondary">
                  {formatSecondaryAmount(session.totalCashSales || 0, currencySettings)}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs text-text-secondary">Ventes non cash</p>
              <p className="text-sm font-semibold text-text-primary">
                {formatPrimaryAmount(session.totalNonCashSales || 0, currencySettings)}
              </p>
              {secondaryEnabled ? (
                <p className="text-[10px] text-text-secondary">
                  {formatSecondaryAmount(session.totalNonCashSales || 0, currencySettings)}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs text-text-secondary">Cash theorique</p>
              <p className="text-sm font-semibold text-text-primary">
                {formatPrimaryAmount(session.expectedCash || 0, currencySettings)}
              </p>
              {secondaryEnabled ? (
                <p className="text-[10px] text-text-secondary">
                  {formatSecondaryAmount(session.expectedCash || 0, currencySettings)}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            {isCloseMode ? "Montant compte" : "Fonds de caisse initial"}
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
            Note
          </label>
          <textarea
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder={
              isCloseMode
                ? "Observation de cloture, ecart, incident..."
                : "Observation sur l'ouverture de caisse..."
            }
          />
        </div>
      </div>
    </Modal>
  );
};

export default CashSessionModal;
