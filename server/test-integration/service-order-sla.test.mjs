import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "service-order-sla-integration-secret-32ch";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const { syncSlaBreaches } = await import("../src/repositories/serviceOrderRepository.js");

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
  return { "content-type": "application/json", cookie, origin: "http://localhost:5173", ...extra };
}

test.after(closeDatabase);

test("OS nova recebe sla_due_at calculado pela prioridade, e o status de SLA e computado sem gravar nada", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const createResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ title: "OS para teste de SLA", priority: "critical" })
  });
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()).serviceOrder;
  assert.ok(created.slaDueAt, "prioridade critica com sla configurado deve gerar um prazo");
  assert.equal(created.sla.status, "on_track");
  assert.equal(created.sla.breached, false);

  const detailResponse = await fetch(`${baseUrl}/api/service-orders/${created.id}`, { headers: { cookie } });
  const detail = (await detailResponse.json()).serviceOrder;
  assert.equal(detail.sla.status, "on_track");
});

test("OS com prazo vencido so recebe sla_breached_at persistido apos o job de cron, nunca em uma leitura", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const createResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ title: "OS que vai vencer o prazo", priority: "critical" })
  });
  const created = (await createResponse.json()).serviceOrder;

  await query("UPDATE service_orders SET sla_due_at = NOW() - INTERVAL '1 hour' WHERE id = $1", [created.id]);

  const beforeSyncRow = await query("SELECT sla_breached_at FROM service_orders WHERE id = $1", [created.id]);
  assert.equal(beforeSyncRow.rows[0].sla_breached_at, null);

  const listResponse = await fetch(`${baseUrl}/api/service-orders`, { headers: { cookie } });
  const listed = (await listResponse.json()).serviceOrders.find((order) => order.id === created.id);
  assert.equal(listed.sla.status, "breached", "a leitura deve computar vencida mesmo sem sla_breached_at persistido");

  const afterReadRow = await query("SELECT sla_breached_at FROM service_orders WHERE id = $1", [created.id]);
  assert.equal(afterReadRow.rows[0].sla_breached_at, null, "GET nao deve gravar sla_breached_at");

  const syncResult = await syncSlaBreaches();
  assert.ok(syncResult.breached >= 1);

  const afterSyncRow = await query("SELECT sla_breached_at FROM service_orders WHERE id = $1", [created.id]);
  assert.ok(afterSyncRow.rows[0].sla_breached_at, "o job agendado deve persistir sla_breached_at");

  const historyAfterSync = await query(
    "SELECT * FROM service_order_history WHERE service_order_id = $1 AND event_type = 'sla_breached'",
    [created.id]
  );
  assert.equal(historyAfterSync.rowCount, 1);

  const secondSync = await syncSlaBreaches();
  const historyStillOne = (await query(
    "SELECT COUNT(*)::int AS total FROM service_order_history WHERE service_order_id = $1 AND event_type = 'sla_breached'",
    [created.id]
  )).rows[0].total;
  assert.ok(secondSync.breached === 0 || historyStillOne === 1, "rodar o job de novo nao deve duplicar o evento");
});

test("escalonamento de prioridade automatica recalcula o prazo de SLA a partir da nova prioridade", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const settingsResponse = await fetch(`${baseUrl}/api/service-orders/settings`, {
    method: "PATCH",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ autoPriority: { enabled: true, lowToMediumHours: 1, mediumToHighHours: 48, highToCriticalHours: 96 } })
  });
  assert.equal(settingsResponse.status, 200);

  const createResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ title: "OS que vai escalar de prioridade", priority: "low" })
  });
  const created = (await createResponse.json()).serviceOrder;
  const lowDueAt = new Date(created.slaDueAt).getTime();

  await query("UPDATE service_orders SET created_at = NOW() - INTERVAL '2 hours' WHERE id = $1", [created.id]);

  const { syncAutoPriorities } = await import("../src/repositories/serviceOrderRepository.js");
  await syncAutoPriorities();

  const afterSyncRow = await query("SELECT priority, sla_due_at FROM service_orders WHERE id = $1", [created.id]);
  assert.equal(afterSyncRow.rows[0].priority, "medium");
  const mediumDueAt = new Date(afterSyncRow.rows[0].sla_due_at).getTime();
  assert.notEqual(mediumDueAt, lowDueAt, "o prazo deve mudar quando a prioridade escala");
});
