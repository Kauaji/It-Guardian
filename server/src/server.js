import http from "node:http";
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { initializeDatabase } from "./database.js";
import { seedManualAssets } from "./repositories/manualAssetRepository.js";
import { seedDefaultSegment } from "./repositories/segmentRepository.js";
import { seedDefaultAdmin } from "./repositories/userRepository.js";
import { attachRealtimeServer } from "./services/realtimeService.js";

dotenv.config();

const port = Number(process.env.PORT || 4000);

await initializeDatabase();
await seedDefaultAdmin();
await seedDefaultSegment();
await seedManualAssets();

const app = createApp();
const server = http.createServer(app);

attachRealtimeServer(server);

server.listen(port, () => {
  console.log(`IT Guardian API running on http://localhost:${port}`);
});
