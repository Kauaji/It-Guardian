import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "dashboard-summary-integration-secret-32ch";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase } = await import("../src/database.js");
const { createAgentEnrollment } = await import("../src/repositories/agentRepository.js");

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

test.after(closeDatabase);

test("resumo do dashboard tem estrutura valida com apenas o seed padrao (sem ativos do agente)", async (t) => {
  // ENABLE_DEMO_SEED e obrigatorio para o admin existir neste harness de teste,
  // e tambem semeia um parque de demonstracao — por isso este teste valida
  // formato/tipos em vez de assumir contagem zero (nao ha estado "vazio"
  // alcancavel aqui). A cobertura de valores exatos fica no teste com dados
  // proprios, que confere deltas apos criar seus proprios registros.
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const cookie = await login(baseUrl);
  const response = await fetch(`${baseUrl}/api/dashboard/summary`, { headers: { cookie } });
  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(typeof body.overview.totalAssets, "number");
  assert.ok(body.overview.totalAssets >= 0);
  assert.equal(body.overview.onlineAssets + body.overview.offlineAssets + body.overview.criticalAssets <= body.overview.totalAssets, true);
  assert.equal(body.overview.overdueServiceOrders, 0);
  assert.equal(body.overview.overdueServiceOrdersAvailable, false);
  assert.ok(body.overview.infrastructureHealth.score >= 0 && body.overview.infrastructureHealth.score <= 100);
  assert.ok(["healthy", "attention", "critical", "emergency"].includes(body.overview.infrastructureHealth.classification));
  assert.ok(Array.isArray(body.overview.infrastructureHealth.deductions));
  assert.ok(Array.isArray(body.assets.byStatus));
  assert.ok(Array.isArray(body.assets.mostProblematic));
  assert.ok(body.serviceOrders.trend.length > 0);
  assert.ok(Array.isArray(body.alerts.bySeverity));
  assert.equal(body.business.enabled, false);
  assert.equal(typeof body.business.message, "string");
  assert.equal(body.metadata.mode, "local");
  assert.equal(body.metadata.period, "30d");

  // Nenhuma metrica inventada: nao ha nenhum dispositivo/OS/alerta criado por
  // este teste, entao qualquer numero refletido aqui vem do seed padrao real,
  // nunca de um calculo fabricado no frontend/backend.
  assert.equal(typeof body.metadata.generatedAt, "string");
});

test("usuario sem permissao de dashboard recebe 403", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const cookie = await login(baseUrl, "sem.permissao@itguardian.local");
  const response = await fetch(`${baseUrl}/api/dashboard/summary`, { headers: { cookie } });
  assert.equal(response.status, 403);
});

test("resumo reflete ativos online/offline, alertas criticos e OS abertas reais", async (t) => {
  await initializeRuntime();
  const enrollment = await createAgentEnrollment({ name: "Laboratorio do dashboard" });
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const heartbeatPayload = (overrides = {}) => ({
    machineId: "dashboard-machine-1",
    hostname: "DASH-01",
    machineAlias: "Notebook do dashboard",
    operatingSystem: "Microsoft Windows 11 Pro",
    osArchitecture: "64-bit",
    windowsVersion: "23H2",
    localIp: "192.168.70.10",
    macAddress: "00-11-22-33-66-10",
    cpuModel: "Intel Core i7",
    cpuUsagePercent: 40,
    memoryTotalBytes: 17179869184,
    memoryUsedBytes: 4294967296,
    diskTotalBytes: 512000000000,
    diskFreeBytes: 256000000000,
    uptimeSeconds: 7200,
    agentVersion: "1.0.0",
    collectedAt: new Date().toISOString(),
    intervalSeconds: 60,
    environment: "Laboratorio Dashboard",
    group: "Suporte",
    segment: "Windows",
    inventoryDetails: { cpuCores: 8, software: [] },
    ...overrides
  });

  const cookie = await login(baseUrl);
  const before = await (await fetch(`${baseUrl}/api/dashboard/summary`, { headers: { cookie } })).json();

  const heartbeatResponse = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify(heartbeatPayload())
  });
  assert.equal(heartbeatResponse.status, 202);

  const orderResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ title: "OS de teste do dashboard" })
  });
  assert.equal(orderResponse.status, 201);

  const response = await fetch(`${baseUrl}/api/dashboard/summary`, { headers: { cookie } });
  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.overview.totalAssets, before.overview.totalAssets + 1);
  assert.equal(body.overview.onlineAssets, before.overview.onlineAssets + 1);
  assert.equal(body.overview.openServiceOrders, before.overview.openServiceOrders + 1);
  assert.ok(body.assets.byStatus.some((entry) => entry.key === "online" && entry.count >= 1));
  assert.ok(body.serviceOrders.byStatus.some((entry) => entry.key === "open" && entry.count >= 1));
  assert.ok(body.serviceOrders.recent.some((order) => order.title === "OS de teste do dashboard"));
  assert.ok(body.assets.mostProblematic.length <= 5);

  const responseJson = JSON.stringify(body);
  assert.doesNotMatch(responseJson, /password/i);
  assert.doesNotMatch(responseJson, /"token"/i);
  assert.doesNotMatch(responseJson, /\bjwt\b/i);
});

test("filtro de periodo altera a janela da tendencia sem quebrar a resposta", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const sevenDays = await fetch(`${baseUrl}/api/dashboard/summary?period=7d`, { headers: { cookie } });
  assert.equal(sevenDays.status, 200);
  const sevenDaysBody = await sevenDays.json();
  assert.equal(sevenDaysBody.metadata.period, "7d");
  assert.equal(sevenDaysBody.serviceOrders.trend.length, 7);

  const invalidPeriod = await fetch(`${baseUrl}/api/dashboard/summary?period=invalid`, { headers: { cookie } });
  assert.equal(invalidPeriod.status, 200);
  const invalidPeriodBody = await invalidPeriod.json();
  assert.equal(invalidPeriodBody.metadata.period, "30d");
});
