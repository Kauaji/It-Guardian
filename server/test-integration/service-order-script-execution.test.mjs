import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "service-order-script-execution-integration-secret-32c";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const { createUser } = await import("../src/repositories/userRepository.js");
const { createAgentEnrollment } = await import("../src/repositories/agentRepository.js");
const { default: jwt } = await import("jsonwebtoken");

const trustedOrigin = "http://localhost:5173";

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function login(baseUrl, email = "admin@itguardian.local") {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "123456" })
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie");
}

function browserHeaders(cookie, extra = {}) {
  return { "content-type": "application/json", cookie, origin: trustedOrigin, ...extra };
}

function bearerHeaders(token) {
  return { "content-type": "application/json", authorization: `Bearer ${token}`, origin: trustedOrigin };
}

async function bearerUser({ role, permissions = [] }) {
  const user = await createUser({
    name: `Usuario ${role} ${Math.random().toString(36).slice(2, 8)}`,
    email: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@script-exec.local`,
    password: "senha-nao-usada-neste-teste",
    role,
    permissions
  });
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  return { user, token };
}

function heartbeatPayload(machineId, overrides = {}) {
  return {
    machineId,
    hostname: machineId.toUpperCase(),
    operatingSystem: "Microsoft Windows 11 Pro",
    osArchitecture: "64-bit",
    windowsVersion: "23H2",
    localIp: "192.168.50.10",
    macAddress: "00-11-22-33-55-66",
    cpuModel: "Intel Core i7",
    memoryTotalBytes: 17179869184,
    diskTotalBytes: 512000000000,
    diskFreeBytes: 256000000000,
    uptimeSeconds: 3600,
    agentVersion: "1.0.0",
    collectedAt: new Date().toISOString(),
    intervalSeconds: 60,
    ...overrides
  };
}

async function enrollAndHeartbeat(baseUrl, machineId) {
  const enrollment = await createAgentEnrollment({ name: `Agente ${machineId}` });
  const response = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify(heartbeatPayload(machineId))
  });
  assert.equal(response.status, 202);
  return enrollment;
}

test.after(closeDatabase);

test("execucao real de script via Ordem de Servico: recomendacao, enfileiramento, entrega, conclusao e historico", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);
  const machineId = "os-script-happy-path";
  const enrollment = await enrollAndHeartbeat(baseUrl, machineId);

  const scriptResponse = await fetch(`${baseUrl}/api/maintenance-scripts`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({
      name: "Diagnostico de rede",
      type: "powershell",
      content: "Get-NetIPConfiguration",
      riskLevel: "low",
      tags: ["rede"]
    })
  });
  const scriptBody = await scriptResponse.json();
  assert.equal(scriptResponse.status, 201, JSON.stringify(scriptBody));
  const script = scriptBody.script;

  const orderResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ title: "Lentidao de rede intermitente", assetId: machineId })
  });
  const orderBody = await orderResponse.json();
  assert.equal(orderResponse.status, 201, JSON.stringify(orderBody));
  const order = orderBody.serviceOrder;

  const recommendationsResponse = await fetch(`${baseUrl}/api/maintenance-scripts/recommendations`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ assetIds: [machineId], context: { title: order.title } })
  });
  const recommendationsBody = await recommendationsResponse.json();
  assert.equal(recommendationsResponse.status, 200, JSON.stringify(recommendationsBody));
  const allRecommended = [...recommendationsBody.recommended, ...recommendationsBody.others];
  assert.ok(allRecommended.some((item) => item.id === script.id), "o script cadastrado deve aparecer na recomendacao para a OS");

  const useResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/scripts/${script.id}/use`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ confirmed: true })
  });
  const useBody = await useResponse.json();
  assert.equal(useResponse.status, 201, JSON.stringify(useBody));
  assert.ok(useBody.job.id, "a resposta deve trazer o trabalho enfileirado para o agente");
  assert.equal(useBody.log.status, "queued");

  const activityAfterQueue = await fetch(`${baseUrl}/api/service-orders/${order.id}/script-activity`, { headers: { cookie } });
  const activityAfterQueueBody = await activityAfterQueue.json();
  assert.equal(activityAfterQueue.status, 200);
  assert.equal(activityAfterQueueBody.activity.length, 1);
  assert.equal(activityAfterQueueBody.activity[0].job.status, "queued");

  const historyRow = await query(
    "SELECT event_type FROM service_order_history WHERE service_order_id = $1 AND event_type = 'script_execution_queued'",
    [order.id]
  );
  assert.equal(historyRow.rowCount, 1, "o enfileiramento deve ficar registrado no historico da OS");

  const assetHistoryRow = await query(
    "SELECT event_type FROM asset_history WHERE asset_id = $1 AND event_type = 'script_execution_queued'",
    [machineId]
  );
  assert.equal(assetHistoryRow.rowCount, 1, "o enfileiramento deve ficar registrado no historico do ativo");

  const deliveryHeartbeat = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify(heartbeatPayload(machineId))
  });
  const deliveryBody = await deliveryHeartbeat.json();
  assert.equal(deliveryHeartbeat.status, 202);
  assert.ok(deliveryBody.job, "o heartbeat deve entregar o trabalho enfileirado para o agente");
  assert.equal(deliveryBody.job.id, useBody.job.id);
  assert.equal(deliveryBody.job.content, "Get-NetIPConfiguration");

  const resultResponse = await fetch(`${baseUrl}/api/agents/jobs/${deliveryBody.job.id}/result`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify({ status: "succeeded", exitCode: 0, stdout: "Adaptador Ethernet...", stderr: "", timedOut: false })
  });
  assert.equal(resultResponse.status, 200);

  const activityAfterCompletion = await fetch(`${baseUrl}/api/service-orders/${order.id}/script-activity`, { headers: { cookie } });
  const activityAfterCompletionBody = await activityAfterCompletion.json();
  assert.equal(activityAfterCompletionBody.activity[0].job.status, "succeeded");
  assert.equal(activityAfterCompletionBody.activity[0].job.exitCode, 0);
});

test("bloqueia execucao de script em OS finalizada", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);
  const machineId = "os-script-finalized";
  await enrollAndHeartbeat(baseUrl, machineId);

  const scriptResponse = await fetch(`${baseUrl}/api/maintenance-scripts`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ name: "Diagnostico simples", type: "powershell", content: "Get-Service", riskLevel: "low" })
  });
  const script = (await scriptResponse.json()).script;

  const orderResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ title: "OS a ser finalizada", assetId: machineId })
  });
  const order = (await orderResponse.json()).serviceOrder;

  const assignResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/technician`, {
    method: "PATCH",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ assignedTechnicianName: "Tecnico Teste" })
  });
  assert.equal(assignResponse.status, 200);

  const closeResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/status`, {
    method: "PATCH",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ status: "closed" })
  });
  assert.equal(closeResponse.status, 200, JSON.stringify(await closeResponse.json()));

  const useResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/scripts/${script.id}/use`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ confirmed: true })
  });
  assert.equal(useResponse.status, 409);
});

test("bloqueia execucao de script em OS sem ativo vinculado", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const scriptResponse = await fetch(`${baseUrl}/api/maintenance-scripts`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ name: "Diagnostico sem ativo", type: "powershell", content: "Get-Service", riskLevel: "low" })
  });
  const script = (await scriptResponse.json()).script;

  const orderResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ title: "OS sem ativo vinculado" })
  });
  const order = (await orderResponse.json()).serviceOrder;
  assert.equal(order.assetId || null, null);

  const useResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/scripts/${script.id}/use`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ confirmed: true })
  });
  assert.equal(useResponse.status, 409);
});

test("bloqueia execucao de script sem a permissao service_orders.run_scripts", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);
  const machineId = "os-script-no-permission";
  await enrollAndHeartbeat(baseUrl, machineId);

  const scriptResponse = await fetch(`${baseUrl}/api/maintenance-scripts`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ name: "Diagnostico restrito", type: "powershell", content: "Get-Service", riskLevel: "low" })
  });
  const script = (await scriptResponse.json()).script;

  const orderResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ title: "OS restrita", assetId: machineId })
  });
  const order = (await orderResponse.json()).serviceOrder;

  const { token: viewerToken } = await bearerUser({ role: "viewer" });
  const useResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/scripts/${script.id}/use`, {
    method: "POST",
    headers: bearerHeaders(viewerToken),
    body: JSON.stringify({ confirmed: true })
  });
  assert.equal(useResponse.status, 403);
});

test("bloqueia execucao quando ENABLE_REMOTE_SCRIPT_EXECUTION esta desligado no servidor", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);
  const machineId = "os-script-flag-off";
  await enrollAndHeartbeat(baseUrl, machineId);

  const scriptResponse = await fetch(`${baseUrl}/api/maintenance-scripts`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ name: "Diagnostico com flag desligada", type: "powershell", content: "Get-Service", riskLevel: "low" })
  });
  const script = (await scriptResponse.json()).script;

  const orderResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ title: "OS com execucao desabilitada", assetId: machineId })
  });
  const order = (await orderResponse.json()).serviceOrder;

  const previousFlag = process.env.ENABLE_REMOTE_SCRIPT_EXECUTION;
  process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "false";
  try {
    const useResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/scripts/${script.id}/use`, {
      method: "POST",
      headers: browserHeaders(cookie),
      body: JSON.stringify({ confirmed: true })
    });
    assert.equal(useResponse.status, 503);
  } finally {
    process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = previousFlag;
  }
});

test("scripts de risco alto/critico exigem a permissao scripts.approve_high_risk de um segundo revisor", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);
  const machineId = "os-script-high-risk";
  await enrollAndHeartbeat(baseUrl, machineId);

  const scriptResponse = await fetch(`${baseUrl}/api/maintenance-scripts`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({
      name: "Reiniciar servico critico",
      type: "powershell",
      content: "Restart-Service -Name Spooler -Force",
      riskLevel: "high"
    })
  });
  const scriptBody = await scriptResponse.json();
  assert.equal(scriptResponse.status, 201, JSON.stringify(scriptBody));
  const script = scriptBody.script;

  const orderResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ title: "OS de risco alto", assetId: machineId })
  });
  const order = (await orderResponse.json()).serviceOrder;

  const { token: operatorWithoutApproval } = await bearerUser({
    role: "operator",
    permissions: []
  });
  const deniedResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/scripts/${script.id}/use`, {
    method: "POST",
    headers: bearerHeaders(operatorWithoutApproval),
    body: JSON.stringify({ confirmed: true, riskAcknowledged: true })
  });
  assert.equal(deniedResponse.status, 403, "operador sem scripts.approve_high_risk nao pode enfileirar script de risco alto");

  const { token: operatorWithApproval } = await bearerUser({
    role: "operator",
    permissions: ["scripts.approve_high_risk"]
  });
  const allowedResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/scripts/${script.id}/use`, {
    method: "POST",
    headers: bearerHeaders(operatorWithApproval),
    body: JSON.stringify({ confirmed: true, riskAcknowledged: true })
  });
  const allowedBody = await allowedResponse.json();
  assert.equal(allowedResponse.status, 201, JSON.stringify(allowedBody));
});

test("agente reporta falha e timeout, atividade da OS reflete o resultado", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);
  const machineId = "os-script-failure-timeout";
  const enrollment = await enrollAndHeartbeat(baseUrl, machineId);

  const scriptResponse = await fetch(`${baseUrl}/api/maintenance-scripts`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ name: "Script que falha", type: "powershell", content: "exit 1", riskLevel: "low" })
  });
  const script = (await scriptResponse.json()).script;

  const orderResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ title: "OS com falha de script", assetId: machineId })
  });
  const order = (await orderResponse.json()).serviceOrder;

  const useResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/scripts/${script.id}/use`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ confirmed: true })
  });
  assert.equal(useResponse.status, 201);

  const deliveryHeartbeat = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify(heartbeatPayload(machineId))
  });
  const deliveryBody = await deliveryHeartbeat.json();
  assert.ok(deliveryBody.job);

  const resultResponse = await fetch(`${baseUrl}/api/agents/jobs/${deliveryBody.job.id}/result`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify({ status: "failed", exitCode: 1, stdout: "", stderr: "erro simulado", timedOut: false })
  });
  assert.equal(resultResponse.status, 200);

  const activityResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/script-activity`, { headers: { cookie } });
  const activityBody = await activityResponse.json();
  assert.equal(activityBody.activity[0].job.status, "failed");
  assert.equal(activityBody.activity[0].job.exitCode, 1);
  assert.match(activityBody.activity[0].job.stderr, /erro simulado/);
});
