import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "service-order-attachments-integration-secret-32c";
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

async function createOrder(baseUrl, cookie, title = "OS para teste de anexos") {
  const createResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ title })
  });
  return (await createResponse.json()).serviceOrder;
}

test.after(closeDatabase);

test("adicionar, listar e remover anexos (metadata-only) de uma OS", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const order = await createOrder(baseUrl, cookie);

  const emptyList = await fetch(`${baseUrl}/api/service-orders/${order.id}/attachments`, { headers: { cookie } });
  assert.equal(emptyList.status, 200);
  assert.deepEqual((await emptyList.json()).attachments, []);

  const createResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/attachments`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({
      fileName: "foto-fonte.jpg",
      category: "evidencia",
      storageKey: "https://drive.example.com/foto-fonte",
      description: "Foto da fonte queimada"
    })
  });
  assert.equal(createResponse.status, 201);
  const attachment = (await createResponse.json()).attachment;
  assert.equal(attachment.fileName, "foto-fonte.jpg");
  assert.equal(attachment.category, "evidencia");

  const listResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/attachments`, { headers: { cookie } });
  assert.equal((await listResponse.json()).attachments.length, 1);

  const deleteResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/attachments/${attachment.id}`, {
    method: "DELETE",
    headers: browserHeaders(cookie)
  });
  assert.equal(deleteResponse.status, 200);

  const afterDeleteList = await fetch(`${baseUrl}/api/service-orders/${order.id}/attachments`, { headers: { cookie } });
  assert.deepEqual((await afterDeleteList.json()).attachments, []);
});

test("nome ou referencia de anexo com extensao bloqueada e rejeitado", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const order = await createOrder(baseUrl, cookie);

  const blockedFileName = await fetch(`${baseUrl}/api/service-orders/${order.id}/attachments`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ fileName: "script-malicioso.exe", category: "outro" })
  });
  assert.equal(blockedFileName.status, 400);

  const blockedReference = await fetch(`${baseUrl}/api/service-orders/${order.id}/attachments`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ fileName: "evidencia.txt", category: "outro", storageKey: "https://example.com/payload.ps1" })
  });
  assert.equal(blockedReference.status, 400);

  const listResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/attachments`, { headers: { cookie } });
  assert.deepEqual((await listResponse.json()).attachments, [], "nenhum anexo bloqueado deve ter sido persistido");
});

test("usuario sem permissao de atendimento nao consegue adicionar anexo", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const adminCookie = await login(baseUrl);
  const restrictedCookie = await login(baseUrl, "sem.permissao@itguardian.local");

  const order = await createOrder(baseUrl, adminCookie);

  const denied = await fetch(`${baseUrl}/api/service-orders/${order.id}/attachments`, {
    method: "POST",
    headers: browserHeaders(restrictedCookie),
    body: JSON.stringify({ fileName: "evidencia.jpg", category: "evidencia" })
  });
  assert.equal(denied.status, 403);
});
