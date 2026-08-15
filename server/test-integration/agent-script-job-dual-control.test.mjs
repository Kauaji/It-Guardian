import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "dual-control-integration-test-secret-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase } = await import("../src/database.js");
const { createAgentEnrollment } = await import("../src/repositories/agentRepository.js");
const { queueAgentScriptJob } = await import("../src/repositories/agentScriptJobRepository.js");
const {
  createMaintenanceScript,
  createScriptSimulationLog,
  findMaintenanceScriptById,
  updateMaintenanceScript
} = await import("../src/repositories/maintenanceScriptRepository.js");

function heartbeatPayload(overrides = {}) {
  return {
    machineId: "dual-control-machine",
    hostname: "LAB-DUAL-CONTROL",
    operatingSystem: "Microsoft Windows 11 Pro",
    osArchitecture: "64-bit",
    windowsVersion: "23H2",
    localIp: "192.168.10.40",
    macAddress: "00-11-22-33-44-77",
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

test("scripts de risco alto/critico exigem um segundo usuario para enfileirar a execucao", async (t) => {
  await initializeRuntime();
  const enrollment = await createAgentEnrollment({ name: "Teste de controle duplo" });
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

  // Usuarios reais do seed de demonstracao (created_by/content_updated_by tem FK para users).
  const author = { id: "seed-admin", name: "Admin Sistema" };
  const reviewer = { id: "seed-admin-marina", name: "Marina Duarte" };

  // Cenario 1: script de risco baixo -- a mesma pessoa que cadastrou pode enfileirar normalmente.
  const lowRiskScript = await createMaintenanceScript(
    { name: "Diagnostico de rede", type: "powershell", content: "Test-NetConnection", riskLevel: "low" },
    author
  );
  const lowRiskLog = await createScriptSimulationLog({
    scriptId: lowRiskScript.id,
    assetId: "dual-control-machine",
    mode: "agent",
    status: "queued",
    rawLog: "Aguardando entrega.",
    parsedSummary: "Enfileirado."
  });
  const lowRiskJob = await queueAgentScriptJob({
    script: lowRiskScript,
    assetId: "dual-control-machine",
    executionLogId: lowRiskLog.id,
    userId: author.id
  });
  assert.ok(lowRiskJob);

  // Cenario 2: script de risco critico -- o proprio autor tenta enfileirar e e recusado.
  const criticalScript = await createMaintenanceScript(
    {
      name: "Limpeza critica de disco",
      type: "powershell",
      content: "Remove-Item -Recurse -Force C:\\temp",
      riskLevel: "critical"
    },
    author
  );
  const criticalLog = await createScriptSimulationLog({
    scriptId: criticalScript.id,
    assetId: "dual-control-machine",
    mode: "agent",
    status: "queued",
    rawLog: "Aguardando entrega.",
    parsedSummary: "Enfileirado."
  });
  await assert.rejects(
    queueAgentScriptJob({
      script: criticalScript,
      assetId: "dual-control-machine",
      executionLogId: criticalLog.id,
      userId: author.id
    }),
    (error) => error.code === "SCRIPT_EXECUTION_REQUIRES_SECOND_REVIEWER" && error.statusCode === 403
  );

  // Cenario 3: um segundo usuario (que nao editou o conteudo) consegue enfileirar o mesmo script critico.
  const secondReviewerLog = await createScriptSimulationLog({
    scriptId: criticalScript.id,
    assetId: "dual-control-machine",
    mode: "agent",
    status: "queued",
    rawLog: "Aguardando entrega.",
    parsedSummary: "Enfileirado."
  });
  const reviewedJob = await queueAgentScriptJob({
    script: criticalScript,
    assetId: "dual-control-machine",
    executionLogId: secondReviewerLog.id,
    userId: reviewer.id
  });
  assert.ok(reviewedJob);

  // Cenario 4: depois que o revisor edita o conteudo, ele passa a ser o "autor" e tambem e bloqueado.
  await updateMaintenanceScript(criticalScript.id, { content: "Remove-Item -Recurse -Force C:\\temp2" }, reviewer);
  const editedScript = await findMaintenanceScriptById(criticalScript.id);
  assert.equal(editedScript.contentUpdatedBy, reviewer.id);
  const afterEditLog = await createScriptSimulationLog({
    scriptId: criticalScript.id,
    assetId: "dual-control-machine",
    mode: "agent",
    status: "queued",
    rawLog: "Aguardando entrega.",
    parsedSummary: "Enfileirado."
  });
  await assert.rejects(
    queueAgentScriptJob({
      script: editedScript,
      assetId: "dual-control-machine",
      executionLogId: afterEditLog.id,
      userId: reviewer.id
    }),
    (error) => error.code === "SCRIPT_EXECUTION_REQUIRES_SECOND_REVIEWER"
  );
});
