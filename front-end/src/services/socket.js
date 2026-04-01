import { io } from "socket.io-client";

let socket;

export const connectSocket = () => {
  if (socket) return socket;

  const token = window.localStorage.getItem("token");
  const url = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

  socket = io(url, {
    auth: { token },
    transports: ["websocket"],
  });

  return socket;
};

export const disconnectSocket = () => {
  if (!socket) return;
  socket.disconnect();
  socket = null;
};
