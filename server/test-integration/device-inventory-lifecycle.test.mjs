import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "integration-test-secret-with-at-least-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { createSegment } = await import("../src/repositories/segmentRepository.js");

const trustedOrigin = "http://localhost:5173";

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function login(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@itguardian.local", password: "123456" })
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie");
}

function requestHeaders(cookie) {
  return {
    "content-type": "application/json",
    cookie,
    origin: trustedOrigin
  };
}

test("ativo manual do inventario: criar, listar, detalhar, atualizar tipo, mover de segmento e remover", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const cookie = await login(baseUrl);
  const segment = await createSegment({ name: "Segmento de teste integrado", userId: null });

  const createResponse = await fetch(`${baseUrl}/api/devices/manual`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({
      name: "Notebook de teste integrado",
      type: "notebook",
      brand: "Generica",
      model: "Teste",
      assetTag: "INV-TEST-1",
      ip: "203.0.113.60"
    })
  });
  const createBody = await createResponse.json();
  assert.equal(createResponse.status, 201, JSON.stringify(createBody));
  const created = createBody.device;
  assert.equal(created.source, "manual");
  assert.ok(created.id);

  const listResponse = await fetch(`${baseUrl}/api/devices`, { headers: { cookie } });
  assert.equal(listResponse.status, 200);
  const listed = (await listResponse.json()).devices;
  assert.ok(listed.some((device) => device.id === created.id), "ativo recem-criado deve aparecer na listagem");

  const detailResponse = await fetch(`${baseUrl}/api/devices/${created.id}`, { headers: { cookie } });
  assert.equal(detailResponse.status, 200);
  const detail = (await detailResponse.json()).device;
  assert.equal(detail.id, created.id);

  const changeTypeResponse = await fetch(`${baseUrl}/api/devices/${created.id}/type`, {
    method: "PATCH",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ assetType: "desktop" })
  });
  const changeTypeBody = await changeTypeResponse.json();
  assert.equal(changeTypeResponse.status, 200, JSON.stringify(changeTypeBody));
  assert.equal(changeTypeBody.device.assetType, "desktop");

  const aliasResponse = await fetch(`${baseUrl}/api/devices/${created.id}/alias`, {
    method: "PATCH",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ alias: "Apelido nao deveria ser aceito" })
  });
  assert.equal(
    aliasResponse.status,
    400,
    "nome fantasia persistente e exclusivo de ativos do agente, ativo manual deve ser recusado"
  );

  const moveResponse = await fetch(`${baseUrl}/api/devices/${created.id}/segment`, {
    method: "PATCH",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ segmentId: segment.id })
  });
  const moveBody = await moveResponse.json();
  assert.equal(moveResponse.status, 200, JSON.stringify(moveBody));
  assert.equal(moveBody.assignment.segmentName, segment.name);

  const pingResponse = await fetch(`${baseUrl}/api/devices/${created.id}/ping`, {
    method: "POST",
    headers: requestHeaders(cookie)
  });
  assert.equal(pingResponse.status, 200);

  const removeResponse = await fetch(`${baseUrl}/api/devices/${created.id}`, {
    method: "DELETE",
    headers: requestHeaders(cookie)
  });
  assert.equal(removeResponse.status, 200);

  const detailAfterRemoveResponse = await fetch(`${baseUrl}/api/devices/${created.id}`, { headers: { cookie } });
  assert.equal(detailAfterRemoveResponse.status, 404, "ativo manual removido nao deve mais existir");
});

test("ativo manual do inventario: campos obrigatorios ausentes sao rejeitados", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const cookie = await login(baseUrl);

  const response = await fetch(`${baseUrl}/api/devices/manual`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ name: "Sem os demais campos" })
  });
  assert.equal(response.status, 400);
});

test("inventario: acesso sem sessao e recusado", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const response = await fetch(`${baseUrl}/api/devices`);
  assert.equal(response.status, 401);
});
