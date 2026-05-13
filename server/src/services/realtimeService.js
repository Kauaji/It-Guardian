import jwt from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";
import { findUserById } from "../repositories/userRepository.js";
import { listSegments } from "../repositories/segmentRepository.js";
import { getActiveAlertsWithAcknowledgements } from "./alertService.js";
import { getDashboardSummary, listDevices } from "./monitoringService.js";

const sockets = new Set();

export function attachRealtimeServer(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket, request) => {
    authenticateSocket(request)
      .then((user) => {
        sockets.add(socket);
        socket.send(JSON.stringify({ type: "connected", user: { id: user.id, role: user.role } }));
        sendSnapshot(socket).catch(() => socket.close(1011, "Snapshot unavailable"));

        socket.on("close", () => sockets.delete(socket));
      })
      .catch(() => {
        socket.close(1008, "Unauthorized");
      });
  });

  const interval = setInterval(
    () => broadcastSnapshot().catch((error) => {
      console.error("Realtime snapshot failed", error);
    }),
    Number(process.env.STREAM_INTERVAL_MS || 10000)
  );

  wss.on("close", () => clearInterval(interval));

  return wss;
}

export async function broadcastSnapshot() {
  if (!sockets.size) {
    return;
  }

  const payload = await buildSnapshot();
  const message = JSON.stringify(payload);

  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  }
}

async function sendSnapshot(socket) {
  const payload = await buildSnapshot();
  socket.send(JSON.stringify(payload));
}

async function buildSnapshot() {
  const [devices, summary, alerts, segments] = await Promise.all([
    listDevices({}),
    getDashboardSummary(),
    getActiveAlertsWithAcknowledgements(),
    listSegments()
  ]);

  return {
    type: "monitoring.snapshot",
    summary,
    devices,
    alerts,
    segments,
    updatedAt: new Date().toISOString()
  };
}

async function authenticateSocket(request) {
  const url = new URL(request.url, "http://localhost");
  const token = url.searchParams.get("token");

  if (!token) {
    throw new Error("Missing token");
  }

  const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
  const user = await findUserById(payload.sub);

  if (!user) {
    throw new Error("Invalid token");
  }

  return user;
}
