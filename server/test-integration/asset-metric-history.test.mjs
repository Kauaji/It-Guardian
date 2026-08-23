import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "asset-metric-history-integration-secret-32ch";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
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
    headers: { "content-type": "application/json", origin: trustedOrigin },
    body: JSON.stringify({ email, password: "123456" })
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie");
}

function heartbeatPayload(machineId, overrides = {}) {
  return {
    machineId,
    hostname: "METRIC-HIST-01",
    machineAlias: "Notebook do teste de historico",
    operatingSystem: "Microsoft Windows 11 Pro",
    osArchitecture: "64-bit",
    windowsVersion: "23H2",
    localIp: "192.168.90.10",
    macAddress: "00-11-22-33-88-10",
    cpuModel: "Intel Core i5",
    cpuUsagePercent: 20,
    memoryTotalBytes: 8_589_934_592,
    memoryUsedBytes: 2_147_483_648,
    diskTotalBytes: 256_000_000_000,
    diskFreeBytes: 128_000_000_000,
    uptimeSeconds: 3600,
    agentVersion: "1.0.0",
    collectedAt: new Date().toISOString(),
    intervalSeconds: 60,
    environment: "Laboratorio Metricas",
    group: "Suporte",
    segment: "Windows",
    inventoryDetails: { cpuCores: 4, software: [] },
    ...overrides
  };
}

test.after(closeDatabase);

test("heartbeat com metricas grava uma amostra em asset_metric_history; heartbeat sem nenhuma metrica nao grava nada", async (t) => {
  await initializeRuntime();
  const enrollmentWithMetrics = await createAgentEnrollment({ name: "Lab metricas 1" });
  const enrollmentWithoutMetrics = await createAgentEnrollment({ name: "Lab metricas 2" });
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const withMetrics = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollmentWithMetrics.token}`, "content-type": "application/json" },
    body: JSON.stringify(heartbeatPayload("metric-hist-machine-1"))
  });
  assert.equal(withMetrics.status, 202);

  const rowsWithMetrics = await query(
    "SELECT * FROM asset_metric_history WHERE asset_id = $1",
    ["metric-hist-machine-1"]
  );
  assert.equal(rowsWithMetrics.rows.length, 1);
  assert.equal(rowsWithMetrics.rows[0].cpu_usage_percent, 20);
  assert.equal(rowsWithMetrics.rows[0].memory_usage_percent, 25);
  assert.equal(rowsWithMetrics.rows[0].disk_usage_percent, 50);

  const withoutMetrics = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollmentWithoutMetrics.token}`, "content-type": "application/json" },
    body: JSON.stringify(
      heartbeatPayload("metric-hist-machine-2", {
        cpuUsagePercent: undefined,
        memoryTotalBytes: undefined,
        memoryUsedBytes: undefined,
        diskTotalBytes: undefined,
        diskFreeBytes: undefined
      })
    )
  });
  assert.equal(withoutMetrics.status, 202);

  const rowsWithoutMetrics = await query(
    "SELECT * FROM asset_metric_history WHERE asset_id = $1",
    ["metric-hist-machine-2"]
  );
  assert.equal(rowsWithoutMetrics.rows.length, 0);
});

test("GET /api/devices/:id/metrics-history exige autenticacao e a permissao inventory.view_machine", async (t) => {
  await initializeRuntime();
  const enrollment = await createAgentEnrollment({ name: "Lab metricas permissao" });
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify(heartbeatPayload("metric-hist-machine-perm"))
  });

  const unauthenticated = await fetch(`${baseUrl}/api/devices/metric-hist-machine-perm/metrics-history`);
  assert.equal(unauthenticated.status, 401);

  const semPermissaoCookie = await login(baseUrl, "sem.permissao@itguardian.local");
  const forbidden = await fetch(`${baseUrl}/api/devices/metric-hist-machine-perm/metrics-history`, {
    headers: { cookie: semPermissaoCookie }
  });
  assert.equal(forbidden.status, 403);

  const adminCookie = await login(baseUrl);
  const allowed = await fetch(`${baseUrl}/api/devices/metric-hist-machine-perm/metrics-history`, {
    headers: { cookie: adminCookie }
  });
  assert.equal(allowed.status, 200);
});

test("preview de historico reflete amostras reais, nunca inventa dado quando nao ha nenhuma", async (t) => {
  await initializeRuntime();
  const enrollment = await createAgentEnrollment({ name: "Lab metricas preview" });
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const emptyAssetResponse = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify(
      heartbeatPayload("metric-hist-machine-empty", {
        cpuUsagePercent: undefined,
        memoryTotalBytes: undefined,
        memoryUsedBytes: undefined,
        diskTotalBytes: undefined,
        diskFreeBytes: undefined
      })
    )
  });
  assert.equal(emptyAssetResponse.status, 202);

  const emptyHistory = await (
    await fetch(`${baseUrl}/api/devices/metric-hist-machine-empty/metrics-history?metric=cpu`, { headers: { cookie } })
  ).json();
  assert.equal(emptyHistory.summary, null);
  assert.deepEqual(emptyHistory.points, []);
  assert.deepEqual(emptyHistory.warnings, ["no_data"]);

  await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify(heartbeatPayload("metric-hist-machine-real", { cpuUsagePercent: 33 }))
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify(heartbeatPayload("metric-hist-machine-real", { cpuUsagePercent: 55 }))
  });

  const realHistory = await (
    await fetch(`${baseUrl}/api/devices/metric-hist-machine-real/metrics-history?metric=cpu&period=24h`, {
      headers: { cookie }
    })
  ).json();
  assert.equal(realHistory.metric, "cpu");
  assert.equal(realHistory.period, "24h");
  assert.equal(realHistory.summary.samples, 2);
  assert.equal(realHistory.summary.current, 55);
  assert.equal(realHistory.points.length, 2);

  const allMetrics = await (
    await fetch(`${baseUrl}/api/devices/metric-hist-machine-real/metrics-history?metric=all`, { headers: { cookie } })
  ).json();
  assert.ok(allMetrics.cpu);
  assert.ok(allMetrics.ram);
  assert.ok(allMetrics.disk);

  await query(
    "UPDATE asset_metric_history SET collected_at = NOW() - INTERVAL '2 hours' WHERE asset_id = $1 AND cpu_usage_percent = 33",
    ["metric-hist-machine-real"]
  );

  const within1h = await (
    await fetch(`${baseUrl}/api/devices/metric-hist-machine-real/metrics-history?metric=cpu&period=1h`, {
      headers: { cookie }
    })
  ).json();
  assert.equal(within1h.summary.samples, 1, "a amostra de 2h atras deveria ficar fora da janela de 1h");
  assert.equal(within1h.summary.current, 55);

  const within30d = await (
    await fetch(`${baseUrl}/api/devices/metric-hist-machine-real/metrics-history?metric=cpu&period=30d`, {
      headers: { cookie }
    })
  ).json();
  assert.equal(within30d.summary.samples, 2, "a janela de 30d deveria incluir as duas amostras");
});
