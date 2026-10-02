import { serializeTimestamp } from "../lib/textUtils.js";
import {
  DEFAULT_PREFERRED_TIME,
  DEFAULT_TIMEZONE,
  normalizePreventiveSchedule,
  normalizeRecurrenceIntervalDays,
  normalizeRecurrenceType
} from "../domain/preventiveSchedule.js";
import {
  buildOverrideTargetKey,
  normalizeAssetIds,
  normalizeIndicatorColor,
  parseJsonArray
} from "../domain/preventiveAutomationNormalizers.js";

/** Mapeamento linha do banco -> objeto de dominio das automacoes preventivas. */

export function fromPlanRow(row) {
  if (!row) return null;
  const schedule = normalizePreventiveSchedule(row);

  return {
    id: row.id,
    preventivePlanId: row.preventive_plan_id || null,
    preventivePlanName: row.preventive_plan_name || null,
    name: row.name,
    description: row.description || "",
    active: row.active !== false,
    recurrenceType: schedule.recurrenceType,
    recurrenceInterval: schedule.recurrenceIntervalDays,
    recurrenceIntervalDays: schedule.recurrenceIntervalDays,
    preferredTime: schedule.preferredTime,
    timezone: schedule.timezone,
    scopeType: row.scope_type || "all",
    scopeId: row.scope_id,
    assetIds: normalizeAssetIds(parseJsonArray(row.asset_ids)),
    excludedAssetIds: normalizeAssetIds(parseJsonArray(row.excluded_asset_ids)),
    defaultScriptIds: parseJsonArray(row.default_script_ids),
    notes: row.notes || "",
    indicatorColor: normalizeIndicatorColor(row.indicator_color),
    lastScheduledAt: serializeTimestamp(row.last_scheduled_at),
    lastPreparedAt: serializeTimestamp(row.last_prepared_at),
    lastRunAt: serializeTimestamp(row.last_run_at),
    nextRunAt: serializeTimestamp(row.next_run_at),
    nextScheduledFor: serializeTimestamp(row.next_run_at),
    scheduleAnchorAt: serializeTimestamp(row.schedule_anchor_at),
    createdBy: row.created_by,
    createdByName: row.created_by_name || null,
    deletedAt: serializeTimestamp(row.deleted_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function fromOverrideRow(row) {
  const recurrenceType = normalizeRecurrenceType(row.recurrence_type);
  const recurrenceIntervalDays = normalizeRecurrenceIntervalDays(row.recurrence_interval, recurrenceType);

  return {
    id: row.id,
    planId: row.plan_id,
    assetId: row.asset_id,
    segmentId: row.segment_id,
    targetKey: row.target_key || buildOverrideTargetKey({ assetId: row.asset_id, segmentId: row.segment_id }),
    recurrenceType,
    recurrenceInterval: recurrenceIntervalDays,
    recurrenceIntervalDays,
    preferredTime: row.preferred_time || null,
    active: row.active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function fromRunRow(row) {
  return {
    id: row.id,
    planId: row.plan_id,
    assetId: row.asset_id,
    status: row.status,
    triggerType: row.trigger_type || "scheduled",
    scheduledFor: serializeTimestamp(row.scheduled_for),
    startedAt: serializeTimestamp(row.started_at),
    finishedAt: serializeTimestamp(row.finished_at),
    result: row.result || "",
    logSummary: row.log_summary || "",
    errorDetected: row.error_detected === true,
    idempotencyKey: row.idempotency_key || null,
    scheduleSlot: serializeTimestamp(row.schedule_slot),
    recurrenceSource: row.recurrence_source || "plan",
    recurrenceInterval: Number(row.recurrence_interval || 0),
    recurrenceIntervalDays: Number(row.recurrence_interval || 0),
    preferredTime: row.preferred_time || null,
    nextRunAt: serializeTimestamp(row.next_run_at),
    createdAt: row.created_at
  };
}

export function fromAssetScheduleRow(row) {
  if (!row) return null;
  const recurrenceType = normalizeRecurrenceType(row.recurrence_type);
  const recurrenceIntervalDays = normalizeRecurrenceIntervalDays(row.recurrence_interval, recurrenceType);

  return {
    id: row.id,
    planId: row.plan_id,
    assetId: row.asset_id,
    recurrenceSource: row.recurrence_source || "plan",
    recurrenceType,
    recurrenceInterval: recurrenceIntervalDays,
    recurrenceIntervalDays,
    preferredTime: row.preferred_time || DEFAULT_PREFERRED_TIME,
    timezone: row.timezone || DEFAULT_TIMEZONE,
    lastScheduledAt: serializeTimestamp(row.last_scheduled_at),
    lastPreparedAt: serializeTimestamp(row.last_prepared_at),
    nextRunAt: serializeTimestamp(row.next_run_at),
    active: row.active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/** Linha da agenda (agenda de maquina + dados do plano). Datas ficam brutas. */
export function fromAgendaRow(row) {
  return {
    planId: row.plan_id,
    planName: row.plan_name,
    assetId: row.asset_id,
    indicatorColor: row.indicator_color,
    nextRunAt: row.next_run_at,
    recurrenceType: row.recurrence_type,
    recurrenceInterval: row.recurrence_interval,
    recurrenceSource: row.recurrence_source,
    planActive: row.plan_active !== false,
    scheduleActive: row.active !== false,
    lastPreparedAt: row.last_prepared_at
  };
}

export function fromAssetHistoryRow(row) {
  return {
    id: row.id,
    eventType: row.event_type,
    message: row.message,
    oldValue: row.old_value,
    newValue: row.new_value,
    userName: row.user_name,
    createdAt: row.created_at
  };
}

export function fromAuditLogRow(row) {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    meta: row.meta || {},
    userName: row.user_name || "Sistema",
    createdAt: row.created_at
  };
}

export function fromScriptSummaryRow(row) {
  return { id: row.id, name: row.name, category: row.category || "", riskLevel: row.risk_level || "medium" };
}
