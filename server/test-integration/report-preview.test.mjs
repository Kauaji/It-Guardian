import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "report-preview-integration-secret-32ch";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase } = await import("../src/database.js");

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

test.after(closeDatabase);

test("preview de cada tipo de relatorio tem o formato esperado (summary + rows + warnings)", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const types = [
    "monthly",
    "service-orders",
    "sla",
    "assets",
    "alerts",
    "scripts",
    "remote-assistance"
  ];

  for (const type of types) {
    const response = await fetch(`${baseUrl}/api/reports/${type}/preview`, { headers: { cookie } });
    assert.equal(response.status, 200, `${type} deveria responder 200`);
    const body = await response.json();

    assert.equal(typeof body.summary, "object", `${type}.summary deveria ser objeto`);
    assert.ok(Array.isArray(body.rows), `${type}.rows deveria ser array`);
    assert.ok(Array.isArray(body.warnings), `${type}.warnings deveria ser array`);
  }
});

test("relatorio mensal reflete ativo real criado via heartbeat, sem inventar contagem", async (t) => {
  await initializeRuntime();
  const { createAgentEnrollment } = await import("../src/repositories/agentRepository.js");
  const enrollment = await createAgentEnrollment({ name: "Laboratorio de relatorios" });
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const before = await (await fetch(`${baseUrl}/api/reports/monthly/preview`, { headers: { cookie } })).json();

  const heartbeatResponse = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${enrollment.token}`, "content-type": "application/json" },
    body: JSON.stringify({
      machineId: "report-machine-1",
      hostname: "REPORT-01",
      machineAlias: "Notebook do relatorio",
      operatingSystem: "Microsoft Windows 11 Pro",
      osArchitecture: "64-bit",
      windowsVersion: "23H2",
      localIp: "192.168.80.10",
      macAddress: "00-11-22-33-77-10",
      cpuModel: "Intel Core i5",
      cpuUsagePercent: 20,
      memoryTotalBytes: 8589934592,
      memoryUsedBytes: 2147483648,
      diskTotalBytes: 256000000000,
      diskFreeBytes: 128000000000,
      uptimeSeconds: 3600,
      agentVersion: "1.0.0",
      collectedAt: new Date().toISOString(),
      intervalSeconds: 60,
      environment: "Laboratorio Relatorios",
      group: "Suporte",
      segment: "Windows",
      inventoryDetails: { cpuCores: 4, software: [] }
    })
  });
  assert.equal(heartbeatResponse.status, 202);

  const after = await (await fetch(`${baseUrl}/api/reports/monthly/preview`, { headers: { cookie } })).json();
  assert.equal(after.summary.assets.total, before.summary.assets.total + 1);
  assert.equal(after.summary.assets.online, before.summary.assets.online + 1);
});

test("relatorio de Ordens de Servico reflete uma OS criada de verdade, com origem manual", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const createResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie, origin: trustedOrigin },
    body: JSON.stringify({ title: "OS de teste do relatorio" })
  });
  assert.equal(createResponse.status, 201);
  const order = (await createResponse.json()).serviceOrder;

  const response = await fetch(`${baseUrl}/api/reports/service-orders/preview`, { headers: { cookie } });
  const body = await response.json();
  const row = body.rows.find((item) => item.id === order.id);
  assert.ok(row, "a OS criada deveria aparecer no relatorio");
  assert.equal(row.title, "OS de teste do relatorio");
  assert.equal(row.originLabel, "Manual");
});
