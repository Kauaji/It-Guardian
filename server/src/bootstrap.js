import { getJwtSecret, isVercel, shouldSeedDemoData } from "./config/environment.js";
import { detectRedisConfig } from "./lib/redisClient.js";
import { initializeDatabase } from "./schema/legacyBootstrap.js";
import { runMigrations } from "./migrations/index.js";
import { seedDemoOperationalData } from "./repositories/demoDataRepository.js";
import { seedDefaultMaintenanceScripts } from "./repositories/maintenanceScriptRepository.js";
import { backfillPreventiveAutomationAssetSchedules } from "./repositories/preventiveAutomationRepository.js";
import { purgeLegacyMockIntegrationSnapshots } from "./repositories/integrationRepository.js";
import { seedDefaultSegment } from "./repositories/segmentRepository.js";
import { seedDefaultSectors } from "./repositories/sectorRepository.js";
import { seedDefaultAdmin, seedDemoUsers } from "./repositories/userRepository.js";

let runtimePromise;

export function shouldWarnAboutMissingRedis(isVercelValue, redisConfig) {
  return Boolean(isVercelValue) && !redisConfig;
}

function warnIfServerlessWithoutSharedRedis() {
  if (!shouldWarnAboutMissingRedis(isVercel, detectRedisConfig())) return;
  console.warn(JSON.stringify({
    level: "warn",
    event: "serverless_without_shared_redis",
    message:
      "Deploy serverless (Vercel) sem UPSTASH_REDIS_REST_URL/TOKEN configurado. " +
      "O rate limiter cai para um contador por instancia (nao compartilhado entre " +
      "instancias serverless, na pratica bem mais fraco do que sugere em dev local) " +
      "e o relay da assistencia remota, se algum dia for reativado, tambem cairia " +
      "para memoria local por instancia. Configure a integracao Upstash/Vercel KV " +
      "para restaurar o comportamento compartilhado."
  }));
}

export function initializeRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      getJwtSecret();
      warnIfServerlessWithoutSharedRedis();
      await initializeDatabase();
      await runMigrations();
      await purgeLegacyMockIntegrationSnapshots();
      await seedDefaultSectors();

      if (shouldSeedDemoData()) {
        await seedDefaultAdmin();
        await seedDemoUsers();
        await seedDefaultSegment();
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
