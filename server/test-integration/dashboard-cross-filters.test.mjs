import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "dashboard-cross-filter-integration-secret-32";
process.env.NODE_ENV = "test";
process.env.VERCEL = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";
process.env.KV_REST_API_URL = "";
process.env.KV_REST_API_TOKEN = "";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const { createAgentEnrollment } = await import("../src/repositories/agentRepository.js");
const { createUser } = await import("../src/repositories/userRepository.js");
const { createSector } = await import("../src/repositories/sectorRepository.js");
const { addLog } = await import("../src/repositories/logRepository.js");

const origin = "http://localhost:5173";
const assetA = "dashboard-cross-filter-a";
const assetB = "dashboard-cross-filter-b";
let server;
let baseUrl;
let adminCookie;
let restrictedCookie;
let orderA;
let orderB;

function headers(cookie = adminCookie) {
  return { "content-type": "application/json", cookie, origin };
}

async function login(email) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "123456" })
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie");
}

function preview(type, filters, config = {}, cookie = adminCookie) {
  return fetch(`${baseUrl}/api/dashboard/widgets/preview`, {
    method: "POST", headers: headers(cookie), body: JSON.stringify({ type, config, filters })
  });
}

async function dataFor(type, filters, config = {}, cookie = adminCookie) {
  const response = await preview(type, filters, config, cookie);
  assert.equal(response.status, 200);
  return (await response.json()).data;
}

test.before(async () => {
  await initializeRuntime();
  server = await new Promise((resolve) => {
    const listener = createApp().listen(0, "127.0.0.1", () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  adminCookie = await login("admin@itguardian.local");
  const enrollment = await createAgentEnrollment({ name: "Cross filter test" });
  for (const [machineId, cpuUsagePercent] of [[assetA, 96], [assetB, 22]]) {
    const response = await fetch(`${baseUrl}/api/agents/heartbeat`, {
      method: "POST", headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        machineId, cpuUsagePercent, hostname: "SAME-NAME", machineAlias: "Mesmo nome",
        operatingSystem: "Windows 11 Pro", osArchitecture: "64-bit", windowsVersion: "23H2",
        localIp: "192.168.70.10", macAddress: "00-11-22-33-44-55", cpuModel: "Intel Core i7",
        memoryTotalBytes: 17179869184, memoryUsedBytes: 4294967296,
        diskTotalBytes: 512000000000, diskFreeBytes: 256000000000, uptimeSeconds: 7200,
        agentVersion: "1.0.0", collectedAt: new Date().toISOString(), intervalSeconds: 60,
        environment: "Filtros", group: "Teste", segment: "Windows", inventoryDetails: { software: [] }
      })
    });
    assert.equal(response.status, 202);
  }
  const hiddenSector = await createSector({ name: "Setor restrito para filtros", permissions: [] });
  const createOrder = async (assetId, sector = {}) => {
    const response = await fetch(`${baseUrl}/api/service-orders`, {
      method: "POST", headers: headers(),
      body: JSON.stringify({ title: `OS de filtros ${assetId}`, assetId, ...sector })
    });
    assert.equal(response.status, 201);
    return (await response.json()).serviceOrder;
  };
  orderA = await createOrder(assetA, { sectorId: hiddenSector.id, sectorName: hiddenSector.name });
  orderB = await createOrder(assetB);
  // Fixture writes are strictly in the in-memory test database.
  assert.equal(process.env.DATABASE_URL, "memory");
  await query("UPDATE service_orders SET sla_due_at = $2 WHERE id = $1", [orderA.id, new Date(Date.now() - 86400000).toISOString()]);
  await query("UPDATE service_orders SET status = $2 WHERE id = $1", [orderB.id, "in_progress"]);
  await createUser({
    name: "Leitor com escopo", email: "dashboard-scope@itguardian.local", password: "123456",
    role: "viewer", permissions: ["dashboard.view", "inventory.view", "service_orders.view"]
  });
  restrictedCookie = await login("dashboard-scope@itguardian.local");
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
});

test("preview aceita filtros transitorios e retorna apenas dados relacionados ao ID, nao ao nome", async () => {
  const filters = { assetId: assetA };
  const assets = await dataFor("asset_availability", filters);
  assert.deepEqual(assets, { total: 1, byStatus: { online: 1, offline: 0, problem: 0, unknown: 0 } });
  const orders = await dataFor("service_orders_by_status", filters);
  assert.deepEqual(orders, { total: 1, rows: [{ status: "open", label: "Aberta", count: 1 }] });
  const alerts = await dataFor("alerts_by_severity", filters);
  assert.deepEqual(alerts, { total: 1, rows: [{ severity: "critical", label: "Critica", count: 1 }] });
  const ranking = await dataFor("top_assets_cpu", filters, { chartType: "bar" });
  assert.deepEqual(ranking.rows.map((row) => row.id), [assetA]);
});

test("preview combina status de ativo, severidade, status de OS e atraso com AND", async () => {
  const filters = { assetStatus: "online", assetId: assetA, alertSeverity: "critical", serviceOrderStatus: "open", overdue: true };
  const overview = await dataFor("status_overview", filters);
  assert.equal(overview.totalAssets, 1);
  assert.equal(overview.openServiceOrders, 1);
  assert.equal(overview.overdueServiceOrders, 1);
  assert.equal(overview.criticalAlerts, 1);
  const overdue = await dataFor("service_orders_overdue", filters);
  assert.equal(overdue.total, 1);
  assert.equal(overdue.rows[0].id, orderA.id);
  const empty = await dataFor("status_overview", { ...filters, assetId: assetB });
  assert.equal(empty.totalAssets, 0);
  assert.equal(empty.openServiceOrders, 0);
  assert.equal(empty.criticalAlerts, 0);
});

test("severidade e status de OS filtram rankings por ID e nao retornam a visao global", async () => {
  const critical = await dataFor("top_assets_cpu", { alertSeverity: "critical" });
  assert.ok(critical.rows.some((row) => row.id === assetA));
  assert.ok(!critical.rows.some((row) => row.id === assetB));
  const progress = await dataFor("top_assets_cpu", { serviceOrderStatus: "in_progress" });
  assert.ok(progress.rows.some((row) => row.id === assetB));
  assert.ok(!progress.rows.some((row) => row.id === assetA));
  const missing = await dataFor("asset_availability", { assetId: "no-such-asset" });
  assert.equal(missing.total, 0);
});

test("preview rejeita filtros malformados e IDs de status nao configurados com 400", async () => {
  for (const invalid of [
    [], { unknownDimension: "x" }, { assetStatus: "erro" }, { alertSeverity: "urgent" },
    { serviceOrderStatus: "Aberta" }, { serviceOrderStatus: "not-configured" },
    { assetId: "x".repeat(201) }, { overdue: "true" }
  ]) {
    const response = await preview("asset_availability", invalid);
    assert.equal(response.status, 400);
  }
});

test("ativo selecionado globalmente substitui config apenas no preview, inclusive quando config nao tem assetId", async () => {
  const gauge = await dataFor("metric_gauge_cpu", { assetId: assetA }, { assetId: assetB });
  assert.equal(gauge.assetId, assetA);
  assert.equal(gauge.value, 96);
  const noConfig = await dataFor("metric_gauge_cpu", { assetId: assetA });
  assert.equal(noConfig.assetId, assetA);
  assert.equal(noConfig.value, 96);
  const history = await dataFor("metric_history_cpu", { assetId: assetA });
  assert.equal(history.assetId, assetA);
  assert.ok(Array.isArray(history.points));
  const filteredOut = await dataFor("metric_history_cpu", { assetStatus: "offline" }, { assetId: assetA });
  assert.deepEqual(filteredOut.points, []);
  assert.deepEqual(filteredOut.warnings, ["filtered_out"]);
  assert.equal(filteredOut.summary, null);
  const original = await dataFor("metric_gauge_cpu", undefined, { assetId: assetB });
  assert.equal(original.assetId, assetB);
  assert.equal(original.value, 22);
});

test("fontes de OS continuam respeitando o usuario autenticado durante filtros cruzados", async () => {
  const filters = { assetId: assetA, serviceOrderStatus: "open" };
  assert.equal((await dataFor("asset_availability", filters)).total, 1);
  assert.equal((await dataFor("asset_availability", filters, {}, restrictedCookie)).total, 0);
  assert.equal((await dataFor("service_orders_by_status", filters, {}, restrictedCookie)).total, 0);
  assert.equal((await dataFor("alerts_by_severity", filters, {}, restrictedCookie)).total, 0);
  const visible = await dataFor("service_orders_by_status", { assetId: assetB }, {}, restrictedCookie);
  assert.deepEqual(visible.rows, [{ status: "in_progress", label: "Em atendimento", count: 1 }]);
});

test("eventos e scripts identificam explicitamente o escopo e nao correlacionam mensagens por nome", async () => {
  await addLog({ type: "test", message: "Mesmo nome - sem vinculo" });
  await addLog({ type: "test", message: "Ativo B", meta: { deviceId: assetB } });
  await addLog({ type: "test", message: "Ativo A", meta: { deviceId: assetA } });
  const events = await dataFor("recent_events", { assetId: assetA }, { limit: 50 });
  assert.equal(events.filterScope, "asset");
  assert.deepEqual(events.warnings, ["recent_window_only"]);
  assert.equal(events.windowLimit, 500);
  assert.ok(events.rows.some((row) => row.message === "Ativo A"));
  assert.ok(!events.rows.some((row) => row.message === "Ativo B" || row.message === "Mesmo nome - sem vinculo"));
  const restrictedEvents = await dataFor("recent_events", { assetId: assetA, serviceOrderStatus: "open" }, {}, restrictedCookie);
  assert.deepEqual(restrictedEvents.rows, []);
  const scripts = await dataFor("script_executions", { assetId: assetA });
  assert.equal(scripts.filterScope, "asset");
  assert.deepEqual(scripts.warnings, ["recent_window_only"]);
});

test("filtrar e limpar nao persiste selecoes nem altera a configuracao salva do widget", async () => {
  const layout = { widgets: [{
    id: "configured-gauge", type: "metric_gauge_cpu", title: "CPU configurada", x: 0, y: 0,
    w: "s", h: "s", refreshIntervalSeconds: 60, config: { assetId: assetB, chartType: "gauge" }
  }] };
  const save = await fetch(`${baseUrl}/api/dashboard/layout`, { method: "PUT", headers: headers(), body: JSON.stringify(layout) });
  assert.equal(save.status, 200);
  await dataFor("metric_gauge_cpu", { assetId: assetA }, layout.widgets[0].config);
  const read = await fetch(`${baseUrl}/api/dashboard/layout`, { headers: headers() });
  assert.deepEqual(await read.json(), layout);
  const cleared = await dataFor("metric_gauge_cpu", {}, layout.widgets[0].config);
  assert.equal(cleared.assetId, assetB);
});

test("preview permite 240 requisicoes por minuto para filtros multigrafico e ainda limita abuso", async (t) => {
  await createUser({
    name: "Limite dashboards", email: "dashboard-limit@itguardian.local", password: "123456",
    role: "viewer", permissions: ["dashboard.view"]
  });
  const cookie = await login("dashboard-limit@itguardian.local");
  // Invalid widget types exercise the limiter without performing 240 inventory reads.
  t.mock.method(console, "warn", () => {});
  t.mock.method(console, "log", () => {});
  let response;
  for (let index = 0; index < 240; index += 1) {
    response = await preview("invalid-widget", {}, {}, cookie);
    assert.equal(response.status, 400);
    await response.json();
  }
  assert.equal(response.headers.get("ratelimit-limit"), "240");
  assert.equal(response.headers.get("ratelimit-remaining"), "0");
  const limited = await preview("invalid-widget", {}, {}, cookie);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
});
