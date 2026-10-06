import assert from "node:assert/strict";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "maintenance-script-high-risk-approval-secret-32chars";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const {
  bearerHeaders,
  bearerUser,
  browserHeaders,
  createScriptViaApi,
  createServiceOrderViaApi,
  createSuggestionForMachine,
  enrollAndHeartbeat,
  listen,
  login
} = await import("../test-support/scriptFixtures.mjs");

test.after(closeDatabase);

async function startServer(t) {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);
  return { baseUrl, cookie };
}

const highRiskBody = {
  name: "Reinicio de servico de risco alto",
  type: "powershell",
  content: "Restart-Service -Name Spooler -Force",
  riskLevel: "high"
};

// Os cenarios que terminam em recusa dentro da transacao ficam por ultimo: o
// pg-mem nao reverte corretamente indices apos um ROLLBACK, o que contaminaria
// cenarios seguintes do mesmo arquivo (no PostgreSQL real nao ha efeito).

test("segundo revisor com permissao de aprovacao enfileira script de risco alto por sugestao e por OS", async (t) => {
  const { baseUrl, cookie } = await startServer(t);
  const machineId = "high-risk-approved-machine";
  await enrollAndHeartbeat(baseUrl, machineId);
  const suggestion = await createSuggestionForMachine(baseUrl, cookie, machineId, "high-risk-approved-alert");
  const order = await createServiceOrderViaApi(baseUrl, cookie, { title: "OS de risco alto", assetId: machineId });
  const script = await createScriptViaApi(baseUrl, cookie, highRiskBody);
  const { user: approver, token } = await bearerUser({ role: "operator", permissions: ["scripts.approve_high_risk"] });

  const viaSuggestion = await fetch(`${baseUrl}/api/service-order-suggestions/${suggestion.id}/scripts/${script.id}/use`, {
    method: "POST",
    headers: bearerHeaders(token),
    body: JSON.stringify({ confirmed: true, riskAcknowledged: true })
  });
  const suggestionBody = await viaSuggestion.json();
  assert.equal(viaSuggestion.status, 201, JSON.stringify(suggestionBody));
  assert.equal(suggestionBody.job.type, "powershell");

  const viaOrder = await fetch(`${baseUrl}/api/service-orders/${order.id}/scripts/${script.id}/use`, {
    method: "POST",
    headers: bearerHeaders(token),
    body: JSON.stringify({ confirmed: true, riskAcknowledged: true })
  });
  assert.equal(viaOrder.status, 201);

  const jobs = await query("SELECT requested_by FROM agent_script_jobs WHERE asset_id = $1 ORDER BY created_at", [machineId]);
  assert.deepEqual(
    jobs.rows.map((row) => row.requested_by),
    [approver.id, approver.id]
  );
});

test("sem a permissao de aprovacao o script de risco alto nao e enfileirado", async (t) => {
  const { baseUrl, cookie } = await startServer(t);
  const machineId = "high-risk-unapproved-machine";
  await enrollAndHeartbeat(baseUrl, machineId);
  const suggestion = await createSuggestionForMachine(baseUrl, cookie, machineId, "high-risk-unapproved-alert");
  const order = await createServiceOrderViaApi(baseUrl, cookie, { title: "OS sem aprovacao", assetId: machineId });
  const script = await createScriptViaApi(baseUrl, cookie, { ...highRiskBody, name: "Risco alto sem aprovacao" });
  const { token } = await bearerUser({ role: "operator", permissions: [] });
  const body = JSON.stringify({ confirmed: true, riskAcknowledged: true });

  const viaSuggestion = await fetch(`${baseUrl}/api/service-order-suggestions/${suggestion.id}/scripts/${script.id}/use`, {
    method: "POST",
    headers: bearerHeaders(token),
    body
  });
  assert.equal(viaSuggestion.status, 403);
  assert.match((await viaSuggestion.json()).message, /exigem um revisor com permissão de aprovação/);

  const viaOrder = await fetch(`${baseUrl}/api/service-orders/${order.id}/scripts/${script.id}/use`, {
    method: "POST",
    headers: bearerHeaders(token),
    body
  });
  assert.equal(viaOrder.status, 403);

  const jobs = await query("SELECT COUNT(*)::INTEGER AS total FROM agent_script_jobs WHERE asset_id = $1", [machineId]);
  assert.equal(jobs.rows[0].total, 0);
});

test("quem editou o conteudo por ultimo nao pode enfileirar o proprio script de risco alto", async (t) => {
  const { baseUrl, cookie } = await startServer(t);
  const machineId = "high-risk-same-author-machine";
  await enrollAndHeartbeat(baseUrl, machineId);
  const order = await createServiceOrderViaApi(baseUrl, cookie, { title: "OS do mesmo autor", assetId: machineId });
  const script = await createScriptViaApi(baseUrl, cookie, { ...highRiskBody, name: "Risco alto do mesmo autor" });

  const sameAuthor = await fetch(`${baseUrl}/api/service-orders/${order.id}/scripts/${script.id}/use`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ confirmed: true, riskAcknowledged: true })
  });
  assert.equal(sameAuthor.status, 403);
  assert.match((await sameAuthor.json()).message, /mesma pessoa que cadastrou/);

  const jobs = await query("SELECT COUNT(*)::INTEGER AS total FROM agent_script_jobs WHERE asset_id = $1", [machineId]);
  assert.equal(jobs.rows[0].total, 0);
});
