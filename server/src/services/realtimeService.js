import { WebSocket, WebSocketServer } from "ws";
import { getCorsOrigins, isAllowedVercelOrigin } from "../config/environment.js";
import { readSessionCookie } from "../security/sessionCookie.js";
import { listSegments } from "../repositories/segmentRepository.js";
import { getActiveAlertsWithAcknowledgements } from "./alertService.js";
import { authenticateSessionToken } from "./sessionService.js";
import { getDashboardSummary, listDevices } from "./monitoringService.js";
import { logger } from "../lib/logger.js";

const sockets = new Set();

export function isTrustedRealtimeOrigin(origin = "") {
  const normalized = String(origin).replace(/\/$/, "");
  return getCorsOrigins().includes(normalized) || isAllowedVercelOrigin(normalized);
}

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
      logger.error("realtime_snapshot_failed", { error });
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
  const token = readSessionCookie(request);

  if (!token) {
    throw new Error("Missing token");
  }

  if (!isTrustedRealtimeOrigin(request.headers.origin)) {
    throw new Error("Untrusted WebSocket origin");
  }

  // Mesma validacao do HTTP: sessao nao revogada, dentro da vida maxima e
  // com a versao de token atual. O token na query string foi removido (URLs
  // acabam em logs de proxy e historico).
  const { user } = await authenticateSessionToken(token);
  return user;
}
