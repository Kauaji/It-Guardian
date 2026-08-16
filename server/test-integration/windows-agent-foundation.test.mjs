import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "false";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "agent-integration-test-secret-with-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const {
  createAgentEnrollment,
  listAgentAssets,
  revokeAgentEnrollment,
  updateAgentAssetAlias
} = await import("../src/repositories/agentRepository.js");
const { queueAgentScriptJob } = await import("../src/repositories/agentScriptJobRepository.js");
const { createScriptSimulationLog } = await import("../src/repositories/maintenanceScriptRepository.js");
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
    inventoryDetails: {
      cpuCores: 8,
      memoryHealth: { status: "Sem falhas reportadas", modules: 2 },
      licenses: {
        windowsKey: "Ativada - final ABCDE",
        officeKey: "Ativada - final VWXYZ"
      },
      office: { name: "Microsoft 365 Apps", version: "16.0.12345" },
      disks: [{
        label: "SSD Teste",
        sizeGb: 476.9,
        type: "SSD",
        smartStatus: "OK",
        healthPercent: 96,
        healthEstimate: "96% (estimativa SMART)"
      }],
      software: [{ name: "Aplicativo Teste", version: "1.2.3" }]
    },
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
  const acceptedBody = await accepted.json();
  assert.equal(acceptedBody.assetId, "machine-guid-agent-test");
  assert.equal(acceptedBody.latestVersion, null, "sem AGENT_LATEST_VERSION configurado, nao deve sugerir atualizacao");

  t.after(() => {
    delete process.env.AGENT_LATEST_VERSION;
    delete process.env.AGENT_LATEST_VERSION_URL;
    delete process.env.AGENT_LATEST_VERSION_SHA256;
  });
  process.env.AGENT_LATEST_VERSION = "2.0.0";
  process.env.AGENT_LATEST_VERSION_URL = "https://cdn.example.com/ITGuardian.exe";
  process.env.AGENT_LATEST_VERSION_SHA256 = "a".repeat(64);

  const withUpdateAvailable = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${enrollment.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload({ agentVersion: "1.0.0" }))
  });
  const updateBody = await withUpdateAvailable.json();
  assert.equal(updateBody.latestVersion, "2.0.0");
  assert.equal(updateBody.latestVersionDownloadUrl, "https://cdn.example.com/ITGuardian.exe");
  assert.equal(updateBody.latestVersionSha256, "a".repeat(64));

  const alreadyUpToDate = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${enrollment.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload({ agentVersion: "2.0.0" }))
  });
  const upToDateBody = await alreadyUpToDate.json();
  assert.equal(upToDateBody.latestVersion, null, "agente ja na versao mais recente nao deve receber sugestao de atualizacao");

  const acceptedWithNulCharacters = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${enrollment.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload({
      hostname: "LAB-PC\u0000-01",
      machineAlias: "Computador\u0000 temporario",
      inventoryDetails: {
        ...payload().inventoryDetails,
        software: [{ name: "Aplicativo\u0000 Teste", version: "1.2.3" }],
        "nul\u0000key": "valor\u0000"
      }
    }))
  });
  assert.equal(acceptedWithNulCharacters.status, 202);
  const [sanitizedAsset] = await listAgentAssets();
  assert.equal(sanitizedAsset.hostname, "LAB-PC-01");
  assert.equal(sanitizedAsset.machineAlias, "Computador temporario");
  assert.equal(sanitizedAsset.inventoryDetails.software[0].name, "Aplicativo Teste");
  assert.equal(sanitizedAsset.inventoryDetails.nulkey, "valor");

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
  assert.equal(assets[0].inventoryDetails.cpuCores, 8);
  assert.ok(new Date(assets[0].lastSeenAt).getTime() >= new Date(beforeUpdate).getTime());

  await updateAgentAssetAlias({
    assetId: "machine-guid-agent-test",
    alias: "Computador da bancada"
  });
  const heartbeatWithoutAlias = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${enrollment.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload({ machineAlias: null }))
  });
  assert.equal(heartbeatWithoutAlias.status, 202);
  assert.equal((await listAgentAssets())[0].machineAlias, "Computador da bancada");

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
  assert.equal(device.name, "Computador da bancada");
  assert.equal(device.hardware.cpuCores, 8);
  assert.equal(device.hardware.disks[0].healthPercent, 96);
  assert.equal(device.hardware.software[0].name, "Aplicativo Teste");

  const script = {
    id: "agent-roundtrip-script",
    name: "Teste controlado do agente",
    type: "powershell",
    content: "Write-Output 'roundtrip'"
  };
  await query(
    `
      INSERT INTO maintenance_scripts (id, name, type, content, risk_level, suggested_risk_level)
      VALUES ($1, $2, $3, $4, 'low', 'low')
    `,
    [script.id, script.name, script.type, script.content]
  );
  const executionLog = await createScriptSimulationLog({
    scriptId: script.id,
    assetId: "machine-guid-agent-test",
    mode: "agent",
    status: "queued",
    rawLog: "Aguardando entrega ao agente.",
    parsedSummary: "Trabalho enfileirado."
  });
  const queuedJob = await queueAgentScriptJob({
    script,
    assetId: "machine-guid-agent-test",
    executionLogId: executionLog.id
  });

  const claimedResponse = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${enrollment.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload())
  });
  assert.equal(claimedResponse.status, 202);
  const claimedBody = await claimedResponse.json();
  assert.equal(claimedBody.job.id, queuedJob.id);
  assert.equal(claimedBody.job.scriptId, script.id);
  assert.equal(claimedBody.job.content, script.content);

  const resultResponse = await fetch(`${baseUrl}/api/agents/jobs/${queuedJob.id}/result`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${enrollment.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      exitCode: 0,
      timedOut: false,
      stdout: "roundtrip",
      stderr: "",
      errorMessage: ""
    })
  });
  assert.equal(resultResponse.status, 200);
  assert.equal((await resultResponse.json()).status, "succeeded");

  const completedJob = await query(
    "SELECT status, exit_code, stdout FROM agent_script_jobs WHERE id = $1",
    [queuedJob.id]
  );
  assert.deepEqual(
    {
      status: completedJob.rows[0].status,
      exitCode: completedJob.rows[0].exit_code,
      stdout: completedJob.rows[0].stdout
    },
    { status: "succeeded", exitCode: 0, stdout: "roundtrip" }
  );
  const completedLog = await query(
    "SELECT mode, status, error_detected FROM script_execution_logs WHERE id = $1",
    [executionLog.id]
  );
  assert.deepEqual(
    {
      mode: completedLog.rows[0].mode,
      status: completedLog.rows[0].status,
      errorDetected: completedLog.rows[0].error_detected
    },
    { mode: "agent", status: "succeeded", errorDetected: false }
  );
  const history = await query(
    `
      SELECT event_type
      FROM asset_history
      WHERE asset_id = $1 AND event_type = 'script_execution_succeeded'
    `,
    ["machine-guid-agent-test"]
  );
  assert.equal(history.rowCount, 1);

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
