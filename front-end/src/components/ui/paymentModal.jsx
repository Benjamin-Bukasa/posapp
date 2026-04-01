import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  DollarSign,
  Smartphone,
  UserPlus,
  X,
} from "lucide-react";
import CustomerCreateModal from "./customerCreateModal";
import { apiGet, apiPost } from "../../services/apiClient";
import useToastStore from "../../stores/toastStore";
import { formatName } from "../../utils/formatters";
import {
  buildSecondaryRateLabel,
  convertCurrencyAmount,
  convertToPrimaryAmount,
  formatConvertedPrimaryAmount,
  formatCurrencyAmount,
  formatPrimaryAmount,
  formatSecondaryAmount,
  hasSecondaryCurrency,
} from "../../utils/currency";

const formatEditableAmount = (value) => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) {
    return "";
  }

  return numericValue
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
};

const PaymentModal = ({
  isOpen,
  onClose,
  cartItems = [],
  totalAmount = 0,
  currencySettings,
  cashSession = null,
  onConfirm,
}) => {
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState("");
  const [amountDirty, setAmountDirty] = useState(false);
  const [paymentCurrencyCode, setPaymentCurrencyCode] = useState(
    currencySettings?.primaryCurrencyCode || "USD",
  );
  const [customerQuery, setCustomerQuery] = useState("");
  const [isCustomerMenuOpen, setIsCustomerMenuOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bonusProgram, setBonusProgram] = useState(null);
  const showToast = useToastStore((state) => state.showToast);

  const normalizeCustomer = useCallback(
    (customer) => ({
      ...customer,
      name: formatName(customer),
      phone: customer?.phone || "",
      points: Number(customer?.points || 0),
    }),
    [],
  );

  const loadCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const data = await apiGet("/api/customers");
      const list = Array.isArray(data?.data) ? data.data : data;
      const normalized = Array.isArray(list)
        ? list.map(normalizeCustomer)
        : [];
      setCustomers(normalized);
    } catch (error) {
      showToast({
        title: "Erreur",
        message: error.message || "Impossible de charger les clients.",
        variant: "danger",
      });
    } finally {
      setLoadingCustomers(false);
    }
  }, [normalizeCustomer, showToast]);

  const loadBonusProgram = useCallback(async () => {
    try {
      const program = await apiGet("/api/customer-bonus-programs/current");
      setBonusProgram(program || null);
    } catch (_error) {
      setBonusProgram(null);
    }
  }, []);

  const primaryCurrencyCode = currencySettings?.primaryCurrencyCode || "USD";
  const secondaryCurrencyCode = currencySettings?.secondaryCurrencyCode || "";
  const secondaryEnabled = hasSecondaryCurrency(currencySettings);
  const exchangeRateLabel = buildSecondaryRateLabel(currencySettings);

  const resolvedTotalAmount = useMemo(() => {
    const computed = cartItems.reduce(
      (sum, item) =>
        sum +
        convertToPrimaryAmount(
          item.price ?? 0,
          item.currencyCode,
          currencySettings,
        ) *
          Number(item.cartQty || 0),
      0,
    );

    return computed > 0 ? computed : Number(totalAmount || 0);
  }, [cartItems, currencySettings, totalAmount]);

  useEffect(() => {
    if (!isOpen) return;
    setMethod("cash");
    setAmount(formatEditableAmount(resolvedTotalAmount));
    setAmountDirty(false);
    setPaymentCurrencyCode(primaryCurrencyCode);
    setCustomerQuery("");
    setSelectedCustomer(null);
    setIsCustomerMenuOpen(false);
    setSubmitting(false);
    loadCustomers();
    loadBonusProgram();
  }, [
    isOpen,
    loadBonusProgram,
    loadCustomers,
    primaryCurrencyCode,
    resolvedTotalAmount,
  ]);

  const inputAmount = useMemo(() => {
    const value = parseFloat(String(amount || "").replace(",", "."));
    return Number.isNaN(value) ? 0 : value;
  }, [amount]);

  const normalizedPaymentCurrencyCode =
    paymentCurrencyCode || primaryCurrencyCode;

  const paymentCurrencyOptions = useMemo(() => {
    const options = [
      { code: primaryCurrencyCode, label: primaryCurrencyCode },
    ];

    if (secondaryEnabled && secondaryCurrencyCode && secondaryCurrencyCode !== primaryCurrencyCode) {
      options.push({
        code: secondaryCurrencyCode,
        label: secondaryCurrencyCode,
      });
    }

    return options;
  }, [primaryCurrencyCode, secondaryCurrencyCode, secondaryEnabled]);

  const receivedAmountPrimary = useMemo(
    () =>
      convertCurrencyAmount(
        inputAmount,
        normalizedPaymentCurrencyCode,
        primaryCurrencyCode,
        currencySettings,
      ),
    [currencySettings, inputAmount, normalizedPaymentCurrencyCode, primaryCurrencyCode],
  );

  const changePrimary = Math.max(0, receivedAmountPrimary - resolvedTotalAmount);
  const changeInPaymentCurrency = useMemo(
    () =>
      convertCurrencyAmount(
        changePrimary,
        primaryCurrencyCode,
        normalizedPaymentCurrencyCode,
        currencySettings,
      ),
    [changePrimary, currencySettings, normalizedPaymentCurrencyCode, primaryCurrencyCode],
  );

  const amountEquivalentCurrencyCode = useMemo(() => {
    if (normalizedPaymentCurrencyCode === primaryCurrencyCode) {
      return secondaryEnabled ? secondaryCurrencyCode : "";
    }

    return primaryCurrencyCode;
  }, [
    normalizedPaymentCurrencyCode,
    primaryCurrencyCode,
    secondaryCurrencyCode,
    secondaryEnabled,
  ]);

  const formatAmountEquivalent = useCallback(
    (amountValue, sourceCurrencyCode) => {
      if (!amountEquivalentCurrencyCode) return null;

      if (sourceCurrencyCode === primaryCurrencyCode) {
        return formatSecondaryAmount(amountValue, currencySettings, primaryCurrencyCode);
      }

      return formatPrimaryAmount(
        convertCurrencyAmount(
          amountValue,
          sourceCurrencyCode,
          primaryCurrencyCode,
          currencySettings,
        ),
        currencySettings,
      );
    },
    [amountEquivalentCurrencyCode, currencySettings, primaryCurrencyCode],
  );

  const canSubmitPayment =
    Boolean(cashSession) && resolvedTotalAmount > 0 && !submitting;

  const pointsEarned = useMemo(() => {
    if (!selectedCustomer || resolvedTotalAmount <= 0) return 0;
    const threshold = Number(bonusProgram?.amountThreshold || 0);
    const points = Number(bonusProgram?.pointsAwarded || 0);
    if (
      Number.isFinite(threshold) &&
      threshold > 0 &&
      Number.isFinite(points) &&
      points > 0
    ) {
      return Math.max(
        0,
        Math.floor(resolvedTotalAmount / threshold) * Math.trunc(points),
      );
    }
    return Math.max(1, Math.floor(resolvedTotalAmount / 10));
  }, [bonusProgram, selectedCustomer, resolvedTotalAmount]);

  const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "<-"];

  const handleKey = (key) => {
    if (key === "<-") {
      if (!amountDirty) {
        setAmount("");
        setAmountDirty(true);
        return;
      }
      setAmount((prev) => prev.slice(0, -1));
      return;
    }

    if (!amountDirty) {
      setAmount(key === "." ? "0." : key);
      setAmountDirty(true);
      return;
    }

    if (key === "." && amount.includes(".")) return;
    setAmount((prev) => `${prev}${key}`);
  };

  const quickAmounts = [5, 10, 20, 50];

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) return customers;
    const digits = query.replace(/\D/g, "");
    return customers.filter((customer) => {
      const nameMatch = customer.name.toLowerCase().includes(query);
      const phoneMatch = digits
        ? customer.phone.replace(/\s/g, "").includes(digits)
        : false;
      return nameMatch || phoneMatch;
    });
  }, [customerQuery, customers]);

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setCustomerQuery(`${customer.name} - ${customer.phone}`);
    setIsCustomerMenuOpen(false);
  };

  const handleCreateCustomer = () => {
    setIsCustomerMenuOpen(false);
    setIsCreateOpen(true);
  };

  const handlePaymentCurrencyChange = (nextCurrencyCode) => {
    if (!nextCurrencyCode || nextCurrencyCode === normalizedPaymentCurrencyCode) {
      return;
    }

    const currentVisibleAmount = amountDirty
      ? inputAmount
      : convertCurrencyAmount(
          resolvedTotalAmount,
          primaryCurrencyCode,
          normalizedPaymentCurrencyCode,
          currencySettings,
        );

    const nextVisibleAmount = convertCurrencyAmount(
      currentVisibleAmount,
      normalizedPaymentCurrencyCode,
      nextCurrencyCode,
      currencySettings,
    );

    setPaymentCurrencyCode(nextCurrencyCode);
    setAmount(formatEditableAmount(nextVisibleAmount));
  };

  const handleSubmitPayment = async () => {
    if (!cashSession) {
      showToast({
        title: "Caisse fermee",
        message: "Ouvrez une caisse avant de valider une vente.",
        variant: "warning",
      });
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm?.({
        amount: receivedAmountPrimary,
        originalAmountReceived: inputAmount,
        paymentCurrencyCode: normalizedPaymentCurrencyCode,
        method,
        customer: selectedCustomer,
        pointsEarned,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="Fermer la fenetre"
        onClick={onClose}
        disabled={submitting}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-surface shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex items-start justify-between border-b border-border px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs text-text-secondary">Vente</p>
            <h3 className="text-xl font-semibold text-text-primary">Paiement</h3>
            {exchangeRateLabel ? (
              <p className="mt-1 text-xs text-text-secondary">{exchangeRateLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary hover:bg-surface/70 hover:text-text-primary"
            aria-label="Fermer"
            disabled={submitting}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="grid gap-6 px-4 py-5 md:grid-cols-[1.1fr_0.9fr] sm:px-6">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs font-semibold uppercase text-text-secondary">
                Client
              </p>
              <div className="relative mt-2">
                <input
                  type="text"
                  value={customerQuery}
                  onChange={(event) => {
                    setCustomerQuery(event.target.value);
                    setIsCustomerMenuOpen(true);
                  }}
                  onFocus={() => setIsCustomerMenuOpen(true)}
                  onBlur={() => {
                    setTimeout(() => setIsCustomerMenuOpen(false), 120);
                  }}
                  placeholder="Nom ou telephone"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
                {isCustomerMenuOpen ? (
                  <div className="absolute z-20 mt-2 w-full rounded-lg border border-border bg-surface shadow-lg">
                    {loadingCustomers ? (
                      <div className="p-3 text-sm text-text-secondary">
                        Chargement des clients...
                      </div>
                    ) : filteredCustomers.length > 0 ? (
                      <div className="max-h-52 overflow-y-auto">
                        {filteredCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSelectCustomer(customer)}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-text-primary hover:bg-surface/70"
                          >
                            <div>
                              <p className="font-medium">{customer.name}</p>
                              <p className="text-xs text-text-secondary">{customer.phone}</p>
                            </div>
                            <span className="text-xs text-text-secondary">
                              {customer.points} pts
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 text-sm text-text-secondary">
                        <p>Client introuvable.</p>
                        <p className="mt-1">Creer un compte ?</p>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCreateCustomer}
                            className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-white hover:bg-secondary/90"
                          >
                            <UserPlus size={14} strokeWidth={1.5} />
                            Oui
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsCustomerMenuOpen(false)}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface/70"
                          >
                            Non
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              {selectedCustomer ? (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-surface/80 px-3 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-text-primary">{selectedCustomer.name}</p>
                    <p className="text-xs text-text-secondary">{selectedCustomer.phone}</p>
                  </div>
                  <div className="text-xs text-text-secondary">
                    Points: <span className="font-semibold text-text-primary">{selectedCustomer.points}</span>
                  </div>
                </div>
              ) : null}
              {selectedCustomer && pointsEarned > 0 ? (
                <p className="mt-2 text-xs text-text-secondary">
                  +{pointsEarned} points a l'achat
                  {bonusProgram?.pointValueAmount
                    ? ` • equivalent ${(
                        pointsEarned * Number(bonusProgram.pointValueAmount || 0)
                      ).toFixed(2)}`
                    : ""}
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs font-semibold uppercase text-text-secondary">
                Details de la transaction
              </p>
              <div className="no-scrollbar mt-3 max-h-[28vh] space-y-3 overflow-y-auto">
                {cartItems.length === 0 ? (
                  <p className="text-sm text-text-secondary">Panier vide</p>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-text-primary">{item.product}</p>
                        <p className="text-xs text-text-secondary">
                          {item.cartQty} x {" "}
                          {formatConvertedPrimaryAmount(
                            item.price,
                            item.currencyCode,
                            currencySettings,
                          )}
                        </p>
                        {secondaryEnabled ? (
                          <p className="text-[10px] text-text-secondary">
                            {item.cartQty} x {" "}
                            {formatSecondaryAmount(
                              item.price,
                              currencySettings,
                              item.currencyCode,
                            )}
                          </p>
                        ) : null}
                      </div>
                      <p className="font-semibold text-text-primary">
                        {formatPrimaryAmount(
                          item.cartQty *
                            convertToPrimaryAmount(
                              item.price ?? 0,
                              item.currencyCode,
                              currencySettings,
                            ),
                          currencySettings,
                        )}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              {!cashSession ? (
                <div className="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                  Aucune caisse ouverte. Ouvrez d'abord la caisse avant d'encaisser.
                </div>
              ) : null}
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-text-secondary">Total ({primaryCurrencyCode})</span>
                <div className="flex flex-col items-end">
                  <span className="font-semibold text-text-primary">
                    {formatPrimaryAmount(resolvedTotalAmount, currencySettings)}
                  </span>
                  {secondaryEnabled ? (
                    <span className="text-[10px] text-text-secondary">
                      Equivalent en {secondaryCurrencyCode}: {" "}
                      {formatSecondaryAmount(resolvedTotalAmount, currencySettings)}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-text-secondary">
                  Montant recu ({normalizedPaymentCurrencyCode})
                </span>
                <div className="flex flex-col items-end">
                  <span className="font-semibold text-text-primary">
                    {formatCurrencyAmount(inputAmount, normalizedPaymentCurrencyCode)}
                  </span>
                  {amountEquivalentCurrencyCode ? (
                    <span className="text-[10px] text-text-secondary">
                      Equivalent en {amountEquivalentCurrencyCode}: {" "}
                      {formatAmountEquivalent(inputAmount, normalizedPaymentCurrencyCode)}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-text-secondary">
                  Monnaie ({normalizedPaymentCurrencyCode})
                </span>
                <div className="flex flex-col items-end">
                  <span className="font-semibold text-text-primary">
                    {formatCurrencyAmount(changeInPaymentCurrency, normalizedPaymentCurrencyCode)}
                  </span>
                  {amountEquivalentCurrencyCode ? (
                    <span className="text-[10px] text-text-secondary">
                      Equivalent en {amountEquivalentCurrencyCode}: {" "}
                      {formatAmountEquivalent(changeInPaymentCurrency, normalizedPaymentCurrencyCode)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs font-semibold uppercase text-text-secondary">
                Mode de paiement
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {[
                  { id: "cash", label: "Cash", icon: DollarSign },
                  { id: "card", label: "Carte", icon: CreditCard },
                  { id: "mobile", label: "Mobile", icon: Smartphone },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = method === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setMethod(item.id)}
                      className={[
                        "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
                        active
                          ? "border-secondary bg-secondary/10 text-secondary"
                          : "border-border bg-surface text-text-primary hover:bg-surface/70",
                      ].join(" ")}
                    >
                      <Icon size={16} strokeWidth={1.5} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs font-semibold uppercase text-text-secondary">
                Devise remise
              </p>
              <select
                value={normalizedPaymentCurrencyCode}
                onChange={(event) => handlePaymentCurrencyChange(event.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {paymentCurrencyOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs font-semibold uppercase text-text-secondary">
                Montant recu
              </p>
              <input
                type="text"
                value={amount}
                onFocus={(event) => {
                  if (!amountDirty) {
                    event.target.select();
                  }
                }}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setAmountDirty(true);
                }}
                className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-lg font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="0.00"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                {quickAmounts.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setAmount(value.toString());
                      setAmountDirty(true);
                    }}
                    className="rounded-lg bg-background px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface dark:border dark:border-border dark:bg-surface dark:hover:bg-surface/70"
                  >
                    {formatCurrencyAmount(value, normalizedPaymentCurrencyCode)}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {keypad.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKey(key)}
                    className="rounded-lg border border-border bg-surface py-2 text-sm font-semibold text-text-primary hover:bg-surface/70"
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmitPayment}
              disabled={!canSubmitPayment}
              className={[
                "w-full rounded-lg px-4 py-3 text-sm font-semibold text-white",
                !canSubmitPayment
                  ? "cursor-not-allowed bg-background text-text-secondary"
                  : "bg-secondary hover:bg-secondary/90",
              ].join(" ")}
            >
              {submitting
                ? "Enregistrement..."
                : !cashSession
                  ? "Ouvrir une caisse d'abord"
                  : "Payer maintenant"}
            </button>
          </div>
        </div>
      </div>

      <CustomerCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        nextSequence={customers.length + 1}
        onSubmit={async (payload) => {
          try {
            const created = await apiPost("/api/customers", payload);
            const normalized = normalizeCustomer(created);
            setCustomers((prev) => [normalized, ...prev]);
            handleSelectCustomer(normalized);
            setIsCreateOpen(false);
            return normalized;
          } catch (error) {
            showToast({
              title: "Erreur",
              message: error.message || "Impossible de creer le client.",
              variant: "danger",
            });
            throw error;
          }
        }}
      />
    </div>
  );
};

export default PaymentModal;
