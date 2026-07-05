import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "integration-test-secret-with-at-least-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");

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

test("sugestão exige decisão humana, cria uma única OS e preserva rastreabilidade", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const cookie = await login(baseUrl);

  const beforeOrdersResponse = await fetch(`${baseUrl}/api/service-orders`, {
    headers: { cookie }
  });
  assert.equal(beforeOrdersResponse.status, 200);
  const beforeOrders = (await beforeOrdersResponse.json()).serviceOrders;

  const evaluateResponse = await fetch(`${baseUrl}/api/alerts/evaluate`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: "{}"
  });
  assert.equal(evaluateResponse.status, 200);

  const pendingResponse = await fetch(`${baseUrl}/api/service-order-suggestions`, {
    headers: { cookie }
  });
  assert.equal(pendingResponse.status, 200);
  const pendingSuggestions = (await pendingResponse.json()).suggestions.filter(
    (suggestion) => suggestion.status === "pending"
  );
  assert.ok(pendingSuggestions.length >= 2);

  const afterEvaluationResponse = await fetch(`${baseUrl}/api/service-orders`, {
    headers: { cookie }
  });
  assert.equal(afterEvaluationResponse.status, 200);
  assert.equal(
    (await afterEvaluationResponse.json()).serviceOrders.length,
    beforeOrders.length,
    "avaliar avisos não deve criar OS automaticamente"
  );

  const acceptedId = pendingSuggestions[0].id;
  const firstAcceptResponse = await fetch(
    `${baseUrl}/api/service-order-suggestions/${acceptedId}/accept`,
    {
      method: "POST",
      headers: requestHeaders(cookie),
      body: "{}"
    }
  );
  assert.equal(firstAcceptResponse.status, 201);
  const firstAccept = await firstAcceptResponse.json();
  assert.equal(firstAccept.suggestion.status, "accepted");
  assert.equal(firstAccept.serviceOrder.source, "alert_suggestion");
  assert.ok(firstAccept.serviceOrder.id);

  const secondAcceptResponse = await fetch(
    `${baseUrl}/api/service-order-suggestions/${acceptedId}/accept`,
    {
      method: "POST",
      headers: requestHeaders(cookie),
      body: "{}"
    }
  );
  assert.equal(secondAcceptResponse.status, 201);
  const secondAccept = await secondAcceptResponse.json();
  assert.equal(secondAccept.serviceOrder.id, firstAccept.serviceOrder.id);

  const afterAcceptResponse = await fetch(`${baseUrl}/api/service-orders`, {
    headers: { cookie }
  });
  assert.equal(afterAcceptResponse.status, 200);
  const afterAcceptOrders = (await afterAcceptResponse.json()).serviceOrders;
  assert.equal(afterAcceptOrders.length, beforeOrders.length + 1);

  const detailResponse = await fetch(
    `${baseUrl}/api/service-orders/${firstAccept.serviceOrder.id}`,
    { headers: { cookie } }
  );
  assert.equal(detailResponse.status, 200);
  const orderDetail = await detailResponse.json();
  assert.ok(
    orderDetail.serviceOrder.history.some(
      (entry) => entry.eventType === "alert_suggestion_accepted"
    )
  );

  const rejectedId = pendingSuggestions[1].id;
  const rejectResponse = await fetch(
    `${baseUrl}/api/service-order-suggestions/${rejectedId}/reject`,
    {
      method: "POST",
      headers: requestHeaders(cookie),
      body: JSON.stringify({ reason: "Falso positivo confirmado no teste integrado." })
    }
  );
  assert.equal(rejectResponse.status, 200);
  const rejected = (await rejectResponse.json()).suggestion;
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.rejectionReason, "Falso positivo confirmado no teste integrado.");
  assert.ok(rejected.ignoredUntil);
});
