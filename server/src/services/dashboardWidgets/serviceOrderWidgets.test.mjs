import assert from "node:assert/strict";
import test from "node:test";
import { fetchServiceOrdersByStatus, fetchServiceOrdersOverdue, fetchServiceOrdersSla } from "./serviceOrderWidgets.js";

const settings = {
  statuses: [
    { id: "open", name: "Aberta", isFinal: false },
    { id: "closed", name: "Finalizada", isFinal: true }
  ],
  sla: {}
};

function order(overrides = {}) {
  return { id: "os-1", status: "open", createdAt: new Date().toISOString(), ...overrides };
}

function fakeCtx({ serviceOrders = [], serviceOrderSettings = settings } = {}) {
  return {
    getServiceOrders: async () => serviceOrders,
    getServiceOrderSettings: async () => serviceOrderSettings
  };
}

test("fetchServiceOrdersByStatus agrupa pelo nome real do status configurado", async () => {
  const result = await fetchServiceOrdersByStatus(
    {},
    fakeCtx({ serviceOrders: [order({ status: "open" }), order({ id: "os-2", status: "open" }), order({ id: "os-3", status: "closed" })] })
  );
  assert.equal(result.total, 3);
  assert.deepEqual(result.rows, [
    { label: "Aberta", count: 2 },
    { label: "Finalizada", count: 1 }
  ]);
});

test("fetchServiceOrdersSla nao inventa tempo medio quando nenhuma OS tem os dois marcos", async () => {
  const result = await fetchServiceOrdersSla({}, fakeCtx({ serviceOrders: [order({ status: "open" })] }));
  assert.equal(result.openCount, 1);
  assert.equal(result.averageResolutionMinutes, null);
  assert.equal(result.averageFirstResponseMinutes, null);
});

test("fetchServiceOrdersSla calcula o tempo medio de resolucao real quando ha OS finalizadas", async () => {
  const createdAt = new Date(Date.now() - 120 * 60000).toISOString();
  const closedAt = new Date().toISOString();
  const result = await fetchServiceOrdersSla(
    {},
    fakeCtx({ serviceOrders: [order({ status: "closed", createdAt, closedAt })] })
  );
  assert.ok(result.averageResolutionMinutes >= 119 && result.averageResolutionMinutes <= 121);
});

test("fetchServiceOrdersOverdue so lista OS abertas com slaDueAt real no passado, nunca inventa vencimento", async () => {
  const overdueOrder = order({ id: "os-overdue", status: "open", slaDueAt: new Date(Date.now() - 60 * 60000).toISOString() });
  const onTrackOrder = order({ id: "os-on-track", status: "open", slaDueAt: new Date(Date.now() + 60 * 60000).toISOString() });
  const noSlaOrder = order({ id: "os-no-sla", status: "open" });
  const result = await fetchServiceOrdersOverdue(
    {},
    fakeCtx({ serviceOrders: [overdueOrder, onTrackOrder, noSlaOrder] })
  );
  assert.equal(result.total, 1);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].id, "os-overdue");
  assert.ok(result.rows[0].overdueMinutes >= 59);
});
