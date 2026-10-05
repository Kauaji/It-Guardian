/** @import { AssetLike, AssetSchedule, AutomationPlan, EffectiveRecurrence, NormalizedSchedule } from "./preventiveTypes.js" */
import { badRequest } from "../lib/errors.js";
import { serializeTimestamp } from "../lib/textUtils.js";
import {
  computeNextScheduledFor,
  normalizePreferredTime,
  normalizePreventiveSchedule,
  normalizeRecurrenceIntervalDays,
  normalizeRecurrenceType,
  normalizeTimezone
} from "./preventiveSchedule.js";
import { normalizeAssetIds } from "./preventiveAutomationNormalizers.js";

/**
 * Regras puras de agendamento por maquina: recorrencia efetiva (maquina >
 * segmento > plano), deteccao de mudanca, base de recalculo e diff de agendas.
 */

/**
 * @typedef {NormalizedSchedule & { recurrenceSource: unknown, active: boolean }} ScheduleSnapshot
 */

/**
 * @param {Record<string, unknown>} schedule Agenda em camelCase ou snake_case.
 * @returns {ScheduleSnapshot}
 */
function snapshotSchedule(schedule) {
  const recurrenceType = schedule.recurrenceType || schedule.recurrence_type;
  return {
    recurrenceSource: schedule.recurrenceSource || schedule.recurrence_source || "plan",
    recurrenceType: normalizeRecurrenceType(recurrenceType),
    recurrenceIntervalDays: normalizeRecurrenceIntervalDays(
      schedule.recurrenceIntervalDays ?? schedule.recurrence_interval,
      recurrenceType
    ),
    preferredTime: normalizePreferredTime(schedule.preferredTime || schedule.preferred_time),
    timezone: normalizeTimezone(schedule.timezone),
    active: schedule.active !== false
  };
}

/**
 * @param {Record<string, unknown> | null | undefined} previousSchedule
 * @param {Record<string, unknown>} nextSchedule
 * @returns {boolean} true quando nao ha agenda anterior ou algum campo mudou.
 */
export function hasPreventiveScheduleChanged(previousSchedule, nextSchedule) {
  if (!previousSchedule) return true;

  const previous = snapshotSchedule(previousSchedule);
  const next = snapshotSchedule(nextSchedule);

  return Object.keys(next).some(
    (key) => previous[/** @type {keyof ScheduleSnapshot} */ (key)] !== next[/** @type {keyof ScheduleSnapshot} */ (key)]
  );
}

/**
 * @param {{ existing?: AssetSchedule | null, plan: AutomationPlan }} input
 * @returns {string} Data-base ISO para recalcular a proxima execucao.
 */
export function chooseScheduleRecalculationBase({ existing, plan }) {
  if (existing?.active === false && plan.active !== false) {
    return new Date().toISOString();
  }

  return (
    existing?.lastScheduledAt ||
    plan.scheduleAnchorAt ||
    existing?.createdAt ||
    plan.createdAt ||
    new Date().toISOString()
  );
}

/**
 * @param {{ existing?: AssetSchedule | null, plan: AutomationPlan, recurrence: EffectiveRecurrence, nextSchedule: Record<string, unknown> }} input
 * @returns {string} Proxima execucao (preservada quando a agenda nao mudou).
 */
export function computeScheduleNextRunAt({ existing, plan, recurrence, nextSchedule }) {
  if (existing && !hasPreventiveScheduleChanged(existing, nextSchedule) && existing.nextRunAt) {
    return existing.nextRunAt;
  }

  return computeNextScheduledFor(
    {
      recurrenceType: recurrence.recurrenceType,
      recurrenceInterval: recurrence.recurrenceIntervalDays,
      preferredTime: nextSchedule.preferredTime,
      timezone: nextSchedule.timezone
    },
    chooseScheduleRecalculationBase({ existing, plan })
  );
}

/**
 * @param {AutomationPlan} plan
 * @param {AssetLike} asset
 * @returns {EffectiveRecurrence}
 */
export function resolveEffectiveRecurrence(plan, asset) {
  const activeOverrides = (plan.overrides || []).filter((override) => override.active !== false);
  const assetOverride = activeOverrides.find((override) => override.assetId && String(override.assetId) === String(asset.id));
  if (assetOverride) {
    return {
      ...normalizePreventiveSchedule({ ...plan, ...assetOverride }),
      source: "machine"
    };
  }

  const segmentOverride = activeOverrides.find(
    (override) => override.segmentId && String(override.segmentId) === String(asset.segmentId)
  );
  if (segmentOverride) {
    return {
      ...normalizePreventiveSchedule({ ...plan, ...segmentOverride }),
      source: "segment"
    };
  }

  return {
    ...normalizePreventiveSchedule(plan),
    source: "plan"
  };
}

/**
 * Monta a agenda desejada de uma maquina para o plano: recorrencia efetiva,
 * proxima execucao (preservada quando nada mudou) e estado ativo.
 *
 * @param {{ plan: AutomationPlan, asset: AssetLike, existing?: AssetSchedule | null }} input
 */
export function buildAssetScheduleDraft({ plan, asset, existing }) {
  const recurrence = resolveEffectiveRecurrence(plan, asset);
  const preferredTime = recurrence.preferredTime || plan.preferredTime;
  const timezone = recurrence.timezone || plan.timezone;
  const nextSchedule = {
    recurrenceSource: recurrence.source,
    recurrenceType: recurrence.recurrenceType,
    recurrenceIntervalDays: recurrence.recurrenceIntervalDays,
    preferredTime,
    timezone,
    active: plan.active !== false
  };

  return {
    source: recurrence.source,
    recurrenceType: recurrence.recurrenceType,
    recurrenceIntervalDays: recurrence.recurrenceIntervalDays,
    preferredTime,
    timezone,
    active: nextSchedule.active,
    nextRunAt: computeScheduleNextRunAt({ existing, plan, recurrence, nextSchedule })
  };
}

/**
 * @param {AutomationPlan | null | undefined} plan
 * @param {{ assetId?: string } | null | undefined} schedule
 * @returns {boolean}
 */
export function isScheduleLinkedToPlan(plan, schedule) {
  if (!plan || !schedule) return false;
  const assetId = String(schedule.assetId || "");
  if (!assetId || (plan.excludedAssetIds || []).some((id) => String(id) === assetId)) return false;
  if (plan.scopeType === "asset_list") {
    return (plan.assetIds || []).some((id) => String(id) === assetId);
  }
  return true;
}

/**
 * @param {unknown[]} [assetIds]
 * @param {AssetLike[]} [devices]
 * @returns {AssetLike[]} Dispositivos na ordem dos ids.
 * @throws {import("../lib/errors.js").AppError} 400 sem ids ou com ids inexistentes.
 */
export function resolveAssetListDevices(assetIds = [], devices = []) {
  const ids = normalizeAssetIds(assetIds);
  if (!ids.length) {
    throw badRequest("Selecione pelo menos uma maquina para automatizar a preventiva.");
  }

  const devicesById = new Map(devices.map((device) => [String(device.id), device]));
  const missingIds = ids.filter((id) => !devicesById.has(String(id)));
  if (missingIds.length) {
    throw badRequest("Uma ou mais maquinas selecionadas nao existem.");
  }

  return ids.map((id) => /** @type {AssetLike} */ (devicesById.get(String(id))));
}

/**
 * @param {AssetSchedule[]} [existingSchedules]
 * @param {unknown[]} [nextAssetIds]
 * @returns {{ add: string[], keep: string[], disable: Array<string | undefined> }}
 */
export function getAssetScheduleSyncActions(existingSchedules = [], nextAssetIds = []) {
  const nextIds = normalizeAssetIds(nextAssetIds);
  const existingActiveIds = new Set(
    existingSchedules
      .filter((schedule) => schedule.active !== false)
      .map((schedule) => String(schedule.assetId))
  );
  const nextIdSet = new Set(nextIds.map(String));

  return {
    add: nextIds.filter((id) => !existingActiveIds.has(String(id))),
    keep: nextIds.filter((id) => existingActiveIds.has(String(id))),
    disable: existingSchedules
      .filter((schedule) => schedule.active !== false && !nextIdSet.has(String(schedule.assetId)))
      .map((schedule) => schedule.id)
  };
}

/**
 * @param {string} planId
 * @param {string} assetId
 * @param {string | Date} scheduledFor
 * @returns {string}
 */
export function buildRunIdempotencyKey(planId, assetId, scheduledFor) {
  return `${planId}:${assetId}:${serializeTimestamp(scheduledFor) || scheduledFor}`;
}

/** Classifica a mudanca de uma agenda entre duas leituras (usado pelo backfill). */
/**
 * @param {AssetSchedule | null | undefined} before
 * @param {AssetSchedule} after
 * @returns {"created" | "deactivated" | "updated" | "ignored"}
 */
export function classifyScheduleChange(before, after) {
  if (!before) return "created";
  if (before.active && !after.active) return "deactivated";

  const changed =
    before.nextRunAt !== after.nextRunAt ||
    before.recurrenceSource !== after.recurrenceSource ||
    before.recurrenceType !== after.recurrenceType ||
    before.recurrenceIntervalDays !== after.recurrenceIntervalDays ||
    before.preferredTime !== after.preferredTime ||
    before.timezone !== after.timezone ||
    before.active !== after.active;

  return changed ? "updated" : "ignored";
}
