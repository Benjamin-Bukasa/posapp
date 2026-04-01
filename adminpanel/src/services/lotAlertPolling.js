import { requestJson } from "../api/client";
import useAuthStore from "../stores/authStore";
import useRealtimeStore from "../stores/realtimeStore";
import useToastStore from "../stores/toastStore";

let pollTimer = null;
let lastSeenKeys = new Set();

const buildKey = (item) =>
  [item?.productId, item?.batchNumber || "sans-lot", item?.status, item?.expiryDate || "sans-date"].join(
    "::",
  );

export const startLotAlertPolling = () => {
  if (pollTimer) return;

  const run = async () => {
    const auth = useAuthStore.getState();
    if (!auth.isAuthenticated || !auth.accessToken) {
      lastSeenKeys = new Set();
      return;
    }

    try {
      const payload = await requestJson("/api/admin-dashboard", {
        token: auth.accessToken,
      });
      const alerts = Array.isArray(payload?.expiryAlerts) ? payload.expiryAlerts : [];
      const nextKeys = new Set(alerts.map(buildKey));
      const realtime = useRealtimeStore.getState();
      const toast = useToastStore.getState();

      alerts.forEach((item) => {
        const key = buildKey(item);
        if (lastSeenKeys.has(key)) return;

        const title = item.status === "EXPIRE" ? "Lot expire" : "Lot proche de peremption";
        const message =
          `${item.productName || "Produit"}${item.batchNumber ? ` - lot ${item.batchNumber}` : ""} ` +
          `${item.status === "EXPIRE" ? "est expire" : "expire bientot"} ` +
          `(${item.storeName || "--"} / ${item.storageZoneName || "--"}).`;

        realtime.addNotification({
          title,
          message,
          payload: item,
        });
        toast.showToast({
          title,
          message,
          variant: item.status === "EXPIRE" ? "danger" : "warning",
        });
      });

      lastSeenKeys = nextKeys;
    } catch {
      // Polling best-effort only.
    }
  };

  run();
  pollTimer = window.setInterval(run, 60000);
};

export const stopLotAlertPolling = () => {
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
  lastSeenKeys = new Set();
};
