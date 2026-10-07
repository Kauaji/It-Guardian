import { Router } from "express";
import { getPoolStats, query } from "../database.js";
import { renderMetrics } from "../lib/metrics.js";
import { logger } from "../lib/logger.js";
import { getMigrationStatus, migrations } from "../migrations/index.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import { requireMetricsToken } from "../middleware/securityMiddleware.js";
import { getMigrationsMode, resolveDatabaseConfig } from "../config/environment.js";
import { getRelayBackendName } from "../services/remoteAssistanceRelay.js";

const router = Router();

// Migracoes so avancam: depois de "ok" nao ha por que reconsultar a cada sonda de saude.
let migrationsConfirmedAt = 0;
const MIGRATION_RECHECK_MS = 60_000;

async function migrationCheck() {
  if (getMigrationsMode() === "skip") return "skipped";
  if (Date.now() - migrationsConfirmedAt < MIGRATION_RECHECK_MS) return "ok";
  try {
    const status = await getMigrationStatus();
    if (!status.legacySchemaApplied || status.pending.length) return "pending";
    migrationsConfirmedAt = Date.now();
    return "ok";
  } catch {
    return "pending";
  }
}

async function readinessChecks() {
  const checks = { database: "ok", migrations: "ok" };
  try {
    await query("SELECT 1 AS healthy");
  } catch (error) {
    logger.error("readiness_database_failed", { message: error.message });
    checks.database = "unavailable";
    checks.migrations = "unknown";
    return checks;
  }
  checks.migrations = await migrationCheck();
  return checks;
}

/** Liveness: so diz que o processo responde. Nunca toca no banco (evita reiniciar o app por queda do banco). */
export function liveness(_req, res) {
  res.json({ status: "ok", service: "it-guardian-api", timestamp: new Date().toISOString() });
}

/** Readiness: pronto para receber trafego (banco acessivel e migracoes aplicadas). */
export async function readiness(_req, res) {
  const checks = await readinessChecks();
  const ready = checks.database === "ok" && ["ok", "skipped"].includes(checks.migrations);
  res.status(ready ? 200 : 503).json({
    ok: ready,
    status: ready ? "ok" : "error",
    service: "it-guardian-api",
    timestamp: new Date().toISOString(),
    database: checks.database,
    checks
  });
}

router.get("/health/live", liveness);
router.get("/health/ready", readiness);
router.get("/metrics", requireMetricsToken, (_req, res) => {
  res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(renderMetrics());
});

/** Diagnostico detalhado (so administradores): nada disto fica em endpoint publico. */
router.get("/api/system/diagnostics", requireAuth, requireAdmin, async (_req, res) => {
  const database = resolveDatabaseConfig();
  const checks = await readinessChecks();
  res.json({
    node: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    database: {
      mode: database.mode,
      tlsVerification: database.tlsVerification || null,
      pool: getPoolStats(),
      checks
    },
    remoteAssistanceRelay: getRelayBackendName(),
    migrations: { expected: migrations.length },
    errorReporting: { sentry: Boolean(process.env.SENTRY_DSN), webhook: Boolean(process.env.ERROR_WEBHOOK_URL) },
    metricsEnabled: Boolean(process.env.METRICS_TOKEN)
  });
});

export { readiness as legacyHealthCheck };
export default router;
