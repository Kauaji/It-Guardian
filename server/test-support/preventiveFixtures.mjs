import assert from "node:assert/strict";

/**
 * Utilitarios compartilhados pelos testes de integracao de preventivas e
 * automacoes. Os imports de ../src sao tardios: o arquivo de teste deve chamar
 * `useTestDatabase()` e configurar o ambiente antes de usar qualquer fixture.
 */

export const trustedOrigin = "http://localhost:5173";
export const automationPath = "/api/preventive-automation-plans";
export const preventivePlansPath = "/api/preventive-plans";

export function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

export async function startServer(t) {
  const { initializeRuntime } = await import("../src/bootstrap.js");
  const { createApp } = await import("../src/app.js");
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

export async function login(baseUrl, email = "admin@itguardian.local", password = "123456") {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  assert.equal(response.status, 200, `login de ${email} deveria funcionar`);
  return response.headers.get("set-cookie");
}

function parseBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Cliente HTTP minimo: devolve `{ status, body }` e nunca lanca por status. */
export function createClient(baseUrl, cookie) {
  async function send(method, path, body) {
    const headers = { cookie, origin: trustedOrigin };
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    return { status: response.status, body: parseBody(text) };
  }

  return {
    get: (path) => send("GET", path),
    post: (path, body = {}) => send("POST", path, body),
    patch: (path, body = {}) => send("PATCH", path, body),
    put: (path, body = {}) => send("PUT", path, body),
    del: (path) => send("DELETE", path)
  };
}

export async function createScript(name, overrides = {}) {
  const { createMaintenanceScript } = await import("../src/services/maintenanceScripts/maintenanceScriptsFacade.js");
  return createMaintenanceScript({
    name,
    content: `Write-Host 'rotina preventiva ${name}'`,
    type: "powershell",
    riskLevel: "low",
    ...overrides
  });
}

function heartbeatPayload(machineId) {
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
    intervalSeconds: 60
  };
}

/** Cadastra uma maquina com agente autenticado (o id do ativo e o machineId). */
export async function enrollAgentAsset(baseUrl, machineId) {
  const { createAgentEnrollment } = await import("../src/repositories/agentRepository.js");
  const enrollment = await createAgentEnrollment({ name: `Agente ${machineId}` });
  const response = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify(heartbeatPayload(machineId))
  });
  assert.equal(response.status, 202, `heartbeat de ${machineId} deveria ser aceito`);
  return enrollment;
}

/** Cadastra um ativo manual (sem agente): aparece no inventario, mas nao recebe jobs. */
export async function createManualDevice(name, tag, ip) {
  const { createManualAsset } = await import("../src/repositories/manualAssetRepository.js");
  const { checkPingStatus } = await import("../src/services/pingStatusService.js");
  const asset = await createManualAsset({
    payload: { name, type: "desktop", brand: "Generica", model: "Teste", assetTag: tag, ip },
    user: { id: null },
    checkPing: checkPingStatus
  });
  return asset;
}

export async function assignSegment(deviceId, segmentId) {
  const { updateDeviceSegment } = await import("../src/repositories/segmentRepository.js");
  await updateDeviceSegment({ deviceId, segmentId, userId: null });
}

export async function createRestrictedUser({ email, permissions, role = "viewer", name = "Usuario restrito" }) {
  const { createUser } = await import("../src/repositories/userRepository.js");
  return createUser({ name, email, password: "senha-restrita-123", role, permissions });
}

export async function setScheduleNextRun(planId, assetId, isoDate) {
  const { query } = await import("../src/database.js");
  await query("UPDATE preventive_automation_asset_schedules SET next_run_at = $3 WHERE plan_id = $1 AND asset_id = $2", [
    planId,
    assetId,
    isoDate
  ]);
}

export async function rows(sql, params = []) {
  const { query } = await import("../src/database.js");
  const result = await query(sql, params);
  return result.rows;
}
