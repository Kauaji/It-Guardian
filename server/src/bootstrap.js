import { getJwtSecret } from "./config/environment.js";
import { initializeDatabase } from "./database.js";
import { seedManualAssets } from "./repositories/manualAssetRepository.js";
import { seedDefaultSegment } from "./repositories/segmentRepository.js";
import { seedDefaultAdmin } from "./repositories/userRepository.js";

let runtimePromise;

export function initializeRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      getJwtSecret();
      await initializeDatabase();
      await seedDefaultAdmin();
      await seedDefaultSegment();
      await seedManualAssets();
    })();
  }

  return runtimePromise;
}
