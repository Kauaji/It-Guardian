import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

// pg-mem (o backend "memory" usado no resto da suite) nao popula
// information_schema para constraints nem aplica corretamente um segundo FK
// substituindo o ON DELETE original -- confirmado experimentalmente, o
// mesmo motivo pelo qual postgres-foundation.test.mjs so roda contra um
// Postgres real. Este teste segue a mesma convencao.
const databaseUrl = process.env.TEST_DATABASE_URL;

test("excluir um ativo ou sessao com historico de assistencia remota falha em vez de apagar o historico em cascata", {
  skip: !databaseUrl
}, async (t) => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.DB_SSL = "false";
  process.env.NODE_ENV = "test";

  const { initializeRuntime } = await import("../src/bootstrap.js");
  const { closeDatabase, query } = await import("../src/database.js");
  const { createAgentEnrollment } = await import("../src/repositories/agentRepository.js");
  t.after(closeDatabase);

  await initializeRuntime();

  const { enrollment } = await createAgentEnrollment({ name: "Integridade da auditoria" });
  const assetId = `integrity-test-asset-${randomUUID()}`;
  const sessionId = randomUUID();
  const eventId = randomUUID();

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
    [assetId, enrollment.id]
  );

  await query(
    `
      INSERT INTO remote_assistance_sessions (
        id, asset_id, technician_name, status, requested_mode, consent_status,
        viewer_token_hash, agent_token_hash, reason, environment_name, expires_at
      )
      VALUES ($1, $2, 'Tecnico', 'ended', 'view', 'granted', $3, $4, 'motivo de teste', 'lab', NOW() + INTERVAL '1 hour')
    `,
    [sessionId, assetId, `viewer-${sessionId}`, `agent-${sessionId}`]
  );

  await query(
    `
      INSERT INTO remote_assistance_events (
        id, session_id, asset_id, actor_type, event_type, message
      )
      VALUES ($1, $2, $3, 'system', 'session_started', 'evento de teste')
    `,
    [eventId, sessionId, assetId]
  );

  await assert.rejects(
    query("DELETE FROM agent_assets WHERE asset_id = $1", [assetId]),
    "excluir o ativo nao deve mais apagar a sessao de assistencia remota em cascata"
  );
  await assert.rejects(
    query("DELETE FROM remote_assistance_sessions WHERE id = $1", [sessionId]),
    "excluir a sessao nao deve mais apagar os eventos de auditoria em cascata"
  );

  const survivingSession = await query("SELECT id FROM remote_assistance_sessions WHERE id = $1", [sessionId]);
  assert.equal(survivingSession.rowCount, 1);
  const survivingEvent = await query("SELECT id FROM remote_assistance_events WHERE id = $1", [eventId]);
  assert.equal(survivingEvent.rowCount, 1);
});
