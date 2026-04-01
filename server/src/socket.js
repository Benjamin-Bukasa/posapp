const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const prisma = require("./config/prisma");

let io;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || "*",
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const raw =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization ||
      "";
    const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;

    if (!token) {
      return next(new Error("Unauthorized"));
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, tenantId: true, storeId: true, role: true },
      });

      if (!user) {
        return next(new Error("Unauthorized"));
      }

      socket.data.user = user;
      socket.join(`tenant:${user.tenantId}`);
      if (user.storeId) socket.join(`store:${user.storeId}`);
      socket.join(`user:${user.id}`);

      return next();
    } catch (error) {
      return next(new Error("Unauthorized"));
    }
  });

  return io;
};

const emitToTenant = (tenantId, event, payload) => {
  if (!io || !tenantId) return;
  io.to(`tenant:${tenantId}`).emit(event, payload);
};

const emitToStore = (storeId, event, payload) => {
  if (!io || !storeId) return;
  io.to(`store:${storeId}`).emit(event, payload);
};

const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
};

module.exports = {
  initSocket,
  emitToTenant,
  emitToStore,
  emitToUser,
};
