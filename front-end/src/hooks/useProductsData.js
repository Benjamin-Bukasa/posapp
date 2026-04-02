import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, buildQuery } from "../services/apiClient";
import useToastStore from "../stores/toastStore";

const buildInventoryMap = (inventory = []) => {
  const byProduct = new Map();
  inventory.forEach((item) => {
    if (!item?.productId) return;
    const current = byProduct.get(item.productId) || {
      quantity: 0,
      minLevel: 0,
    };
    current.quantity += Number(item.quantity || 0);
    current.minLevel += Number(item.minLevel || 0);
    byProduct.set(item.productId, current);
  });
  return byProduct;
};

const resolveStockLabel = (quantity, minLevel) => {
  if (quantity <= 0) return "Épuisé";
  if (minLevel && quantity <= minLevel) return "Faible";
  return "En stock";
};

const computeArticleAvailability = (product, inventoryMap) => {
  const components = Array.isArray(product?.components) ? product.components : [];

  if (components.length === 0) {
    return {
      quantity: 0,
      minLevel: 0,
      hasTechnicalSheet: false,
    };
  }

  let minAvailable = Number.POSITIVE_INFINITY;
  let minLevel = Number.POSITIVE_INFINITY;

  for (const component of components) {
    if (!component?.componentProductId) {
      return { quantity: 0, minLevel: 0 };
    }

    const perArticle = Number(component.quantity || 0);
    if (!Number.isFinite(perArticle) || perArticle <= 0) {
      return { quantity: 0, minLevel: 0 };
    }

    const inventory = inventoryMap.get(component.componentProductId) || {
      quantity: 0,
      minLevel: 0,
    };
    const possible = Math.floor(Number(inventory.quantity || 0) / perArticle);
    minAvailable = Math.min(minAvailable, possible);
    minLevel = Math.min(
      minLevel,
      Math.floor(Number(inventory.minLevel || 0) / perArticle),
    );
  }

  return {
    quantity: Number.isFinite(minAvailable) ? Math.max(0, minAvailable) : 0,
    minLevel: Number.isFinite(minLevel) ? Math.max(0, minLevel) : 0,
    hasTechnicalSheet: true,
  };
};

const mapProducts = (products, inventoryMap) =>
  (products || []).map((product) => {
    const availability = computeArticleAvailability(product, inventoryMap);
    const quantity = Number(availability.quantity || 0);
    const minLevel = Number(availability.minLevel || 0);
    return {
      id: product.id,
      product: product.name,
      imageUrl: product.imageUrl || "",
      category: product.category?.name || "N/A",
      family: product.family?.name || "N/A",
      subFamily: product.subFamily?.name || "N/A",
      collection: product.category?.collection?.name || "N/A",
      status: product.isActive ? "Actif" : "Inactif",
      quantity,
      stock:
        availability.hasTechnicalSheet === false
          ? "Fiche technique manquante"
          : resolveStockLabel(quantity, minLevel),
      price: Number(product.unitPrice || 0),
      currencyCode: product.currencyCode || "USD",
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      components: product.components || [],
      hasTechnicalSheet: availability.hasTechnicalSheet !== false,
    };
  });

export const useProductsData = ({ storeId, storageZoneId } = {}) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const showToast = useToastStore((state) => state.showToast);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const inventoryQuery = buildQuery({
        ...(storageZoneId ? { storageZoneId } : {}),
        ...(storageZoneId ? {} : storeId ? { storeId } : {}),
      });
      const [productsResponse, inventoryResponse] = await Promise.all([
        apiGet("/api/products?kind=ARTICLE&includeComponents=true"),
        apiGet(`/api/inventory${inventoryQuery ? `?${inventoryQuery}` : ""}`),
      ]);
      const inventoryMap = buildInventoryMap(inventoryResponse);
      setProducts(mapProducts(productsResponse, inventoryMap));
    } catch (error) {
      showToast({
        title: "Erreur",
        message: error.message || "Impossible de charger les produits.",
        variant: "danger",
      });
    } finally {
      setLoading(false);
    }
  }, [showToast, storageZoneId, storeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      products,
      loading,
      refresh,
    }),
    [products, loading, refresh]
  );
};
