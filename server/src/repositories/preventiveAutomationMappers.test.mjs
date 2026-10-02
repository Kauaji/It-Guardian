import assert from "node:assert/strict";
import test from "node:test";
import {
  fromAgendaRow,
  fromAssetHistoryRow,
  fromAssetScheduleRow,
  fromAuditLogRow,
  fromOverrideRow,
  fromPlanRow,
  fromRunRow,
  fromScriptSummaryRow
} from "./preventiveAutomationMappers.js";
import { fromAutomationIndicatorRow } from "./automationIndicatorRepository.js";

test("linha do plano vira objeto com recorrencia normalizada e listas validas", () => {
  assert.equal(fromPlanRow(null), null);

  const plan = fromPlanRow({
    id: "p1",
    name: "Plano",
    recurrence_type: "custom_days",
    recurrence_interval: 12,
    preferred_time: "07:45",
    timezone: "America/Manaus",
    scope_type: null,
    asset_ids: '[" a1 ","a1"]',
    excluded_asset_ids: ["x", ""],
    default_script_ids: "invalido",
    indicator_color: "#ABCDEF",
    next_run_at: "2026-06-14T11:00:00.000Z",
    active: false,
    created_by_name: "Ana"
  });

  assert.equal(plan.recurrenceType, "custom_days");
  assert.equal(plan.recurrenceIntervalDays, 12);
  assert.equal(plan.recurrenceInterval, 12);
  assert.equal(plan.preferredTime, "07:45");
  assert.equal(plan.scopeType, "all");
  assert.deepEqual(plan.assetIds, ["a1"]);
  assert.deepEqual(plan.excludedAssetIds, ["x"]);
  assert.deepEqual(plan.defaultScriptIds, []);
  assert.equal(plan.indicatorColor, "#abcdef");
  assert.equal(plan.nextRunAt, "2026-06-14T11:00:00.000Z");
  assert.equal(plan.nextScheduledFor, plan.nextRunAt);
  assert.equal(plan.active, false);
  assert.equal(plan.createdByName, "Ana");
  assert.equal(plan.preventivePlanId, null);
  assert.equal(plan.description, "");
  assert.equal(plan.deletedAt, null);
});

test("linha do override deriva a chave do alvo quando ela nao foi gravada", () => {
  const byAsset = fromOverrideRow({ id: "o1", plan_id: "p1", asset_id: "a1", recurrence_type: "weekly", recurrence_interval: 99 });
  assert.equal(byAsset.targetKey, "asset:a1");
  assert.equal(byAsset.recurrenceIntervalDays, 7);
  assert.equal(byAsset.preferredTime, null);
  assert.equal(byAsset.active, true);

  const bySegment = fromOverrideRow({ plan_id: "p1", segment_id: "s1", recurrence_type: "desconhecida", target_key: "segment:s1", active: false });
  assert.equal(bySegment.recurrenceType, "monthly");
  assert.equal(bySegment.targetKey, "segment:s1");
  assert.equal(bySegment.active, false);
});

test("linha da execucao aplica padroes e serializa datas", () => {
  const run = fromRunRow({
    id: "r1",
    plan_id: "p1",
    asset_id: "a1",
    status: "waiting_agent",
    scheduled_for: new Date("2026-06-14T11:00:00.000Z"),
    error_detected: true,
    recurrence_interval: "7"
  });
  assert.equal(run.triggerType, "scheduled");
  assert.equal(run.scheduledFor, "2026-06-14T11:00:00.000Z");
  assert.equal(run.startedAt, null);
  assert.equal(run.errorDetected, true);
  assert.equal(run.recurrenceSource, "plan");
  assert.equal(run.recurrenceIntervalDays, 7);
  assert.equal(run.result, "");
  assert.equal(run.idempotencyKey, null);
  assert.equal(fromRunRow({ id: "r2", error_detected: "true" }).errorDetected, false);
});

test("linha da agenda por maquina usa padroes de horario e fuso", () => {
  assert.equal(fromAssetScheduleRow(undefined), null);
  const schedule = fromAssetScheduleRow({ id: "s1", plan_id: "p1", asset_id: "a1", recurrence_type: "daily", recurrence_interval: 5, active: false });
  assert.equal(schedule.recurrenceIntervalDays, 1);
  assert.equal(schedule.preferredTime, "08:00");
  assert.equal(schedule.timezone, "America/Sao_Paulo");
  assert.equal(schedule.recurrenceSource, "plan");
  assert.equal(schedule.active, false);
  assert.equal(schedule.nextRunAt, null);
});

test("linhas de apoio mantem datas brutas na agenda e padroes nos demais", () => {
  const date = new Date("2026-06-14T11:00:00.000Z");
  const agenda = fromAgendaRow({ plan_id: "p1", plan_name: "Plano", asset_id: "a1", indicator_color: "#111111", next_run_at: date, recurrence_type: "weekly", recurrence_interval: 7, recurrence_source: "machine", plan_active: false, active: true, last_prepared_at: date });
  assert.equal(agenda.nextRunAt, date);
  assert.equal(agenda.planActive, false);
  assert.equal(agenda.scheduleActive, true);
  assert.equal(agenda.lastPreparedAt, date);

  assert.deepEqual(fromAssetHistoryRow({ id: "h1", event_type: "t", message: "m", old_value: "o", new_value: "n", user_name: "u", created_at: date }), {
    id: "h1",
    eventType: "t",
    message: "m",
    oldValue: "o",
    newValue: "n",
    userName: "u",
    createdAt: date
  });
  assert.equal(fromAuditLogRow({ id: "l1", type: "t", message: "m", created_at: date }).userName, "Sistema");
  assert.deepEqual(fromAuditLogRow({ id: "l1", type: "t", message: "m", created_at: date }).meta, {});
  assert.deepEqual(fromScriptSummaryRow({ id: "s1", name: "Script" }), { id: "s1", name: "Script", category: "", riskLevel: "medium" });
});

test("indicador por maquina combina agenda e plano com padroes seguros", () => {
  const indicator = fromAutomationIndicatorRow({
    asset_id: "a1",
    automation_plan_id: "p1",
    plan_name: "Plano",
    recurrence_type: "custom_days",
    recurrence_interval: 20,
    schedule_next_run_at: null,
    plan_next_run_at: "2026-06-30T11:00:00.000Z",
    plan_active: true,
    schedule_active: false,
    default_script_ids: '["s1","s2"]',
    indicator_color: "invalida"
  });

  assert.equal(indicator.id, "p1");
  assert.equal(indicator.name, "Plano");
  assert.equal(indicator.indicatorColor, "#1f7a61");
  assert.equal(indicator.recurrenceIntervalDays, 20);
  assert.equal(indicator.preferredTime, "08:00");
  assert.equal(indicator.timezone, "America/Sao_Paulo");
  assert.equal(indicator.nextRunAt, "2026-06-30T11:00:00.000Z");
  assert.equal(indicator.active, false);
  assert.equal(indicator.scriptCount, 2);
  assert.equal(indicator.preventivePlanId, null);
});
