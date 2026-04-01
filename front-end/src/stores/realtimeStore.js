import { create } from "zustand";

const createId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const MAX_ITEMS = 50;

const normalizeItem = (item, defaults = {}) => ({
  id: item?.id ?? createId(),
  title: item?.title ?? defaults.title ?? "Update",
  message: item?.message ?? defaults.message ?? "",
  createdAt: item?.createdAt ?? Date.now(),
  payload: item?.payload ?? null,
});

const useRealtimeStore = create((set) => ({
  notifications: [],
  messages: [],
  events: [],
  counters: {
    orders: 0,
    sales: 0,
    stockEntries: 0,
    supplyRequests: 0,
    purchaseRequests: 0,
    purchaseOrders: 0,
    deliveryNotes: 0,
    transfers: 0,
  },
  addNotification: (item) =>
    set((state) => ({
      notifications: [
        normalizeItem(item, { title: "Notification" }),
        ...state.notifications,
      ].slice(0, MAX_ITEMS),
    })),
  addMessage: (item) =>
    set((state) => ({
      messages: [
        normalizeItem(item, { title: "Message" }),
        ...state.messages,
      ].slice(0, MAX_ITEMS),
    })),
  addEvent: (item) =>
    set((state) => ({
      events: [normalizeItem(item, { title: "Event" }), ...state.events].slice(
        0,
        MAX_ITEMS
      ),
    })),
  incrementCounter: (key) =>
    set((state) => ({
      counters: {
        ...state.counters,
        [key]: (state.counters[key] ?? 0) + 1,
      },
    })),
  clearNotifications: () => set({ notifications: [] }),
  clearMessages: () => set({ messages: [] }),
  clearEvents: () => set({ events: [] }),
}));

export default useRealtimeStore;
