import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "service-order-feedback-integration-secret-32c";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase } = await import("../src/database.js");

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

async function createOrder(baseUrl, cookie, title = "OS para teste de avaliacao") {
  const createResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ title })
  });
  return (await createResponse.json()).serviceOrder;
}

test.after(closeDatabase);

test("registrar avaliacao exige nota de 1 a 5 e reenviar atualiza a existente", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const order = await createOrder(baseUrl, cookie);

  const emptyBefore = await fetch(`${baseUrl}/api/service-orders/${order.id}/feedback`, { headers: { cookie } });
  assert.equal(emptyBefore.status, 200);
  assert.equal((await emptyBefore.json()).feedback, null);

  const invalidRating = await fetch(`${baseUrl}/api/service-orders/${order.id}/feedback`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ rating: 7, comment: "nota invalida" })
  });
  assert.equal(invalidRating.status, 400);

  const firstSubmit = await fetch(`${baseUrl}/api/service-orders/${order.id}/feedback`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ rating: 4, comment: "Bom atendimento" })
  });
  assert.equal(firstSubmit.status, 201);
  const firstFeedback = (await firstSubmit.json()).feedback;
  assert.equal(firstFeedback.rating, 4);
  assert.equal(firstFeedback.serviceOrderId, order.id);

  const secondSubmit = await fetch(`${baseUrl}/api/service-orders/${order.id}/feedback`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ rating: 5, comment: "Corrigindo minha avaliacao" })
  });
  assert.equal(secondSubmit.status, 201);
  const secondFeedback = (await secondSubmit.json()).feedback;
  assert.equal(secondFeedback.rating, 5);
  assert.equal(secondFeedback.id, firstFeedback.id, "reenviar deve atualizar a avaliacao existente, nao criar outra");

  const listResponse = await fetch(`${baseUrl}/api/service-orders`, { headers: { cookie } });
  const listed = (await listResponse.json()).serviceOrders.find((item) => item.id === order.id);
  assert.equal(listed.feedback.rating, 5, "a listagem de OS deve trazer a avaliacao anexada");
});

test("usuario sem permissao de atendimento nao consegue registrar avaliacao", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const adminCookie = await login(baseUrl);
  const restrictedCookie = await login(baseUrl, "sem.permissao@itguardian.local");

  const order = await createOrder(baseUrl, adminCookie);

  const denied = await fetch(`${baseUrl}/api/service-orders/${order.id}/feedback`, {
    method: "POST",
    headers: browserHeaders(restrictedCookie),
    body: JSON.stringify({ rating: 5 })
  });
  assert.equal(denied.status, 403);
});
