import assert from "node:assert/strict";
import test from "node:test";
import { fetchAlertsBySeverity, fetchCurrentProblems } from "./alertWidgets.js";

function alert(overrides = {}) {
  return { id: "alert-1", hostId: "host-1", hostName: "Host 1", severity: "critical", type: "cpu_high", lastSeenAt: new Date().toISOString(), ...overrides };
}

function fakeCtx(activeAlerts = []) {
  return { getActiveAlerts: async () => activeAlerts };
}

test("fetchCurrentProblems ordena por visto por ultimo mais recente e respeita o limite", async () => {
  const older = alert({ id: "a1", lastSeenAt: new Date(Date.now() - 60000).toISOString() });
  const newer = alert({ id: "a2", lastSeenAt: new Date().toISOString() });
  const result = await fetchCurrentProblems({ limit: 1 }, fakeCtx([older, newer]));
  assert.equal(result.total, 2);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].id, "a2");
});

test("fetchCurrentProblems nao inventa nada quando nao ha alertas ativos", async () => {
  const result = await fetchCurrentProblems({}, fakeCtx([]));
  assert.deepEqual(result, { total: 0, rows: [] });
});

test("fetchAlertsBySeverity agrupa pela severidade real, ordenado do maior para o menor", async () => {
  const result = await fetchAlertsBySeverity(
    {},
    fakeCtx([alert({ severity: "critical" }), alert({ id: "a2", severity: "critical" }), alert({ id: "a3", severity: "low" })])
  );
  assert.equal(result.total, 3);
  assert.deepEqual(result.rows, [
    { label: "Critica", count: 2 },
    { label: "Baixa", count: 1 }
  ]);
});
