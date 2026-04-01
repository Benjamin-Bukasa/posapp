import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Modal from "./modal";
import SearchSelect from "./searchSelect";
import { apiGet } from "../../services/apiClient";
import useToastStore from "../../stores/toastStore";
import {
  convertCurrencyAmount,
  convertToPrimaryAmount,
  formatCurrencyAmount,
  formatPrimaryAmount,
  hasSecondaryCurrency,
} from "../../utils/currency";

const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Carte" },
  { value: "mobile", label: "Mobile Money" },
  { value: "transfer", label: "Transfert" },
];

const formatEditableAmount = (value) => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return "";
  return numericValue
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
};

const createEmptyItem = () => ({
  productId: "",
  quantity: 1,
});

const SaleEditModal = ({
  isOpen,
  onClose,
  sale,
  currencySettings,
  onSubmit,
  submitting = false,
}) => {
  const showToast = useToastStore((state) => state.showToast);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentCurrencyCode, setPaymentCurrencyCode] = useState(
    currencySettings?.primaryCurrencyCode || "USD",
  );
  const [amountReceived, setAmountReceived] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [saleItems, setSaleItems] = useState([createEmptyItem()]);

  const primaryCurrencyCode = currencySettings?.primaryCurrencyCode || "USD";
  const secondaryCurrencyCode = currencySettings?.secondaryCurrencyCode || "";
  const secondaryEnabled = hasSecondaryCurrency(currencySettings);

  useEffect(() => {
    if (!isOpen || !sale) return;

    const payment = sale.payments?.[0] || {};
    setCustomerId(sale.customerId || "");
    setPaymentMethod((payment.method || "CASH").toLowerCase());
    setPaymentCurrencyCode(
      payment.originalCurrencyCode || payment.currencyCode || primaryCurrencyCode,
    );
    setAmountReceived(
      formatEditableAmount(payment.originalAmount ?? payment.amount ?? sale.total ?? 0),
    );
    setReference(payment.reference || "");
    setReason("");
    setSaleItems(
      Array.isArray(sale.items) && sale.items.length
        ? sale.items.map((item) => ({
            productId: item.productId,
            quantity: Number(item.quantity || 1),
          }))
        : [createEmptyItem()],
    );
  }, [isOpen, primaryCurrencyCode, sale]);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const loadReferences = async () => {
      setLoadingCustomers(true);
      setLoadingProducts(true);
      try {
        const [customersResponse, productsResponse] = await Promise.all([
          apiGet("/api/customers"),
          apiGet("/api/products?kind=ARTICLE&includeComponents=true"),
        ]);
        if (!mounted) return;
        const customerList = Array.isArray(customersResponse?.data)
          ? customersResponse.data
          : customersResponse;
        const productList = Array.isArray(productsResponse?.data)
          ? productsResponse.data
          : productsResponse;
        setCustomers(Array.isArray(customerList) ? customerList : []);
        setProducts(Array.isArray(productList) ? productList : []);
      } catch (error) {
        if (!mounted) return;
        showToast({
          title: "Erreur",
          message:
            error.message || "Impossible de charger les references de la vente.",
          variant: "danger",
        });
      } finally {
        if (mounted) {
          setLoadingCustomers(false);
          setLoadingProducts(false);
        }
      }
    };

    loadReferences();
    return () => {
      mounted = false;
    };
  }, [isOpen, showToast]);

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: product.name,
      })),
    [products],
  );

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        value: customer.id,
        label:
          [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
          customer.phone ||
          customer.email ||
          customer.id,
      })),
    [customers],
  );

  const currencyOptions = useMemo(() => {
    const options = [{ code: primaryCurrencyCode, label: primaryCurrencyCode }];
    if (
      secondaryEnabled &&
      secondaryCurrencyCode &&
      secondaryCurrencyCode !== primaryCurrencyCode
    ) {
      options.push({ code: secondaryCurrencyCode, label: secondaryCurrencyCode });
    }
    return options;
  }, [primaryCurrencyCode, secondaryCurrencyCode, secondaryEnabled]);

  const normalizedItems = useMemo(
    () =>
      saleItems
        .map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity || 0),
        }))
        .filter((item) => item.productId && item.quantity > 0),
    [saleItems],
  );

  const recalculatedTotal = useMemo(
    () =>
      normalizedItems.reduce((sum, item) => {
        const product = productMap.get(item.productId);
        if (!product) return sum;
        return (
          sum +
          convertToPrimaryAmount(
            product.unitPrice ?? 0,
            product.currencyCode,
            currencySettings,
          ) * item.quantity
        );
      }, 0),
    [currencySettings, normalizedItems, productMap],
  );

  const numericAmount = Number.parseFloat(String(amountReceived || "").replace(",", "."));
  const safeNumericAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
  const amountPrimary = convertCurrencyAmount(
    safeNumericAmount,
    paymentCurrencyCode,
    primaryCurrencyCode,
    currencySettings,
  );

  const equivalentLabel =
    paymentCurrencyCode === primaryCurrencyCode ? secondaryCurrencyCode : primaryCurrencyCode;
  const equivalentAmount = equivalentLabel
    ? convertCurrencyAmount(
        safeNumericAmount,
        paymentCurrencyCode,
        equivalentLabel,
        currencySettings,
      )
    : null;

  const canSubmit = normalizedItems.length > 0 && !submitting;

  return (
    <Modal
      isOpen={isOpen}
      title="Modifier la vente"
      description="Mettez a jour les articles vendus, le client et les informations de paiement."
      confirmLabel={submitting ? "Enregistrement..." : "Enregistrer"}
      cancelLabel="Annuler"
      onCancel={onClose}
      dialogClassName="max-w-5xl"
      contentClassName="overflow-x-hidden"
      onConfirm={() =>
        canSubmit &&
        onSubmit?.({
          customerId: customerId || null,
          paymentMethod,
          paymentCurrencyCode,
          originalAmountReceived: safeNumericAmount,
          reference,
          reason,
          items: normalizedItems,
        })
      }
      confirmButtonClassName={submitting ? "opacity-70 pointer-events-none" : ""}
    >
      <div className="space-y-4 overflow-x-hidden">
        <div className="rounded-xl border border-border bg-surface/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">Articles vendus</p>
              <p className="text-xs text-text-secondary">
                Modifiez les lignes de vente. Le stock et le total seront recalcules.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSaleItems((prev) => [...prev, createEmptyItem()])}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-primary hover:bg-surface"
            >
              <Plus size={16} strokeWidth={1.5} />
              Ajouter
            </button>
          </div>

          <div className="space-y-3">
            {saleItems.map((item, index) => {
              const product = productMap.get(item.productId);
              const lineTotal = product
                ? convertToPrimaryAmount(
                    product.unitPrice ?? 0,
                    product.currencyCode,
                    currencySettings,
                  ) * Number(item.quantity || 0)
                : 0;

              return (
                <div
                  key={`sale-item-${index}`}
                  className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_180px_96px]"
                >
                  <label className="flex flex-col gap-2 text-sm text-text-primary">
                    <span>Article</span>
                    <SearchSelect
                      name={`sale-item-${index}-product`}
                      value={item.productId}
                      onChange={(nextValue) =>
                        setSaleItems((prev) =>
                          prev.map((entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, productId: nextValue }
                              : entry,
                          ),
                        )
                      }
                      options={productOptions}
                      placeholder="Rechercher un article"
                      emptyMessage="Aucun article trouve."
                      required
                    />
                    {loadingProducts ? (
                      <span className="text-xs text-text-secondary">Chargement des articles...</span>
                    ) : null}
                  </label>

                  <label className="flex flex-col gap-2 text-sm text-text-primary">
                    <span>Quantite</span>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(event) =>
                        setSaleItems((prev) =>
                          prev.map((entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, quantity: Number(event.target.value || 0) }
                              : entry,
                          ),
                        )
                      }
                      className="rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>

                  <div className="flex flex-col justify-end gap-2">
                    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-secondary">
                      {formatPrimaryAmount(lineTotal, currencySettings)}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSaleItems((prev) =>
                          prev.length > 1
                            ? prev.filter((_, entryIndex) => entryIndex !== index)
                            : [createEmptyItem()],
                        )
                      }
                      className="inline-flex items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-text-primary">
            <span>Client</span>
            <SearchSelect
              name="sale-customer"
              value={customerId}
              onChange={setCustomerId}
              options={customerOptions}
              placeholder="Rechercher un client"
              emptyMessage="Aucun client trouve."
            />
            <button
              type="button"
              onClick={() => setCustomerId("")}
              className="w-fit text-xs text-text-secondary underline-offset-2 hover:underline"
            >
              Utiliser client comptoir
            </button>
            {loadingCustomers ? (
              <span className="text-xs text-text-secondary">Chargement des clients...</span>
            ) : null}
          </label>

          <label className="flex flex-col gap-2 text-sm text-text-primary">
            <span>Mode de paiement</span>
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
            >
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
          <label className="flex flex-col gap-2 text-sm text-text-primary">
            <span>Devise remise</span>
            <select
              value={paymentCurrencyCode}
              onChange={(event) => setPaymentCurrencyCode(event.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
            >
              {currencyOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm text-text-primary">
            <span>Montant remis</span>
            <input
              type="text"
              value={amountReceived}
              onChange={(event) => setAmountReceived(event.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
              placeholder="0.00"
            />
          </label>
        </div>

        <label className="flex flex-col gap-2 text-sm text-text-primary">
          <span>Reference</span>
          <input
            type="text"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
            placeholder="Reference optionnelle"
          />
        </label>

        <div className="rounded-xl border border-border bg-surface/70 p-3 text-sm text-text-secondary">
          <div className="flex items-center justify-between gap-4">
            <span>Total recalcule</span>
            <span className="font-semibold text-text-primary">
              {formatPrimaryAmount(recalculatedTotal, currencySettings)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-4">
            <span>Montant recu converti</span>
            <span className="font-semibold text-text-primary">
              {formatPrimaryAmount(amountPrimary, currencySettings)}
            </span>
          </div>
          {equivalentLabel ? (
            <div className="mt-2 flex items-center justify-between gap-4">
              <span>Equivalent en {equivalentLabel}</span>
              <span className="font-semibold text-text-primary">
                {formatCurrencyAmount(equivalentAmount, equivalentLabel)}
              </span>
            </div>
          ) : null}
        </div>

        <label className="flex flex-col gap-2 text-sm text-text-primary">
          <span>Motif</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            className="rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
            placeholder="Expliquez la modification pour l'historique"
          />
        </label>
      </div>
    </Modal>
  );
};

export default SaleEditModal;
