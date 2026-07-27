import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "false";
process.env.JWT_SECRET = "agent-integration-test-secret-with-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const {
  createAgentEnrollment,
  listAgentAssets,
  revokeAgentEnrollment
} = await import("../src/repositories/agentRepository.js");
const { listDevices } = await import("../src/services/monitoringService.js");

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function payload(overrides = {}) {
  return {
    machineId: "machine-guid-agent-test",
    hostname: "LAB-PC-01",
    operatingSystem: "Microsoft Windows 11 Pro",
    osArchitecture: "64-bit",
    windowsVersion: "23H2",
    localIp: "192.168.10.21",
    macAddress: "00-11-22-33-44-55",
    cpuModel: "Intel Core i5",
    memoryTotalBytes: 17179869184,
    diskTotalBytes: 512000000000,
    diskFreeBytes: 256000000000,
    uptimeSeconds: 7200,
    agentVersion: "1.0.0",
    collectedAt: new Date().toISOString(),
    intervalSeconds: 60,
    environment: "Laboratorio",
    group: "Suporte",
    segment: "Windows",
    ...overrides
  };
}

test("agente autentica, valida, atualiza inventario e respeita revogacao", async (t) => {
  await initializeRuntime();
  const enrollment = await createAgentEnrollment({ name: "Teste de integracao" });
  const server = await listen(createApp());
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await closeDatabase();
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(
    Object.fromEntries(Object.entries(await health.json()).filter(([key]) => ["ok", "status", "service", "database"].includes(key))),
    { ok: true, status: "ok", service: "it-guardian-api", database: "ok" }
  );

  const missingToken = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload())
  });
  assert.equal(missingToken.status, 401);

  const invalidToken = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: {
      authorization: "Bearer itg_token_invalido",
      "content-type": "application/json"
    },
    body: JSON.stringify(payload())
  });
  assert.equal(invalidToken.status, 401);

  const emptyPayload = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${enrollment.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({})
  });
  assert.equal(emptyPayload.status, 400);

  const accepted = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${enrollment.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload())
  });
  assert.equal(accepted.status, 202);
  assert.equal((await accepted.json()).assetId, "machine-guid-agent-test");

  const unknownField = await fetch(`${baseUrl}/api/agents/inventory`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${enrollment.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload({ command: "whoami" }))
  });
  assert.equal(unknownField.status, 400);

  const invalidDisk = await fetch(`${baseUrl}/api/agents/inventory`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${enrollment.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload({ diskFreeBytes: 600000000000 }))
  });
  assert.equal(invalidDisk.status, 400);

  const beforeUpdate = (await listAgentAssets())[0].lastSeenAt;
  const updated = await fetch(`${baseUrl}/agent/heartbeat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${enrollment.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload({ localIp: "192.168.10.22" }))
  });
  assert.equal(updated.status, 202);

  const assets = await listAgentAssets();
  assert.equal(assets.length, 1);
  assert.equal(assets[0].localIp, "192.168.10.22");
  assert.ok(new Date(assets[0].lastSeenAt).getTime() >= new Date(beforeUpdate).getTime());

  const enrollmentRows = await query(
    "SELECT token_hash, token_prefix FROM agent_enrollments WHERE id = $1",
    [enrollment.enrollment.id]
  );
  assert.notEqual(enrollmentRows.rows[0].token_hash, enrollment.token);
  assert.notEqual(enrollmentRows.rows[0].token_prefix, enrollment.token);
  const heartbeatRows = await query(
    "SELECT payload FROM agent_heartbeats WHERE asset_id = $1",
    ["machine-guid-agent-test"]
  );
  assert.equal(JSON.stringify(heartbeatRows.rows).includes(enrollment.token), false);

  const devices = await listDevices({});
  const device = devices.find((item) => item.id === "machine-guid-agent-test");
  assert.equal(device.source, "agent");
  assert.equal(device.status, "online");
  assert.equal(device.agent.agentVersion, "1.0.0");

  await query(
    "UPDATE agent_assets SET last_seen_at = $2 WHERE asset_id = $1",
    ["machine-guid-agent-test", new Date(Date.now() - 10 * 60 * 1000).toISOString()]
  );
  const staleDevices = await listDevices({});
  assert.equal(
    staleDevices.find((item) => item.id === "machine-guid-agent-test").status,
    "offline"
  );

  await revokeAgentEnrollment(enrollment.enrollment.id);
  const revoked = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${enrollment.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload())
  });
  assert.equal(revoked.status, 401);
});
