import { create } from "zustand";

const MAX_LOGS = 80;

const toLogEntry = ({ level = "info", scope = "app", message, details = null }) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  createdAt: new Date().toISOString(),
  level,
  scope,
  message,
  details,
});

const useDebugStore = create((set) => ({
  logs: [],
  addLog: (payload) =>
    set((state) => ({
      logs: [toLogEntry(payload), ...state.logs].slice(0, MAX_LOGS),
    })),
  clearLogs: () => set({ logs: [] }),
}));

export default useDebugStore;
