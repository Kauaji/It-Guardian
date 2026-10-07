import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "retention-integration-secret-with-32-chars";
process.env.NODE_ENV = "test";
process.env.AUTH_RATE_LIMIT_MAX = "1000";
process.env.RETENTION_HEARTBEAT_DAYS = "30";
process.env.RETENTION_METRIC_HISTORY_DAYS = "90";
process.env.RETENTION_AUTH_SESSION_DAYS = "30";
process.env.RETENTION_REAUTH_DAYS = "7";
process.env.RETENTION_REAUTH_ATTEMPT_DAYS = "180";
process.env.RETENTION_AUDIT_LOG_DAYS = "365";
process.env.RETENTION_BATCH_SIZE = "100";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const { createAgentEnrollment } = await import("../src/repositories/agentRepository.js");
const { runDataRetention } = await import("../src/jobs/dataRetention.js");

const DAY = 86_400_000;
const ago = (days) => new Date(Date.now() - days * DAY);

let userId;
let assetId;
let enrollmentId;

test.before(async () => {
  await initializeRuntime();
  userId = (await query("SELECT id FROM users ORDER BY created_at LIMIT 1")).rows[0].id;
  const { enrollment } = await createAgentEnrollment({ name: "Retencao" });
  enrollmentId = enrollment.id;
  assetId = `retention-asset-${randomUUID()}`;
  await query(
    `
      INSERT INTO agent_assets (
        asset_id, enrollment_id, hostname, machine_alias, operating_system, os_architecture,
        windows_version, local_ip, mac_address, cpu_model, memory_total_bytes,
        disk_total_bytes, disk_free_bytes, uptime_seconds, agent_version,
        collected_at, interval_seconds
      )
      VALUES ($1, $2, 'host', 'alias', 'Windows', '64-bit', '23H2', '10.0.0.1', '00-00-00-00-00-00',
        'CPU', 1, 1, 1, 1, '1.0.0', NOW(), 60)
    `,
    [assetId, enrollmentId]
  );
});

test.after(async () => {
  await closeDatabase();
});

const count = async (table, where = "TRUE", params = []) =>
  Number((await query(`SELECT COUNT(*)::int AS total FROM ${table} WHERE ${where}`, params)).rows[0].total);

async function seedHeartbeat(receivedAt) {
  await query("INSERT INTO agent_heartbeats (id, asset_id, enrollment_id, collected_at, received_at) VALUES ($1, $2, $3, $4, $4)", [
    randomUUID(),
    assetId,
    enrollmentId,
    receivedAt
  ]);
}

test("apaga so o que passou do prazo, em lotes, e preserva o recente", async () => {
  // 250 heartbeats antigos (3 lotes de 100) + 5 recentes
  for (let i = 0; i < 250; i += 1) await seedHeartbeat(ago(45));
  for (let i = 0; i < 5; i += 1) await seedHeartbeat(ago(2));

  await query("INSERT INTO asset_metric_history (id, asset_id, collected_at) VALUES ($1, $2, $3), ($4, $2, $5)", [
    randomUUID(),
    assetId,
    ago(120),
    randomUUID(),
    ago(10)
  ]);

  const oldSession = randomUUID();
  const freshSession = randomUUID();
  const revokedOld = randomUUID();
  const revokedRecent = randomUUID();
  await query(
    `INSERT INTO auth_sessions (id, user_id, absolute_expires_at, revoked_at) VALUES
      ($1, $5, $6, NULL), ($2, $5, $7, NULL), ($3, $5, $7, $8), ($4, $5, $7, $9)`,
    [oldSession, freshSession, revokedOld, revokedRecent, userId, ago(40), new Date(Date.now() + DAY), ago(40), ago(1)]
  );

  await query(
    "INSERT INTO security_reauthentication_attempts (id, user_id, action, created_at) VALUES ($1, $3, 'x', $4), ($2, $3, 'x', $5)",
    [randomUUID(), randomUUID(), userId, ago(400), ago(5)]
  );

  const logOld = randomUUID();
  const logRecent = randomUUID();
  await query("INSERT INTO audit_logs (id, type, message, created_at) VALUES ($1, 't', 'antigo', $3), ($2, 't', 'recente', $4)", [
    logOld,
    logRecent,
    ago(400),
    ago(5)
  ]);

  const result = await runDataRetention();
  assert.equal(result.removed.agentHeartbeats, 250);
  assert.equal(result.removed.assetMetricHistory, 1);
  assert.equal(result.removed.authSessions, 2, "expirada ha 40 dias e revogada ha 40 dias");
  assert.equal(result.removed.reauthAttempts, 1);
  assert.equal(result.removed.auditLogs, 1);

  assert.equal(await count("agent_heartbeats", "asset_id = $1", [assetId]), 5);
  assert.equal(await count("asset_metric_history", "asset_id = $1", [assetId]), 1);
  assert.equal(await count("auth_sessions", "id IN ($1, $2, $3, $4)", [oldSession, freshSession, revokedOld, revokedRecent]), 2);
  assert.equal(await count("audit_logs", "id = $1", [logRecent]), 1);
  assert.equal(await count("audit_logs", "id = $1", [logOld]), 0);
});

test("tokens de reautenticacao: apaga os expirados nao usados, preserva os usados e os referenciados pela auditoria", async () => {
  const unusedExpired = randomUUID();
  const used = randomUUID();
  const referenced = randomUUID();
  const recent = randomUUID();
  const insert = (id, expiresAt, usedAt) =>
    query(
      `INSERT INTO security_reauthentications (id, user_id, action, token_hash, expires_at, used_at)
       VALUES ($1, $2, 'remote_assistance', $3, $4, $5)`,
      [id, userId, `hash-${id}`, expiresAt, usedAt]
    );
  await insert(unusedExpired, ago(20), null);
  await insert(used, ago(20), ago(20));
  await insert(referenced, ago(20), null);
  await insert(recent, new Date(Date.now() + 60_000), null);

  await query(
    `INSERT INTO remote_assistance_sessions (
       id, asset_id, technician_name, status, requested_mode, consent_status,
       viewer_token_hash, agent_token_hash, reason, environment_name, expires_at, reauth_id
     ) VALUES ($1, $2, 'Tecnico', 'ended', 'view', 'granted', $3, $4, 'motivo', 'lab', NOW(), $5)`,
    [randomUUID(), assetId, `v-${referenced}`, `a-${referenced}`, referenced]
  );

  const result = await runDataRetention();
  assert.equal(result.removed.reauthTokens, 1);
  const remaining = new Set(
    (
      await query("SELECT id FROM security_reauthentications WHERE id IN ($1, $2, $3, $4)", [unusedExpired, used, referenced, recent])
    ).rows.map((row) => row.id)
  );
  assert.equal(remaining.has(unusedExpired), false);
  assert.equal(remaining.has(used), true);
  assert.equal(remaining.has(referenced), true);
  assert.equal(remaining.has(recent), true);
});

test("e idempotente: segunda execucao nao remove mais nada", async () => {
  const result = await runDataRetention();
  for (const [name, total] of Object.entries(result.removed)) {
    assert.equal(total, 0, `${name} deveria ser 0 na segunda execucao`);
  }
});

test("endpoint de cron exige CRON_SECRET", async (t) => {
  const server = await new Promise((resolve) => {
    const instance = createApp().listen(0, "127.0.0.1", () => resolve(instance));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/maintenance/retention/cron`;

  delete process.env.CRON_SECRET;
  assert.equal((await fetch(url)).status, 503, "sem segredo configurado o cron fica desativado");

  process.env.CRON_SECRET = "segredo-de-cron-do-teste";
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { authorization: "Bearer errado" } })).status, 401);
  const ok = await fetch(url, { headers: { authorization: "Bearer segredo-de-cron-do-teste" } });
  assert.equal(ok.status, 200);
  assert.ok((await ok.json()).removed, "devolve o resumo da limpeza");
  delete process.env.CRON_SECRET;
});
