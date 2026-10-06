import assert from "node:assert/strict";
import test from "node:test";
import { normalizeOverridePayload } from "./preventiveAutomationPayload.js";
import {
  buildAssetScheduleDraft,
  chooseScheduleRecalculationBase,
  classifyScheduleChange,
  computeScheduleNextRunAt,
  isScheduleLinkedToPlan
} from "./preventiveAutomationSchedule.js";

const basePlan = () => ({
  active: true,
  recurrenceType: "weekly",
  recurrenceIntervalDays: 7,
  preferredTime: "08:00",
  timezone: "America/Sao_Paulo",
  scheduleAnchorAt: "2026-06-01T12:00:00.000Z",
  overrides: []
});

test("agenda desejada herda o plano e calcula a proxima execucao a partir da ancora", () => {
  const draft = buildAssetScheduleDraft({ plan: basePlan(), asset: { id: "a1" }, existing: undefined });

  assert.equal(draft.source, "plan");
  assert.equal(draft.recurrenceType, "weekly");
  assert.equal(draft.recurrenceIntervalDays, 7);
  assert.equal(draft.preferredTime, "08:00");
  assert.equal(draft.timezone, "America/Sao_Paulo");
  assert.equal(draft.active, true);
  assert.equal(draft.nextRunAt, "2026-06-08T11:00:00.000Z");
});

test("agenda desejada usa o override da maquina e marca o plano pausado como inativo", () => {
  const plan = {
    ...basePlan(),
    active: false,
    overrides: [{ assetId: "a1", recurrenceType: "daily", recurrenceIntervalDays: 1, preferredTime: "10:00", active: true }]
  };
  const draft = buildAssetScheduleDraft({ plan, asset: { id: "a1" }, existing: undefined });

  assert.equal(draft.source, "machine");
  assert.equal(draft.recurrenceType, "daily");
  assert.equal(draft.preferredTime, "10:00");
  assert.equal(draft.active, false);
});

test("agenda existente sem mudanca preserva a proxima execucao", () => {
  const first = buildAssetScheduleDraft({ plan: basePlan(), asset: { id: "a1" }, existing: undefined });
  const existing = {
    id: "s1",
    active: true,
    recurrenceSource: "plan",
    recurrenceType: "weekly",
    recurrenceIntervalDays: 7,
    preferredTime: "08:00",
    timezone: "America/Sao_Paulo",
    nextRunAt: "2030-01-01T11:00:00.000Z",
    lastScheduledAt: null
  };
  const unchanged = buildAssetScheduleDraft({ plan: basePlan(), asset: { id: "a1" }, existing });
  assert.equal(unchanged.nextRunAt, "2030-01-01T11:00:00.000Z");
  assert.notEqual(first.nextRunAt, unchanged.nextRunAt);

  const changed = buildAssetScheduleDraft({ plan: { ...basePlan(), preferredTime: "09:00" }, asset: { id: "a1" }, existing });
  assert.notEqual(changed.nextRunAt, "2030-01-01T11:00:00.000Z");
  assert.equal(changed.preferredTime, "09:00");
});

test("base de recalculo prioriza ultima agenda, ancora do plano e criacao", () => {
  const plan = { scheduleAnchorAt: "2026-01-01T00:00:00.000Z", createdAt: "2025-01-01T00:00:00.000Z", active: true };

  assert.equal(
    chooseScheduleRecalculationBase({ existing: { lastScheduledAt: "2026-02-01T00:00:00.000Z" }, plan }),
    "2026-02-01T00:00:00.000Z"
  );
  assert.equal(chooseScheduleRecalculationBase({ existing: {}, plan }), "2026-01-01T00:00:00.000Z");
  assert.equal(
    chooseScheduleRecalculationBase({ existing: { createdAt: "2026-03-01T00:00:00.000Z" }, plan: { active: true } }),
    "2026-03-01T00:00:00.000Z"
  );
  assert.equal(
    chooseScheduleRecalculationBase({ existing: undefined, plan: { createdAt: "2025-05-05T00:00:00.000Z" } }),
    "2025-05-05T00:00:00.000Z"
  );
  assert.ok(Number.isFinite(Date.parse(chooseScheduleRecalculationBase({ existing: undefined, plan: {} }))));

  const before = Date.now();
  const reactivated = chooseScheduleRecalculationBase({ existing: { active: false, lastScheduledAt: "2020-01-01T00:00:00.000Z" }, plan });
  assert.ok(Date.parse(reactivated) >= before - 1000, "agenda reativada recalcula a partir de agora");
  assert.equal(
    chooseScheduleRecalculationBase({
      existing: { active: false, lastScheduledAt: "2020-01-01T00:00:00.000Z" },
      plan: { ...plan, active: false }
    }),
    "2020-01-01T00:00:00.000Z"
  );
});

test("proxima execucao so e recalculada quando a recorrencia mudou ou nao existe", () => {
  const recurrence = { recurrenceType: "daily", recurrenceIntervalDays: 1 };
  const nextSchedule = {
    recurrenceSource: "plan",
    recurrenceType: "daily",
    recurrenceIntervalDays: 1,
    preferredTime: "08:00",
    timezone: "America/Sao_Paulo",
    active: true
  };
  const existing = { ...nextSchedule, nextRunAt: "2031-01-01T11:00:00.000Z" };
  const plan = { scheduleAnchorAt: "2026-06-14T10:00:00.000Z", active: true };

  assert.equal(computeScheduleNextRunAt({ existing, plan, recurrence, nextSchedule }), "2031-01-01T11:00:00.000Z");
  assert.equal(
    computeScheduleNextRunAt({ existing: { ...existing, nextRunAt: null }, plan, recurrence, nextSchedule }),
    "2026-06-14T11:00:00.000Z"
  );
  assert.equal(computeScheduleNextRunAt({ existing: undefined, plan, recurrence, nextSchedule }), "2026-06-14T11:00:00.000Z");
});

test("classifica a diferenca entre duas leituras da agenda", () => {
  const schedule = {
    active: true,
    nextRunAt: "2026-07-01T11:00:00.000Z",
    recurrenceSource: "plan",
    recurrenceType: "weekly",
    recurrenceIntervalDays: 7,
    preferredTime: "08:00",
    timezone: "America/Sao_Paulo"
  };

  assert.equal(classifyScheduleChange(undefined, schedule), "created");
  assert.equal(classifyScheduleChange(schedule, { ...schedule }), "ignored");
  assert.equal(classifyScheduleChange(schedule, { ...schedule, active: false }), "deactivated");
  assert.equal(classifyScheduleChange({ ...schedule, active: false }, { ...schedule }), "updated");
  for (const patch of [
    { nextRunAt: "2026-07-02T11:00:00.000Z" },
    { recurrenceSource: "machine" },
    { recurrenceType: "daily" },
    { recurrenceIntervalDays: 1 },
    { preferredTime: "09:00" },
    { timezone: "America/Manaus" }
  ]) {
    assert.equal(classifyScheduleChange(schedule, { ...schedule, ...patch }), "updated", JSON.stringify(patch));
  }
});

test("agenda ligada ao plano respeita lista explicita e exclusoes", () => {
  assert.equal(isScheduleLinkedToPlan(null, { assetId: "a1" }), false);
  assert.equal(isScheduleLinkedToPlan({ excludedAssetIds: [], scopeType: "all" }, null), false);
  assert.equal(isScheduleLinkedToPlan({ excludedAssetIds: [], scopeType: "all" }, { assetId: "" }), false);
  assert.equal(isScheduleLinkedToPlan({ excludedAssetIds: [], scopeType: "segment", assetIds: [] }, { assetId: "a1" }), true);
  assert.equal(isScheduleLinkedToPlan({ excludedAssetIds: ["a1"], scopeType: "segment", assetIds: [] }, { assetId: "a1" }), false);
});

test("override recem-normalizado prevalece sobre os dias do plano lido do banco", () => {
  const plan = { ...basePlan(), recurrenceInterval: 7 };
  const override = normalizeOverridePayload({ assetId: "a1", recurrenceType: "custom_days", recurrenceIntervalDays: 4 });
  const draft = buildAssetScheduleDraft({ plan: { ...plan, overrides: [override] }, asset: { id: "a1" }, existing: undefined });

  assert.equal(draft.source, "machine");
  assert.equal(draft.recurrenceType, "custom_days");
  assert.equal(draft.recurrenceIntervalDays, 4);
});
