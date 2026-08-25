import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "dashboard-layout-integration-secret-32ch";
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
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "123456" })
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie");
}

function browserHeaders(cookie, extra = {}) {
  return { "content-type": "application/json", cookie, origin: trustedOrigin, ...extra };
}

function validWidget(overrides = {}) {
  return {
    id: "widget-1",
    type: "status_overview",
    x: 0,
    y: 0,
    w: "m",
    h: "s",
    refreshIntervalSeconds: 60,
    config: {},
    ...overrides
  };
}

test.after(closeDatabase);

test("usuario sem layout salvo recebe o layout padrao do servidor, nunca null", async (t) => {
  // Precisa rodar antes de qualquer teste que salve um layout para o admin
  // (e o primeiro teste do arquivo, de proposito) -- os testes deste arquivo
  // compartilham o mesmo banco em memoria entre si, entao um PUT anterior
  // deixaria o admin com layout salvo, invalidando o cenario "sem layout".
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const response = await fetch(`${baseUrl}/api/dashboard/layout`, { headers: { cookie } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(Array.isArray(body.widgets));
  assert.ok(body.widgets.length > 0);
});

test("PUT salva o layout, GET seguinte reflete o que foi salvo", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const layout = { widgets: [validWidget({ id: "meu-widget", type: "alerts_by_severity" })] };
  const putResponse = await fetch(`${baseUrl}/api/dashboard/layout`, {
    method: "PUT",
    headers: browserHeaders(cookie),
    body: JSON.stringify(layout)
  });
  assert.equal(putResponse.status, 200);

  const getResponse = await fetch(`${baseUrl}/api/dashboard/layout`, { headers: { cookie } });
  const body = await getResponse.json();
  assert.equal(body.widgets.length, 1);
  assert.equal(body.widgets[0].id, "meu-widget");
  assert.equal(body.widgets[0].type, "alerts_by_severity");
});

test("PUT rejeita um layout com tipo de widget desconhecido, sem persistir nada", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const putResponse = await fetch(`${baseUrl}/api/dashboard/layout`, {
    method: "PUT",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ widgets: [validWidget({ type: "widget_que_nao_existe" })] })
  });
  assert.equal(putResponse.status, 400);
  const body = await putResponse.json();
  assert.match(body.message || body.error || "", /tipo desconhecido/);
});

test("POST /reset apaga o layout salvo e volta ao padrao", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  await fetch(`${baseUrl}/api/dashboard/layout`, {
    method: "PUT",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ widgets: [validWidget()] })
  });

  const resetResponse = await fetch(`${baseUrl}/api/dashboard/layout/reset`, {
    method: "POST",
    headers: browserHeaders(cookie)
  });
  assert.equal(resetResponse.status, 200);
  const resetBody = await resetResponse.json();
  assert.ok(resetBody.widgets.length > 1, "o layout padrao tem mais de um widget");
  assert.ok(!resetBody.widgets.some((widget) => widget.id === "widget-1"));

  const getResponse = await fetch(`${baseUrl}/api/dashboard/layout`, { headers: { cookie } });
  const getBody = await getResponse.json();
  assert.deepEqual(getBody, resetBody);
});

test("usuario sem nenhuma permissao de dashboard recebe 403 em GET/PUT/reset", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl, "sem.permissao@itguardian.local");

  const getResponse = await fetch(`${baseUrl}/api/dashboard/layout`, { headers: { cookie } });
  assert.equal(getResponse.status, 403);

  const putResponse = await fetch(`${baseUrl}/api/dashboard/layout`, {
    method: "PUT",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ widgets: [validWidget()] })
  });
  assert.equal(putResponse.status, 403);

  const resetResponse = await fetch(`${baseUrl}/api/dashboard/layout/reset`, {
    method: "POST",
    headers: browserHeaders(cookie)
  });
  assert.equal(resetResponse.status, 403);
});

test("usuario com dashboard.view mas sem dashboard.customize consegue ver o layout, nao consegue salvar nem resetar", async (t) => {
  await initializeRuntime();
  const { query } = await import("../src/database.js");
  await query("UPDATE users SET permissions = '[\"dashboard.view\"]'::jsonb WHERE email = $1", [
    "sem.permissao@itguardian.local"
  ]);
  const server = await listen(createApp());
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await query("UPDATE users SET permissions = '[]'::jsonb WHERE email = $1", ["sem.permissao@itguardian.local"]);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl, "sem.permissao@itguardian.local");

  const getResponse = await fetch(`${baseUrl}/api/dashboard/layout`, { headers: { cookie } });
  assert.equal(getResponse.status, 200);

  const putResponse = await fetch(`${baseUrl}/api/dashboard/layout`, {
    method: "PUT",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ widgets: [validWidget()] })
  });
  assert.equal(putResponse.status, 403);

  const resetResponse = await fetch(`${baseUrl}/api/dashboard/layout/reset`, {
    method: "POST",
    headers: browserHeaders(cookie)
  });
  assert.equal(resetResponse.status, 403);
});

test("a preferencia generica /api/preferences/dashboard-layout continua bloqueada (nao vira uma porta dos fundos)", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const response = await fetch(`${baseUrl}/api/preferences/dashboard-layout`, {
    method: "PUT",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ widgets: [] })
  });
  assert.equal(response.status, 400);
});
