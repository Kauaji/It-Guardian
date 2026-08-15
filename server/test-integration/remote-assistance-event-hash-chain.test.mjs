import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "false";
process.env.JWT_SECRET = "hash-chain-integration-test-secret-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const { createAgentEnrollment } = await import("../src/repositories/agentRepository.js");
const {
  addRemoteAssistanceEvent,
  createRemoteAssistanceSession,
  verifyRemoteAssistanceEventChain
} = await import("../src/repositories/remoteAssistanceRepository.js");

function heartbeatPayload(overrides = {}) {
  return {
    machineId: "hash-chain-machine",
    hostname: "LAB-HASH-CHAIN",
    operatingSystem: "Microsoft Windows 11 Pro",
    osArchitecture: "64-bit",
    windowsVersion: "23H2",
    localIp: "192.168.10.50",
    macAddress: "00-11-22-33-44-88",
    cpuModel: "Intel Core i5",
    memoryTotalBytes: 17179869184,
    diskTotalBytes: 512000000000,
    diskFreeBytes: 256000000000,
    uptimeSeconds: 7200,
    agentVersion: "1.0.0",
    collectedAt: new Date().toISOString(),
    intervalSeconds: 60,
    ...overrides
  };
}

test("a cadeia de hash da trilha de auditoria detecta adulteracao de um evento historico", async (t) => {
  await initializeRuntime();
  const enrollment = await createAgentEnrollment({ name: "Teste de cadeia de hash" });
  const server = await new Promise((resolve) => {
    const instance = createApp().listen(0, "127.0.0.1", () => resolve(instance));
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await closeDatabase();
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const heartbeat = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${enrollment.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(heartbeatPayload())
  });
  assert.equal(heartbeat.status, 202);

  const session = await createRemoteAssistanceSession({
    assetId: "hash-chain-machine",
    requestedMode: "view",
    consentRequired: false,
    consentStatus: "granted",
    viewerTokenHash: "viewer-token-hash-teste",
    agentTokenHash: "agent-token-hash-teste",
    reason: "Teste de integridade da trilha de auditoria",
    environment: "Laboratorio",
    expiresAt: new Date(Date.now() + 3600000).toISOString()
  });

  await addRemoteAssistanceEvent({
    sessionId: session.id,
    assetId: session.assetId,
    actorType: "technician",
    actorUserId: "user-tecnico",
    actorName: "Tecnico Teste",
    eventType: "session_requested",
    message: "Sessao solicitada.",
    metadata: { requestedMode: "view" }
  });
  await addRemoteAssistanceEvent({
    sessionId: session.id,
    assetId: session.assetId,
    actorType: "agent",
    eventType: "consent_granted",
    message: "Consentimento local concedido.",
    metadata: {}
  });
  const thirdEvent = await addRemoteAssistanceEvent({
    sessionId: session.id,
    assetId: session.assetId,
    actorType: "technician",
    actorUserId: "user-tecnico",
    actorName: "Tecnico Teste",
    eventType: "session_ended",
    message: "Sessao encerrada pelo tecnico.",
    metadata: { reason: "concluido" }
  });

  const validChain = await verifyRemoteAssistanceEventChain(session.id);
  assert.deepEqual(validChain, {
    valid: true,
    totalEvents: 3,
    brokenAtEventId: null,
    brokenAtIndex: null
  });

  // Adulteracao direta no banco (fora do caminho normal do app) -- exatamente o
  // cenario que "insert-only por convencao de codigo" nao consegue detectar.
  await query(
    "UPDATE remote_assistance_events SET message = $2 WHERE id = $1",
    [thirdEvent.id, "Sessao encerrada pelo tecnico. (mensagem adulterada)"]
  );

  const tamperedChain = await verifyRemoteAssistanceEventChain(session.id);
  assert.equal(tamperedChain.valid, false);
  assert.equal(tamperedChain.totalEvents, 3);
  assert.equal(tamperedChain.brokenAtEventId, thirdEvent.id);
  assert.equal(tamperedChain.brokenAtIndex, 2);
});
