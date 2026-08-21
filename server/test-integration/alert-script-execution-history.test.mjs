import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "alert-script-execution-history-integration-secret-32c";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase } = await import("../src/database.js");
const { createAgentEnrollment } = await import("../src/repositories/agentRepository.js");
const { upsertAlert } = await import("../src/repositories/alertRepository.js");
const { evaluateAlertsForSuggestions } = await import("../src/services/alertService.js");
const { createUser } = await import("../src/repositories/userRepository.js");
const { default: jwt } = await import("jsonwebtoken");

const trustedOrigin = "http://localhost:5173";

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function login(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@itguardian.local", password: "123456" })
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie");
}

function browserHeaders(cookie) {
  return { "content-type": "application/json", cookie, origin: trustedOrigin };
}

function heartbeatPayload(machineId, overrides = {}) {
  return {
    machineId,
    hostname: machineId.toUpperCase(),
    operatingSystem: "Microsoft Windows 11 Pro",
    osArchitecture: "64-bit",
    windowsVersion: "23H2",
    localIp: "192.168.60.10",
    macAddress: "00-11-22-33-77-88",
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

function bearerHeaders(token) {
  return { "content-type": "application/json", authorization: `Bearer ${token}`, origin: trustedOrigin };
}

async function bearerUser({ role, permissions = [] }) {
  const user = await createUser({
    name: `Usuario ${role} ${Math.random().toString(36).slice(2, 8)}`,
    email: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@alert-guardrails.local`,
    password: "senha-nao-usada-neste-teste",
    role,
    permissions
  });
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  return { user, token };
}

async function setupAlertSuggestionAndScript(baseUrl, cookie, suffix) {
  const machineId = `alert-guardrail-asset-${suffix}`;
  const enrollment = await createAgentEnrollment({ name: `Agente guardrail ${suffix}` });
  await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify(heartbeatPayload(machineId))
  });

  const alertId = `alert-guardrail-${suffix}`;
  const observedAt = new Date().toISOString();
  await upsertAlert({
    id: alertId,
    assetId: machineId,
    hostName: machineId.toUpperCase(),
    type: "disk_health_low",
    metric: "disk_health",
    title: "Saude do disco abaixo do limite",
    description: "Alerta deterministico do teste de guardrails de script em aviso.",
    severity: "critical",
    value: 30,
    threshold: 80,
    status: "active",
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    occurrencesCount: 1,
    source: "integration_test"
  });
  await evaluateAlertsForSuggestions();

  const suggestionsResponse = await fetch(`${baseUrl}/api/service-order-suggestions`, { headers: { cookie } });
  const suggestionsBody = await suggestionsResponse.json();
  const suggestion = suggestionsBody.suggestions.find((item) => item.alertId === alertId);

  const scriptResponse = await fetch(`${baseUrl}/api/maintenance-scripts`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({
      name: `Diagnostico guardrail ${suffix}`,
      type: "powershell",
      content: "Get-Service",
      riskLevel: "low"
    })
  });
  const script = (await scriptResponse.json()).script;

  return { machineId, suggestion, script };
}

test.after(closeDatabase);

test("uso de script a partir de aviso comenta no alerta ao enfileirar e ao concluir, sem duplicar em reuso ou reenvio", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const machineId = "alert-script-history-asset";
  const enrollment = await createAgentEnrollment({ name: "Agente historico de alerta" });
  const heartbeat = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify(heartbeatPayload(machineId))
  });
  assert.equal(heartbeat.status, 202);

  const alertId = "alert-script-history-alert";
  const observedAt = new Date().toISOString();
  await upsertAlert({
    id: alertId,
    assetId: machineId,
    hostName: machineId.toUpperCase(),
    type: "disk_health_low",
    metric: "disk_health",
    title: "Saude do disco abaixo do limite",
    description: "Alerta deterministico do teste de historico de script em aviso.",
    severity: "critical",
    value: 32,
    threshold: 80,
    status: "active",
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    occurrencesCount: 1,
    source: "integration_test"
  });
  await evaluateAlertsForSuggestions();

  const suggestionsResponse = await fetch(`${baseUrl}/api/service-order-suggestions`, { headers: { cookie } });
  const suggestionsBody = await suggestionsResponse.json();
  assert.equal(suggestionsResponse.status, 200);
  const suggestion = suggestionsBody.suggestions.find((item) => item.alertId === alertId);
  assert.ok(suggestion, "a avaliacao de alertas deve gerar uma sugestao de OS para o alerta de teste");

  const scriptResponse = await fetch(`${baseUrl}/api/maintenance-scripts`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({
      name: "Diagnostico de saude de disco",
      type: "powershell",
      content: "Get-PhysicalDisk | Select-Object HealthStatus",
      riskLevel: "low"
    })
  });
  const scriptBody = await scriptResponse.json();
  assert.equal(scriptResponse.status, 201, JSON.stringify(scriptBody));
  const script = scriptBody.script;

  async function fetchComments() {
    const response = await fetch(`${baseUrl}/api/alerts/${alertId}/comments`, { headers: { cookie } });
    assert.equal(response.status, 200);
    const body = await response.json();
    return body.comments;
  }

  const commentsBeforeUse = await fetchComments();
  assert.equal(commentsBeforeUse.length, 0);

  const firstUseResponse = await fetch(`${baseUrl}/api/service-order-suggestions/${suggestion.id}/scripts/${script.id}/use`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ confirmed: true })
  });
  const firstUseBody = await firstUseResponse.json();
  assert.equal(firstUseResponse.status, 201, JSON.stringify(firstUseBody));
  assert.equal(firstUseBody.reused, undefined);

  const commentsAfterEnqueue = await fetchComments();
  assert.equal(commentsAfterEnqueue.length, 1, "o enfileiramento deve comentar uma unica vez no aviso");
  assert.match(commentsAfterEnqueue[0].message, /Diagnostico de saude de disco|enfileirado/i);

  const secondUseResponse = await fetch(`${baseUrl}/api/service-order-suggestions/${suggestion.id}/scripts/${script.id}/use`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ confirmed: true })
  });
  const secondUseBody = await secondUseResponse.json();
  assert.equal(secondUseResponse.status, 201);
  assert.equal(secondUseBody.reused, true, "reenviar o mesmo script para a mesma sugestao ativa deve ser idempotente");

  const commentsAfterReuse = await fetchComments();
  assert.equal(commentsAfterReuse.length, 1, "reuso idempotente nao deve duplicar o comentario no aviso");

  const deliveryHeartbeat = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify(heartbeatPayload(machineId))
  });
  const deliveryBody = await deliveryHeartbeat.json();
  assert.equal(deliveryHeartbeat.status, 202);
  assert.ok(deliveryBody.job, "o heartbeat deve entregar o trabalho enfileirado a partir do aviso");

  const completeResponse = await fetch(`${baseUrl}/api/agents/jobs/${deliveryBody.job.id}/result`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify({ status: "succeeded", exitCode: 0, stdout: "Healthy", stderr: "", timedOut: false })
  });
  assert.equal(completeResponse.status, 200);

  const commentsAfterCompletion = await fetchComments();
  assert.equal(commentsAfterCompletion.length, 2, "a conclusao do agente deve adicionar um segundo comentario no aviso");
  assert.ok(
    commentsAfterCompletion.some((comment) => /sucesso/i.test(comment.message)),
    "um dos comentarios deve refletir a conclusao com sucesso reportada pelo agente"
  );

  const suggestionsAfterCompletion = await fetch(`${baseUrl}/api/service-order-suggestions`, { headers: { cookie } });
  const suggestionsAfterCompletionBody = await suggestionsAfterCompletion.json();
  const updatedSuggestion = suggestionsAfterCompletionBody.suggestions.find((item) => item.id === suggestion.id);
  assert.equal(updatedSuggestion.latestValidation.job.status, "succeeded", "a listagem de sugestoes deve refletir o status do job concluido");
  assert.equal(updatedSuggestion.latestValidation.job.stdout, "Healthy", "o stdout reportado pelo agente deve chegar na listagem de sugestoes");
  assert.equal(updatedSuggestion.latestValidation.job.stderr, "", "o stderr deve chegar na listagem de sugestoes mesmo quando vazio");
  assert.match(
    updatedSuggestion.latestValidation.log.rawLog,
    /STDOUT:\s*\nHealthy/,
    "o log tecnico exibido ao tecnico (log.rawLog) precisa conter o stdout real do agente, nao ficar vazio"
  );

  const duplicateResultResponse = await fetch(`${baseUrl}/api/agents/jobs/${deliveryBody.job.id}/result`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify({ status: "succeeded", exitCode: 0, stdout: "Healthy", stderr: "", timedOut: false })
  });
  assert.equal(duplicateResultResponse.status, 200, "reenviar o resultado de um trabalho ja concluido deve ser idempotente, nao um erro");

  const commentsAfterDuplicateReport = await fetchComments();
  assert.equal(
    commentsAfterDuplicateReport.length,
    2,
    "reenviar o resultado de um trabalho ja concluido nao deve duplicar o comentario no aviso"
  );
});

test("bloqueia uso de script a partir de aviso quando ENABLE_REMOTE_SCRIPT_EXECUTION esta desligado no servidor", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const { suggestion, script } = await setupAlertSuggestionAndScript(baseUrl, cookie, "flag-off");
  assert.ok(suggestion, "a avaliacao de alertas deve gerar uma sugestao de OS para o alerta de teste");

  const previousFlag = process.env.ENABLE_REMOTE_SCRIPT_EXECUTION;
  process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "false";
  try {
    const useResponse = await fetch(`${baseUrl}/api/service-order-suggestions/${suggestion.id}/scripts/${script.id}/use`, {
      method: "POST",
      headers: browserHeaders(cookie),
      body: JSON.stringify({ confirmed: true })
    });
    assert.equal(useResponse.status, 503);
  } finally {
    process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = previousFlag;
  }
});

test("bloqueia uso de script a partir de aviso sem a permissao scripts.use_from_alert", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const { suggestion, script } = await setupAlertSuggestionAndScript(baseUrl, cookie, "no-permission");
  assert.ok(suggestion, "a avaliacao de alertas deve gerar uma sugestao de OS para o alerta de teste");

  const { token: viewerToken } = await bearerUser({ role: "viewer" });
  const deniedResponse = await fetch(`${baseUrl}/api/service-order-suggestions/${suggestion.id}/scripts/${script.id}/use`, {
    method: "POST",
    headers: bearerHeaders(viewerToken),
    body: JSON.stringify({ confirmed: true })
  });
  assert.equal(deniedResponse.status, 403);
});
