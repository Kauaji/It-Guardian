import {
  getJwtSecret,
  getMigrationsMode,
  isDemoSeedBlockedInProduction,
  isRemoteScriptExecutionEnabled,
  isVercel,
  resolveDatabaseConfig,
  shouldSeedDemoData
} from "./config/environment.js";
import { logger } from "./lib/logger.js";
import { getJobSigningPublicKey } from "./services/agentSigningService.js";
import { detectRedisConfig } from "./lib/redisClient.js";
import { initializeDatabase } from "./schema/legacyBootstrap.js";
import { assertSchemaUpToDate, runMigrations } from "./migrations/index.js";
import { seedDemoOperationalData } from "./repositories/demoDataRepository.js";
import { seedDemoUsers } from "./repositories/demo/demoUserSeed.js";
import { seedDefaultMaintenanceScripts } from "./repositories/maintenanceScriptRepository.js";
import { backfillPreventiveAutomationAssetSchedules } from "./repositories/preventiveAutomationRepository.js";
import { purgeLegacyMockIntegrationSnapshots } from "./repositories/integrationRepository.js";
import { seedDefaultSegment } from "./repositories/segmentRepository.js";
import { seedDefaultSectors } from "./repositories/sectorRepository.js";
import { seedDefaultAdmin } from "./repositories/userRepository.js";

let runtimePromise;

export function shouldWarnAboutMissingRedis(isVercelValue, redisConfig) {
  return Boolean(isVercelValue) && !redisConfig;
}

function warnIfServerlessWithoutSharedRedis() {
  if (!shouldWarnAboutMissingRedis(isVercel, detectRedisConfig())) return;
  logger.warn("serverless_without_shared_redis", { message: "Deploy serverless (Vercel) sem UPSTASH_REDIS_REST_URL/TOKEN configurado. " +
      "O rate limiter cai para um contador por instancia (nao compartilhado entre " +
      "instancias serverless, na pratica bem mais fraco do que sugere em dev local) " +
      "e o relay da assistencia remota, se algum dia for reativado, tambem cairia " +
      "para memoria local por instancia. Configure a integracao Upstash/Vercel KV " +
      "para restaurar o comportamento compartilhado."
  });
}

function warnAboutRiskyConfiguration() {
  if (isDemoSeedBlockedInProduction()) {
    logger.error("demo_seed_blocked_in_production", { message: "ENABLE_DEMO_SEED esta ligado em ambiente de producao e foi IGNORADO: os dados de demonstracao criam " +
        "administradores com senha publica. Para uma instancia de apresentacao, defina tambem " +
        "DEMO_SEED_ALLOW_PRODUCTION=true."
    });
  }
  if (isRemoteScriptExecutionEnabled() && !getJobSigningPublicKey()) {
    logger.warn("agent_job_signing_not_configured", {
      message: "ENABLE_REMOTE_SCRIPT_EXECUTION esta ligado sem AGENT_JOB_SIGNING_PRIVATE_KEY: agentes com padroes seguros recusam jobs nao assinados. Gere o par com `npm run agent:keys -- jobs`."
    });
  }
  const database = resolveDatabaseConfig();
  if (database.mode === "postgres" && database.tlsVerification === "unverified") {
    logger.warn("db_tls_unverified", { message: "A conexao com o banco usa TLS SEM verificar o certificado (aceita interceptacao). Defina DB_SSL_CA " +
        "com o certificado da CA do provedor (ou DB_SSL_MODE=verify) para fechar isso."
    });
  }
}

async function prepareSchema() {
  const mode = getMigrationsMode();
  if (mode === "auto") {
    await initializeDatabase();
    await runMigrations();
  } else if (mode === "check") {
    await assertSchemaUpToDate();
  }
}

export function initializeRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      getJwtSecret();
      warnIfServerlessWithoutSharedRedis();
      warnAboutRiskyConfiguration();
      await prepareSchema();
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
