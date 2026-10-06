/** @import { PriorityRow, ServiceOrder, ServiceOrderSettings, ServiceOrderSettingsInput, ServiceOrderSla } from "./types.js" */

import { defaultSlaSettings, getFinalStatus } from "./serviceOrderSettings.js";
import { priorityRank } from "./serviceOrderPriority.js";

/** @type {{ ON_TRACK: "on_track", NEAR_DUE: "near_due", BREACHED: "breached", PAUSED: "paused", RESOLVED: "resolved", NOT_APPLICABLE: "not_applicable" }} */
export const SLA_STATUSES = {
  ON_TRACK: "on_track",
  NEAR_DUE: "near_due",
  BREACHED: "breached",
  PAUSED: "paused",
  RESOLVED: "resolved",
  NOT_APPLICABLE: "not_applicable"
};

/**
 * @param {ServiceOrderSettingsInput | null | undefined} settings
 * @param {string} priority
 * @returns {number | null}
 */
function slaPriorityHours(settings, priority) {
  const hours = Number(/** @type {Record<string, unknown> | undefined} */ (settings?.sla)?.[priority]);
  return Number.isFinite(hours) && hours > 0 ? hours : null;
}

// Calcula o prazo de SLA uma unica vez, no momento em que ha um "inicio"
// valido (criacao da OS, ou reescala de prioridade automatica) -- nunca
// recalculado so por causa de leitura.
/**
 * @param {string} priority
 * @param {ServiceOrderSettingsInput | null | undefined} settings
 * @param {string | number | Date} startAt
 * @returns {string | null} ISO do prazo, ou `null` sem meta de SLA/inicio valido.
 */
export function computeServiceOrderSlaDueAt(priority, settings, startAt) {
  const hours = slaPriorityHours(settings, priority);
  const start = new Date(startAt).getTime();
  if (!hours || !Number.isFinite(start)) return null;
  return new Date(start + hours * 60 * 60 * 1000).toISOString();
}

/**
 * Funcao pura: status de SLA (on_track/near_due/breached/resolved/
 * not_applicable) e minutos restantes, sempre computados na leitura a
 * partir de `slaDueAt` (persistido) - mesmo principio de
 * `withDisplayPriority`, nunca grava nada. `slaBreachedAt` (persistido
 * so por `syncSlaBreaches`) e o unico sinal que vira evento discreto de
 * historico; aqui ele so afeta o status retornado, nao e alterado.
 *
 * @param {Pick<ServiceOrder, "status" | "priority" | "slaDueAt" | "closedAt" | "slaBreachedAt"> | null | undefined} order
 * @param {ServiceOrderSettingsInput} settings
 * @param {Date} [now]
 * @returns {ServiceOrderSla}
 */
export function calculateServiceOrderSla(order, settings, now = new Date()) {
  const empty = { dueAt: null, status: SLA_STATUSES.NOT_APPLICABLE, remainingMinutes: null, breached: false, nearDue: false };
  if (!order?.slaDueAt) return empty;

  const dueAt = order.slaDueAt;
  const dueMs = new Date(dueAt).getTime();
  if (!Number.isFinite(dueMs)) return empty;

  const finalStatusId = getFinalStatus(settings).id;
  const isFinal = order.status === finalStatusId;

  if (isFinal) {
    const closedMs = order.closedAt ? new Date(order.closedAt).getTime() : null;
    const resolvedLate = Boolean(order.slaBreachedAt) || (closedMs !== null && Number.isFinite(closedMs) && closedMs > dueMs);
    return {
      dueAt,
      status: resolvedLate ? SLA_STATUSES.BREACHED : SLA_STATUSES.RESOLVED,
      remainingMinutes: null,
      breached: resolvedLate,
      nearDue: false
    };
  }

  const nowMs = now.getTime();
  const remainingMinutes = Math.round((dueMs - nowMs) / 60000);
  const breached = Boolean(order.slaBreachedAt) || remainingMinutes <= 0;

  if (breached) {
    return { dueAt, status: SLA_STATUSES.BREACHED, remainingMinutes: Math.min(remainingMinutes, 0), breached: true, nearDue: false };
  }

  const totalHours = slaPriorityHours(settings, order.priority);
  const totalMinutes = totalHours ? totalHours * 60 : null;
  const nearDuePercent = settings?.sla?.nearDuePercent ?? defaultSlaSettings.nearDuePercent;
  const nearDueMinHours = settings?.sla?.nearDueMinHours ?? defaultSlaSettings.nearDueMinHours;

  const percentRule = totalMinutes !== null && remainingMinutes <= totalMinutes * (nearDuePercent / 100);
  const hoursRule =
    (order.priority === "high" || order.priority === "critical") && remainingMinutes <= nearDueMinHours * 60;
  const nearDue = percentRule || hoursRule;

  return { dueAt, status: nearDue ? SLA_STATUSES.NEAR_DUE : SLA_STATUSES.ON_TRACK, remainingMinutes, breached: false, nearDue };
}

/**
 * @param {PriorityRow} row
 * @param {ServiceOrderSettings} settings
 * @returns {string}
 */
export function getTimedPriority(row, settings) {
  if (!settings.autoPriority.enabled || !row.auto_priority_enabled || row.status === getFinalStatus(settings).id) {
    return row.priority;
  }

  const createdAt = new Date(row.created_at).getTime();
  const openHours = (Date.now() - createdAt) / 36e5;
  let target = row.priority;

  if (openHours >= settings.autoPriority.highToCriticalHours) target = "critical";
  else if (openHours >= settings.autoPriority.mediumToHighHours) target = "high";
  else if (openHours >= settings.autoPriority.lowToMediumHours) target = "medium";

  return priorityRank[target] > priorityRank[row.priority] ? target : row.priority;
}

/**
 * Aplica a prioridade calculada por tempo apenas para exibicao, sem gravar
 * no banco. Uma simples listagem/leitura de OS nao deve ter efeito colateral
 * de escrita -- a persistencia real acontece em `persistAutoPriority`,
 * chamada apenas pelo job agendado (`syncAutoPriorities`).
 *
 * @template {PriorityRow} T
 * @param {T} row
 * @param {ServiceOrderSettings} settings
 * @returns {T}
 */
export function withDisplayPriority(row, settings) {
  const nextPriority = getTimedPriority(row, settings);
  return nextPriority === row.priority ? row : { ...row, priority: nextPriority };
}
