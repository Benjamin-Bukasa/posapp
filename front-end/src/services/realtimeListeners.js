import { connectSocket } from "./socket";
import useToastStore from "../stores/toastStore";
import useRealtimeStore from "../stores/realtimeStore";
import useCurrencyStore from "../stores/currencyStore";
import { translateMessage } from "../utils/translateMessage";

let initialized = false;

const getLabel = (payload, fallback) => payload?.code || payload?.id || fallback;

const notify = (title, message, variant = "info") => {
  const { showToast } = useToastStore.getState();
  showToast({ title, message, variant });
};

export const initRealtimeListeners = () => {
  if (initialized) return;
  const token = window.localStorage.getItem("token");
  if (!token) return;

  initialized = true;
  const socket = connectSocket();
  const realtime = useRealtimeStore.getState();

  socket.on("connect_error", (error) => {
    notify("Erreur socket", translateMessage(error?.message, "Connexion impossible."), "warning");
  });

  socket.on("notification:new", (payload) => {
    realtime.addNotification(payload);
    notify(payload?.title || "Notification", payload?.message || "");
  });

  socket.on("message:new", (payload) => {
    realtime.addMessage(payload);
    notify(payload?.title || "Message", payload?.message || "");
  });

  socket.on("order:created", (payload) => {
    realtime.incrementCounter("orders");
    realtime.addEvent({
      title: "Nouvelle commande",
      message: `Commande ${getLabel(payload, "")}`.trim(),
      payload,
    });
    notify("Nouvelle commande", `Commande ${getLabel(payload, "")}`.trim(), "success");
  });

  socket.on("sale:created", (payload) => {
    realtime.incrementCounter("sales");
    realtime.addEvent({
      title: "Nouvelle vente",
      message: `Vente ${getLabel(payload, "")}`.trim(),
      payload,
    });
    notify("Nouvelle vente", `Vente ${getLabel(payload, "")}`.trim(), "success");
  });

  socket.on("stock:entry:created", (payload) => {
    realtime.incrementCounter("stockEntries");
    realtime.addEvent({
      title: "Entree de stock creee",
      message: `Entree ${getLabel(payload, "")}`.trim(),
      payload,
    });
    notify("Entree de stock creee", `Entree ${getLabel(payload, "")}`.trim());
  });

  socket.on("stock:entry:approved", (payload) => {
    realtime.addEvent({
      title: "Entree de stock approuvee",
      message: `Entree ${getLabel(payload, "")}`.trim(),
      payload,
    });
    notify("Entree de stock approuvee", `Entree ${getLabel(payload, "")}`.trim());
  });

  socket.on("stock:entry:posted", (payload) => {
    realtime.addEvent({
      title: "Entree de stock comptabilisee",
      message: `Entree ${getLabel(payload, "")}`.trim(),
      payload,
    });
    notify("Entree de stock comptabilisee", `Entree ${getLabel(payload, "")}`.trim());
  });

  socket.on("supply:request:created", (payload) => {
    realtime.incrementCounter("supplyRequests");
    realtime.addEvent({
      title: "Requisition creee",
      message: payload?.title || getLabel(payload, ""),
      payload,
    });
    notify("Requisition creee", payload?.title || getLabel(payload, ""));
  });

  socket.on("supply:request:submitted", (payload) => {
    realtime.addEvent({
      title: "Requisition soumise",
      message: payload?.title || getLabel(payload, ""),
      payload,
    });
    notify("Requisition soumise", payload?.title || getLabel(payload, ""));
  });

  socket.on("supply:request:approved", (payload) => {
    realtime.addEvent({
      title: "Requisition approuvee",
      message: payload?.title || getLabel(payload, ""),
      payload,
    });
    notify("Requisition approuvee", payload?.title || getLabel(payload, ""));
  });

  socket.on("supply:request:rejected", (payload) => {
    realtime.addEvent({
      title: "Requisition rejetee",
      message: payload?.title || getLabel(payload, ""),
      payload,
    });
    notify("Requisition rejetee", payload?.title || getLabel(payload, ""), "warning");
  });

  socket.on("purchase:request:created", (payload) => {
    realtime.incrementCounter("purchaseRequests");
    realtime.addEvent({
      title: "Demande d'achat creee",
      message: payload?.title || getLabel(payload, ""),
      payload,
    });
    notify("Demande d'achat creee", payload?.title || getLabel(payload, ""));
  });

  socket.on("purchase:request:submitted", (payload) => {
    realtime.addEvent({
      title: "Demande d'achat soumise",
      message: payload?.title || getLabel(payload, ""),
      payload,
    });
    notify("Demande d'achat soumise", payload?.title || getLabel(payload, ""));
  });

  socket.on("purchase:request:approved", (payload) => {
    realtime.addEvent({
      title: "Demande d'achat approuvee",
      message: payload?.title || getLabel(payload, ""),
      payload,
    });
    notify("Demande d'achat approuvee", payload?.title || getLabel(payload, ""));
  });

  socket.on("purchase:request:rejected", (payload) => {
    realtime.addEvent({
      title: "Demande d'achat rejetee",
      message: payload?.title || getLabel(payload, ""),
      payload,
    });
    notify("Demande d'achat rejetee", payload?.title || getLabel(payload, ""), "warning");
  });

  socket.on("purchase:order:created", (payload) => {
    realtime.incrementCounter("purchaseOrders");
    realtime.addEvent({
      title: "Commande fournisseur creee",
      message: getLabel(payload, ""),
      payload,
    });
    notify("Commande fournisseur creee", getLabel(payload, ""));
  });

  socket.on("purchase:order:sent", (payload) => {
    realtime.addEvent({
      title: "Commande fournisseur validee",
      message: getLabel(payload, ""),
      payload,
    });
    notify("Commande fournisseur validee", getLabel(payload, ""));
  });

  socket.on("delivery:note:created", (payload) => {
    realtime.incrementCounter("deliveryNotes");
    realtime.addEvent({
      title: "Bon de reception cree",
      message: getLabel(payload, ""),
      payload,
    });
    notify("Bon de reception cree", getLabel(payload, ""));
  });

  socket.on("delivery:note:received", (payload) => {
    realtime.addEvent({
      title: "Bon de reception recu",
      message: getLabel(payload, ""),
      payload,
    });
    notify("Bon de reception recu", getLabel(payload, ""));
  });

  socket.on("transfer:created", (payload) => {
    realtime.incrementCounter("transfers");
    realtime.addEvent({
      title: "Transfert cree",
      message: getLabel(payload, ""),
      payload,
    });
    notify("Transfert cree", getLabel(payload, ""));
  });

  socket.on("transfer:completed", (payload) => {
    realtime.addEvent({
      title: "Transfert termine",
      message: getLabel(payload, ""),
      payload,
    });
    notify("Transfert termine", getLabel(payload, ""));
  });

  socket.on("currency:updated", async () => {
    await useCurrencyStore.getState().loadSettings({ force: true });
  });
};
