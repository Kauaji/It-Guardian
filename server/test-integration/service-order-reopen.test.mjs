import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "service-order-reopen-integration-secret-32c";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");

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

async function createAndCloseOrder(baseUrl, cookie) {
  const createResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ title: "OS para teste de reabertura" })
  });
  const created = (await createResponse.json()).serviceOrder;

  const technicianResponse = await fetch(`${baseUrl}/api/service-orders/${created.id}/technician`, {
    method: "PATCH",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ assignedTechnicianName: "Tecnico de Teste" })
  });
  assert.equal(technicianResponse.status, 200);

  const statusResponse = await fetch(`${baseUrl}/api/service-orders/${created.id}/status`, {
    method: "PATCH",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ status: "closed" })
  });
  assert.equal(statusResponse.status, 200);
  return (await statusResponse.json()).serviceOrder;
}

test.after(closeDatabase);

test("reabrir uma OS finalizada exige motivo, reseta status e incrementa o contador", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const closed = await createAndCloseOrder(baseUrl, cookie);
  assert.equal(closed.status, "closed");
  assert.ok(closed.closedAt);

  const withoutReason = await fetch(`${baseUrl}/api/service-orders/${closed.id}/reopen`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({})
  });
  assert.equal(withoutReason.status, 400, "reabertura sem motivo deve ser rejeitada");

  const withShortReason = await fetch(`${baseUrl}/api/service-orders/${closed.id}/reopen`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ reason: "ab" })
  });
  assert.equal(withShortReason.status, 400, "motivo curto demais deve ser rejeitado");

  const reopenResponse = await fetch(`${baseUrl}/api/service-orders/${closed.id}/reopen`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ reason: "Cliente reportou que o problema voltou." })
  });
  assert.equal(reopenResponse.status, 200);
  const reopened = (await reopenResponse.json()).serviceOrder;
  assert.notEqual(reopened.status, "closed");
  assert.equal(reopened.closedAt, null);
  assert.equal(reopened.reopenCount, 1);
  assert.ok(reopened.reopenedAt);
  assert.equal(reopened.reopenReason, "Cliente reportou que o problema voltou.");

  const historyRow = await query(
    "SELECT * FROM service_order_history WHERE service_order_id = $1 AND event_type = 'reopened'",
    [closed.id]
  );
  assert.equal(historyRow.rowCount, 1);
});

test("reabrir uma OS ainda em andamento e rejeitado", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const createResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ title: "OS aberta que nao pode ser reaberta" })
  });
  const created = (await createResponse.json()).serviceOrder;

  const reopenResponse = await fetch(`${baseUrl}/api/service-orders/${created.id}/reopen`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ reason: "Motivo valido para o teste." })
  });
  assert.equal(reopenResponse.status, 400);
});

test("usuario sem a permissao service_orders.reopen recebe 403", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const adminCookie = await login(baseUrl);
  const restrictedCookie = await login(baseUrl, "sem.permissao@itguardian.local");

  const closed = await createAndCloseOrder(baseUrl, adminCookie);

  const denied = await fetch(`${baseUrl}/api/service-orders/${closed.id}/reopen`, {
    method: "POST",
    headers: browserHeaders(restrictedCookie),
    body: JSON.stringify({ reason: "Motivo valido para o teste." })
  });
  assert.equal(denied.status, 403);
});
