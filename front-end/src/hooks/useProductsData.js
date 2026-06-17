import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, buildQuery } from "../services/apiClient";
import useToastStore from "../stores/toastStore";

export const useProductsData = ({ storeId, storageZoneId } = {}) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const showToast = useToastStore((state) => state.showToast);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const query = buildQuery({
        ...(storageZoneId ? { storageZoneId } : {}),
        ...(storageZoneId ? {} : storeId ? { storeId } : {}),
      });
      const response = await apiGet(
        `/api/products/cashier/articles${query ? `?${query}` : ""}`,
      );
      setProducts(Array.isArray(response) ? response : []);
    } catch (error) {
      if (error?.status === 403) {
        setProducts([]);
        return;
      }

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
    [products, loading, refresh],
  );
};
