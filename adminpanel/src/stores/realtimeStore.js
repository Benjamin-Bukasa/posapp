import { create } from "zustand";

const createId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const MAX_ITEMS = 50;

const normalizeItem = (item, defaults = {}) => ({
  id: item?.id ?? createId(),
  title: item?.title ?? defaults.title ?? "Notification",
  message: item?.message ?? defaults.message ?? "",
  createdAt: item?.createdAt ?? Date.now(),
  payload: item?.payload ?? null,
});

const useRealtimeStore = create((set) => ({
  notifications: [],
  messages: [],
  addNotification: (item) =>
    set((state) => ({
      notifications: [
        normalizeItem(item, { title: "Notification" }),
        ...state.notifications,
      ].slice(0, MAX_ITEMS),
    })),
  addMessage: (item) =>
    set((state) => ({
      messages: [normalizeItem(item, { title: "Message" }), ...state.messages].slice(
        0,
        MAX_ITEMS,
      ),
    })),
  clearNotifications: () => set({ notifications: [] }),
  clearMessages: () => set({ messages: [] }),
}));

export default useRealtimeStore;
