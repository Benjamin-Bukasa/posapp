import React, { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import Badge from "../components/ui/badge";
import Button from "../components/ui/button";
import Input from "../components/ui/input";
import DropdownFilter from "../components/ui/dropdownFilter";
import DropdownSort from "../components/ui/dropdownSort";
import PaymentModal from "../components/ui/paymentModal";
import { resolveCategoryAvatar } from "./ProductsList";
import { useProductsData } from "../hooks/useProductsData";
import { apiPost, buildUrl } from "../services/apiClient";
import useAuthStore from "../stores/authStore";
import useCounterStore from "../stores/counterStore";
import useCurrencyStore from "../stores/currencyStore";
import useToastStore from "../stores/toastStore";
import {
  buildSecondaryRateLabel,
  convertToPrimaryAmount,
  formatConvertedPrimaryAmount,
  formatPrimaryAmount,
  formatSecondaryAmount,
  hasSecondaryCurrency,
} from "../utils/currency";
import printReceiptViaLocalService from "../utils/localPrintService";
import { printSaleReceipt } from "../utils/printSaleReceipt";

const CounterList = () => {
  const cartItems = useCounterStore((state) => state.cartItems);
  const addToCart = useCounterStore((state) => state.addToCart);
  const updateCartQty = useCounterStore((state) => state.updateCartQty);
  const removeCartItem = useCounterStore((state) => state.removeCartItem);
  const clearCart = useCounterStore((state) => state.clearCart);
  const showToast = useToastStore((state) => state.showToast);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const search = useCounterStore((state) => state.search);
  const setSearch = useCounterStore((state) => state.setSearch);
  const filterValues = useCounterStore((state) => state.filterValues);
  const setFilterValues = useCounterStore((state) => state.setFilterValues);
  const sortValues = useCounterStore((state) => state.sortValues);
  const setSortValues = useCounterStore((state) => state.setSortValues);
  const user = useAuthStore((state) => state.user);
  const currencySettings = useCurrencyStore((state) => state.settings);
  const loadCurrencySettings = useCurrencyStore((state) => state.loadSettings);

  const resolveProductImage = (product) =>
    product?.imageUrl ? buildUrl(product.imageUrl) : resolveCategoryAvatar(product?.category, product?.id);

  const {
    products,
    loading: productsLoading,
    refresh: refreshProducts,
  } = useProductsData({
    storeId: user?.storeId,
    storageZoneId: user?.defaultStorageZoneId,
  });

  const productList = useMemo(() => products, [products]);
  const secondaryEnabled = hasSecondaryCurrency(currencySettings);
  const exchangeRateLabel = buildSecondaryRateLabel(currencySettings);

  useEffect(() => {
    loadCurrencySettings();
  }, [loadCurrencySettings]);

  const filteredProducts = useMemo(() => {
    const searchQuery = search.trim().toLowerCase();
    const keywordQuery = (filterValues.keyword ?? "").trim().toLowerCase();
    const hasSearch = Boolean(searchQuery);
    const hasKeyword = Boolean(keywordQuery);
    const statusFilter =
      filterValues.status && filterValues.status !== "all"
        ? filterValues.status.toLowerCase()
        : "";
    const stockFilter =
      filterValues.stock && filterValues.stock !== "all"
        ? filterValues.stock.toLowerCase()
        : "";
    const categoryFilter =
      filterValues.category && filterValues.category !== "all"
        ? filterValues.category.toLowerCase()
        : "";

    return productList.filter((product) => {
      const productName = product.product?.toLowerCase() ?? "";
      const category = product.category?.toLowerCase() ?? "";
      const status = product.status?.toLowerCase() ?? "";
      const stock = product.stock?.toLowerCase() ?? "";

      if (statusFilter && status !== statusFilter) return false;
      if (stockFilter && stock !== stockFilter) return false;

      if (categoryFilter) {
        const categoryValue = product.category?.toLowerCase() ?? "";
        if (categoryValue !== categoryFilter) return false;
      }

      const haystack = `${productName} ${category} ${status} ${stock}`;
      if (hasSearch && !haystack.includes(searchQuery)) return false;
      if (hasKeyword && !haystack.includes(keywordQuery)) return false;

      return true;
    });
  }, [productList, search, filterValues]);

  const sortedProducts = useMemo(() => {
    const next = [...filteredProducts];
    const compareText = (aValue, bValue, direction) => {
      const aText = (aValue ?? "").toString().toLowerCase();
      const bText = (bValue ?? "").toString().toLowerCase();
      if (direction === "desc" || direction === "za") {
        return bText.localeCompare(aText);
      }
      return aText.localeCompare(bText);
    };
    const compareDate = (aValue, bValue, direction) => {
      const aDate = aValue ? new Date(aValue).getTime() : 0;
      const bDate = bValue ? new Date(bValue).getTime() : 0;
      if (direction === "desc") return bDate - aDate;
      return aDate - bDate;
    };

    next.sort((a, b) => {
      const dateValueA = a.date || a.createdAt || a.updatedAt;
      const dateValueB = b.date || b.createdAt || b.updatedAt;
      const dateCompare = compareDate(dateValueA, dateValueB, sortValues.date);
      if (dateCompare !== 0) return dateCompare;

      const activityCompare = compareText(
        a.activity ?? "",
        b.activity ?? "",
        sortValues.activity,
      );
      if (activityCompare !== 0) return activityCompare;

      return compareText(a.product ?? "", b.product ?? "", sortValues.name);
    });

    return next;
  }, [filteredProducts, sortValues]);

  const [page, setPage] = useState(1);
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / pageSize));
  const { pagedProducts, rangeLabel } = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, sortedProducts.length);
    const slice = sortedProducts.slice(startIndex, endIndex);
    const label =
      sortedProducts.length === 0
        ? "0 sur 0"
        : `${startIndex + 1}-${endIndex} sur ${sortedProducts.length}`;
    return { pagedProducts: slice, rangeLabel: label };
  }, [sortedProducts, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, filterValues, sortValues]);

  const totalItems = cartItems.reduce((sum, item) => sum + item.cartQty, 0);
  const totalAmount = cartItems.reduce(
    (sum, item) =>
      sum +
      convertToPrimaryAmount(
        item.price ?? 0,
        item.currencyCode,
        currencySettings,
      ) *
        item.cartQty,
    0,
  );

  const getPaginationItems = (current, total) => {
    if (total <= 5) {
      return Array.from({ length: total }, (_, index) => ({
        type: "page",
        value: index + 1,
      }));
    }

    const items = [];
    const addPage = (value) => items.push({ type: "page", value });
    const addEllipsis = (key) => items.push({ type: "ellipsis", key });

    addPage(1);

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    if (start > 2) addEllipsis("left");

    for (let value = start; value <= end; value += 1) {
      addPage(value);
    }

    if (end < total - 1) addEllipsis("right");

    addPage(total);

    return items;
  };

  const handleConfirmSale = async ({ amount, method, customer, pointsEarned }) => {
    if (amount < totalAmount) {
      showToast({
        title: "Paiement insuffisant",
        message: "Le montant recu est inferieur au total.",
        variant: "warning",
      });
      return;
    }

    try {
      const createdOrder = await apiPost("/api/orders", {
        customerId: customer?.id || undefined,
        paymentMethod: method,
        amountReceived: amount,
        pointsEarned,
        items: cartItems.map((item) => ({
          productId: item.id,
          quantity: item.cartQty,
        })),
      });

      const awardedPoints = Number(createdOrder?.loyaltyPoints ?? pointsEarned ?? 0);

      if (customer && awardedPoints > 0) {
        showToast({
          title: "Points fidelite",
          message: `+${awardedPoints} points pour ${customer.name}.`,
          variant: "info",
        });
      }

      if (createdOrder?.bonusUnlocked && customer) {
        showToast({
          title: "Quota bonus atteint",
          message:
            createdOrder.bonusUnlocked.rewardAmount > 0
              ? `${customer.name} atteint ${createdOrder.bonusUnlocked.quotaPoints} points sur ${createdOrder.bonusUnlocked.quotaPeriodDays} jours. Prime: ${createdOrder.bonusUnlocked.rewardAmount}.`
              : `${customer.name} atteint ${createdOrder.bonusUnlocked.quotaPoints} points sur ${createdOrder.bonusUnlocked.quotaPeriodDays} jours.`,
          variant: "success",
        });
      }

      showToast({
        title: "Paiement accepte",
        message: `Methode: ${method}. Total: ${formatPrimaryAmount(
          totalAmount,
          currencySettings,
        )}`,
        variant: "success",
      });

      try {
        await printReceiptViaLocalService({
          order: createdOrder,
          amountReceived: amount,
          cashierName:
            [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
            user?.email ||
            "Caissier",
          storeName: createdOrder?.store?.name || user?.storeName || "Boutique",
          businessName: createdOrder?.store?.name || user?.storeName || "NeoPharma",
        });
      } catch (printError) {
        try {
          printSaleReceipt({
            order: createdOrder,
            amountReceived: amount,
            cashierName:
              [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
              user?.email ||
              "Caissier",
            storeName: createdOrder?.store?.name || user?.storeName || "Boutique",
            businessName: createdOrder?.store?.name || user?.storeName || "NeoPharma",
          });
          showToast({
            title: "Service local indisponible",
            message:
              printError.message ||
              "Le ticket a ete bascule vers l'impression navigateur.",
            variant: "warning",
          });
        } catch (browserPrintError) {
          showToast({
            title: "Impression impossible",
            message:
              printError.message ||
              browserPrintError.message ||
              "Le ticket n'a pas pu etre imprime.",
            variant: "warning",
          });
        }
      }

      clearCart();
      setIsPaymentOpen(false);
      await refreshProducts();
    } catch (error) {
      showToast({
        title: "Erreur",
        message: error.message || "Impossible d'enregistrer la vente.",
        variant: "danger",
      });
    }
  };

  return (
    <>
      <section className="sectionDashboard">
        <div className="mainBloc">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-text-primary">Caisse</h1>
              <p className="text-sm text-text-secondary">
                Selectionnez les articles a ajouter au panier.
              </p>
              {exchangeRateLabel ? (
                <p className="mt-1 text-xs text-text-secondary">{exchangeRateLabel}</p>
              ) : null}
            </div>
            <div className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-secondary sm:w-auto">
              Articles: <span className="font-semibold text-text-primary">{totalItems}</span>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-surface p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full sm:max-w-xs">
                <Input
                  name="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher..."
                  type="text"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DropdownFilter
                  onApply={setFilterValues}
                  showDateRange={false}
                  showCategory
                />
                <DropdownSort onApply={setSortValues} />
              </div>
            </div>
          </div>

          <div className="no-scrollbar mt-4 max-h-[65vh] overflow-y-auto border-y border-border bg-surface p-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {productsLoading ? (
                <div className="col-span-full text-center text-sm text-text-secondary">
                  Chargement...
                </div>
              ) : pagedProducts.length === 0 ? (
                <div className="col-span-full text-center text-sm text-text-secondary">
                  Aucun article disponible
                </div>
              ) : (
                pagedProducts.map((product) => {
                  const isOut =
                    Number(product.quantity) <= 0 || product.hasTechnicalSheet === false;
                  return (
                    <div
                      key={product.id}
                      className="flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-4"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={resolveProductImage(product)}
                          alt={product.product}
                          className="h-12 w-12 rounded-lg object-cover"
                          loading="lazy"
                        />
                        <div className="flex-1">
                          <div>
                            <p className="text-[11px] text-text-secondary">
                              {product.category}
                            </p>
                            <h3 className="text-[13px] font-semibold text-text-primary">
                              {product.product}
                            </h3>
                          </div>
                        </div>
                      </div>
                      <div className="text-[11px] text-text-secondary">
                        Stock: <span className="font-semibold text-text-primary">{product.quantity}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 text-[11px] text-text-secondary">
                        <div className="flex flex-col">
                          <span>
                            Prix:{" "}
                            <span className="font-semibold text-text-primary">
                              {formatConvertedPrimaryAmount(
                                product.price,
                                product.currencyCode,
                                currencySettings,
                              )}
                            </span>
                          </span>
                          {secondaryEnabled ? (
                            <span className="text-[10px] text-text-secondary">
                              {formatSecondaryAmount(
                                product.price,
                                currencySettings,
                                product.currencyCode,
                              )}
                            </span>
                          ) : null}
                        </div>
                        <Badge status={product.stock} />
                      </div>
                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        disabled={isOut}
                        className={[
                          "rounded-lg px-3 py-2 text-sm font-medium",
                          isOut
                            ? "cursor-not-allowed bg-neutral-200 text-text-secondary dark:bg-surface dark:border dark:border-border"
                            : "bg-primary text-white hover:bg-primary/90",
                        ].join(" ")}
                      >
                        {product.hasTechnicalSheet === false
                          ? "Fiche requise"
                          : isOut
                            ? "Epuise"
                            : "Ajouter"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-center text-sm text-text-secondary sm:text-left">{rangeLabel}</div>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
              {getPaginationItems(page, totalPages).map((item) => {
                if (item.type === "ellipsis") {
                  return (
                    <button
                      key={item.key}
                      type="button"
                      disabled
                      className="cursor-default rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm font-medium text-text-secondary"
                    >
                      ...
                    </button>
                  );
                }

                const isActive = item.value === page;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      if (isActive) return;
                      setPage(item.value);
                    }}
                    className={[
                      "rounded-lg border px-3 py-1.5 text-sm font-medium",
                      isActive
                        ? "border-[#b0bbb7] bg-[#b0bbb7] text-text-primary dark:border-[#1D473F] dark:bg-[#1D473F] dark:text-white"
                        : "border-border bg-surface text-text-primary hover:bg-surface/70 dark:bg-surface/70 dark:text-text-primary",
                    ].join(" ")}
                  >
                    {item.value}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="sideBloc flex h-full flex-col">
          <div className="rounded-xl border border-border bg-surface p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Panier</h2>
                <p className="text-xs text-text-secondary">{cartItems.length} article(s)</p>
              </div>
              <div className="rounded-lg border border-border bg-surface px-3 py-1 text-xs text-text-secondary">
                <div className="flex flex-col items-end">
                  <span>
                    Total:{" "}
                    <span className="font-semibold text-text-primary">
                      {formatPrimaryAmount(totalAmount, currencySettings)}
                    </span>
                  </span>
                  {secondaryEnabled ? (
                    <span className="text-[10px] text-text-secondary">
                      {formatSecondaryAmount(totalAmount, currencySettings)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="no-scrollbar mt-3 max-h-[65vh] overflow-y-auto rounded-xl bg-surface p-3">
            <div className="flex flex-col gap-3">
              {cartItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-text-secondary">
                  Panier vide
                </div>
              ) : (
                cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-surface/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-1 items-start gap-3">
                      <img
                        src={resolveProductImage(item)}
                        alt={item.product}
                        className="h-12 w-12 rounded-lg object-cover"
                        loading="lazy"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-text-primary">{item.product}</p>
                        <p className="text-xs text-text-secondary">{item.category}</p>
                        <p className="text-xs text-text-secondary">
                          {formatConvertedPrimaryAmount(
                            item.price,
                            item.currencyCode,
                            currencySettings,
                          )}{" "}
                          / unite
                        </p>
                        {secondaryEnabled ? (
                          <p className="text-[10px] text-text-secondary">
                            {formatSecondaryAmount(
                              item.price,
                              currencySettings,
                              item.currencyCode,
                            )}{" "}
                            / unite
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => removeCartItem(item.id)}
                        className="rounded-md border border-border bg-surface p-1 text-danger hover:bg-danger/10"
                        aria-label="Supprimer l'article"
                      >
                        <Trash2 size={16} strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.id, -1)}
                        className="rounded-md border border-border bg-surface p-1 text-text-primary hover:bg-surface/70"
                        aria-label="Reduire la quantite"
                      >
                        <Minus size={16} strokeWidth={1.5} />
                      </button>
                      <span className="min-w-6 text-center text-sm font-semibold text-text-primary">
                        {item.cartQty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.id, 1)}
                        className="rounded-md border border-border bg-surface p-1 text-text-primary hover:bg-surface/70"
                        aria-label="Augmenter la quantite"
                      >
                        <Plus size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-border bg-surface p-3">
            <div className="flex flex-col gap-2">
              <Button
                label="Valider la vente"
                variant="primary"
                size="default"
                disabled={cartItems.length === 0}
                onClick={() => setIsPaymentOpen(true)}
                className={[
                  "w-full",
                  cartItems.length === 0 ? "cursor-not-allowed opacity-70" : "",
                ].join(" ")}
              />
              <Button
                label="Vider le panier"
                variant="default"
                size="default"
                onClick={clearCart}
                disabled={cartItems.length === 0}
                className={[
                  "w-full",
                  cartItems.length === 0 ? "cursor-not-allowed opacity-70" : "",
                ].join(" ")}
              />
            </div>
          </div>
        </div>
      </section>

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        cartItems={cartItems}
        totalAmount={totalAmount}
        currencySettings={currencySettings}
        onConfirm={handleConfirmSale}
      />
    </>
  );
};

export default CounterList;
