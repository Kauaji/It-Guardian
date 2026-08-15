import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "false";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "content-integrity-integration-test-secret-32-chars";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const { createAgentEnrollment } = await import("../src/repositories/agentRepository.js");
const {
  claimNextAgentScriptJob,
  queueAgentScriptJob
} = await import("../src/repositories/agentScriptJobRepository.js");
const {
  createMaintenanceScript,
  createScriptSimulationLog,
  deactivateMaintenanceScript,
  updateMaintenanceScript
} = await import("../src/repositories/maintenanceScriptRepository.js");

function heartbeatPayload(overrides = {}) {
  return {
    machineId: "content-integrity-machine",
    hostname: "LAB-CONTENT-INTEGRITY",
    operatingSystem: "Microsoft Windows 11 Pro",
    osArchitecture: "64-bit",
    windowsVersion: "23H2",
    localIp: "192.168.10.30",
    macAddress: "00-11-22-33-44-66",
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

test("trabalhos do agente so entregam conteudo de script que ainda bate com o cadastro aprovado", async (t) => {
  await initializeRuntime();
  const enrollment = await createAgentEnrollment({ name: "Teste de integridade de conteudo" });
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

  // Cenario 1: conteudo do script nao mudou entre o enfileiramento e a entrega -> job segue normalmente.
  const stableScript = await createMaintenanceScript({
    name: "Script estavel",
    type: "powershell",
    content: "Write-Output 'conteudo original'"
  });
  const stableLog = await createScriptSimulationLog({
    scriptId: stableScript.id,
    assetId: "content-integrity-machine",
    mode: "agent",
    status: "queued",
    rawLog: "Aguardando entrega.",
    parsedSummary: "Enfileirado."
  });
  const stableJob = await queueAgentScriptJob({
    script: stableScript,
    assetId: "content-integrity-machine",
    executionLogId: stableLog.id
  });
  const claimedStable = await claimNextAgentScriptJob({
    assetId: "content-integrity-machine",
    enrollmentId: enrollment.enrollment.id
  });
  assert.ok(claimedStable);
  assert.equal(claimedStable.id, stableJob.id);
  assert.equal(claimedStable.content, "Write-Output 'conteudo original'");

  // Cenario 2: o script cadastrado e editado depois do enfileiramento -> job e recusado, nao entregue.
  const tamperedScript = await createMaintenanceScript({
    name: "Script alvo de adulteracao",
    type: "powershell",
    content: "Write-Output 'conteudo revisado e aprovado'"
  });
  const tamperedLog = await createScriptSimulationLog({
    scriptId: tamperedScript.id,
    assetId: "content-integrity-machine",
    mode: "agent",
    status: "queued",
    rawLog: "Aguardando entrega.",
    parsedSummary: "Enfileirado."
  });
  const tamperedJob = await queueAgentScriptJob({
    script: tamperedScript,
    assetId: "content-integrity-machine",
    executionLogId: tamperedLog.id
  });
  await updateMaintenanceScript(tamperedScript.id, { content: "Remove-Item -Recurse -Force C:\\" });

  const claimedTampered = await claimNextAgentScriptJob({
    assetId: "content-integrity-machine",
    enrollmentId: enrollment.enrollment.id
  });
  assert.equal(claimedTampered, null);

  const tamperedJobRow = await query(
    "SELECT status, error_message FROM agent_script_jobs WHERE id = $1",
    [tamperedJob.id]
  );
  assert.equal(tamperedJobRow.rows[0].status, "failed");
  assert.match(tamperedJobRow.rows[0].error_message, /conteudo do script cadastrado mudou/);

  const tamperedLogRow = await query(
    "SELECT status, error_detected, attention_required FROM script_execution_logs WHERE id = $1",
    [tamperedLog.id]
  );
  assert.deepEqual(
    {
      status: tamperedLogRow.rows[0].status,
      errorDetected: tamperedLogRow.rows[0].error_detected,
      attentionRequired: tamperedLogRow.rows[0].attention_required
    },
    { status: "failed", errorDetected: true, attentionRequired: true }
  );

  const tamperedHistory = await query(
    "SELECT event_type FROM asset_history WHERE asset_id = $1 AND event_type = 'script_execution_blocked_content_mismatch'",
    ["content-integrity-machine"]
  );
  assert.equal(tamperedHistory.rowCount, 1);

  // Cenario 3: o script cadastrado e desativado depois do enfileiramento -> job tambem e recusado.
  const deactivatedScript = await createMaintenanceScript({
    name: "Script desativado apos enfileirar",
    type: "powershell",
    content: "Write-Output 'valido no momento do enfileiramento'"
  });
  const deactivatedLog = await createScriptSimulationLog({
    scriptId: deactivatedScript.id,
    assetId: "content-integrity-machine",
    mode: "agent",
    status: "queued",
    rawLog: "Aguardando entrega.",
    parsedSummary: "Enfileirado."
  });
  const deactivatedJob = await queueAgentScriptJob({
    script: deactivatedScript,
    assetId: "content-integrity-machine",
    executionLogId: deactivatedLog.id
  });
  await deactivateMaintenanceScript(deactivatedScript.id);

  const claimedDeactivated = await claimNextAgentScriptJob({
    assetId: "content-integrity-machine",
    enrollmentId: enrollment.enrollment.id
  });
  assert.equal(claimedDeactivated, null);

  const deactivatedJobRow = await query(
    "SELECT status FROM agent_script_jobs WHERE id = $1",
    [deactivatedJob.id]
  );
  assert.equal(deactivatedJobRow.rows[0].status, "failed");
});
