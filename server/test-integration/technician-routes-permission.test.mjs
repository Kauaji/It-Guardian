import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "technician-routes-integration-secret-32c";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase } = await import("../src/database.js");

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function login(baseUrl, email) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "123456" })
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie");
}

test.after(closeDatabase);

test("listar tecnicos exige a mesma permissao usada no resto de Ordens de Servico", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const adminCookie = await login(baseUrl, "admin@itguardian.local");
  const restrictedCookie = await login(baseUrl, "sem.permissao@itguardian.local");

  const allowed = await fetch(`${baseUrl}/api/technicians`, { headers: { cookie: adminCookie } });
  assert.equal(allowed.status, 200);
  assert.ok(Array.isArray((await allowed.json()).technicians));

  const denied = await fetch(`${baseUrl}/api/technicians`, { headers: { cookie: restrictedCookie } });
  assert.equal(denied.status, 403);
});
