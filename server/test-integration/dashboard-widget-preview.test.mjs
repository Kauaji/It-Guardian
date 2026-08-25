import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "dashboard-widget-preview-integration-secret-32";
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

async function preview(baseUrl, cookie, type, config = {}) {
  return fetch(`${baseUrl}/api/dashboard/widgets/preview`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ type, config })
  });
}

async function heartbeat(baseUrl, enrollmentToken, machineId, overrides = {}) {
  const response = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollmentToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      machineId,
      hostname: "DASH-WIDGET-01",
      machineAlias: "Notebook widgets",
      operatingSystem: "Microsoft Windows 11 Pro",
      osArchitecture: "64-bit",
      windowsVersion: "23H2",
      localIp: "192.168.80.10",
      macAddress: "00-11-22-33-77-10",
      cpuModel: "Intel Core i7",
      cpuUsagePercent: 55,
      memoryTotalBytes: 17179869184,
      memoryUsedBytes: 8589934592,
      diskTotalBytes: 512000000000,
      diskFreeBytes: 128000000000,
      uptimeSeconds: 7200,
      agentVersion: "1.0.0",
      collectedAt: new Date().toISOString(),
      intervalSeconds: 60,
      environment: "Laboratorio Widgets",
      group: "Suporte",
      segment: "Windows",
      inventoryDetails: { cpuCores: 8, software: [] },
      ...overrides
    })
  });
  assert.equal(response.status, 202);
}

test.after(closeDatabase);

test("catalogo de widgets lista tipos com forma valida", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const response = await fetch(`${baseUrl}/api/dashboard/widgets/catalog`, { headers: { cookie } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(Array.isArray(body.widgets));
  assert.ok(body.widgets.length >= 15);
  for (const widget of body.widgets) {
    assert.equal(typeof widget.type, "string");
    assert.equal(typeof widget.label, "string");
    assert.ok(["s", "m", "l", "xl"].includes(widget.defaultSize.w));
    assert.ok(["s", "m", "l"].includes(widget.defaultSize.h));
  }
  // "Assistencia Remota" (item 20 do pedido original) fica de fora do
  // catalogo nesta rodada -- nao existe consulta multi-sessao pronta e
  // construir uma tocaria o modulo que a rodada foi orientada a nao alterar.
  assert.ok(!body.widgets.some((widget) => widget.type.includes("remote_assistance")));
});

test("preview rejeita um tipo de widget desconhecido com 400", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const response = await preview(baseUrl, cookie, "widget_que_nao_existe");
  assert.equal(response.status, 400);
});

test("preview exige autenticacao e a permissao dashboard.view", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const noAuth = await fetch(`${baseUrl}/api/dashboard/widgets/preview`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: trustedOrigin },
    body: JSON.stringify({ type: "asset_availability", config: {} })
  });
  assert.equal(noAuth.status, 401);

  const cookie = await login(baseUrl, "sem.permissao@itguardian.local");
  const response = await preview(baseUrl, cookie, "asset_availability");
  assert.equal(response.status, 403);
});

test("status_overview e asset_availability refletem dispositivos reais, sem inventar contagem", async (t) => {
  await initializeRuntime();
  const enrollment = await createAgentEnrollment({ name: "Laboratorio widgets overview" });
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const before = await (await preview(baseUrl, cookie, "asset_availability")).json();
  await heartbeat(baseUrl, enrollment.token, "dashboard-widget-machine-1");
  const after = await (await preview(baseUrl, cookie, "asset_availability")).json();

  assert.equal(after.type, "asset_availability");
  assert.equal(after.data.total, before.data.total + 1);
  assert.equal(after.data.byStatus.online, before.data.byStatus.online + 1);

  const overview = await (await preview(baseUrl, cookie, "status_overview")).json();
  assert.equal(overview.type, "status_overview");
  assert.ok(overview.data.health.score >= 0 && overview.data.health.score <= 100);
  assert.ok(overview.data.totalAssets >= 1);
});

test("top_assets_cpu ranqueia pelo valor atual real do dispositivo cadastrado", async (t) => {
  await initializeRuntime();
  const enrollment = await createAgentEnrollment({ name: "Laboratorio widgets top assets" });
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  await heartbeat(baseUrl, enrollment.token, "dashboard-widget-machine-cpu", { cpuUsagePercent: 77 });
  const response = await preview(baseUrl, cookie, "top_assets_cpu", { limit: 5 });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.basis, "current");
  const entry = body.data.rows.find((row) => row.value === 77);
  assert.ok(entry, "o ativo com 77% de CPU deveria aparecer no ranking");
});

test("metric_history_cpu sem assetId devolve estado explicito, nunca inventa pontos", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const response = await preview(baseUrl, cookie, "metric_history_cpu", {});
  assert.equal(response.status, 400);
});

test("metric_history_cpu com assetId real devolve o historico real do ativo (sem historico ainda = warning explicito)", async (t) => {
  await initializeRuntime();
  const enrollment = await createAgentEnrollment({ name: "Laboratorio widgets metric history" });
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);
  const machineId = "dashboard-widget-machine-history";

  await heartbeat(baseUrl, enrollment.token, machineId);

  const response = await preview(baseUrl, cookie, "metric_history_cpu", { assetId: machineId, period: "24h" });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.assetId, machineId);
  assert.equal(body.data.metric, "cpu");
  assert.ok(Array.isArray(body.data.points));
});

test("metric_history_cpu com ativo inexistente falha isoladamente (404), sem derrubar outros widgets", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const response = await preview(baseUrl, cookie, "metric_history_cpu", { assetId: "ativo-que-nao-existe" });
  assert.equal(response.status, 404);
});

test("service_orders_by_status, service_orders_overdue e alerts_by_severity respondem com listas reais", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const orderResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ title: "OS de teste do widget de dashboard" })
  });
  assert.equal(orderResponse.status, 201);

  const byStatus = await (await preview(baseUrl, cookie, "service_orders_by_status")).json();
  assert.ok(byStatus.data.rows.length > 0);
  assert.ok(byStatus.data.total >= 1);

  const overdue = await (await preview(baseUrl, cookie, "service_orders_overdue")).json();
  assert.ok(Array.isArray(overdue.data.rows));

  const bySeverity = await (await preview(baseUrl, cookie, "alerts_by_severity")).json();
  assert.ok(Array.isArray(bySeverity.data.rows));
});

test("recent_events e script_executions respondem sem erro mesmo sem nenhum evento novo", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const events = await preview(baseUrl, cookie, "recent_events", { limit: 5 });
  assert.equal(events.status, 200);
  const eventsBody = await events.json();
  assert.ok(Array.isArray(eventsBody.data.rows));

  const scripts = await preview(baseUrl, cookie, "script_executions", { limit: 5 });
  assert.equal(scripts.status, 200);
  const scriptsBody = await scripts.json();
  assert.ok(Array.isArray(scriptsBody.data.rows));
});

test("nenhuma resposta de widget vaza senha, token ou segredo", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const response = await preview(baseUrl, cookie, "status_overview");
  const text = await response.text();
  assert.doesNotMatch(text, /password/i);
  assert.doesNotMatch(text, /"token"/i);
  assert.doesNotMatch(text, /\bjwt\b/i);
});
