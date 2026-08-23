import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "report-permissions-integration-secret-32ch";
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

async function login(baseUrl, email) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: trustedOrigin },
    body: JSON.stringify({ email, password: "123456" })
  });
  assert.equal(response.status, 200, `login deveria funcionar para ${email}`);
  return response.headers.get("set-cookie");
}

test.after(closeDatabase);

const routes = [
  "/api/reports/monthly/preview",
  "/api/reports/service-orders/preview",
  "/api/reports/sla/preview",
  "/api/reports/assets/preview",
  "/api/reports/alerts/preview",
  "/api/reports/scripts/preview",
  "/api/reports/remote-assistance/preview"
];

test("sem cookie de sessao, todas as rotas de relatorio devolvem 401", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  for (const route of routes) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(response.status, 401, `${route} deveria exigir autenticacao`);
  }
});

test("admin acessa o preview de todos os 7 tipos de relatorio", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl, "admin@itguardian.local");

  for (const route of routes) {
    const response = await fetch(`${baseUrl}${route}`, { headers: { cookie } });
    assert.equal(response.status, 200, `admin deveria acessar ${route}`);
  }
});

test("usuario sem nenhuma permissao de relatorio recebe 403 em todas as rotas de preview", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl, "sem.permissao@itguardian.local");

  for (const route of routes) {
    const response = await fetch(`${baseUrl}${route}`, { headers: { cookie } });
    assert.equal(response.status, 403, `${route} deveria negar quem nao tem reports.view`);
  }
});

test("exportar CSV exige reports.export mesmo para quem tem reports.view do tipo", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl, "admin@itguardian.local");

  const response = await fetch(`${baseUrl}/api/reports/monthly/export.csv`, { headers: { cookie } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/csv/);
});
