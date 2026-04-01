import { create } from "zustand";
import { persist } from "zustand/middleware";

const useCounterStore = create(
  persist(
    (set) => ({
      search: "",
      filterValues: {
        stock: "all",
        status: "all",
        category: "all",
        family: "all",
        subFamily: "all",
        collection: "all",
        keyword: "",
      },
      sortValues: {
        date: "asc",
        activity: "az",
        name: "az",
      },
      cartItems: [],
      setSearch: (search) => set({ search }),
      setFilterValues: (filterValues) => set({ filterValues }),
      setSortValues: (sortValues) => set({ sortValues }),
      addToCart: (product) => {
        const maxQty = Number.isFinite(product.quantity)
          ? Number(product.quantity)
          : Number.POSITIVE_INFINITY;
        if (maxQty <= 0) return;

        set((state) => {
          const existing = state.cartItems.find((item) => item.id === product.id);
          if (existing) {
            const nextQty = Math.min(existing.cartQty + 1, maxQty);
            return {
              cartItems: state.cartItems.map((item) =>
                item.id === product.id
                  ? {
                      ...item,
                      cartQty: nextQty,
                      currencyCode: product.currencyCode || item.currencyCode,
                    }
                  : item,
              ),
            };
          }

          return {
            cartItems: [
              ...state.cartItems,
              {
                id: product.id,
                product: product.product,
                collection: product.collection,
                category: product.category,
                family: product.family,
                subFamily: product.subFamily,
                stock: product.stock,
                quantity: product.quantity,
                price: product.price,
                currencyCode: product.currencyCode,
                cartQty: 1,
              },
            ],
          };
        });
      },
      updateCartQty: (id, delta) => {
        set((state) => ({
          cartItems: state.cartItems
            .map((item) => {
              if (item.id !== id) return item;
              const maxQty = Number.isFinite(item.quantity)
                ? Number(item.quantity)
                : Number.POSITIVE_INFINITY;
              const nextQty = Math.max(0, Math.min(item.cartQty + delta, maxQty));
              return { ...item, cartQty: nextQty };
            })
            .filter((item) => item.cartQty > 0),
        }));
      },
      removeCartItem: (id) => {
        set((state) => ({
          cartItems: state.cartItems.filter((item) => item.id !== id),
        }));
      },
      clearCart: () => set({ cartItems: [] }),
    }),
    {
      name: "counter-filters",
    },
  ),
);

export default useCounterStore;
