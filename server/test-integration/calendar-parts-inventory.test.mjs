import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "integration-test-secret-with-at-least-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");

function listen(app) { return new Promise((resolve) => { const server = app.listen(0, "127.0.0.1", () => resolve(server)); }); }

test("agenda e inventario de pecas persistem fluxos operacionais", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@itguardian.local", password: "123456" }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie");
  const headers = { "content-type": "application/json", cookie, origin: "http://localhost:5173" };

  const startAt = new Date(Date.now() + 86_400_000).toISOString();
  const endAt = new Date(Date.now() + 90_000_000).toISOString();
  const createdEvent = await fetch(`${baseUrl}/api/calendar/events`, { method: "POST", headers, body: JSON.stringify({ title: "Visita de validacao", eventType: "technical_visit", startAt, endAt }) });
  assert.equal(createdEvent.status, 201);
  const event = (await createdEvent.json()).event;
  assert.equal(event.title, "Visita de validacao");

  const rangeStart = new Date(Date.now() - 86_400_000).toISOString();
  const rangeEnd = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const listed = await fetch(`${baseUrl}/api/calendar/events?startDate=${encodeURIComponent(rangeStart)}&endDate=${encodeURIComponent(rangeEnd)}`, { headers: { cookie } });
  assert.equal(listed.status, 200);
  assert.ok((await listed.json()).events.some((item) => item.id === event.id));

  const createdPart = await fetch(`${baseUrl}/api/parts`, { method: "POST", headers, body: JSON.stringify({ name: "SSD NVMe 1 TB", internalCode: "SSD-001", quantity: 3, minimumStock: 1, unit: "un" }) });
  assert.equal(createdPart.status, 201);
  const part = (await createdPart.json()).part;
  const consumed = await fetch(`${baseUrl}/api/parts/${part.id}/movements`, { method: "POST", headers, body: JSON.stringify({ movementType: "consumption", quantity: 1, assetId: "asset-test", notes: "Troca preventiva" }) });
  assert.equal(consumed.status, 201);
  const updatedPart = (await consumed.json()).part;
  assert.equal(updatedPart.quantity, 2);
  assert.equal(updatedPart.movements[0].assetId, "asset-test");
});
