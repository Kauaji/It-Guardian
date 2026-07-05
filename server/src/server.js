import http from "node:http";
import { createApp } from "./app.js";
import { initializeRuntime } from "./bootstrap.js";
import { attachRealtimeServer } from "./services/realtimeService.js";

const port = Number(process.env.PORT || 4000);

await initializeRuntime();

const app = createApp();
const server = http.createServer(app);
server.requestTimeout = 30_000;
server.headersTimeout = 35_000;
server.keepAliveTimeout = 5_000;

server.on("clientError", (error, socket) => {
  console.warn(JSON.stringify({
    level: "warn",
    event: "client_error",
    code: error.code,
    message: error.message
  }));
  if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

attachRealtimeServer(server);

server.listen(port, () => {
  console.log(`IT Guardian API running on http://localhost:${port}`);
});
