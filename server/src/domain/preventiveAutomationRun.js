/** @import { AssetLike, AutomationPlan, EffectiveRecurrence, NormalizedSchedule } from "./preventiveTypes.js" */
import { computeFollowingScheduledFor } from "./preventiveSchedule.js";
import { normalizeRunStatus } from "./preventiveAutomationNormalizers.js";
import { buildRunIdempotencyKey } from "./preventiveAutomationSchedule.js";

/** Regras puras do preparo de uma execucao (run) de automacao preventiva. */

/** Resume a recorrencia efetiva de uma agenda por maquina para o preparo agendado. */
/**
 * @param {NormalizedSchedule & { recurrenceSource?: string }} schedule
 */
export function recurrenceFromSchedule(schedule) {
  return {
    recurrenceType: schedule.recurrenceType,
    recurrenceIntervalDays: schedule.recurrenceIntervalDays,
    preferredTime: schedule.preferredTime,
    timezone: schedule.timezone,
    source: schedule.recurrenceSource
  };
}

/**
 * Dados da execucao preparada: com scripts ela aguarda o agente; sem scripts
 * conclui imediatamente. `nextRunAt` e a ocorrencia seguinte a esta janela.
 */
/**
 * @param {object} input
 * @param {string} input.id
 * @param {AutomationPlan} input.plan
 * @param {AssetLike} input.asset
 * @param {Partial<EffectiveRecurrence> & { recurrenceType: string, recurrenceIntervalDays: number }} input.recurrence
 * @param {string | Date} input.scheduledFor
 * @param {unknown[]} input.scripts Scripts vinculados (so a quantidade importa).
 * @param {string} input.triggerType
 */
export function buildRunDraft({ id, plan, asset, recurrence, scheduledFor, scripts, triggerType }) {
  const preferredTime = recurrence.preferredTime || plan.preferredTime;
  const nextRunAt = computeFollowingScheduledFor(
    {
      recurrenceType: recurrence.recurrenceType,
      recurrenceInterval: recurrence.recurrenceIntervalDays,
      preferredTime,
      timezone: plan.timezone
    },
    scheduledFor
  );
  const scriptSummary = scripts.length ? `${scripts.length} script(s) previsto(s)` : "Nenhum script vinculado";

  return {
    id,
    planId: plan.id,
    assetId: asset.id,
    status: normalizeRunStatus(scripts.length ? "waiting_agent" : "success"),
    scheduledFor,
    result: scripts.length ? "queued" : "success",
    logSummary:
      `Rotina preparada para ${asset.name || asset.id}. ${scriptSummary}. ` +
      `Recorrência efetiva: ${recurrence.source}/${recurrence.recurrenceIntervalDays} dia(s). ` +
      "Scripts reais dependem de agente seguro.",
    idempotencyKey: buildRunIdempotencyKey(plan.id, asset.id, scheduledFor),
    recurrenceSource: recurrence.source,
    recurrenceIntervalDays: recurrence.recurrenceIntervalDays,
    preferredTime,
    nextRunAt,
    triggerType
  };
}
