import { getJwtSecret, shouldSeedDemoData } from "./config/environment.js";
import { initializeDatabase } from "./database.js";
import { seedDemoOperationalData } from "./repositories/demoDataRepository.js";
import { seedManualAssets } from "./repositories/manualAssetRepository.js";
import { seedDefaultMaintenanceScripts } from "./repositories/maintenanceScriptRepository.js";
import { backfillPreventiveAutomationAssetSchedules } from "./repositories/preventiveAutomationRepository.js";
import { seedDefaultSegment } from "./repositories/segmentRepository.js";
import { seedDefaultSectors } from "./repositories/sectorRepository.js";
import { seedDefaultAdmin, seedDemoUsers } from "./repositories/userRepository.js";

let runtimePromise;

export function initializeRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      getJwtSecret();
      await initializeDatabase();
      await seedDefaultSectors();

      if (shouldSeedDemoData()) {
        await seedDefaultAdmin();
        await seedDemoUsers();
        await seedDefaultSegment();
        await seedManualAssets();
        await seedDemoOperationalData();
        await seedDefaultMaintenanceScripts();
      }

      await backfillPreventiveAutomationAssetSchedules({
        user: { id: null, name: "Inicializacao do sistema" }
      });
    })();
  }

  return runtimePromise;
}
