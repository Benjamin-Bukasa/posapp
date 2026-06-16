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
  stockItems = null,
  stockLoading = false,
  submitting = false,
  onClose,
  onSubmit,
}) => {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [stockCounts, setStockCounts] = useState({});
  const safeStockItems = Array.isArray(stockItems) ? stockItems : null;

  useEffect(() => {
    if (!isOpen) return;
    if (mode === "close") {
      setAmount(
        session?.expectedCash != null ? Number(session.expectedCash).toFixed(2) : "",
      );
      setNote("");
      setStockCounts(
        Object.fromEntries(
          (safeStockItems || []).map((item) => [
            item.productId || item.id,
            String(Number(item.theoreticalQuantity ?? item.quantity ?? 0)),
          ]),
        ),
      );
      return;
    }

    setAmount("");
    setNote("");
    setStockCounts({});
  }, [isOpen, mode, session?.expectedCash, safeStockItems]);

  const numericAmount = useMemo(() => {
    const parsed = Number(String(amount || "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amount]);

  const secondaryEnabled = hasSecondaryCurrency(currencySettings);
  const exchangeRateLabel = buildSecondaryRateLabel(currencySettings);
  const isCloseMode = mode === "close";
  const normalizedStockItems = (safeStockItems || []).map((item) => {
    const productId = item.productId || item.id;
    const theoreticalQuantity = Number(
      item.theoreticalQuantity ?? item.quantity ?? 0,
    );
    const countedRaw = stockCounts[productId];
    const countedQuantity =
      countedRaw === undefined || countedRaw === null || countedRaw === ""
        ? theoreticalQuantity
        : Number(String(countedRaw).replace(",", "."));

    return {
      productId,
      productName: item.productName || item.product || "Article",
      sku: item.sku || "",
      theoreticalQuantity,
      countedQuantity: Number.isFinite(countedQuantity) ? countedQuantity : theoreticalQuantity,
      varianceQuantity:
        (Number.isFinite(countedQuantity) ? countedQuantity : theoreticalQuantity) -
        theoreticalQuantity,
    };
  });
  const stockVarianceCount = normalizedStockItems.filter(
    (item) => Math.abs(Number(item.varianceQuantity || 0)) > 0.0001,
  ).length;

  const title = isCloseMode ? "Cloturer la caisse" : "Ouvrir la caisse";
  const description = isCloseMode
    ? "Saisissez le montant reellement compte en fin de service."
    : "Definissez le fonds de caisse initial avant d'enregistrer des ventes.";

  const handleConfirm = () => {
    if (submitting) return;
    if (isCloseMode && stockLoading) return;
    onSubmit?.({
      amount: numericAmount,
      note,
      stockItems: isCloseMode ? normalizedStockItems : [],
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
      dialogClassName={isCloseMode ? "max-w-5xl" : ""}
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
            type="text"
            inputMode="decimal"
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

        {isCloseMode ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Controle du stock vendeur
                </p>
                <p className="text-xs text-text-secondary">
                  Saisissez le stock reel constate a la fermeture pour voir les ecarts.
                </p>
              </div>
              <span className="rounded-full bg-background px-3 py-1 text-xs font-medium text-text-secondary">
                {stockVarianceCount} ecart(s)
              </span>
            </div>

            {stockLoading ? (
              <div className="rounded-xl border border-border bg-surface/70 px-4 py-3 text-sm text-text-secondary">
                Chargement du stock courant...
              </div>
            ) : normalizedStockItems.length ? (
              <div className="overflow-hidden rounded-xl border border-border bg-background">
                <div className="grid grid-cols-[minmax(0,1.8fr)_120px_120px_120px] gap-3 border-b border-border bg-surface/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  <span>Article</span>
                  <span className="text-right">Theorique</span>
                  <span className="text-right">Compte</span>
                  <span className="text-right">Ecart</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {normalizedStockItems.map((item) => (
                    <div
                      key={item.productId}
                      className="grid grid-cols-[minmax(0,1.8fr)_120px_120px_120px] gap-3 border-b border-border/70 px-4 py-3 text-sm last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-text-primary">
                          {item.productName}
                        </p>
                        {item.sku ? (
                          <p className="text-xs text-text-secondary">{item.sku}</p>
                        ) : null}
                      </div>
                      <div className="text-right text-text-primary">
                        {item.theoreticalQuantity}
                      </div>
                      <div>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={stockCounts[item.productId] ?? String(item.theoreticalQuantity)}
                          onChange={(event) =>
                            setStockCounts((current) => ({
                              ...current,
                              [item.productId]: event.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-right text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>
                      <div
                        className={[
                          "text-right font-medium",
                          item.varianceQuantity > 0
                            ? "text-success"
                            : item.varianceQuantity < 0
                              ? "text-danger"
                              : "text-text-secondary",
                        ].join(" ")}
                      >
                        {item.varianceQuantity > 0 ? "+" : ""}
                        {item.varianceQuantity}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-surface/70 px-4 py-3 text-sm text-text-secondary">
                Aucun article de caisse n'a ete trouve pour cette zone de stock.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default CashSessionModal;
