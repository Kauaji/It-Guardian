import assert from "node:assert/strict";

/**
 * Utilitarios compartilhados pelos testes de integracao do dominio de scripts
 * de manutencao e de jobs do agente. As funcoes que dependem de ../src/* fazem
 * import dinamico, porque useTestDatabase() precisa rodar antes de qualquer
 * import do servidor.
 */

export const trustedOrigin = "http://localhost:5173";

export function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

export async function login(baseUrl, email = "admin@itguardian.local") {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "123456" })
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie");
}

export function browserHeaders(cookie, extra = {}) {
  return { "content-type": "application/json", cookie, origin: trustedOrigin, ...extra };
}

export function bearerHeaders(token) {
  return { "content-type": "application/json", authorization: `Bearer ${token}`, origin: trustedOrigin };
}

export function agentHeaders(token) {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

export async function bearerUser({ role, permissions = [] }) {
  const { createUser } = await import("../src/repositories/userRepository.js");
  const { default: jwt } = await import("jsonwebtoken");
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const user = await createUser({
    name: `Usuario ${role} ${suffix}`,
    email: `${role}-${suffix}@script-fixtures.local`,
    password: "senha-nao-usada-neste-teste",
    role,
    permissions
  });
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  return { user, token };
}

export function heartbeatPayload(machineId, overrides = {}) {
  return {
    machineId,
    hostname: machineId.toUpperCase(),
    operatingSystem: "Microsoft Windows 11 Pro",
    osArchitecture: "64-bit",
    windowsVersion: "23H2",
    localIp: "192.168.70.10",
    macAddress: "00-11-22-33-99-88",
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

export async function sendHeartbeat(baseUrl, token, machineId, overrides = {}) {
  const response = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: agentHeaders(token),
    body: JSON.stringify(heartbeatPayload(machineId, overrides))
  });
  return { response, body: await response.json() };
}

/** Cria um enrollment e registra a maquina com um primeiro heartbeat aceito. */
export async function enrollAndHeartbeat(baseUrl, machineId, overrides = {}) {
  const { createAgentEnrollment } = await import("../src/repositories/agentRepository.js");
  const enrollment = await createAgentEnrollment({ name: `Agente ${machineId}` });
  const { response } = await sendHeartbeat(baseUrl, enrollment.token, machineId, overrides);
  assert.equal(response.status, 202);
  return enrollment;
}

export async function createScriptViaApi(baseUrl, cookie, body, expectedStatus = 201) {
  const response = await fetch(`${baseUrl}/api/maintenance-scripts`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify(body)
  });
  const parsed = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(parsed));
  return parsed.script || parsed;
}

export async function createServiceOrderViaApi(baseUrl, cookie, body) {
  const response = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify(body)
  });
  const parsed = await response.json();
  assert.equal(response.status, 201, JSON.stringify(parsed));
  return parsed.serviceOrder;
}

/**
 * Cria um aviso ativo para a maquina e deixa o servidor gerar a sugestao de OS
 * correspondente. Devolve a sugestao como a API a lista.
 */
export async function createSuggestionForMachine(baseUrl, cookie, machineId, alertId, overrides = {}) {
  const { upsertAlert } = await import("../src/repositories/alertRepository.js");
  const { evaluateAlertsForSuggestions } = await import("../src/services/alertService.js");
  const observedAt = new Date().toISOString();
  await upsertAlert({
    id: alertId,
    assetId: machineId,
    hostName: machineId.toUpperCase(),
    type: "disk_health_low",
    metric: "disk_health",
    title: "Saude do disco abaixo do limite",
    description: "Aviso deterministico usado pelos testes do dominio de scripts.",
    severity: "critical",
    value: 30,
    threshold: 80,
    status: "active",
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    occurrencesCount: 1,
    source: "integration_test",
    ...overrides
  });
  await evaluateAlertsForSuggestions();

  const response = await fetch(`${baseUrl}/api/service-order-suggestions`, { headers: { cookie } });
  const body = await response.json();
  assert.equal(response.status, 200);
  const suggestion = body.suggestions.find((item) => item.alertId === alertId);
  assert.ok(suggestion, "a avaliacao de avisos deve gerar uma sugestao de OS para o aviso do teste");
  return suggestion;
}
