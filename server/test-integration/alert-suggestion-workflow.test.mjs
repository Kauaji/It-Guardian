import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "integration-test-secret-with-at-least-32-characters";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { query } = await import("../src/database.js");
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

test("sugestão exige decisão humana, cria uma única OS e preserva rastreabilidade", async (t) => {
  const server = await listen(createApp({ initializeOnRequest: true }));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const cookie = await login(baseUrl);
  const observedAt = new Date().toISOString();

  await Promise.all([
    upsertAlert({
      id: "integration-alert-disk-health-1",
      assetId: "integration-asset-1",
      hostName: "INTEGRATION-01",
      type: "disk_health_low",
      metric: "disk_health",
      title: "Saude do disco abaixo do limite",
      description: "Alerta deterministico criado somente pelo teste integrado.",
      severity: "critical",
      value: 35,
      threshold: 80,
      status: "active",
      firstSeenAt: observedAt,
      lastSeenAt: observedAt,
      occurrencesCount: 1,
      source: "integration_test"
    }),
    upsertAlert({
      id: "integration-alert-disk-health-2",
      assetId: "integration-asset-2",
      hostName: "INTEGRATION-02",
      type: "disk_health_low",
      metric: "disk_health",
      title: "Saude do disco abaixo do limite",
      description: "Segundo alerta deterministico criado somente pelo teste integrado.",
      severity: "critical",
      value: 42,
      threshold: 80,
      status: "active",
      firstSeenAt: observedAt,
      lastSeenAt: observedAt,
      occurrencesCount: 1,
      source: "integration_test"
    })
  ]);

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

  const activeMaintenance = await query(
    "SELECT * FROM maintenance_records WHERE service_order_id = $1 AND status = 'active'",
    [firstAccept.serviceOrder.id]
  );
  assert.equal(activeMaintenance.rowCount, 1, "aceitar o aviso deve iniciar a manutencao no backend");

  const maintenanceSegment = await query(
    `
      SELECT segments.name
      FROM device_segments devices
      INNER JOIN inventory_segments segments ON segments.id = devices.segment_id
      WHERE devices.device_id = $1
    `,
    [firstAccept.serviceOrder.assetId]
  );
  assert.match(maintenanceSegment.rows[0].name, /manuten/i);

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

  const technicianResponse = await fetch(
    `${baseUrl}/api/service-orders/${firstAccept.serviceOrder.id}/technician`,
    {
      method: "PATCH",
      headers: requestHeaders(cookie),
      body: JSON.stringify({ assignedTechnicianName: "Tecnico Integracao" })
    }
  );
  assert.equal(technicianResponse.status, 200);

  const settingsResponse = await fetch(`${baseUrl}/api/service-orders/settings`, {
    headers: { cookie }
  });
  assert.equal(settingsResponse.status, 200);
  const serviceOrderSettings = (await settingsResponse.json()).settings;
  const finalStatus = serviceOrderSettings.statuses.find((status) => status.isFinal);
  assert.ok(finalStatus?.id);

  const finishResponse = await fetch(
    `${baseUrl}/api/service-orders/${firstAccept.serviceOrder.id}/status`,
    {
      method: "PATCH",
      headers: requestHeaders(cookie),
      body: JSON.stringify({ status: finalStatus.id })
    }
  );
  assert.equal(finishResponse.status, 200);

  const finishedMaintenance = await query(
    "SELECT * FROM maintenance_records WHERE service_order_id = $1",
    [firstAccept.serviceOrder.id]
  );
  assert.equal(finishedMaintenance.rows[0].status, "finished");
  assert.ok(finishedMaintenance.rows[0].finished_at);

  const assetHistory = await query(
    "SELECT event_type, message FROM asset_history WHERE asset_id = $1 ORDER BY created_at ASC",
    [firstAccept.serviceOrder.assetId]
  );
  assert.ok(assetHistory.rows.some((entry) => entry.event_type === "maintenance"));
  assert.ok(assetHistory.rows.some((entry) => /retirada da manuten/i.test(entry.message)));

  const createManualOrderResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: requestHeaders(cookie),
    body: JSON.stringify({ title: "OS para validar vinculacao posterior" })
  });
  assert.equal(createManualOrderResponse.status, 201);
  const manualOrder = (await createManualOrderResponse.json()).serviceOrder;
  const linkedAssetId = "integration-linked-asset";

  const linkAssetResponse = await fetch(
    `${baseUrl}/api/service-orders/${manualOrder.id}/asset`,
    {
      method: "PATCH",
      headers: requestHeaders(cookie),
      body: JSON.stringify({ assetId: linkedAssetId })
    }
  );
  assert.equal(linkAssetResponse.status, 200);

  const linkedMaintenance = await query(
    "SELECT * FROM maintenance_records WHERE service_order_id = $1 AND status = 'active'",
    [manualOrder.id]
  );
  assert.equal(linkedMaintenance.rowCount, 1, "vincular uma maquina deve iniciar manutencao");
  assert.equal(linkedMaintenance.rows[0].asset_id, linkedAssetId);

  const unlinkAssetResponse = await fetch(
    `${baseUrl}/api/service-orders/${manualOrder.id}/asset`,
    {
      method: "PATCH",
      headers: requestHeaders(cookie),
      body: JSON.stringify({ assetId: null })
    }
  );
  assert.equal(unlinkAssetResponse.status, 200);

  const unlinkedMaintenance = await query(
    "SELECT * FROM maintenance_records WHERE service_order_id = $1",
    [manualOrder.id]
  );
  assert.equal(unlinkedMaintenance.rows[0].status, "finished");
  assert.ok(unlinkedMaintenance.rows[0].finished_at);

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
