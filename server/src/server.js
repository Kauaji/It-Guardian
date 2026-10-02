import http from "node:http";
import { createApp } from "./app.js";
import { reportError } from "./lib/errorReporter.js";
import { logger } from "./lib/logger.js";
import { initializeRuntime } from "./bootstrap.js";
import { attachRealtimeServer } from "./services/realtimeService.js";
import { startDataRetentionScheduler } from "./jobs/dataRetention.js";
import { startIntegrationSyncScheduler } from "./services/integrationSyncScheduler.js";

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || "0.0.0.0";

await initializeRuntime();

const app = createApp();
const server = http.createServer(app);
server.requestTimeout = 30_000;
server.headersTimeout = 35_000;
server.keepAliveTimeout = 5_000;

server.on("clientError", (error, socket) => {
  logger.warn("client_error", { code: error.code, message: error.message });
  if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

attachRealtimeServer(server);

server.listen(port, host, () => {
  logger.info("server_listening", { host, port });
});

function toError(error) {
  return error instanceof Error ? error : new Error(String(error));
}

// Rejeicao nao tratada: registra e reporta (o processo segue, o servidor atende outras requisicoes).
process.on("unhandledRejection", (error) => {
  logger.error("unhandledRejection", { error });
  reportError(toError(error), { extra: { event: "unhandledRejection" } });
});

// Excecao nao capturada deixa o processo em estado indefinido: reporta e ENCERRA para o supervisor
// (Docker restart/systemd) subir uma instancia limpa.
process.on("uncaughtException", async (error) => {
  logger.error("uncaughtException", { error });
  try {
    await Promise.race([reportError(toError(error), { extra: { event: "uncaughtException" } }), new Promise((resolve) => setTimeout(resolve, 2000))]);
  } finally {
    process.exit(1);
  }
});

const stopIntegrationScheduler = startIntegrationSyncScheduler();
const stopRetentionScheduler = startDataRetentionScheduler();
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    stopIntegrationScheduler();
    stopRetentionScheduler();
    server.close(() => process.exit(0));
  });
}
