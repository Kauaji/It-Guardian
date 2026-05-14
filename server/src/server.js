import http from "node:http";
import { createApp } from "./app.js";
import { initializeRuntime } from "./bootstrap.js";
import { attachRealtimeServer } from "./services/realtimeService.js";

const port = Number(process.env.PORT || 4000);

await initializeRuntime();

const app = createApp();
const server = http.createServer(app);

attachRealtimeServer(server);

server.listen(port, () => {
  console.log(`IT Guardian API running on http://localhost:${port}`);
});
