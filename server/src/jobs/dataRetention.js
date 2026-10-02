import { getRetentionConfig, resolveDatabaseConfig } from "../config/environment.js";
import { withConnection } from "../database.js";
import { logger } from "../lib/logger.js";

const MAX_BATCHES = 200;
const LOCK_KEY = 813_724_603;

/**
 * Apaga em lotes (nunca um DELETE gigante): devolve quantas linhas sairam.
 * `table`/`column` vem de lista fixa abaixo, nunca de entrada externa.
 */
async function purgeInBatches(db, { table, idColumn = "id", where, params, batchSize }) {
  let total = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const result = await db(
      `DELETE FROM ${table} WHERE ${idColumn} IN (SELECT ${idColumn} FROM ${table} WHERE ${where} LIMIT ${Number(batchSize)})`,
      params
    );
    total += result.rowCount;
    if (result.rowCount < batchSize) break;
  }
  return total;
}

const daysAgo = (days, now) => new Date(now.getTime() - days * 86_400_000);

async function purgeAll(db, config, now) {
  const batchSize = config.batchSize;
  const removed = {};
  const purge = async (name, spec) => {
    removed[name] = await purgeInBatches(db, { ...spec, batchSize });
  };

  if (config.heartbeatDays > 0) {
    await purge("agentHeartbeats", { table: "agent_heartbeats", where: "received_at < $1", params: [daysAgo(config.heartbeatDays, now)] });
  }
  if (config.metricHistoryDays > 0) {
    await purge("assetMetricHistory", { table: "asset_metric_history", where: "collected_at < $1", params: [daysAgo(config.metricHistoryDays, now)] });
  }
  await purge("authSessions", {
    table: "auth_sessions",
    where: "absolute_expires_at < $1 OR (revoked_at IS NOT NULL AND revoked_at < $1)",
    params: [daysAgo(config.authSessionDays, now)]
  });
  // So tokens de reautenticacao nunca usados: os usados ficam referenciados pela auditoria da assistencia remota.
  await purge("reauthTokens", {
    table: "security_reauthentications",
    where: "used_at IS NULL AND expires_at < $1 AND id NOT IN (SELECT reauth_id FROM remote_assistance_sessions WHERE reauth_id IS NOT NULL)",
    params: [daysAgo(config.reauthDays, now)]
  });
  if (config.reauthAttemptDays > 0) {
    await purge("reauthAttempts", { table: "security_reauthentication_attempts", where: "created_at < $1", params: [daysAgo(config.reauthAttemptDays, now)] });
  }
  if (config.auditLogDays > 0) {
    await purge("auditLogs", { table: "audit_logs", where: "created_at < $1", params: [daysAgo(config.auditLogDays, now)] });
  }
  return removed;
}

export async function runDataRetention({ now = new Date() } = {}) {
  const config = getRetentionConfig();
  const postgres = resolveDatabaseConfig().mode === "postgres";

  const outcome = await withConnection(async (db) => {
    if (postgres) {
      // Duas instancias nao limpam ao mesmo tempo (varias replicas, cron + agendador interno).
      const lock = await db("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_KEY]);
      if (!lock.rows[0]?.locked) return { skipped: "locked" };
    }
    try {
      return { removed: await purgeAll(db, config, now) };
    } finally {
      if (postgres) await db("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    }
  });

  if (outcome.removed) logger.info("data_retention_completed", { removed: outcome.removed });
  return outcome;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Agendador interno para o servidor persistente (on-premises). Em serverless usa-se o cron da Vercel. */
export function startDataRetentionScheduler({ initialDelayMs = 5 * 60 * 1000 } = {}) {
  const run = () => runDataRetention().catch((error) => logger.error("data_retention_failed", { error }));
  const first = setTimeout(run, initialDelayMs);
  const repeat = setInterval(run, DAY_MS);
  first.unref?.();
  repeat.unref?.();
  return () => {
    clearTimeout(first);
    clearInterval(repeat);
  };
}
