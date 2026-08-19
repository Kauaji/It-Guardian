import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "service-order-checklist-integration-secret-32c";
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

test.after(closeDatabase);

test("template de checklist e aplicado automaticamente e pode bloquear a finalizacao da OS", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const optionsResponse = await fetch(`${baseUrl}/api/public/support-options`);
  const problemTypes = (await optionsResponse.json()).problemTypes;
  const problemType = problemTypes.find((item) => item.id === "demo-problem-power") || problemTypes[0];
  assert.ok(problemType, "o seed de demonstracao deve ter ao menos um tipo de problema");

  const templateResponse = await fetch(`${baseUrl}/api/service-order-checklist-templates`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({
      name: "Checklist de teste",
      problemTypeKey: problemType.id,
      items: [
        { label: "Verificar fonte de energia", required: true },
        { label: "Testar cabo de forca", required: false }
      ]
    })
  });
  assert.equal(templateResponse.status, 201);

  const createResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ title: "OS com checklist automatico", problemType: problemType.id })
  });
  assert.equal(createResponse.status, 201);
  const order = (await createResponse.json()).serviceOrder;

  const checklistResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/checklist`, { headers: { cookie } });
  assert.equal(checklistResponse.status, 200);
  const items = (await checklistResponse.json()).items;
  assert.equal(items.length, 2, "o template deve ser aplicado automaticamente na criacao da OS");
  const requiredItem = items.find((item) => item.required);
  assert.ok(requiredItem);
  assert.equal(requiredItem.checked, false);

  const policyResponse = await fetch(`${baseUrl}/api/service-order-checklist-templates/policy`, {
    method: "PATCH",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ requireChecklistBeforeFinish: true })
  });
  assert.equal(policyResponse.status, 200);

  const technicianResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/technician`, {
    method: "PATCH",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ assignedTechnicianName: "Tecnico do checklist" })
  });
  assert.equal(technicianResponse.status, 200);

  const blockedFinish = await fetch(`${baseUrl}/api/service-orders/${order.id}/status`, {
    method: "PATCH",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ status: "closed" })
  });
  assert.equal(blockedFinish.status, 400, "finalizar deve ser bloqueado com item obrigatorio pendente");

  const checkItemResponse = await fetch(`${baseUrl}/api/service-orders/${order.id}/checklist/${requiredItem.id}`, {
    method: "PATCH",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ checked: true })
  });
  assert.equal(checkItemResponse.status, 200);

  const allowedFinish = await fetch(`${baseUrl}/api/service-orders/${order.id}/status`, {
    method: "PATCH",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ status: "closed" })
  });
  assert.equal(allowedFinish.status, 200, "finalizar deve ser permitido apos marcar o item obrigatorio");
});

test("usuario sem service_orders.manage_checklists nao consegue criar template", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const restrictedCookie = await login(baseUrl, "sem.permissao@itguardian.local");

  const denied = await fetch(`${baseUrl}/api/service-order-checklist-templates`, {
    method: "POST",
    headers: browserHeaders(restrictedCookie),
    body: JSON.stringify({ name: "Template negado", problemTypeKey: "demo-problem-power", items: [{ label: "x" }] })
  });
  assert.equal(denied.status, 403);
});
