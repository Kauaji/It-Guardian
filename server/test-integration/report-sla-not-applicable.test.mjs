import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "report-sla-integration-secret-32ch";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");

const trustedOrigin = "http://localhost:5173";

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function login(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: trustedOrigin },
    body: JSON.stringify({ email: "admin@itguardian.local", password: "123456" })
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie");
}

test.after(closeDatabase);

test("OS legada sem sla_due_at cai em notApplicableCount, nunca em breached/resolved ou no percentual", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const before = await (await fetch(`${baseUrl}/api/reports/sla/preview`, { headers: { cookie } })).json();

  const createResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie, origin: trustedOrigin },
    body: JSON.stringify({ title: "OS legada sem SLA" })
  });
  assert.equal(createResponse.status, 201);
  const order = (await createResponse.json()).serviceOrder;
  await query("UPDATE service_orders SET sla_due_at = NULL WHERE id = $1", [order.id]);

  const after = await (await fetch(`${baseUrl}/api/reports/sla/preview`, { headers: { cookie } })).json();

  const row = after.rows.find((item) => item.id === order.id);
  assert.ok(row, "a OS legada deveria aparecer no relatorio de SLA");
  assert.equal(row.slaStatus, "not_applicable");
  assert.equal(row.slaStatusLabel, "Nao se aplica");

  assert.equal(after.summary.notApplicableCount, before.summary.notApplicableCount + 1);
  assert.equal(after.summary.applicableTotal, before.summary.applicableTotal);
  assert.equal(after.summary.open.onTrack, before.summary.open.onTrack);
  assert.equal(after.summary.open.nearDue, before.summary.open.nearDue);
  assert.equal(after.summary.open.breachedOpen, before.summary.open.breachedOpen);
  assert.equal(after.summary.closedCompliancePercent, before.summary.closedCompliancePercent);
});

test("OS fechada apos o prazo entra como breached no fechamento, nunca como resolved", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);

  const createResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie, origin: trustedOrigin },
    body: JSON.stringify({ title: "OS que vai vencer", priority: "critical" })
  });
  assert.equal(createResponse.status, 201);
  const order = (await createResponse.json()).serviceOrder;

  await query(
    "UPDATE service_orders SET sla_due_at = NOW() - INTERVAL '2 hours', status = 'closed', closed_at = NOW() - INTERVAL '1 hour' WHERE id = $1",
    [order.id]
  );

  const response = await fetch(`${baseUrl}/api/reports/sla/preview`, { headers: { cookie } });
  const body = await response.json();
  const row = body.rows.find((item) => item.id === order.id);

  assert.ok(row);
  assert.equal(row.slaStatus, "breached");
  assert.notEqual(row.slaStatus, "resolved");
});
