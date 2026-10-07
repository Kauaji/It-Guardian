import assert from "node:assert/strict";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "observability-integration-secret-with-32-chars";
process.env.NODE_ENV = "test";
process.env.AUTH_RATE_LIMIT_MAX = "1000";
process.env.METRICS_TOKEN = "token-de-metricas-do-teste";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase } = await import("../src/database.js");

let server;
let baseUrl;

test.before(async () => {
  await initializeRuntime();
  server = await new Promise((resolve) => {
    const instance = createApp().listen(0, "127.0.0.1", () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
});

async function loginCookie(email) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:5173" },
    body: JSON.stringify({ email, password: "123456" })
  });
  return response.headers.get("set-cookie").split(";")[0];
}

test("liveness nao toca no banco e readiness confirma banco e migracoes", async () => {
  const live = await fetch(`${baseUrl}/health/live`);
  assert.equal(live.status, 200);
  assert.equal((await live.json()).status, "ok");

  const ready = await fetch(`${baseUrl}/health/ready`);
  assert.equal(ready.status, 200);
  const body = await ready.json();
  assert.equal(body.checks.database, "ok");
  assert.equal(body.checks.migrations, "ok");

  const legacy = await (await fetch(`${baseUrl}/api/health`)).json();
  assert.equal(legacy.database, "ok");
  assert.equal("remoteAssistanceRelay" in legacy, false, "detalhe interno nao fica no health publico");
});

test("/metrics exige o token e expoe contadores e histogramas HTTP", async () => {
  await fetch(`${baseUrl}/health/live`);
  assert.equal((await fetch(`${baseUrl}/metrics`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/metrics`, { headers: { authorization: "Bearer errado" } })).status, 401);

  const ok = await fetch(`${baseUrl}/metrics`, { headers: { authorization: `Bearer ${process.env.METRICS_TOKEN}` } });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get("content-type"), /text\/plain/);
  const text = await ok.text();
  assert.match(text, /itguardian_http_requests_total\{method="GET",route="\/health\/live",status="200"\} \d+/);
  assert.match(text, /itguardian_http_request_duration_seconds_bucket/);
  assert.match(text, /itguardian_db_pool_connections/);
});

test("x-request-id do cliente so e aceito com formato seguro", async () => {
  const good = await fetch(`${baseUrl}/health/live`, { headers: { "x-request-id": "req-abc-123456" } });
  assert.equal(good.headers.get("x-request-id"), "req-abc-123456");
  const bad = await fetch(`${baseUrl}/health/live`, { headers: { "x-request-id": 'x"}{"injetado":1' } });
  assert.notEqual(bad.headers.get("x-request-id"), 'x"}{"injetado":1');
  assert.match(bad.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
});

test("a API envia CSP restritiva, sem enquadramento e sem referrer", async () => {
  const response = await fetch(`${baseUrl}/health/live`);
  assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("strict-transport-security"), /max-age=/);
  assert.equal(response.headers.get("x-powered-by"), null);
});

test("CORS recusado nao reflete a origem e usa codigo estavel", async () => {
  const response = await fetch(`${baseUrl}/api/public/support-options`, { headers: { origin: "https://evil.example" } });
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.code, "CORS_ORIGIN_DENIED");
  assert.doesNotMatch(JSON.stringify(body), /evil\.example/);
});

test("corpo com __proto__ e recusado antes de chegar nas rotas", async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:5173" },
    body: '{"email":"a@b.com","password":"x","__proto__":{"isAdmin":true}}'
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "INVALID_INPUT");
});

test("rota inexistente devolve 404 em portugues sem refletir o caminho", async () => {
  const response = await fetch(`${baseUrl}/api/nao-existe-<script>`);
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.message, "Rota não encontrada.");
  assert.equal(body.code, "NOT_FOUND");
});

test("diagnostico detalhado e exclusivo de administradores", async () => {
  assert.equal((await fetch(`${baseUrl}/api/system/diagnostics`)).status, 401);
  const viewer = await loginCookie("sem.permissao@itguardian.local");
  assert.equal((await fetch(`${baseUrl}/api/system/diagnostics`, { headers: { cookie: viewer } })).status, 403);
  const admin = await loginCookie("admin@itguardian.local");
  const response = await fetch(`${baseUrl}/api/system/diagnostics`, { headers: { cookie: admin } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.database.mode, process.env.DATABASE_URL === "memory" ? "memory" : "postgres");
  assert.equal(body.metricsEnabled, true);
  assert.ok(body.remoteAssistanceRelay);
});
