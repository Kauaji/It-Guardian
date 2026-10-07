import assert from "node:assert/strict";
import test from "node:test";
import { buildRunDraft, recurrenceFromSchedule } from "./preventiveAutomationRun.js";

const plan = { id: "plan-1", preferredTime: "08:00", timezone: "America/Sao_Paulo" };
const asset = { id: "asset-1", name: "SRV-01" };
const recurrence = {
  recurrenceType: "daily",
  recurrenceIntervalDays: 1,
  preferredTime: "09:00",
  timezone: "America/Sao_Paulo",
  source: "machine"
};

test("execucao com scripts aguarda o agente e agenda a proxima ocorrencia", () => {
  const draft = buildRunDraft({
    id: "run-1",
    plan,
    asset,
    recurrence,
    scheduledFor: "2026-06-14T12:00:00.000Z",
    scripts: [{ name: "um" }, { name: "dois" }],
    triggerType: "manual"
  });

  assert.equal(draft.id, "run-1");
  assert.equal(draft.status, "waiting_agent");
  assert.equal(draft.result, "queued");
  assert.equal(draft.triggerType, "manual");
  assert.equal(draft.recurrenceSource, "machine");
  assert.equal(draft.preferredTime, "09:00");
  assert.equal(draft.idempotencyKey, "plan-1:asset-1:2026-06-14T12:00:00.000Z");
  assert.equal(draft.nextRunAt, "2026-06-15T12:00:00.000Z");
  assert.match(draft.logSummary, /Rotina preparada para SRV-01\. 2 script\(s\) previsto\(s\)\./);
  assert.match(draft.logSummary, /machine\/1 dia\(s\)/);
});

test("execucao sem scripts conclui com sucesso e herda o horario do plano", () => {
  const draft = buildRunDraft({
    id: "run-2",
    plan,
    asset: { id: "asset-2" },
    recurrence: { ...recurrence, preferredTime: "", source: "plan" },
    scheduledFor: "2026-06-14T11:00:00.000Z",
    scripts: [],
    triggerType: "scheduled"
  });

  assert.equal(draft.status, "success");
  assert.equal(draft.result, "success");
  assert.equal(draft.preferredTime, "08:00");
  assert.match(draft.logSummary, /Rotina preparada para asset-2\. Nenhum script vinculado\./);
});

test("recorrencia do preparo agendado vem da propria agenda da maquina", () => {
  assert.deepEqual(
    recurrenceFromSchedule({
      recurrenceType: "weekly",
      recurrenceIntervalDays: 7,
      preferredTime: "07:00",
      timezone: "America/Manaus",
      recurrenceSource: "segment",
      outroCampo: true
    }),
    { recurrenceType: "weekly", recurrenceIntervalDays: 7, preferredTime: "07:00", timezone: "America/Manaus", source: "segment" }
  );
});
