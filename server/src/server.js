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

for (const event of ["unhandledRejection", "uncaughtException"]) {
  process.on(event, (error) => {
    logger.error(event, { error });
    reportError(error instanceof Error ? error : new Error(String(error)), { extra: { event } });
  });
}

const stopIntegrationScheduler = startIntegrationSyncScheduler();
const stopRetentionScheduler = startDataRetentionScheduler();
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    stopIntegrationScheduler();
    stopRetentionScheduler();
    server.close(() => process.exit(0));
  });
}
