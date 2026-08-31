import assert from "node:assert/strict";
import test from "node:test";
import { fetchRecentEvents } from "./eventWidgets.js";
import { fetchMetricGaugeCpu, fetchMetricHistoryCpu } from "./metricWidgets.js";
import { fetchScriptExecutions } from "./scriptWidgets.js";
import {
  buildDashboardAssetScope,
  filterDashboardAlerts,
  filterDashboardEvents,
  filterDashboardServiceOrders,
  normalizeDashboardFilters,
  validateDashboardOrderStatus,
  withDashboardFilters
} from "./widgetFilters.js";

const now = new Date("2026-08-27T12:00:00.000Z");
const settings = {
  statuses: [
    { id: "open", name: "Aberta", isInitial: true, isFinal: false },
    { id: "in_progress", name: "Em atendimento", isFinal: false },
    { id: "resolved_custom", name: "Resolvida", isFinal: true }
  ],
  sla: {}
};
const devices = [
  { id: "asset-a", name: "Mesmo nome", status: "online", metrics: { cpu: 96 } },
  { id: "asset-b", name: "Mesmo nome", status: "online", metrics: { cpu: 22 } },
  { id: "asset-c", name: "Offline", status: "offline", metrics: { cpu: 35 } },
  { id: "asset-d", name: "Erro", status: "problem", metrics: null },
  { id: "asset-e", name: "Legado", status: "unrecognized", metrics: null }
];
const activeAlerts = [
  { id: "alert-a", assetId: "asset-a", severity: "critical", status: "active" },
  { id: "alert-warning", hostId: "asset-a", severity: "warning", status: "active" },
  { id: "alert-c", hostId: "asset-c", severity: "critical", status: "active" },
  { id: "alert-orphan", hostId: "removed", hostName: "Mesmo nome", severity: "critical", status: "active" }
];
const allAlerts = [
  ...activeAlerts,
  { id: "alert-old", hostId: "asset-b", severity: "critical", status: "resolved" }
];
const serviceOrders = [
  { id: "order-a", assetId: "asset-a", status: "open", slaDueAt: "2026-08-26T12:00:00.000Z" },
  { id: "order-b", assetId: "asset-b", status: "in_progress", slaDueAt: "2026-09-01T12:00:00.000Z" },
  { id: "order-c", assetId: "asset-c", status: "open", slaDueAt: "2026-09-01T12:00:00.000Z" },
  { id: "order-closed", assetId: "asset-a", status: "resolved_custom", slaDueAt: "2026-08-01T12:00:00.000Z", closedAt: "2026-08-02T12:00:00.000Z" },
  { id: "order-orphan", assetId: "removed", assetName: "Mesmo nome", status: "open" },
  { id: "order-unlinked", assetId: null, status: "open" }
];

const ids = (items) => items.map((item) => item.id);
const scopeFor = (filters) => buildDashboardAssetScope({ devices, activeAlerts, serviceOrders, settings }, filters, now);
function contextFor(filters, overrides = {}) {
  return withDashboardFilters({
    getDevices: async () => devices,
    getActiveAlerts: async () => activeAlerts,
    getAllAlerts: async () => allAlerts,
    getServiceOrders: async () => serviceOrders,
    getServiceOrderSettings: async () => settings,
    ...overrides
  }, normalizeDashboardFilters(filters));
}

test("filtros aceitam uma selecao por dimensao, aparando espacos sem alterar o original", () => {
  const original = { assetId: " asset-a ", assetStatus: "online", alertSeverity: "info", serviceOrderStatus: "open", overdue: false };
  const result = normalizeDashboardFilters(original);
  assert.deepEqual(result, { ...original, assetId: "asset-a" });
  assert.equal(original.assetId, " asset-a ");
  assert.deepEqual(normalizeDashboardFilters(), {});
  assert.deepEqual(normalizeDashboardFilters(null), {});
});

test("filtros rejeitam dimensoes desconhecidas, tipos errados, enums invalidos e valores excessivos", () => {
  for (const invalid of [
    [], "online", 1, true, new Date(), { unexpected: "x" }, { assetStatus: "Offline" },
    { assetStatus: "critical" }, { alertSeverity: "urgent" }, { assetId: [] },
    { assetId: " " }, { assetId: "x".repeat(201) }, { serviceOrderStatus: { id: "open" } },
    { serviceOrderStatus: "x".repeat(201) }, { assetId: "a\u0000b" }, { overdue: "true" }, { overdue: 1 },
    JSON.parse('{"__proto__":{"assetStatus":"online"}}')
  ]) {
    assert.throws(() => normalizeDashboardFilters(invalid), { statusCode: 400, code: "invalid_dashboard_filter" });
  }
});

test("status de OS e validado pelo ID configurado, nunca pelo rotulo ou lista fixa", () => {
  assert.doesNotThrow(() => validateDashboardOrderStatus({ serviceOrderStatus: "resolved_custom" }, settings));
  assert.throws(() => validateDashboardOrderStatus({ serviceOrderStatus: "Resolvida" }, settings), { statusCode: 400 });
  assert.throws(() => validateDashboardOrderStatus({ serviceOrderStatus: "closed" }, settings), { statusCode: 400 });
});

test("sem filtros as fontes e os contratos existentes permanecem intactos", async () => {
  const ctx = contextFor({});
  assert.equal(ctx.hasFilters, false);
  assert.strictEqual(await ctx.getDevices(), devices);
  assert.strictEqual(await ctx.getActiveAlerts(), activeAlerts);
  assert.strictEqual(await ctx.getAllAlerts(), allAlerts);
  assert.strictEqual(await ctx.getServiceOrders(), serviceOrders);
});

test("status de ativo restringe maquinas, alertas e OS por ID real", async () => {
  const ctx = contextFor({ assetStatus: "offline" });
  assert.deepEqual(ids(await ctx.getDevices()), ["asset-c"]);
  assert.deepEqual(ids(await ctx.getActiveAlerts()), ["alert-c"]);
  assert.deepEqual(ids(await ctx.getServiceOrders()), ["order-c"]);
  assert.deepEqual(ids(await contextFor({ assetStatus: "unknown" }).getDevices()), ["asset-e"]);
});

test("assetId ignora homonimos e restringe inclusive o historico de alertas", async () => {
  const ctx = contextFor({ assetId: "asset-b" });
  assert.deepEqual(ids(await ctx.getDevices()), ["asset-b"]);
  assert.deepEqual(ids(await ctx.getActiveAlerts()), []);
  assert.deepEqual(ids(await ctx.getAllAlerts()), ["alert-old"]);
  assert.deepEqual(ids(await ctx.getServiceOrders()), ["order-b"]);
});

test("severidade cruza apenas alertas ATIVOS com maquinas conhecidas e as respectivas OS", async () => {
  const ctx = contextFor({ alertSeverity: "critical" });
  assert.deepEqual(ids(await ctx.getDevices()), ["asset-a", "asset-c"]);
  assert.deepEqual(ids(await ctx.getServiceOrders()), ["order-a", "order-c", "order-closed"]);
  // An orphan may still be counted in its own fact chart but cannot identify a device.
  assert.deepEqual(ids(await ctx.getActiveAlerts()), ["alert-a", "alert-c", "alert-orphan"]);
  assert.deepEqual(ids(await ctx.getAllAlerts()), ["alert-a", "alert-c"]);
});

test("status de OS preserva OS sem ativo no proprio grafico, sem relaciona-las por nome", async () => {
  const ctx = contextFor({ serviceOrderStatus: "open" });
  assert.deepEqual(ids(await ctx.getDevices()), ["asset-a", "asset-c"]);
  assert.deepEqual(ids(await ctx.getServiceOrders()), ["order-a", "order-c", "order-orphan", "order-unlinked"]);
  assert.deepEqual(ids(await ctx.getActiveAlerts()), ["alert-a", "alert-warning", "alert-c"]);
});

test("dimensoes combinam AND: ativo online com alerta critico e OS aberta", async () => {
  const ctx = contextFor({ assetStatus: "online", alertSeverity: "critical", serviceOrderStatus: "open" });
  assert.deepEqual(ids(await ctx.getDevices()), ["asset-a"]);
  assert.deepEqual(ids(await ctx.getActiveAlerts()), ["alert-a"]);
  assert.deepEqual(ids(await ctx.getServiceOrders()), ["order-a"]);
  assert.deepEqual(ids(await contextFor({ assetId: "asset-b", alertSeverity: "critical" }).getDevices()), []);
});

test("overdue usa o mesmo SLA real do widget e exclui finais mesmo encerradas com atraso", () => {
  const filters = { overdue: true };
  const scope = scopeFor(filters);
  assert.deepEqual(ids(scope.devices), ["asset-a"]);
  assert.deepEqual(ids(filterDashboardServiceOrders(serviceOrders, filters, scope.assetIds, settings, now)), ["order-a"]);
  assert.deepEqual(ids(filterDashboardAlerts(activeAlerts, filters, scope.assetIds)), ["alert-a", "alert-warning"]);
  const notOverdue = { overdue: false };
  assert.deepEqual(ids(filterDashboardServiceOrders(serviceOrders, notOverdue, scopeFor(notOverdue).assetIds, settings, now)), [
    "order-b", "order-c", "order-closed", "order-orphan", "order-unlinked"
  ]);
});

test("assetId inexistente e intersecoes vazias retornam fontes vazias, sem voltar ao global", async () => {
  for (const filters of [{ assetId: "missing" }, { assetId: "asset-a", assetStatus: "offline" }]) {
    const ctx = contextFor(filters);
    assert.deepEqual(await ctx.getDevices(), []);
    assert.deepEqual(await ctx.getActiveAlerts(), []);
    assert.deepEqual(await ctx.getAllAlerts(), []);
    assert.deepEqual(await ctx.getServiceOrders(), []);
  }
});

test("contexto cruza somente as OS visiveis que a fonte autorizada retorna", async () => {
  const ctx = contextFor({ serviceOrderStatus: "open" }, { getServiceOrders: async () => [serviceOrders[2]] });
  assert.deepEqual(ids(await ctx.getDevices()), ["asset-c"]);
  assert.deepEqual(ids(await ctx.getActiveAlerts()), ["alert-c"]);
  assert.deepEqual(ids(await ctx.getServiceOrders()), ["order-c"]);
  const references = await ctx.getScopedEventReferences();
  assert.ok(!references.serviceOrderIds.has("order-a"));
});

test("selecao de status invalida falha isoladamente antes de calcular o widget", async () => {
  const ctx = contextFor({ serviceOrderStatus: "not_configured" });
  await assert.rejects(ctx.validateFilters(), { statusCode: 400 });
});

test("contexto memoiza calculos apenas nesta requisicao e nao altera as fontes", async () => {
  const before = JSON.stringify({ devices, activeAlerts, serviceOrders });
  const ctx = contextFor({ assetId: "asset-a" });
  assert.strictEqual(ctx.getDevices(), ctx.getDevices());
  assert.strictEqual(ctx.getActiveAlerts(), ctx.getActiveAlerts());
  assert.strictEqual(ctx.getServiceOrders(), ctx.getServiceOrders());
  assert.strictEqual(ctx.getScopedEventReferences(), ctx.getScopedEventReferences());
  await ctx.getScopedEventReferences();
  assert.equal(JSON.stringify({ devices, activeAlerts, serviceOrders }), before);
  assert.deepEqual(ids(await contextFor({ assetId: "asset-b" }).getDevices()), ["asset-b"]);
});

test("metricas fora da selecao nao consultam historico nem mostram valor de outro ativo", async () => {
  const ctx = contextFor({ assetStatus: "offline" });
  const history = await fetchMetricHistoryCpu({ assetId: "asset-a", period: "7d" }, ctx);
  assert.deepEqual(history, { metric: "cpu", assetId: "asset-a", period: "7d", points: [], summary: null, warnings: ["filtered_out"] });
  const gauge = await fetchMetricGaugeCpu({ assetId: "asset-a" }, ctx);
  assert.equal(gauge.available, false);
  assert.equal(gauge.value, null);
  assert.deepEqual(gauge.warnings, ["filtered_out"]);
});

test("eventos correlacionam metadados explicitos e rejeitam nomes iguais ou referencias contraditorias", () => {
  const result = filterDashboardEvents([
    { id: "direct", meta: { deviceId: "asset-a" } },
    { id: "order", meta: { serviceOrderId: "order-a" } },
    { id: "alert", meta: { alertId: "alert-a", hostId: "asset-a" } },
    { id: "contradictory", meta: { assetId: "asset-a", serviceOrderId: "hidden" } },
    { id: "same-name", message: "Mesmo nome", meta: {} },
    { id: "foreign", meta: { deviceId: "asset-b" } },
    { id: "no-meta" }
  ], { assetIds: new Set(["asset-a"]), alertIds: new Set(["alert-a"]), serviceOrderIds: new Set(["order-a"]) });
  assert.deepEqual(ids(result), ["direct", "order", "alert"]);
});

test("eventos filtram antes de limitar e informam a janela recente", async () => {
  const logs = [
    { id: "other", meta: { deviceId: "asset-b" } },
    { id: "match", meta: { serviceOrderId: "order-a" }, message: "OS atualizada" },
    { id: "unrelated", message: "Mesmo nome" }
  ];
  const result = await fetchRecentEvents({ limit: 1 }, contextFor({ assetId: "asset-a" }, { getRecentEventLogs: async () => logs }));
  assert.equal(result.total, 1);
  assert.deepEqual(ids(result.rows), ["match"]);
  assert.equal(result.filterScope, "asset");
  assert.equal(result.windowLimit, 500);
  assert.deepEqual(result.warnings, ["recent_window_only"]);
  const unfiltered = await fetchRecentEvents({ limit: 1 }, contextFor({}, { getRecentEventLogs: async () => logs }));
  assert.equal(unfiltered.total, 3);
  assert.equal(unfiltered.filterScope, undefined);
  assert.deepEqual(ids(unfiltered.rows), ["other"]);
});

test("scripts filtram a janela por IDs reais antes do limite e preservam o shape sem filtros", async () => {
  const logs = [
    { id: "other", assetId: "asset-b", scriptName: "Script" },
    { id: "hidden-order", assetId: "asset-a", serviceOrderId: "hidden" },
    { id: "matching", assetId: "asset-a", serviceOrderId: "order-a", scriptName: "Script" },
    { id: "unlinked", assetId: null, scriptName: "Mesmo nome" }
  ];
  let queriedLimit;
  const ctx = contextFor({ assetId: "asset-a" }, { getRecentScriptExecutionLogs: async (limit) => { queriedLimit = limit; return logs; } });
  const result = await fetchScriptExecutions({ limit: 1 }, ctx);
  assert.equal(queriedLimit, 500);
  assert.deepEqual(ids(result.rows), ["matching"]);
  assert.equal(result.filterScope, "asset");
  assert.deepEqual(result.warnings, ["recent_window_only"]);
  const plain = await fetchScriptExecutions({ limit: 1 }, contextFor({}, {
    getRecentScriptExecutionLogs: async (limit) => { queriedLimit = limit; return logs.slice(0, limit); }
  }));
  assert.equal(queriedLimit, 1);
  assert.equal(plain.filterScope, undefined);
  assert.deepEqual(ids(plain.rows), ["other"]);
});
