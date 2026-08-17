import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "integration-test-secret-with-at-least-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { createMaintenanceScript } = await import("../src/repositories/maintenanceScriptRepository.js");
const { createManualAsset } = await import("../src/repositories/manualAssetRepository.js");

const trustedOrigin = "http://localhost:5173";
const basePath = "/api/preventive-automation-plans";

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

test("plano de automacao preventiva: criar, listar, pausar, reativar e excluir", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const cookie = await login(baseUrl);
  const script = await createMaintenanceScript({
    name: "Script de teste integrado",
    content: "Write-Host 'rotina de manutencao preventiva de teste'",
    type: "powershell"
  });
  await createManualAsset({
    payload: {
      name: "Ativo de teste integrado",
      type: "desktop",
      brand: "Generica",
      model: "Teste",
      assetTag: "AUTOMATION-TEST-1",
      ip: "203.0.113.50"
    },
    user: { id: null }
  });

  const createResponse = await fetch(baseUrl + basePath, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({
      name: "Automacao integrada de teste",
      scopeType: "all",
      recurrenceType: "monthly",
      defaultScriptIds: [script.id]
    })
  });
  const createBody = await createResponse.json();
  assert.equal(createResponse.status, 201, JSON.stringify(createBody));
  const created = createBody.preventiveAutomationPlan;
  assert.equal(created.name, "Automacao integrada de teste");
  assert.equal(created.active, true);
  assert.ok(created.id);

  const listResponse = await fetch(baseUrl + basePath, { headers: { cookie } });
  assert.equal(listResponse.status, 200);
  const listedPlans = (await listResponse.json()).preventiveAutomationPlans;
  assert.ok(listedPlans.some((plan) => plan.id === created.id), "plano recem-criado deve aparecer na listagem");

  const detailResponse = await fetch(`${baseUrl}${basePath}/${created.id}`, { headers: { cookie } });
  assert.equal(detailResponse.status, 200);
  const detail = (await detailResponse.json()).preventiveAutomationPlan;
  assert.equal(detail.id, created.id);
  assert.equal(detail.recurrenceType, "monthly");

  const managementResponse = await fetch(`${baseUrl}${basePath}/management`, { headers: { cookie } });
  assert.equal(managementResponse.status, 200);
  const management = await managementResponse.json();
  assert.ok(Array.isArray(management.plans));
  assert.ok(management.plans.some((plan) => plan.id === created.id));

  const agendaResponse = await fetch(`${baseUrl}${basePath}/agenda`, { headers: { cookie } });
  assert.equal(agendaResponse.status, 200);

  const disableResponse = await fetch(`${baseUrl}${basePath}/${created.id}/disable`, {
    method: "POST",
    headers: requestHeaders(cookie)
  });
  assert.equal(disableResponse.status, 200);
  const disabled = (await disableResponse.json()).preventiveAutomationPlan;
  assert.equal(disabled.active, false, "pausar deve marcar o plano como inativo");

  const historyAfterDisableResponse = await fetch(`${baseUrl}${basePath}/${created.id}/history`, {
    headers: { cookie }
  });
  assert.equal(historyAfterDisableResponse.status, 200);
  const historyAfterDisable = await historyAfterDisableResponse.json();
  assert.ok(
    historyAfterDisable.items?.some((item) => item.type === "preventive_automation_paused"),
    `pausar deve deixar rastro no historico do plano: ${JSON.stringify(historyAfterDisable)}`
  );

  const reactivateResponse = await fetch(`${baseUrl}${basePath}/${created.id}/reactivate`, {
    method: "POST",
    headers: requestHeaders(cookie)
  });
  assert.equal(reactivateResponse.status, 200);
  const reactivated = (await reactivateResponse.json()).preventiveAutomationPlan;
  assert.equal(reactivated.active, true, "reativar deve marcar o plano como ativo de novo");

  const deleteResponse = await fetch(`${baseUrl}${basePath}/${created.id}`, {
    method: "DELETE",
    headers: requestHeaders(cookie)
  });
  assert.equal(deleteResponse.status, 200);

  const detailAfterDeleteResponse = await fetch(`${baseUrl}${basePath}/${created.id}`, { headers: { cookie } });
  assert.equal(detailAfterDeleteResponse.status, 404, "plano excluido logicamente nao deve mais aparecer no detalhe");
});

test("plano de automacao preventiva: nome curto e escopo ausente sao rejeitados", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const cookie = await login(baseUrl);

  const shortNameResponse = await fetch(baseUrl + basePath, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ name: "ab", scopeType: "all" })
  });
  assert.equal(shortNameResponse.status, 400);

  const missingScopeResponse = await fetch(baseUrl + basePath, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ name: "Plano sem escopo definido", scopeType: "segment" })
  });
  assert.equal(missingScopeResponse.status, 400);
});

test("plano de automacao preventiva: acesso sem sessao e recusado", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const response = await fetch(baseUrl + basePath);
  assert.equal(response.status, 401);
});
