import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "script-execution-diagnosis-integration-secret-32c";
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

function browserHeaders(cookie) {
  return { "content-type": "application/json", cookie, origin: trustedOrigin };
}

function bearerHeaders(token) {
  return { "content-type": "application/json", authorization: `Bearer ${token}`, origin: trustedOrigin };
}

async function bearerUser({ role, permissions = [] }) {
  const user = await createUser({
    name: `Usuario ${role} ${Math.random().toString(36).slice(2, 8)}`,
    email: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@diagnosis.local`,
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
    localIp: "192.168.70.10",
    macAddress: "00-11-22-33-88-99",
    cpuModel: "Intel Core i5",
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
  const enrollment = await createAgentEnrollment({ name: `Agente diagnostico ${machineId}` });
  const response = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify(heartbeatPayload(machineId))
  });
  assert.equal(response.status, 202);
  return enrollment;
}

async function diagnose(baseUrl, headers, body) {
  const response = await fetch(`${baseUrl}/api/maintenance-scripts/execution-diagnosis`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const json = await response.json();
  return { status: response.status, json };
}

test.after(closeDatabase);

test("diagnostico: servidor desligado reflete serverEnabled false, agente ausente reflete agentRegistered false", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const noAgentResult = await diagnose(baseUrl, browserHeaders(cookie), {
    assetId: "diagnosis-no-agent",
    context: "service_order"
  });
  assert.equal(noAgentResult.status, 200);
  assert.equal(noAgentResult.json.diagnosis.agentRegistered, false);
  assert.equal(noAgentResult.json.diagnosis.agentActive, false);
  assert.equal(noAgentResult.json.diagnosis.overallAvailable, false);
  assert.equal(noAgentResult.json.diagnosis.agentLocalConfigStatus, "unknown");

  const machineId = "diagnosis-server-off";
  await enrollAndHeartbeat(baseUrl, machineId);

  const previousFlag = process.env.ENABLE_REMOTE_SCRIPT_EXECUTION;
  process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "false";
  try {
    const serverOffResult = await diagnose(baseUrl, browserHeaders(cookie), {
      assetId: machineId,
      context: "service_order"
    });
    assert.equal(serverOffResult.status, 200);
    assert.equal(serverOffResult.json.diagnosis.serverEnabled, false);
    assert.equal(serverOffResult.json.diagnosis.agentRegistered, true);
    assert.equal(serverOffResult.json.diagnosis.overallAvailable, false);
  } finally {
    process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = previousFlag;
  }
});

test("diagnostico: agente obsoleto reflete agentActive false, agente com contato recente e tudo certo reflete overallAvailable true", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);
  const machineId = "diagnosis-stale-agent";
  await enrollAndHeartbeat(baseUrl, machineId);

  await query("UPDATE agent_assets SET last_seen_at = NOW() - INTERVAL '2 hours' WHERE asset_id = $1", [machineId]);

  const staleResult = await diagnose(baseUrl, browserHeaders(cookie), {
    assetId: machineId,
    context: "service_order"
  });
  assert.equal(staleResult.status, 200);
  assert.equal(staleResult.json.diagnosis.agentRegistered, true);
  assert.equal(staleResult.json.diagnosis.agentActive, false);
  assert.equal(staleResult.json.diagnosis.overallAvailable, false);

  const freshMachineId = "diagnosis-fresh-agent";
  await enrollAndHeartbeat(baseUrl, freshMachineId);

  const freshResult = await diagnose(baseUrl, browserHeaders(cookie), {
    assetId: freshMachineId,
    context: "service_order"
  });
  assert.equal(freshResult.status, 200);
  assert.equal(freshResult.json.diagnosis.serverEnabled, true);
  assert.equal(freshResult.json.diagnosis.agentRegistered, true);
  assert.equal(freshResult.json.diagnosis.agentActive, true);
  assert.equal(freshResult.json.diagnosis.userHasPermission, true);
  assert.equal(freshResult.json.diagnosis.overallAvailable, true);
  assert.equal(freshResult.json.diagnosis.script, null);
});

test("diagnostico: usuario sem permissao reflete userHasPermission false; contexto alert usa scripts.use_from_alert", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const machineId = "diagnosis-permission";
  await enrollAndHeartbeat(baseUrl, machineId);

  const { token: viewOnlyToken } = await bearerUser({ role: "viewer", permissions: ["scripts.view"] });
  const viewerResult = await diagnose(baseUrl, bearerHeaders(viewOnlyToken), {
    assetId: machineId,
    context: "service_order"
  });
  assert.equal(viewerResult.status, 200);
  assert.equal(viewerResult.json.diagnosis.userHasPermission, false);
  assert.equal(viewerResult.json.diagnosis.overallAvailable, false);

  const { token: operatorToken } = await bearerUser({ role: "operator" });
  const alertResult = await diagnose(baseUrl, bearerHeaders(operatorToken), {
    assetId: machineId,
    context: "alert"
  });
  assert.equal(alertResult.status, 200);
  assert.equal(alertResult.json.diagnosis.userHasPermission, true, "operator ja tem scripts.use_from_alert por padrao");
});

test("diagnostico: risco alto/critico reflete controle duplo por identidade e por permissao de aprovacao", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);
  const machineId = "diagnosis-high-risk";
  await enrollAndHeartbeat(baseUrl, machineId);

  const scriptResponse = await fetch(`${baseUrl}/api/maintenance-scripts`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({
      name: "Script de risco alto para diagnostico",
      type: "powershell",
      content: "Restart-Service -Name Spooler -Force",
      riskLevel: "high"
    })
  });
  const scriptBody = await scriptResponse.json();
  assert.equal(scriptResponse.status, 201, JSON.stringify(scriptBody));
  const script = scriptBody.script;

  const sameAuthorResult = await diagnose(baseUrl, browserHeaders(cookie), {
    assetId: machineId,
    scriptId: script.id,
    context: "service_order"
  });
  assert.equal(sameAuthorResult.status, 200);
  assert.equal(sameAuthorResult.json.diagnosis.script.riskRequiresSecondReviewer, true);
  assert.equal(sameAuthorResult.json.diagnosis.script.secondReviewerSatisfied, false, "admin editou o script, nao pode ser o proprio segundo revisor");
  assert.equal(sameAuthorResult.json.diagnosis.userHasHighRiskApproval, true, "admin sempre tem todas as permissoes");
  assert.equal(sameAuthorResult.json.diagnosis.overallAvailable, false);

  const { token: operatorWithoutApproval } = await bearerUser({ role: "operator", permissions: [] });
  const noApprovalResult = await diagnose(baseUrl, bearerHeaders(operatorWithoutApproval), {
    assetId: machineId,
    scriptId: script.id,
    context: "service_order"
  });
  assert.equal(noApprovalResult.json.diagnosis.script.secondReviewerSatisfied, true, "identidade diferente do autor");
  assert.equal(noApprovalResult.json.diagnosis.userHasHighRiskApproval, false);
  assert.equal(noApprovalResult.json.diagnosis.overallAvailable, false);

  const { token: operatorWithApproval } = await bearerUser({
    role: "operator",
    permissions: ["scripts.approve_high_risk"]
  });
  const approvedResult = await diagnose(baseUrl, bearerHeaders(operatorWithApproval), {
    assetId: machineId,
    scriptId: script.id,
    context: "service_order"
  });
  assert.equal(approvedResult.json.diagnosis.script.secondReviewerSatisfied, true);
  assert.equal(approvedResult.json.diagnosis.userHasHighRiskApproval, true);
  assert.equal(approvedResult.json.diagnosis.overallAvailable, true);
});

test("diagnostico: exige assetId e usuario sem sessao recebe 401", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const missingAssetResponse = await fetch(`${baseUrl}/api/maintenance-scripts/execution-diagnosis`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ context: "service_order" })
  });
  assert.equal(missingAssetResponse.status, 400);

  const unauthenticatedResponse = await fetch(`${baseUrl}/api/maintenance-scripts/execution-diagnosis`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: trustedOrigin },
    body: JSON.stringify({ assetId: "whatever", context: "service_order" })
  });
  assert.equal(unauthenticatedResponse.status, 401);
});
