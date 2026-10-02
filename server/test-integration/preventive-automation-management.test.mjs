import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

const database = await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.ENABLE_REMOTE_SCRIPT_EXECUTION = "true";
process.env.JWT_SECRET = "preventive-management-integration-secret-32-chars";
process.env.NODE_ENV = "test";

const fx = await import("../test-support/preventiveFixtures.mjs");
const { closeDatabase } = await import("../src/database.js");

const base = fx.automationPath;
let api;
let scripts;
let closeServer;
let plans;

const past = () => new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();

async function insertRun(planId, assetId, { status = "success", errorDetected = false, createdAt = new Date().toISOString() } = {}) {
  await fx.rows(
    `
      INSERT INTO preventive_automation_runs (
        id, plan_id, asset_id, status, scheduled_for, error_detected, result, log_summary, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'resultado', 'resumo', $7)
    `,
    [randomUUID(), planId, assetId, status, createdAt, errorDetected, createdAt]
  );
}

async function create(payload) {
  const response = await api.post(base, { defaultScriptIds: [scripts.first.id], ...payload });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body.preventiveAutomationPlan;
}

test.before(async () => {
  const holder = { after: (callback) => { closeServer = callback; } };
  const baseUrl = await fx.startServer(holder);
  api = fx.createClient(baseUrl, await fx.login(baseUrl));
  scripts = {
    first: await fx.createScript("Script de gerenciamento um"),
    second: await fx.createScript("Script de gerenciamento dois", { category: "Disco" })
  };
  for (const machineId of ["gm-a1", "gm-a2", "gm-a3"]) await fx.enrollAgentAsset(baseUrl, machineId);
  await fx.assignSegment("gm-a1", "demo-segment-servers");
  await fx.assignSegment("gm-a2", "demo-segment-workstations");
  await fx.assignSegment("gm-a3", "demo-segment-workstations");

  plans = {
    list: await create({
      name: "Rotina semanal de servidores",
      scopeType: "asset_list",
      assetIds: ["gm-a1", "gm-a2"],
      recurrenceType: "weekly",
      defaultScriptIds: [scripts.first.id, scripts.second.id],
      indicatorColor: "#aa3300"
    }),
    segment: await create({
      name: "Limpeza diaria das estacoes",
      scopeType: "segment",
      scopeId: "demo-segment-workstations",
      recurrenceType: "daily",
      indicatorColor: "#0055cc"
    }),
    paused: await create({
      name: "Rotina pausada",
      scopeType: "asset",
      scopeId: "gm-a3",
      indicatorColor: "#00aa55"
    })
  };
  const paused = await api.post(`${base}/${plans.paused.id}/disable`);
  assert.equal(paused.status, 200);
});

test.after(async () => {
  if (closeServer) await closeServer();
  await closeDatabase();
});

function machineIds(body) {
  return body.machines.map((machine) => machine.assetId).sort();
}

test("gerenciamento agrupa varios planos por maquina e entrega metadados em lote", async () => {
  const response = await api.get(`${base}/management`);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const { plans: listed, machines, metadata, pagination } = response.body;

  assert.deepEqual(machineIds(response.body), ["gm-a1", "gm-a2", "gm-a3"]);
  assert.equal(listed.length, 3);
  assert.deepEqual(metadata, {
    planCount: 3,
    activePlanCount: 2,
    inactivePlanCount: 1,
    machineCount: 3,
    activeScheduleCount: 4,
    errorCount: 0,
    withoutScheduleCount: 0
  });
  assert.deepEqual(pagination, { limit: 100, offset: 0, total: 3, hasMore: false });

  const a2 = machines.find((machine) => machine.assetId === "gm-a2");
  assert.equal(a2.plans.length, 2, "uma maquina com varios planos aparece uma unica vez");
  assert.equal(a2.segmentId, "demo-segment-workstations");
  assert.equal(a2.segmentName, "Estações administrativas");
  assert.equal(a2.groupId, "demo-group-workstations");
  assert.equal(a2.groupName, "Estações e Atendimento");
  assert.equal(a2.assetName, "GM-A2");
  assert.equal(a2.status, "online");
  assert.deepEqual(a2.plans.map((plan) => plan.name).sort(), ["Limpeza diaria das estacoes", "Rotina semanal de servidores"]);

  const a3 = machines.find((machine) => machine.assetId === "gm-a3");
  const pausedPlan = a3.plans.find((plan) => plan.name === "Rotina pausada");
  assert.equal(pausedPlan.active, false);
  assert.equal(pausedPlan.planActive, false);
  assert.equal(pausedPlan.scheduleActive, false);

  const listPlan = listed.find((plan) => plan.id === plans.list.id);
  assert.equal(listPlan.assetCount, 2);
  assert.equal(listPlan.scriptCount, 2);
  assert.deepEqual(listPlan.scripts.map((script) => script.name).sort(), [
    "Script de gerenciamento dois",
    "Script de gerenciamento um"
  ]);
  assert.equal(listPlan.scripts.find((script) => script.name.endsWith("dois")).category, "Disco");
  assert.equal(listPlan.activeScheduleCount, 2);
  assert.equal(listPlan.overrideCount, 0);
});

test("gerenciamento filtra por busca, segmento, grupo e situacao", async () => {
  const byName = await api.get(`${base}/management?search=SEMANAL`);
  assert.deepEqual(machineIds(byName.body), ["gm-a1", "gm-a2"]);

  const byMachine = await api.get(`${base}/management?search=gm-a3`);
  assert.deepEqual(machineIds(byMachine.body), ["gm-a3"]);

  const bySegmentName = await api.get(`${base}/management?search=administrativas`);
  assert.deepEqual(machineIds(bySegmentName.body), ["gm-a2", "gm-a3"]);

  const byPlanWord = await api.get(`${base}/management?search=servidores`);
  assert.deepEqual(machineIds(byPlanWord.body), ["gm-a1", "gm-a2"], "a busca tambem olha o nome dos planos");

  const byGroupName = await api.get(`${base}/management?search=infraestrutura`);
  assert.deepEqual(machineIds(byGroupName.body), ["gm-a1"]);

  const bySegment = await api.get(`${base}/management?segmentId=demo-segment-workstations`);
  assert.deepEqual(machineIds(bySegment.body), ["gm-a2", "gm-a3"]);

  const byGroup = await api.get(`${base}/management?groupId=demo-group-infra`);
  assert.deepEqual(machineIds(byGroup.body), ["gm-a1"]);

  const inactive = await api.get(`${base}/management?status=inactive`);
  assert.deepEqual(machineIds(inactive.body), ["gm-a3"]);

  const active = await api.get(`${base}/management?status=active`);
  assert.deepEqual(machineIds(active.body), ["gm-a1", "gm-a2", "gm-a3"], "gm-a3 ainda tem um plano ativo");

  const nothing = await api.get(`${base}/management?search=nao-existe-nenhuma`);
  assert.deepEqual(nothing.body.machines, []);
  assert.equal(nothing.body.plans.length, 3, "o filtro vale apenas para a lista de maquinas");
});

test("gerenciamento destaca erro da ultima execucao e agendas sem proxima data", async () => {
  await insertRun(plans.segment.id, "gm-a3", { status: "success", createdAt: past() });
  await insertRun(plans.segment.id, "gm-a3", { status: "error", errorDetected: true });
  await insertRun(plans.list.id, "gm-a1", { status: "success" });

  const errors = await api.get(`${base}/management?status=error`);
  assert.deepEqual(machineIds(errors.body), ["gm-a3"]);
  assert.equal(errors.body.metadata.errorCount, 1);
  const segmentPlan = errors.body.plans.find((plan) => plan.id === plans.segment.id);
  assert.equal(segmentPlan.errorAssetCount, 1);
  assert.equal(segmentPlan.latestRun.status, "error", "a execucao mais recente por plano/maquina vence");
  assert.equal(segmentPlan.latestRun.errorDetected, true);

  const machine = errors.body.machines[0];
  const machinePlan = machine.plans.find((plan) => plan.id === plans.segment.id);
  assert.equal(machinePlan.latestRun.status, "error");

  await fx.rows(
    "UPDATE preventive_automation_asset_schedules SET next_run_at = NULL WHERE plan_id = $1 AND asset_id = $2",
    [plans.list.id, "gm-a1"]
  );
  const without = await api.get(`${base}/management?status=without_schedule`);
  assert.deepEqual(machineIds(without.body), ["gm-a1"]);
  assert.equal(without.body.metadata.withoutScheduleCount, 1);
  const listPlan = without.body.plans.find((plan) => plan.id === plans.list.id);
  assert.equal(listPlan.withoutScheduleCount, 1);
});

test("gerenciamento pagina planos e devolve resposta vazia fora do intervalo", async () => {
  const first = await api.get(`${base}/management?limit=1&offset=0`);
  assert.equal(first.body.plans.length, 1);
  assert.deepEqual(first.body.pagination, { limit: 1, offset: 0, total: 3, hasMore: true });

  const last = await api.get(`${base}/management?limit=1&offset=2`);
  assert.equal(last.body.pagination.hasMore, false);

  const beyond = await api.get(`${base}/management?limit=5&offset=50`);
  assert.deepEqual(beyond.body, { plans: [], machines: [], metadata: { planCount: 0, machineCount: 0 } });
});

test("agenda lista compromissos com situacao, filtros e paginacao", async () => {
  // estado herdado do teste anterior: gm-a1/lista sem proxima data e gm-a3/segmento com erro.
  await fx.setScheduleNextRun(plans.segment.id, "gm-a2", past());

  const all = await api.get(`${base}/agenda`);
  assert.equal(all.status, 200, JSON.stringify(all.body));
  assert.equal(all.body.pagination.limit, 200);
  assert.equal(all.body.pagination.total, all.body.items.length);
  const byKey = Object.fromEntries(all.body.items.map((item) => [`${item.planId}:${item.assetId}`, item]));

  assert.equal(byKey[`${plans.list.id}:gm-a1`].status, "without_schedule");
  assert.equal(byKey[`${plans.list.id}:gm-a1`].scheduledFor, null);
  assert.equal(byKey[`${plans.segment.id}:gm-a2`].status, "overdue");
  assert.equal(byKey[`${plans.segment.id}:gm-a3`].status, "error");
  assert.equal(byKey[`${plans.paused.id}:gm-a3`].status, "paused");
  assert.equal(byKey[`${plans.list.id}:gm-a2`].status, "scheduled");
  assert.equal(byKey[`${plans.list.id}:gm-a2`].segmentName, "Estações administrativas");
  assert.equal(byKey[`${plans.list.id}:gm-a2`].indicatorColor, "#aa3300");
  assert.equal(byKey[`${plans.list.id}:gm-a2`].assetName, "GM-A2");
  assert.equal(byKey[`${plans.list.id}:gm-a2`].recurrenceType, "weekly");
  assert.equal(byKey[`${plans.list.id}:gm-a2`].recurrenceIntervalDays, 7);
  assert.equal(byKey[`${plans.list.id}:gm-a2`].recurrenceSource, "plan");
  assert.equal(byKey[`${plans.segment.id}:gm-a3`].latestRun.status, "error");

  // Ordenacao: data crescente, itens sem data por ultimo.
  const dates = all.body.items.map((item) => item.nextRunAt);
  const nullIndex = dates.indexOf(null);
  assert.ok(nullIndex === -1 || dates.slice(nullIndex).every((value) => value === null));
  const concrete = dates.filter(Boolean);
  assert.deepEqual(concrete, [...concrete].sort());

  assert.equal(all.body.summary.overdue, 1);
  assert.equal(all.body.summary.withoutSchedule, 1);
  assert.equal(all.body.summary.errors, 1);
  assert.ok(all.body.summary.nextSevenDays >= 1);

  const byPlan = await api.get(`${base}/agenda?planId=${plans.list.id}`);
  assert.deepEqual(byPlan.body.items.map((item) => item.assetId).sort(), ["gm-a1", "gm-a2"]);

  const byAsset = await api.get(`${base}/agenda?assetId=gm-a3`);
  assert.deepEqual(byAsset.body.items.map((item) => item.planId).sort(), [plans.segment.id, plans.paused.id].sort());

  const overdue = await api.get(`${base}/agenda?status=overdue`);
  assert.deepEqual(overdue.body.items.map((item) => item.assetId), ["gm-a2"]);
  assert.equal(overdue.body.pagination.total, 1);

  const active = await api.get(`${base}/agenda?status=active`);
  assert.ok(active.body.items.every((item) => item.status !== "paused"));
  assert.ok(!active.body.items.some((item) => item.planId === plans.paused.id));

  const withoutSchedule = await api.get(`${base}/agenda?status=without_schedule`);
  assert.deepEqual(withoutSchedule.body.items.map((item) => item.assetId), ["gm-a1"]);

  const errors = await api.get(`${base}/agenda?status=error`);
  assert.deepEqual(errors.body.items.map((item) => item.assetId), ["gm-a3"]);
  assert.equal(errors.body.pagination.total, 1);
  assert.equal(errors.body.pagination.hasMore, false);

  const bySegment = await api.get(`${base}/agenda?segmentId=demo-segment-servers`);
  assert.deepEqual(bySegment.body.items.map((item) => item.assetId), ["gm-a1"]);
  assert.equal(bySegment.body.pagination.total, 1);

  const invalidStatus = await api.get(`${base}/agenda?status=qualquer-coisa`);
  assert.equal(invalidStatus.body.items.length, all.body.items.length, "situacao desconhecida vira all");

  const startDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const endDate = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const window = await api.get(`${base}/agenda?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
  assert.ok(window.body.items.every((item) => item.nextRunAt >= startDate && item.nextRunAt <= endDate));
  assert.ok(!window.body.items.some((item) => item.assetId === "gm-a2" && item.planId === plans.segment.id));

  const firstPage = await api.get(`${base}/agenda?limit=2&offset=0`);
  const secondPage = await api.get(`${base}/agenda?limit=2&offset=2`);
  assert.equal(firstPage.body.items.length, 2);
  assert.equal(firstPage.body.pagination.hasMore, true);
  assert.equal(firstPage.body.pagination.total, all.body.items.length);
  const pagedKeys = [...firstPage.body.items, ...secondPage.body.items].map((item) => `${item.planId}:${item.assetId}`);
  assert.equal(new Set(pagedKeys).size, pagedKeys.length, "paginas nao repetem itens");

  const unknownPlan = await api.get(`${base}/agenda?planId=plano-inexistente`);
  assert.deepEqual(unknownPlan.body.items, []);
  assert.equal(unknownPlan.body.pagination.total, 0);
  assert.deepEqual(unknownPlan.body.summary, { today: 0, nextSevenDays: 0, overdue: 0, withoutSchedule: 0, errors: 0 });
});

test("detalhe da maquina no plano traz agenda, override e historico direcionado", async () => {
  const response = await api.get(`${base}/${plans.list.id}/assets/gm-a2`);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const detail = response.body.automationAsset;
  assert.equal(detail.plan.id, plans.list.id);
  assert.equal(detail.machine.assetId, "gm-a2");
  assert.equal(detail.machine.assetName, "GM-A2");
  assert.equal(detail.machine.segmentId, "demo-segment-workstations");
  assert.equal(detail.machine.groupId, "demo-group-workstations");
  assert.equal(detail.machine.plans.length, 1);
  assert.equal(detail.schedule.planName, "Rotina semanal de servidores");
  assert.equal(detail.schedule.recurrenceSource, "plan");
  assert.equal(detail.override, null);
  assert.ok(Array.isArray(detail.history));
  assert.ok(detail.history.some((item) => item.eventType === "preventive_automation_created"));
  assert.ok(detail.history.every((item) => item.eventType.startsWith("preventive_automation")));

  const withRun = await api.get(`${base}/${plans.segment.id}/assets/gm-a3`);
  assert.equal(withRun.body.automationAsset.schedule.latestRun.status, "error");

  assert.equal((await api.get(`${base}/${plans.list.id}/assets/gm-a3`)).status, 404, "maquina fora do plano");
  assert.equal((await api.get(`${base}/${plans.list.id}/assets/fantasma`)).status, 404);
  assert.equal((await api.get(`${base}/plano-inexistente/assets/gm-a1`)).status, 404);
  assert.equal((await api.get(`${base}/${plans.paused.id}/assets/gm-a3`)).status, 404, "agenda pausada nao aparece no detalhe");
});

test("override individual cria, substitui e remove a recorrencia da maquina", async () => {
  const url = `${base}/${plans.list.id}/assets/gm-a2/override`;

  const created = await api.put(url, { recurrenceType: "custom_days", recurrenceIntervalDays: 4, preferredTime: "09:45" });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const detail = created.body.automationAsset;
  assert.equal(detail.override.targetKey, "asset:gm-a2");
  assert.equal(detail.override.recurrenceIntervalDays, 4);
  assert.equal(detail.override.preferredTime, "09:45");
  assert.equal(detail.schedule.recurrenceSource, "machine");
  assert.equal(detail.schedule.recurrenceType, "custom_days");
  assert.equal(detail.schedule.preferredTime, "09:45");
  assert.ok(detail.history.some((item) => item.eventType === "preventive_automation_asset_override_updated"));

  const replaced = await api.put(url, { recurrenceType: "daily" });
  assert.equal(replaced.status, 200);
  assert.equal(replaced.body.automationAsset.override.recurrenceType, "daily");
  assert.equal(replaced.body.automationAsset.override.preferredTime, null);
  const stored = await fx.rows(
    "SELECT COUNT(*)::int AS total FROM preventive_automation_overrides WHERE plan_id = $1 AND target_key = 'asset:gm-a2'",
    [plans.list.id]
  );
  assert.equal(stored[0].total, 1, "chave unica plan_id + target_key");

  const other = await api.get(`${base}/${plans.list.id}/assets/gm-a1`);
  assert.equal(other.body.automationAsset.schedule.recurrenceSource, "plan", "outras maquinas nao mudam");

  const invalid = await api.put(url, { recurrenceType: "custom_days" });
  assert.equal(invalid.status, 400);
  assert.match(invalid.body.message, /quantidade de dias/);

  const outsider = await api.put(`${base}/${plans.list.id}/assets/gm-a3/override`, { recurrenceType: "daily" });
  assert.equal(outsider.status, 404);
  assert.match(outsider.body.message, /não pertence|nao pertence/i);
  assert.equal((await api.put(`${base}/plano-inexistente/assets/gm-a2/override`, { recurrenceType: "daily" })).status, 404);

  const removed = await api.del(url);
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.equal(removed.body.automationAsset.override, null);
  assert.equal(removed.body.automationAsset.schedule.recurrenceSource, "plan");
  assert.equal(removed.body.automationAsset.schedule.recurrenceType, "weekly");
  assert.ok(removed.body.automationAsset.history.some((item) => item.eventType === "preventive_automation_asset_override_removed"));

  const audit = await fx.rows(
    "SELECT type FROM audit_logs WHERE meta->>'planId' = $1 ORDER BY created_at ASC",
    [plans.list.id]
  );
  const types = audit.map((row) => row.type);
  assert.ok(types.includes("preventive_automation_asset_override_updated"));
  assert.ok(types.includes("preventive_automation_asset_override_removed"));

  assert.equal((await api.del(`${base}/plano-inexistente/assets/gm-a2/override`)).status, 404);
});

test("remover maquina de plano asset_list reduz a lista e desativa somente a agenda dela", async () => {
  const plan = await create({
    name: "Plano para remover maquinas",
    scopeType: "asset_list",
    assetIds: ["gm-a1", "gm-a2"],
    indicatorColor: "#7a1f61",
    overrides: [{ assetId: "gm-a1", recurrenceType: "weekly" }]
  });
  await insertRun(plan.id, "gm-a1", { status: "success" });

  const removed = await api.del(`${base}/${plan.id}/assets/gm-a1`);
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.deepEqual(removed.body, { planId: plan.id, assetId: "gm-a1", remainingAssetCount: 1, planActive: true });

  const detail = (await api.get(`${base}/${plan.id}`)).body.preventiveAutomationPlan;
  assert.deepEqual(detail.assetIds, ["gm-a2"]);
  assert.equal(detail.active, true);
  assert.equal(detail.overrides.length, 0, "override da maquina removida some");
  const schedules = Object.fromEntries(detail.assetSchedules.map((schedule) => [schedule.assetId, schedule]));
  assert.equal(schedules["gm-a1"].active, false);
  assert.equal(schedules["gm-a2"].active, true);

  const runs = await fx.rows("SELECT id FROM preventive_automation_runs WHERE plan_id = $1", [plan.id]);
  assert.equal(runs.length, 1, "runs preservados");
  const history = await fx.rows(
    "SELECT message FROM asset_history WHERE asset_id = 'gm-a1' AND event_type = 'preventive_automation_removed_from_asset'"
  );
  assert.equal(history.length, 1);

  assert.equal((await api.del(`${base}/${plan.id}/assets/gm-a1`)).status, 404, "agenda ja desativada");
  assert.equal((await api.get(`${base}/${plan.id}/assets/gm-a1`)).status, 404);

  const last = await api.del(`${base}/${plan.id}/assets/gm-a2`);
  assert.deepEqual(last.body, { planId: plan.id, assetId: "gm-a2", remainingAssetCount: 0, planActive: false });
  const afterLast = (await api.get(`${base}/${plan.id}`)).body.preventiveAutomationPlan;
  assert.equal(afterLast.active, false, "sem maquinas o plano e desativado");

  assert.equal((await api.del(`${base}/plano-inexistente/assets/gm-a1`)).status, 404);
  await api.del(`${base}/${plan.id}`);
});

test("remover maquina de escopo amplo adiciona a lista de exclusoes", async () => {
  const plan = await create({
    name: "Plano de segmento com exclusao",
    scopeType: "segment",
    scopeId: "demo-segment-workstations",
    indicatorColor: "#1a2b3c",
    overrides: [{ assetId: "gm-a2", recurrenceType: "weekly" }]
  });
  assert.deepEqual(plan.assetSchedules.map((schedule) => schedule.assetId).sort(), ["gm-a2", "gm-a3"]);

  const removed = await api.del(`${base}/${plan.id}/assets/gm-a2`);
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.equal(removed.body.remainingAssetCount, 1);
  assert.equal(removed.body.planActive, true);

  const detail = (await api.get(`${base}/${plan.id}`)).body.preventiveAutomationPlan;
  assert.deepEqual(detail.excludedAssetIds, ["gm-a2"]);
  assert.deepEqual(detail.assetIds, []);

  const management = await api.get(`${base}/management`);
  const machineOfPlan = management.body.machines.filter((machine) => machine.plans.some((item) => item.id === plan.id));
  assert.deepEqual(machineOfPlan.map((machine) => machine.assetId), ["gm-a3"], "exclusao individual some do gerenciamento");

  await api.del(`${base}/${plan.id}`);
});

// pg-mem nao suporta `= ANY($1)` com parametro de lista (devolve sempre zero
// linhas); a consulta so e verificavel no PostgreSQL real.
test("indicadores por maquina listam apenas agendas e planos ativos", {
  skip: database.mode !== "postgres" && "requer PostgreSQL real (ANY com array)"
}, async () => {
  const { listAutomationIndicatorsByAssetIds } = await import("../src/repositories/automationIndicatorRepository.js");
  assert.equal((await listAutomationIndicatorsByAssetIds([])).size, 0);
  assert.equal((await listAutomationIndicatorsByAssetIds(null)).size, 0);

  const indicators = await listAutomationIndicatorsByAssetIds(["gm-a2", " gm-a3 ", "gm-a2", "gm-a1"]);
  const a2 = indicators.get("gm-a2");
  assert.deepEqual(a2.map((item) => item.planName).sort(), ["Limpeza diaria das estacoes", "Rotina semanal de servidores"]);
  const weekly = a2.find((item) => item.planName === "Rotina semanal de servidores");
  assert.equal(weekly.indicatorColor, "#aa3300");
  assert.equal(weekly.recurrenceType, "weekly");
  assert.equal(weekly.recurrenceIntervalDays, 7);
  assert.equal(weekly.scriptCount, 2);
  assert.equal(weekly.active, true);
  assert.equal(weekly.automationPlanId, plans.list.id);
  assert.equal(weekly.preventivePlanId, null);
  assert.ok(weekly.nextRunAt);

  assert.deepEqual(
    indicators.get("gm-a3").map((item) => item.planName),
    ["Limpeza diaria das estacoes"],
    "plano pausado nao gera indicador"
  );
});
