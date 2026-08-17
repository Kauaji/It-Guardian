import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "integration-test-secret-with-at-least-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { upsertAlert } = await import("../src/repositories/alertRepository.js");

const trustedOrigin = "http://localhost:5173";

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

test("aviso: reconhecer, comentar, remover reconhecimento e consultar historico/regras/configuracoes", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const cookie = await login(baseUrl);
  const observedAt = new Date().toISOString();
  const alertId = "integration-alert-lifecycle-1";

  await upsertAlert({
    id: alertId,
    assetId: "integration-asset-lifecycle-1",
    hostName: "INTEGRATION-LIFECYCLE-01",
    type: "disk_health_low",
    metric: "disk_health",
    title: "Saude do disco abaixo do limite",
    description: "Alerta deterministico criado somente pelo teste integrado.",
    severity: "critical",
    value: 30,
    threshold: 80,
    status: "active",
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    occurrencesCount: 1,
    source: "integration_test"
  });

  const activeResponse = await fetch(`${baseUrl}/api/alerts`, { headers: { cookie } });
  assert.equal(activeResponse.status, 200);
  const active = (await activeResponse.json()).alerts;
  assert.ok(active.some((alert) => alert.id === alertId), "aviso semeado deve aparecer nos avisos ativos");

  const acknowledgeResponse = await fetch(`${baseUrl}/api/alerts/${alertId}/acknowledge`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ note: "Reconhecido pelo teste integrado" })
  });
  const acknowledgeBody = await acknowledgeResponse.json();
  assert.equal(acknowledgeResponse.status, 200, JSON.stringify(acknowledgeBody));

  const commentResponse = await fetch(`${baseUrl}/api/alerts/${alertId}/comments`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ message: "Comentario de teste integrado" })
  });
  const commentBody = await commentResponse.json();
  assert.equal(commentResponse.status, 201, JSON.stringify(commentBody));
  assert.equal(commentBody.comment.message, "Comentario de teste integrado");

  const commentsListResponse = await fetch(`${baseUrl}/api/alerts/${alertId}/comments`, { headers: { cookie } });
  assert.equal(commentsListResponse.status, 200);
  const commentsList = (await commentsListResponse.json()).comments;
  assert.ok(commentsList.some((comment) => comment.message === "Comentario de teste integrado"));

  const historyResponse = await fetch(`${baseUrl}/api/alerts/history`, { headers: { cookie } });
  assert.equal(historyResponse.status, 200);

  const rulesResponse = await fetch(`${baseUrl}/api/alerts/rules`, { headers: { cookie } });
  assert.equal(rulesResponse.status, 200);
  const rules = (await rulesResponse.json()).rules;
  assert.ok(Array.isArray(rules) && rules.length > 0, "deve existir ao menos uma regra de aviso configurada");

  const settingsResponse = await fetch(`${baseUrl}/api/alerts/settings`, { headers: { cookie } });
  assert.equal(settingsResponse.status, 200);

  const removeAckResponse = await fetch(`${baseUrl}/api/alerts/${alertId}/acknowledge`, {
    method: "DELETE",
    headers: requestHeaders(cookie)
  });
  assert.equal(removeAckResponse.status, 200);
});

test("aviso: comentar um aviso inexistente e recusado com 404", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const cookie = await login(baseUrl);

  const response = await fetch(`${baseUrl}/api/alerts/nao-existe/comments`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ message: "Nunca deveria ser aceito" })
  });
  assert.equal(response.status, 404);
});

test("avisos: acesso sem sessao e recusado", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const response = await fetch(`${baseUrl}/api/alerts`);
  assert.equal(response.status, 401);
});
