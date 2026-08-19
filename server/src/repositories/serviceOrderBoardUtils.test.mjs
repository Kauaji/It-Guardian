import assert from "node:assert/strict";
import test from "node:test";
import {
  buildServiceOrderMonthValues,
  buildServiceOrderNumberPreview,
  getMonthValue,
  getServiceOrderOriginKey,
  getServiceOrderOriginLabel,
  isServiceOrderVisibleInMonth,
  mergeServiceOrderSettings,
  normalizeSearchText,
  normalizeStatuses,
  orderBelongsToClient,
  orderBelongsToSector
} from "../../../client/src/components/serviceOrders/serviceOrderBoardUtils.js";

test("mes principal da OS deriva da data informada sem considerar fechamento", () => {
  assert.equal(getMonthValue("2026-05-31T23:00:00.000-03:00"), "2026-05");
  assert.equal(getMonthValue("valor-invalido"), "");
});

test("busca de OS ignora acentos e diferenca entre maiusculas", () => {
  assert.equal(normalizeSearchText("Manutenção Preventiva"), "manutencao preventiva");
});

test("status da OS preservam exatamente um inicial e um final", () => {
  const statuses = normalizeStatuses([
    { id: "new", name: "Nova", isInitial: true },
    { id: "doing", name: "Fazendo", isInitial: true, isFinal: true },
    { id: "done", name: "Concluida", isFinal: true }
  ]);
  assert.equal(statuses.filter((status) => status.isInitial).length, 1);
  assert.equal(statuses.filter((status) => status.isFinal).length, 1);
});

test("configuracao parcial da OS recebe defaults sem perder valores", () => {
  const settings = mergeServiceOrderSettings({
    boardLayout: "vertical",
    priorityColors: { critical: "#112233" }
  });
  assert.equal(settings.boardLayout, "vertical");
  assert.equal(settings.priorityColors.critical, "#112233");
  assert.equal(settings.priorityColors.low, "#16a34a");
  assert.ok(settings.statuses.length >= 2);
});

test("filtros de setor e cliente respeitam os identificadores", () => {
  const order = { sectorId: "finance", environmentId: "client-a" };
  assert.equal(orderBelongsToSector(order, "finance"), true);
  assert.equal(orderBelongsToSector(order, "other"), false);
  assert.equal(orderBelongsToClient(order, "client-a"), true);
  assert.equal(orderBelongsToClient(order, "client-b"), false);
});

test("preview de numero da OS inclui prefixo e sequencia", () => {
  assert.match(
    buildServiceOrderNumberPreview({ numberFormat: { prefix: "os", nextNumber: 42 } }),
    /^OS-0042$/
  );
});

test("OS nao finalizada continua visivel nos meses seguintes", () => {
  const order = { createdAt: "2026-05-20T12:00:00.000Z", status: "in_progress" };
  assert.equal(isServiceOrderVisibleInMonth(order, "2026-05", ["closed"]), true);
  assert.equal(isServiceOrderVisibleInMonth(order, "2026-08", ["closed"]), true);
  assert.equal(isServiceOrderVisibleInMonth(order, "2026-04", ["closed"]), false);
});

test("OS finalizada aparece ate o mes de encerramento", () => {
  const order = {
    createdAt: "2026-05-20T12:00:00.000Z",
    closedAt: "2026-07-03T12:00:00.000Z",
    status: "closed"
  };
  assert.equal(isServiceOrderVisibleInMonth(order, "2026-06", ["closed"]), true);
  assert.equal(isServiceOrderVisibleInMonth(order, "2026-07", ["closed"]), true);
  assert.equal(isServiceOrderVisibleInMonth(order, "2026-08", ["closed"]), false);
});

test("seletor mensal inclui meses intermediarios sem novas OS", () => {
  assert.deepEqual(
    buildServiceOrderMonthValues([{ createdAt: "2026-05-10T10:00:00.000Z" }], "2026-08"),
    ["2026-05", "2026-06", "2026-07", "2026-08"]
  );
});

test("configuracao de SLA e checklist obrigatorio recebe defaults sem perder valores informados", () => {
  const settings = mergeServiceOrderSettings({ sla: { critical: 2 }, requireChecklistBeforeFinish: true });
  assert.equal(settings.sla.critical, 2);
  assert.equal(settings.sla.low, 72, "prioridades nao informadas mantem o default");
  assert.equal(settings.requireChecklistBeforeFinish, true);
});

test("configuracao sem SLA informado recebe os defaults completos", () => {
  const settings = mergeServiceOrderSettings({});
  assert.deepEqual(settings.sla, { low: 72, medium: 48, high: 24, critical: 4, nearDuePercent: 20, nearDueMinHours: 2 });
  assert.equal(settings.requireChecklistBeforeFinish, false);
});

test("origem da OS prioriza vinculo com plano preventivo sobre o campo source", () => {
  assert.equal(getServiceOrderOriginKey({ preventivePlanId: "plan-1", source: "alert_suggestion" }), "preventive");
  assert.equal(getServiceOrderOriginLabel({ preventivePlanId: "plan-1" }), "Preventiva");
});

test("origem da OS reconhece alerta e portal publico, com manual como fallback", () => {
  assert.equal(getServiceOrderOriginKey({ source: "alert_suggestion" }), "alert_suggestion");
  assert.equal(getServiceOrderOriginKey({ source: "public_support_form" }), "public_support_form");
  assert.equal(getServiceOrderOriginKey({}), "manual");
  assert.equal(getServiceOrderOriginLabel({}), "Manual");
});
