import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "integration-test-secret-with-at-least-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("sessao por cookie persiste preferencia e bloqueia origem nao confiavel", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@itguardian.local", password: "123456" })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie");
  assert.match(cookie, /it_guardian_session=/);
  assert.match(cookie, /HttpOnly/i);

  const blocked = await fetch(`${baseUrl}/api/preferences/inventory-workspace`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      cookie,
      origin: "https://untrusted.example"
    },
    body: JSON.stringify({ value: { activeTabId: "tab-a" } })
  });
  assert.equal(blocked.status, 403);

  const saved = await fetch(`${baseUrl}/api/preferences/inventory-workspace`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      cookie,
      origin: "http://localhost:5173"
    },
    body: JSON.stringify({ value: { activeTabId: "tab-a", aliases: { "asset-1": "Caixa" } } })
  });
  assert.equal(saved.status, 200);

  const loaded = await fetch(`${baseUrl}/api/preferences/inventory-workspace`, {
    headers: { cookie }
  });
  assert.equal(loaded.status, 200);
  assert.deepEqual((await loaded.json()).value, {
    activeTabId: "tab-a",
    aliases: { "asset-1": "Caixa" }
  });

  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { cookie, origin: "http://localhost:5173" }
  });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
});
