import { create } from "zustand";

const createId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const MAX_ITEMS = 50;
const MAX_DISMISSED_ITEMS = 200;
const STORAGE_PREFIX = "frontend.realtime.read-state";

const EMPTY_COUNTERS = {
  orders: 0,
  sales: 0,
  stockEntries: 0,
  supplyRequests: 0,
  purchaseRequests: 0,
  purchaseOrders: 0,
  deliveryNotes: 0,
  transfers: 0,
};

const canUseStorage = () => typeof window !== "undefined" && window.localStorage;

const mergeKeys = (...groups) =>
  Array.from(new Set(groups.flat().filter(Boolean))).slice(-MAX_DISMISSED_ITEMS);

const readPersistedState = (scopeKey) => {
  if (!canUseStorage() || !scopeKey) {
    return { notifications: [], messages: [] };
  }

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:${scopeKey}`);
    if (!raw) {
      return { notifications: [], messages: [] };
    }

    const parsed = JSON.parse(raw);
    return {
      notifications: Array.isArray(parsed?.notifications) ? parsed.notifications : [],
      messages: Array.isArray(parsed?.messages) ? parsed.messages : [],
    };
  } catch (_error) {
    return { notifications: [], messages: [] };
  }
};

const persistReadState = (scopeKey, payload) => {
  if (!canUseStorage() || !scopeKey) return;

  window.localStorage.setItem(
    `${STORAGE_PREFIX}:${scopeKey}`,
    JSON.stringify({
      notifications: Array.isArray(payload?.notifications) ? payload.notifications : [],
      messages: Array.isArray(payload?.messages) ? payload.messages : [],
    }),
  );
};

const stableSerialize = (value) => {
  if (value === null || value === undefined) return "";

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${key}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return String(value);
};

const buildReadKey = (item, defaults = {}) => {
  const explicitKey = item?.readKey ?? item?.dedupeKey ?? item?.key;
  if (explicitKey) return String(explicitKey);
  if (item?.id) return `id:${item.id}`;

  const title = item?.title ?? defaults.title ?? "Update";
  const message = item?.message ?? defaults.message ?? "";
  return `content:${title}|${message}|${stableSerialize(item?.payload ?? null)}`;
};

const normalizeItem = (item, defaults = {}) => ({
  id: item?.id ?? createId(),
  title: item?.title ?? defaults.title ?? "Update",
  message: item?.message ?? defaults.message ?? "",
  createdAt: item?.createdAt ?? Date.now(),
  payload: item?.payload ?? null,
  readKey: buildReadKey(item, defaults),
});

const useRealtimeStore = create((set) => ({
  persistenceScope: null,
  dismissedNotificationKeys: [],
  dismissedMessageKeys: [],
  notifications: [],
  messages: [],
  events: [],
  counters: EMPTY_COUNTERS,
  setPersistenceScope: (scopeKey) => {
    const nextScope = scopeKey || null;
    const persisted = readPersistedState(nextScope);

    set({
      persistenceScope: nextScope,
      dismissedNotificationKeys: persisted.notifications,
      dismissedMessageKeys: persisted.messages,
      notifications: [],
      messages: [],
      events: [],
      counters: { ...EMPTY_COUNTERS },
    });
  },
  addNotification: (item) => {
    let inserted = false;

    set((state) => {
      const normalized = normalizeItem(item, { title: "Notification" });
      if (
        state.dismissedNotificationKeys.includes(normalized.readKey) ||
        state.notifications.some((entry) => entry.readKey === normalized.readKey)
      ) {
        return state;
      }

      inserted = true;
      return {
        notifications: [normalized, ...state.notifications].slice(0, MAX_ITEMS),
      };
    });

    return inserted;
  },
  addMessage: (item) => {
    let inserted = false;

    set((state) => {
      const normalized = normalizeItem(item, { title: "Message" });
      if (
        state.dismissedMessageKeys.includes(normalized.readKey) ||
        state.messages.some((entry) => entry.readKey === normalized.readKey)
      ) {
        return state;
      }

      inserted = true;
      return {
        messages: [normalized, ...state.messages].slice(0, MAX_ITEMS),
      };
    });

    return inserted;
  },
  addEvent: (item) =>
    set((state) => ({
      events: [normalizeItem(item, { title: "Event" }), ...state.events].slice(
        0,
        MAX_ITEMS,
      ),
    })),
  incrementCounter: (key) =>
    set((state) => ({
      counters: {
        ...state.counters,
        [key]: (state.counters[key] ?? 0) + 1,
      },
    })),
  clearNotifications: () =>
    set((state) => {
      const dismissedNotificationKeys = mergeKeys(
        state.dismissedNotificationKeys,
        state.notifications.map((item) => item.readKey),
      );

      persistReadState(state.persistenceScope, {
        notifications: dismissedNotificationKeys,
        messages: state.dismissedMessageKeys,
      });

      return {
        notifications: [],
        dismissedNotificationKeys,
      };
    }),
  clearMessages: () =>
    set((state) => {
      const dismissedMessageKeys = mergeKeys(
        state.dismissedMessageKeys,
        state.messages.map((item) => item.readKey),
      );

      persistReadState(state.persistenceScope, {
        notifications: state.dismissedNotificationKeys,
        messages: dismissedMessageKeys,
      });

      return {
        messages: [],
        dismissedMessageKeys,
      };
    }),
  clearEvents: () => set({ events: [] }),
}));

export default useRealtimeStore;
