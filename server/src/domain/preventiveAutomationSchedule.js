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

export function hasPreventiveScheduleChanged(previousSchedule, nextSchedule) {
  if (!previousSchedule) return true;

  const previous = snapshotSchedule(previousSchedule);
  const next = snapshotSchedule(nextSchedule);

  return Object.keys(next).some((key) => previous[key] !== next[key]);
}

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

export function isScheduleLinkedToPlan(plan, schedule) {
  if (!plan || !schedule) return false;
  const assetId = String(schedule.assetId || "");
  if (!assetId || plan.excludedAssetIds.some((id) => String(id) === assetId)) return false;
  if (plan.scopeType === "asset_list") {
    return plan.assetIds.some((id) => String(id) === assetId);
  }
  return true;
}

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

  return ids.map((id) => devicesById.get(String(id)));
}

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

export function buildRunIdempotencyKey(planId, assetId, scheduledFor) {
  return `${planId}:${assetId}:${serializeTimestamp(scheduledFor) || scheduledFor}`;
}

/** Classifica a mudanca de uma agenda entre duas leituras (usado pelo backfill). */
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
