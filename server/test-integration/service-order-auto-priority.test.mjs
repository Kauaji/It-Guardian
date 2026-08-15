import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "service-order-auto-priority-secret-32c";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const { syncAutoPriorities } = await import("../src/repositories/serviceOrderRepository.js");

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function login(baseUrl, email = "admin@itguardian.local") {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "123456" })
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie");
}

function browserHeaders(cookie, extra = {}) {
  return { "content-type": "application/json", cookie, origin: "http://localhost:5173", ...extra };
}

test.after(closeDatabase);

test("prioridade automatica por tempo aparece na leitura sem gravar, e so persiste pelo job agendado", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const cookie = await login(baseUrl);

  const settingsResponse = await fetch(`${baseUrl}/api/service-orders/settings`, {
    method: "PATCH",
    headers: browserHeaders(cookie),
    body: JSON.stringify({
      autoPriority: {
        enabled: true,
        lowToMediumHours: 1,
        mediumToHighHours: 48,
        highToCriticalHours: 96
      }
    })
  });
  assert.equal(settingsResponse.status, 200);

  const createResponse = await fetch(`${baseUrl}/api/service-orders`, {
    method: "POST",
    headers: browserHeaders(cookie),
    body: JSON.stringify({ title: "OS para teste de prioridade automatica", priority: "low" })
  });
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()).serviceOrder;
  assert.equal(created.priority, "low");
  assert.equal(created.isDemo, false, "OS criada de verdade nao pode ser marcada como demo");

  // Simula que a OS foi aberta ha 2 horas, cruzando o limiar de 1h configurado
  // acima -- sem isso, o teste dependeria de esperar de verdade.
  await query("UPDATE service_orders SET created_at = NOW() - INTERVAL '2 hours' WHERE id = $1", [created.id]);

  const beforeSyncRow = await query("SELECT priority FROM service_orders WHERE id = $1", [created.id]);
  assert.equal(beforeSyncRow.rows[0].priority, "low");

  const listResponse = await fetch(`${baseUrl}/api/service-orders`, { headers: { cookie } });
  assert.equal(listResponse.status, 200);
  const allOrders = (await listResponse.json()).serviceOrders;
  const listed = allOrders.find((order) => order.id === created.id);
  assert.equal(listed.priority, "medium", "a listagem deve mostrar a prioridade calculada por tempo");
  assert.equal(listed.isDemo, false, "OS criada de verdade nao pode ser marcada como demo");

  const detailResponse = await fetch(`${baseUrl}/api/service-orders/${created.id}`, { headers: { cookie } });
  assert.equal(detailResponse.status, 200);
  assert.equal((await detailResponse.json()).serviceOrder.priority, "medium");

  const demoOrder = allOrders.find((order) => order.id === "demo-os-001");
  assert.ok(demoOrder, "seed de demonstracao deveria existir com ENABLE_DEMO_SEED=true");
  assert.equal(demoOrder.isDemo, true, "OS semeada por demonstracao deve ser marcada como demo");

  // A leitura acima nao pode ter escrito nada: nem a coluna, nem o historico.
  const afterReadsRow = await query("SELECT priority FROM service_orders WHERE id = $1", [created.id]);
  assert.equal(afterReadsRow.rows[0].priority, "low", "GET nao deve gravar a prioridade calculada no banco");
  const historyBeforeSync = await query(
    "SELECT * FROM service_order_history WHERE service_order_id = $1 AND event_type = 'auto_priority'",
    [created.id]
  );
  assert.equal(historyBeforeSync.rowCount, 0, "GET nao deve criar evento de auditoria");

  const syncResult = await syncAutoPriorities();
  assert.ok(syncResult.updated >= 1);

  const afterSyncRow = await query("SELECT priority FROM service_orders WHERE id = $1", [created.id]);
  assert.equal(afterSyncRow.rows[0].priority, "medium", "o job agendado deve persistir a prioridade calculada");
  const historyAfterSync = await query(
    "SELECT * FROM service_order_history WHERE service_order_id = $1 AND event_type = 'auto_priority'",
    [created.id]
  );
  assert.equal(historyAfterSync.rowCount, 1);

  const secondSyncResult = await syncAutoPriorities();
  const unchangedForThisOrder = secondSyncResult.updated === 0 ||
    (await query(
      "SELECT COUNT(*)::int AS total FROM service_order_history WHERE service_order_id = $1 AND event_type = 'auto_priority'",
      [created.id]
    )).rows[0].total === 1;
  assert.ok(unchangedForThisOrder, "rodar o job de novo sem mudanca de horario nao deve duplicar o evento desta OS");
});
