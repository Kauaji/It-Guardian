import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "integration-test-secret-with-at-least-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");

const trustedOrigin = "http://localhost:5173";
const basePath = "/api/maintenance-scripts";

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

test("script de manutencao: analisar, criar, listar, atualizar, registrar simulacao e desativar", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const cookie = await login(baseUrl);

  const analyzeResponse = await fetch(`${baseUrl}${basePath}/analyze`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ content: "Write-Host 'rotina de teste integrado'" })
  });
  const analyzeBody = await analyzeResponse.json();
  assert.equal(analyzeResponse.status, 200, JSON.stringify(analyzeBody));
  assert.ok(analyzeBody.analysis);

  const createResponse = await fetch(baseUrl + basePath, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({
      name: "Script de teste integrado",
      content: "Write-Host 'rotina de teste integrado'",
      type: "powershell"
    })
  });
  const createBody = await createResponse.json();
  assert.equal(createResponse.status, 201, JSON.stringify(createBody));
  const created = createBody.script;
  assert.equal(created.name, "Script de teste integrado");
  assert.equal(created.active, true);

  const listResponse = await fetch(baseUrl + basePath, { headers: { cookie } });
  assert.equal(listResponse.status, 200);
  const listed = (await listResponse.json()).scripts;
  assert.ok(listed.some((script) => script.id === created.id), "script recem-criado deve aparecer na listagem");

  const updateResponse = await fetch(`${baseUrl}${basePath}/${created.id}`, {
    method: "PATCH",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ description: "Descricao atualizada pelo teste integrado" })
  });
  const updateBody = await updateResponse.json();
  assert.equal(updateResponse.status, 200, JSON.stringify(updateBody));
  assert.equal(updateBody.script.description, "Descricao atualizada pelo teste integrado");

  const simulationResponse = await fetch(`${baseUrl}${basePath}/${created.id}/register-simulation`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ confirmed: true, notes: "Simulacao registrada pelo teste integrado" })
  });
  const simulationBody = await simulationResponse.json();
  assert.equal(simulationResponse.status, 201, JSON.stringify(simulationBody));

  const unconfirmedSimulationResponse = await fetch(`${baseUrl}${basePath}/${created.id}/register-simulation`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ notes: "Sem confirmacao" })
  });
  assert.equal(
    unconfirmedSimulationResponse.status,
    400,
    "registrar simulacao sem confirmar explicitamente deve ser recusado"
  );

  const removeResponse = await fetch(`${baseUrl}${basePath}/${created.id}`, {
    method: "DELETE",
    headers: requestHeaders(cookie)
  });
  const removeBody = await removeResponse.json();
  assert.equal(removeResponse.status, 200, JSON.stringify(removeBody));
  assert.equal(removeBody.script.active, false, "remover um script deve desativa-lo, nao apaga-lo de verdade");

  const listAfterRemoveResponse = await fetch(`${baseUrl}${basePath}?includeInactive=false`, { headers: { cookie } });
  assert.equal(listAfterRemoveResponse.status, 200);
  const listedAfterRemove = (await listAfterRemoveResponse.json()).scripts;
  assert.ok(
    !listedAfterRemove.some((script) => script.id === created.id),
    "script desativado nao deve aparecer quando includeInactive=false"
  );
});

test("script de manutencao: nome curto e conteudo vazio sao rejeitados", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const cookie = await login(baseUrl);

  const shortNameResponse = await fetch(baseUrl + basePath, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ name: "ab", content: "algo", type: "powershell" })
  });
  assert.equal(shortNameResponse.status, 400);

  const emptyContentResponse = await fetch(baseUrl + basePath, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ name: "Nome valido", content: "   ", type: "powershell" })
  });
  assert.equal(emptyContentResponse.status, 400);
});

test("scripts de manutencao: acesso sem sessao e recusado", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const response = await fetch(baseUrl + basePath);
  assert.equal(response.status, 401);
});
