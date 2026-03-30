import { create } from "zustand";

const createId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const timeouts = new Map();

const scheduleRemoval = (id, duration, removeToast) => {
  if (!duration || duration <= 0) return;
  if (timeouts.has(id)) {
    clearTimeout(timeouts.get(id));
  }
  const timeout = setTimeout(() => {
    removeToast(id);
    timeouts.delete(id);
  }, duration);
  timeouts.set(id, timeout);
};

const useToastStore = create((set, get) => ({
  toasts: [],
  showToast: ({
    title,
    message,
    variant = "info",
    duration = 3200,
    position,
    actions = [],
  }) => {
    const id = createId();
    const toast = {
      id,
      title,
      message,
      variant,
      duration,
      position,
      actions,
      createdAt: Date.now(),
    };

    set((state) => ({
      toasts: [toast, ...state.toasts],
    }));
    scheduleRemoval(id, duration, get().removeToast);
    return id;
  },
  removeToast: (id) => {
    if (timeouts.has(id)) {
      clearTimeout(timeouts.get(id));
      timeouts.delete(id);
    }
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
  clearToasts: () => {
    timeouts.forEach((timeout) => clearTimeout(timeout));
    timeouts.clear();
    set({ toasts: [] });
  },
}));

export default useToastStore;
