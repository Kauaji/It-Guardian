import assert from "node:assert/strict";
import test from "node:test";
import {
  agendaItemStatus,
  buildAgendaItems,
  buildAgendaPagination,
  buildManagementMachines,
  buildManagementMetadata,
  buildManagementPlan,
  emptyAutomationAgenda,
  emptyManagementView,
  filterAgendaItemsAfterLoad,
  filterManagementMachines,
  groupByPlanId,
  latestRunKey,
  normalizeAgendaFilters,
  summarizeAgenda
} from "./preventiveAutomationViews.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const plan = (overrides = {}) => ({
  id: "p1",
  name: "Plano um",
  active: true,
  scopeType: "all",
  assetIds: [],
  excludedAssetIds: [],
  defaultScriptIds: ["s1", "s-sem-resumo"],
  indicatorColor: "#111111",
  preventivePlanId: null,
  preventivePlanName: null,
  description: "",
  notes: "",
  ...overrides
});
const schedule = (assetId, overrides = {}) => ({
  planId: "p1",
  assetId,
  active: true,
  nextRunAt: "2026-06-16T11:00:00.000Z",
  recurrenceSource: "plan",
  recurrenceType: "weekly",
  recurrenceIntervalDays: 7,
  preferredTime: "08:00",
  timezone: "America/Sao_Paulo",
  lastPreparedAt: null,
  ...overrides
});

test("agrupa itens por plano e monta a chave de ultima execucao", () => {
  const grouped = groupByPlanId([{ planId: 1, v: "a" }, { planId: "1", v: "b" }, { planId: 2, v: "c" }]);
  assert.deepEqual(grouped.get("1").map((item) => item.v), ["a", "b"]);
  assert.equal(grouped.get("2").length, 1);
  assert.equal(latestRunKey(7, "asset"), "7:asset");
});

test("plano do gerenciamento conta maquinas, erros e agendas sem proxima execucao", () => {
  const runsByAsset = new Map([
    [latestRunKey("p1", "a1"), { status: "error", errorDetected: false, createdAt: "2026-06-01T00:00:00.000Z" }],
    [latestRunKey("p1", "a2"), { status: "success", errorDetected: true, createdAt: "2026-06-10T00:00:00.000Z" }],
    [latestRunKey("p1", "a3"), { status: "success", errorDetected: false, createdAt: "2026-06-05T00:00:00.000Z" }]
  ]);
  const built = buildManagementPlan({
    plan: plan({ excludedAssetIds: ["a-excluida"] }),
    overrides: [{ active: true }, { active: false }],
    schedules: [
      schedule("a1"),
      schedule("a2", { nextRunAt: null }),
      schedule("a3", { active: false }),
      schedule("a-excluida")
    ],
    runsByAsset,
    scriptsById: new Map([["s1", { id: "s1", name: "Script 1" }]])
  });

  assert.equal(built.assetSchedules.length, 3);
  assert.equal(built.assetCount, 2);
  assert.equal(built.scriptCount, 2);
  assert.deepEqual(built.scripts, [{ id: "s1", name: "Script 1" }]);
  assert.equal(built.overrideCount, 1);
  assert.equal(built.activeScheduleCount, 2);
  assert.equal(built.errorAssetCount, 2);
  assert.equal(built.withoutScheduleCount, 1);
  assert.equal(built.latestRun.createdAt, "2026-06-10T00:00:00.000Z");

  const paused = buildManagementPlan({ plan: plan({ active: false }), overrides: [], schedules: [schedule("a1")], runsByAsset: new Map(), scriptsById: new Map() });
  assert.equal(paused.activeScheduleCount, 0);
  assert.equal(paused.latestRun, null);
});

test("maquinas reunem planos, ignoram dispositivos ausentes e agendas desvinculadas", () => {
  const first = buildManagementPlan({
    plan: plan(),
    overrides: [{ assetId: "a1", active: true }],
    schedules: [schedule("a1"), schedule("sem-dispositivo")],
    runsByAsset: new Map(),
    scriptsById: new Map()
  });
  const second = buildManagementPlan({
    plan: plan({ id: "p2", name: "Plano dois", scopeType: "asset_list", assetIds: ["a1"] }),
    overrides: [],
    schedules: [schedule("a1", { planId: "p2", active: false }), schedule("a9", { planId: "p2" })],
    runsByAsset: new Map(),
    scriptsById: new Map()
  });
  const devicesById = new Map([
    ["a1", { id: "a1", name: "NB-01", assetType: "notebook", segmentId: "seg", segmentName: "Seg", segmentGroupId: "g1", hardware: { os: "Win", loggedUser: "ana" }, status: "online" }],
    ["a9", { id: "a9", type: "desktop" }]
  ]);

  const machines = buildManagementMachines({
    plans: [first, second],
    schedules: [...first.assetSchedules, ...second.assetSchedules],
    devicesById,
    groupsById: new Map([["g1", "Grupo 1"]]),
    runsByAsset: new Map()
  });

  assert.equal(machines.length, 1, "a9 nao esta na lista explicita do plano dois");
  const machine = machines[0];
  assert.equal(machine.assetName, "NB-01");
  assert.equal(machine.groupName, "Grupo 1");
  assert.equal(machine.operatingSystem, "Win");
  assert.equal(machine.plans.length, 2);
  assert.equal(machine.plans[0].hasCustomOverride, true);
  assert.equal(machine.plans[1].active, false);
  assert.equal(machine.plans[1].scheduleActive, false);

  const fallback = buildManagementMachines({
    plans: [first],
    schedules: [schedule("a9")],
    devicesById: new Map([["a9", { id: "a9", type: "desktop" }]]),
    groupsById: new Map(),
    runsByAsset: new Map()
  });
  assert.equal(fallback[0].assetName, "a9");
  assert.equal(fallback[0].assetType, "desktop");
  assert.equal(fallback[0].segmentName, "Nao organizadas");
  assert.equal(fallback[0].groupName, "Sem grupo");
  assert.equal(fallback[0].status, "");
});

test("filtros de maquinas combinam busca, segmento, grupo e situacao", () => {
  const machines = [
    { assetName: "NB-01", segmentName: "Diretoria", groupName: "Matriz", segmentId: "s1", groupId: "g1", plans: [{ name: "Limpeza", active: true, nextRunAt: "x" }] },
    { assetName: "SRV-02", segmentName: "Servidores", groupName: "Infra", segmentId: "s2", groupId: "g2", plans: [{ name: "Banco", active: false, nextRunAt: null, latestRun: { status: "error" } }] },
    { assetName: "PC-03", segmentName: "Diretoria", groupName: "Matriz", segmentId: "s1", groupId: "g1", plans: [{ name: "Disco", active: true, nextRunAt: "x", latestRun: { errorDetected: true } }] }
  ];
  const names = (options) => filterManagementMachines(machines, options).map((machine) => machine.assetName);

  assert.deepEqual(names({}), ["NB-01", "SRV-02", "PC-03"]);
  assert.deepEqual(names({ search: "banco" }), ["SRV-02"]);
  assert.deepEqual(names({ search: " DIRETORIA " }), ["NB-01", "PC-03"]);
  assert.deepEqual(names({ segmentId: "s2" }), ["SRV-02"]);
  assert.deepEqual(names({ groupId: "g1" }), ["NB-01", "PC-03"]);
  assert.deepEqual(names({ status: "error" }), ["SRV-02", "PC-03"]);
  assert.deepEqual(names({ status: "without_schedule" }), ["SRV-02"]);
  assert.deepEqual(names({ status: "active" }), ["NB-01", "PC-03"]);
  assert.deepEqual(names({ status: "inactive" }), ["SRV-02"]);
  assert.deepEqual(names({ status: "qualquer" }), ["NB-01", "SRV-02", "PC-03"]);
  assert.deepEqual(names({ status: "active", groupId: "g1", search: "disco" }), ["PC-03"]);
});

test("metadados somam os contadores dos planos e a visao vazia tem formato estavel", () => {
  const plans = [
    { active: true, activeScheduleCount: 2, errorAssetCount: 1, withoutScheduleCount: 0 },
    { active: false, activeScheduleCount: 0, errorAssetCount: 0, withoutScheduleCount: 3 }
  ];
  assert.deepEqual(buildManagementMetadata(plans, [{}, {}, {}]), {
    planCount: 2,
    activePlanCount: 1,
    inactivePlanCount: 1,
    machineCount: 3,
    activeScheduleCount: 2,
    errorCount: 1,
    withoutScheduleCount: 3
  });
  assert.deepEqual(emptyManagementView(), { plans: [], machines: [], metadata: { planCount: 0, machineCount: 0 } });
});

test("filtros da agenda normalizam datas, situacao e paginacao", () => {
  assert.deepEqual(normalizeAgendaFilters(), {
    startDate: null,
    endDate: null,
    status: "all",
    planId: null,
    assetId: null,
    segmentId: null,
    limit: 200,
    offset: 0
  });

  const normalized = normalizeAgendaFilters({
    startDate: "2026-06-01T00:00:00-03:00",
    endDate: "invalida",
    status: " OVERDUE ",
    planId: " p1 ",
    assetId: "a1",
    segmentId: "s1",
    limit: "9999",
    offset: "5"
  });
  assert.equal(normalized.startDate, "2026-06-01T03:00:00.000Z");
  assert.equal(normalized.endDate, null);
  assert.equal(normalized.status, "overdue");
  assert.equal(normalized.planId, "p1");
  assert.equal(normalized.limit, 500);
  assert.equal(normalized.offset, 5);
  assert.equal(normalizeAgendaFilters({ status: "desconhecido" }).status, "all");
});

test("situacao do item da agenda segue pausa, erro, falta de data e atraso", () => {
  const base = { planActive: true, scheduleActive: true, nextRunAt: "2026-06-20T00:00:00.000Z", latestRun: null };
  assert.equal(agendaItemStatus({ ...base, planActive: false }, NOW), "paused");
  assert.equal(agendaItemStatus({ ...base, scheduleActive: false }, NOW), "paused");
  assert.equal(agendaItemStatus({ ...base, latestRun: { errorDetected: true } }, NOW), "error");
  assert.equal(agendaItemStatus({ ...base, latestRun: { status: "ERROR" } }, NOW), "error");
  assert.equal(agendaItemStatus({ ...base, nextRunAt: null }, NOW), "without_schedule");
  assert.equal(agendaItemStatus({ ...base, nextRunAt: "2026-06-01T00:00:00.000Z" }, NOW), "overdue");
  assert.equal(agendaItemStatus(base, NOW), "scheduled");
});

test("itens da agenda cruzam dispositivo e ultima execucao; filtros locais e resumo", () => {
  const rows = [
    { planId: "p1", planName: "Plano um", assetId: "a1", indicatorColor: "#ABCDEF", nextRunAt: new Date("2026-06-15T12:01:00.000Z"), recurrenceType: "weekly", recurrenceInterval: 7, recurrenceSource: "machine", planActive: true, scheduleActive: true, lastPreparedAt: null },
    { planId: "p1", planName: "Plano um", assetId: "a2", indicatorColor: "invalida", nextRunAt: "2026-06-10T00:00:00.000Z", recurrenceType: "daily", recurrenceInterval: null, recurrenceSource: null, planActive: true, scheduleActive: true, lastPreparedAt: "2026-06-01T00:00:00.000Z" },
    { planId: "p1", planName: "Plano um", assetId: "a3", indicatorColor: "#111111", nextRunAt: null, recurrenceType: "daily", recurrenceInterval: 1, planActive: true, scheduleActive: true },
    { planId: "p1", planName: "Plano um", assetId: "a4", indicatorColor: "#111111", nextRunAt: "2026-06-17T00:00:00.000Z", recurrenceType: "daily", recurrenceInterval: 1, planActive: true, scheduleActive: true }
  ];
  const devicesById = new Map([["a1", { id: "a1", name: "NB-01", assetType: "notebook", segmentId: "s1", segmentName: "Diretoria", segmentGroupId: "g1" }]]);
  const latestRunsByAsset = new Map([[latestRunKey("p1", "a4"), { status: "error", errorDetected: true }]]);

  const items = buildAgendaItems({ rows, devicesById, latestRunsByAsset, now: NOW });
  assert.equal(items[0].assetName, "NB-01");
  assert.equal(items[0].indicatorColor, "#abcdef");
  assert.equal(items[0].scheduledFor, "2026-06-15T12:01:00.000Z");
  assert.equal(items[0].recurrenceIntervalDays, 7);
  assert.equal(items[0].recurrenceSource, "machine");
  assert.equal(items[0].status, "scheduled");
  assert.equal(items[1].assetName, "a2");
  assert.equal(items[1].segmentName, "Não organizadas");
  assert.equal(items[1].indicatorColor, "#1f7a61");
  assert.equal(items[1].recurrenceIntervalDays, 0);
  assert.equal(items[1].recurrenceSource, "plan");
  assert.equal(items[1].status, "overdue");
  assert.equal(items[2].status, "without_schedule");
  assert.equal(items[3].status, "error");
  assert.equal(items[3].latestRun.status, "error");

  assert.equal(filterAgendaItemsAfterLoad(items, { segmentId: null, status: "all" }).length, 4);
  assert.deepEqual(filterAgendaItemsAfterLoad(items, { segmentId: "s1", status: "all" }).map((item) => item.assetId), ["a1"]);
  assert.deepEqual(filterAgendaItemsAfterLoad(items, { segmentId: null, status: "error" }).map((item) => item.assetId), ["a4"]);

  assert.deepEqual(summarizeAgenda(items, NOW), { today: 1, nextSevenDays: 2, overdue: 1, withoutSchedule: 1, errors: 1 });
});

test("paginacao da agenda usa o total do banco, exceto com filtros locais", () => {
  const items = [{}, {}, {}];
  assert.deepEqual(buildAgendaPagination({ normalized: { status: "all", segmentId: null, limit: 3, offset: 0 }, items, pageRowCount: 3, totalCount: 10 }), {
    limit: 3,
    offset: 0,
    total: 10,
    hasMore: true
  });
  assert.deepEqual(buildAgendaPagination({ normalized: { status: "all", segmentId: null, limit: 3, offset: 9 }, items, pageRowCount: 1, totalCount: 10 }), {
    limit: 3,
    offset: 9,
    total: 10,
    hasMore: false
  });
  assert.deepEqual(buildAgendaPagination({ normalized: { status: "error", segmentId: null, limit: 3, offset: 0 }, items, pageRowCount: 3, totalCount: 10 }), {
    limit: 3,
    offset: 0,
    total: 3,
    hasMore: false
  });
  assert.equal(buildAgendaPagination({ normalized: { status: "all", segmentId: "s1", limit: 1, offset: 0 }, items: [], pageRowCount: 0, totalCount: 0 }).total, 0);

  assert.deepEqual(emptyAutomationAgenda({ limit: 5, offset: 10 }), {
    items: [],
    summary: { today: 0, nextSevenDays: 0, overdue: 0, withoutSchedule: 0, errors: 0 },
    pagination: { limit: 5, offset: 10, total: 0, hasMore: false }
  });
});
