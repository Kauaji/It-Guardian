import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";
import { addAssetHistory } from "./assetHistoryRepository.js";
import { addLog } from "./logRepository.js";
import { findMaintenanceScriptById, refreshDueScriptValidations } from "./maintenanceScriptRepository.js";
import { listDevices } from "../services/monitoringService.js";

const recurrenceTypes = new Set(["daily", "weekly", "biweekly", "monthly", "custom_days"]);
const scopeTypes = new Set(["asset", "asset_list", "segment", "group", "all"]);
const runStatuses = new Set(["scheduled", "prepared", "waiting_agent", "success", "error", "cancelled", "skipped"]);
const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_PREFERRED_TIME = "08:00";
const DEFAULT_INDICATOR_COLOR = "#1f7a61";

export const recurrenceIntervalDefaults = {
  daily: 1,
  weekly: 7,
  biweekly: 15,
  monthly: 30,
  custom_days: 30
};

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function trimString(value, maxLength = 1000, fallback = "") {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : fallback;
}

function normalizeIndicatorColor(value, fallback = DEFAULT_INDICATOR_COLOR) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeTimestamp(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toValidDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function normalizeScheduleSlot(value = new Date()) {
  const date = toValidDate(value);
  date.setSeconds(0, 0);
  return date.toISOString();
}

function normalizeScriptIds(value = []) {
  return [
    ...new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => trimString(item, 120))
        .filter(Boolean)
    )
  ];
}

export function normalizeAssetIds(value = []) {
  return [
    ...new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => trimString(item, 120))
        .filter(Boolean)
    )
  ];
}

export function normalizeRecurrenceType(value, fallback = "monthly") {
  const normalized = String(value || "").trim().toLowerCase();
  return recurrenceTypes.has(normalized) ? normalized : fallback;
}

export function defaultIntervalForType(type) {
  return recurrenceIntervalDefaults[normalizeRecurrenceType(type)] || recurrenceIntervalDefaults.monthly;
}

export function normalizeRecurrenceIntervalDays(value, type = "monthly", options = {}) {
  const recurrenceType = normalizeRecurrenceType(type);
  if (recurrenceType !== "custom_days") {
    return defaultIntervalForType(recurrenceType);
  }

  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 365) {
    return parsed;
  }

  if (options.strict) {
    throw createHttpError("Informe a quantidade de dias da recorrência personalizada.", 400);
  }

  return defaultIntervalForType(recurrenceType);
}

function normalizePreferredTime(value, fallback = DEFAULT_PREFERRED_TIME) {
  const text = trimString(value, 5, fallback);
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback;
}

function normalizeTimezone(value, fallback = DEFAULT_TIMEZONE) {
  const timezone = trimString(value, 80, fallback);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return fallback;
  }
}

function normalizeScopeType(value, fallback = "all") {
  const normalized = String(value || "").trim().toLowerCase();
  return scopeTypes.has(normalized) ? normalized : fallback;
}

function normalizeRunStatus(value, fallback = "scheduled") {
  const normalized = String(value || "").trim().toLowerCase();
  return runStatuses.has(normalized) ? normalized : fallback;
}

function parsePreferredTime(value) {
  const [hour, minute] = normalizePreferredTime(value).split(":").map(Number);
  return { hour, minute };
}

function getZonedDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = getZonedDateParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second || 0);
  return asUtc - date.getTime();
}

function zonedDateTimeToUtc({ year, month, day, hour, minute, second = 0 }, timeZone) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  const firstUtc = utcGuess - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(new Date(firstUtc), timeZone);
  return new Date(utcGuess - secondOffset);
}

function addDaysToLocalDateParts(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

export function normalizePreventiveSchedule(source = {}) {
  const recurrenceType = normalizeRecurrenceType(source.recurrenceType || source.recurrence_type);
  const recurrenceIntervalDays = normalizeRecurrenceIntervalDays(
    source.recurrenceIntervalDays ?? source.recurrenceInterval ?? source.recurrence_interval,
    recurrenceType
  );

  return {
    recurrenceType,
    recurrenceIntervalDays,
    preferredTime: normalizePreferredTime(source.preferredTime || source.preferred_time),
    timezone: normalizeTimezone(source.timezone || source.time_zone)
  };
}

export function recurrenceToDays(type, interval) {
  return normalizeRecurrenceIntervalDays(interval, type);
}

export function computeNextScheduledFor(source, fromDate = new Date()) {
  const schedule = normalizePreventiveSchedule(source);
  const baseDate = toValidDate(fromDate);
  const localParts = getZonedDateParts(baseDate, schedule.timezone);
  const preferred = parsePreferredTime(schedule.preferredTime);

  let candidate = zonedDateTimeToUtc(
    {
      year: localParts.year,
      month: localParts.month,
      day: localParts.day,
      hour: preferred.hour,
      minute: preferred.minute
    },
    schedule.timezone
  );

  if (candidate <= baseDate) {
    const nextLocalDate = addDaysToLocalDateParts(localParts, schedule.recurrenceIntervalDays);
    candidate = zonedDateTimeToUtc(
      {
        ...nextLocalDate,
        hour: preferred.hour,
        minute: preferred.minute
      },
      schedule.timezone
    );
  }

  return candidate.toISOString();
}

function computeFollowingScheduledFor(source, scheduledFor) {
  return computeNextScheduledFor(source, toValidDate(scheduledFor));
}

function fromPlanRow(row) {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function fromOverrideRow(row) {
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

function fromRunRow(row) {
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

function fromAssetScheduleRow(row) {
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

function normalizeOverridePayload(item = {}) {
  const assetId = trimString(item.assetId, 120) || null;
  const segmentId = trimString(item.segmentId, 120) || null;
  const recurrenceType = normalizeRecurrenceType(item.recurrenceType);

  if (!assetId && !segmentId) return null;
  if (assetId && segmentId) {
    throw createHttpError("Informe apenas uma máquina ou um segmento para a recorrência personalizada.", 400);
  }

  return {
    assetId,
    segmentId,
    targetKey: buildOverrideTargetKey({ assetId, segmentId }),
    recurrenceType,
    recurrenceInterval: normalizeRecurrenceIntervalDays(
      item.recurrenceIntervalDays ?? item.recurrenceInterval,
      recurrenceType,
      { strict: recurrenceType === "custom_days" }
    ),
    preferredTime: item.preferredTime ? normalizePreferredTime(item.preferredTime) : null,
    active: normalizeBoolean(item.active, true)
  };
}

function normalizeAssetListPayload(value) {
  if (!Array.isArray(value)) {
    throw createHttpError("assetIds deve ser uma lista de maquinas para o escopo asset_list.", 400);
  }

  const ids = normalizeAssetIds(value);
  if (!ids.length) {
    throw createHttpError("Selecione pelo menos uma maquina para automatizar a preventiva.", 400);
  }

  return ids;
}

function normalizeNonAssetListPayload(value, hasIncomingValue) {
  if (!hasIncomingValue || value == null) return [];
  if (!Array.isArray(value)) {
    throw createHttpError("assetIds so pode ser usado com o escopo asset_list.", 400);
  }

  const ids = normalizeAssetIds(value);
  if (ids.length) {
    throw createHttpError("assetIds so pode ser usado com o escopo asset_list.", 400);
  }

  return [];
}

function normalizePlanPayload(payload = {}, current = null) {
  const name = trimString(payload.name ?? current?.name, 120);
  const recurrenceType = normalizeRecurrenceType(payload.recurrenceType ?? current?.recurrenceType);
  const scopeType = normalizeScopeType(payload.scopeType ?? current?.scopeType);
  const rawAssetIds = payload.assetIds ?? payload.asset_ids;
  const hasIncomingAssetIds = rawAssetIds !== undefined;
  const assetIds = scopeType === "asset_list"
    ? normalizeAssetListPayload(hasIncomingAssetIds ? rawAssetIds : current?.assetIds)
    : normalizeNonAssetListPayload(rawAssetIds, hasIncomingAssetIds);
  const scopeId = scopeType === "all" || scopeType === "asset_list"
    ? null
    : trimString(payload.scopeId ?? current?.scopeId, 120) || null;
  const defaultScriptIds = normalizeScriptIds(payload.defaultScriptIds ?? current?.defaultScriptIds);

  if (name.length < 3) {
    throw createHttpError("Informe um nome para a automação preventiva com pelo menos 3 caracteres.", 400);
  }

  if (scopeType !== "all" && scopeType !== "asset_list" && !scopeId) {
    throw createHttpError("Informe o escopo da automação preventiva.", 400);
  }

  return {
    preventivePlanId: trimString(payload.preventivePlanId ?? payload.preventive_plan_id ?? current?.preventivePlanId, 120) || null,
    name,
    description: trimString(payload.description ?? current?.description, 1000),
    active: normalizeBoolean(payload.active, current ? current.active : true),
    recurrenceType,
    recurrenceInterval: normalizeRecurrenceIntervalDays(
      payload.recurrenceIntervalDays ?? payload.recurrenceInterval ?? current?.recurrenceIntervalDays ?? current?.recurrenceInterval,
      recurrenceType,
      { strict: recurrenceType === "custom_days" }
    ),
    preferredTime: normalizePreferredTime(payload.preferredTime ?? current?.preferredTime),
    timezone: normalizeTimezone(payload.timezone ?? current?.timezone),
    scopeType,
    scopeId,
    assetIds,
    defaultScriptIds,
    notes: trimString(payload.notes ?? current?.notes, 1000),
    indicatorColor: normalizeIndicatorColor(payload.indicatorColor ?? current?.indicatorColor),
    overrides: Array.isArray(payload.overrides)
      ? payload.overrides.map(normalizeOverridePayload).filter(Boolean)
      : undefined
  };
}

async function validateScripts(scriptIds, { requireAtLeastOne = true } = {}) {
  const ids = normalizeScriptIds(scriptIds);
  if (requireAtLeastOne && !ids.length) {
    throw createHttpError("Selecione pelo menos um script ativo para a rotina preventiva.", 400);
  }

  const scripts = [];
  for (const scriptId of ids) {
    const script = await findMaintenanceScriptById(scriptId);
    if (!script || script.active === false) {
      throw createHttpError("Um dos scripts selecionados não existe ou está inativo.", 400);
    }
    scripts.push(script);
  }

  return scripts;
}

function buildOverrideTargetKey({ assetId = null, segmentId = null } = {}) {
  if (assetId) return `asset:${assetId}`;
  if (segmentId) return `segment:${segmentId}`;
  return null;
}

function assertUniqueOverrides(overrides = []) {
  const seen = new Set();

  for (const override of overrides) {
    const targetKey = override.targetKey || buildOverrideTargetKey(override);
    if (!targetKey) continue;

    if (seen.has(targetKey)) {
      const error = createHttpError(
        targetKey.startsWith("asset:")
          ? "Esta máquina já possui recorrência personalizada neste plano."
          : "Este segmento já possui recorrência personalizada neste plano.",
        409
      );
      error.code = "DUPLICATE_PREVENTIVE_AUTOMATION_OVERRIDE";
      throw error;
    }
    seen.add(targetKey);
  }
}

function isDuplicateOverrideError(error) {
  return error?.code === "23505" || /idx_preventive_automation_overrides_target|preventive_automation_overrides.*unique/i.test(error?.message || "");
}

async function replaceOverrides(planId, overrides = [], db = query) {
  assertUniqueOverrides(overrides);
  await db("DELETE FROM preventive_automation_overrides WHERE plan_id = $1", [planId]);

  for (const override of overrides) {
    try {
      await db(
        `
          INSERT INTO preventive_automation_overrides (
            id, plan_id, asset_id, segment_id, target_key, recurrence_type,
            recurrence_interval, preferred_time, active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          randomUUID(),
          planId,
          override.assetId,
          override.segmentId,
          override.targetKey || buildOverrideTargetKey(override),
          override.recurrenceType,
          override.recurrenceInterval,
          override.preferredTime,
          override.active
        ]
      );
    } catch (error) {
      if (isDuplicateOverrideError(error)) {
        throw createHttpError("Este alvo já possui recorrência personalizada neste plano.", 409);
      }
      throw error;
    }
  }
}

async function listAssetSchedulesForPlan(planId, db = query) {
  const result = await db(
    `
      SELECT *
      FROM preventive_automation_asset_schedules
      WHERE plan_id = $1
      ORDER BY next_run_at ASC NULLS LAST, created_at ASC
    `,
    [planId]
  );

  return result.rows.map(fromAssetScheduleRow);
}

async function updatePlanNextRunFromAssetSchedules(planId, db = query) {
  const result = await db(
    `
      SELECT MIN(next_run_at) AS next_run_at
      FROM preventive_automation_asset_schedules
      WHERE plan_id = $1
        AND active = TRUE
        AND next_run_at IS NOT NULL
    `,
    [planId]
  );
  const nextRunAt = serializeTimestamp(result.rows[0]?.next_run_at);

  await db(
    `
      UPDATE preventive_automation_plans
      SET next_run_at = $2,
          updated_at = NOW()
      WHERE id = $1
    `,
    [planId, nextRunAt]
  );

  return nextRunAt;
}

export function hasPreventiveScheduleChanged(previousSchedule, nextSchedule) {
  if (!previousSchedule) return true;

  const previous = {
    recurrenceSource: previousSchedule.recurrenceSource || previousSchedule.recurrence_source || "plan",
    recurrenceType: normalizeRecurrenceType(previousSchedule.recurrenceType || previousSchedule.recurrence_type),
    recurrenceIntervalDays: normalizeRecurrenceIntervalDays(
      previousSchedule.recurrenceIntervalDays ?? previousSchedule.recurrence_interval,
      previousSchedule.recurrenceType || previousSchedule.recurrence_type
    ),
    preferredTime: normalizePreferredTime(previousSchedule.preferredTime || previousSchedule.preferred_time),
    timezone: normalizeTimezone(previousSchedule.timezone),
    active: previousSchedule.active !== false
  };
  const next = {
    recurrenceSource: nextSchedule.recurrenceSource || nextSchedule.recurrence_source || "plan",
    recurrenceType: normalizeRecurrenceType(nextSchedule.recurrenceType || nextSchedule.recurrence_type),
    recurrenceIntervalDays: normalizeRecurrenceIntervalDays(
      nextSchedule.recurrenceIntervalDays ?? nextSchedule.recurrence_interval,
      nextSchedule.recurrenceType || nextSchedule.recurrence_type
    ),
    preferredTime: normalizePreferredTime(nextSchedule.preferredTime || nextSchedule.preferred_time),
    timezone: normalizeTimezone(nextSchedule.timezone),
    active: nextSchedule.active !== false
  };

  return Object.keys(next).some((key) => previous[key] !== next[key]);
}

function chooseScheduleRecalculationBase({ existing, plan }) {
  return (
    existing?.lastScheduledAt ||
    plan.scheduleAnchorAt ||
    existing?.createdAt ||
    plan.createdAt ||
    new Date().toISOString()
  );
}

function computeScheduleNextRunAt({ existing, plan, recurrence, nextSchedule }) {
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

async function syncAssetSchedulesForPlan(plan, assets, db = query) {
  const existingSchedules = await listAssetSchedulesForPlan(plan.id, db);
  const existingByAsset = new Map(existingSchedules.map((schedule) => [String(schedule.assetId), schedule]));
  const syncActions = getAssetScheduleSyncActions(existingSchedules, assets.map((asset) => asset.id));
  const scheduleAnchorAt = plan.scheduleAnchorAt || plan.createdAt || new Date().toISOString();

  for (const asset of assets) {
    const recurrence = resolveEffectiveRecurrence(plan, asset);
    const existing = existingByAsset.get(String(asset.id));
    const nextSchedule = {
      recurrenceSource: recurrence.source,
      recurrenceType: recurrence.recurrenceType,
      recurrenceIntervalDays: recurrence.recurrenceIntervalDays,
      preferredTime: recurrence.preferredTime || plan.preferredTime,
      timezone: recurrence.timezone || plan.timezone,
      active: true
    };
    const nextRunAt = computeScheduleNextRunAt({
      existing,
      plan: { ...plan, scheduleAnchorAt },
      recurrence,
      nextSchedule
    });

    await db(
      `
        INSERT INTO preventive_automation_asset_schedules (
          id, plan_id, asset_id, recurrence_source, recurrence_type,
          recurrence_interval, preferred_time, timezone, next_run_at, active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
        ON CONFLICT (plan_id, asset_id)
        DO UPDATE SET recurrence_source = EXCLUDED.recurrence_source,
                      recurrence_type = EXCLUDED.recurrence_type,
                      recurrence_interval = EXCLUDED.recurrence_interval,
                      preferred_time = EXCLUDED.preferred_time,
                      timezone = EXCLUDED.timezone,
                      active = TRUE,
                      next_run_at = EXCLUDED.next_run_at,
                      updated_at = NOW()
      `,
      [
        existing?.id || randomUUID(),
        plan.id,
        asset.id,
        recurrence.source,
        recurrence.recurrenceType,
        recurrence.recurrenceIntervalDays,
        recurrence.preferredTime || plan.preferredTime,
        recurrence.timezone || plan.timezone,
        nextRunAt
      ]
    );
  }

  for (const scheduleId of syncActions.disable) {
    await db(
      `
        UPDATE preventive_automation_asset_schedules
        SET active = FALSE,
            updated_at = NOW()
        WHERE id = $1
      `,
      [scheduleId]
    );
  }

  return updatePlanNextRunFromAssetSchedules(plan.id, db);
}

async function ensurePlanRowSchedule(row) {
  if (!row) return null;
  if (row.next_run_at && row.schedule_anchor_at) return row;

  const scheduleAnchorAt = serializeTimestamp(row.schedule_anchor_at || row.created_at || new Date());
  const nextRunAt = serializeTimestamp(row.next_run_at) || computeNextScheduledFor(row, scheduleAnchorAt);
  const lastScheduledAt = serializeTimestamp(row.last_scheduled_at) || nextRunAt;

  await query(
    `
      UPDATE preventive_automation_plans
      SET schedule_anchor_at = COALESCE(schedule_anchor_at, $2),
          next_run_at = COALESCE(next_run_at, $3),
          last_scheduled_at = COALESCE(last_scheduled_at, $4)
      WHERE id = $1
    `,
    [row.id, scheduleAnchorAt, nextRunAt, lastScheduledAt]
  );

  return {
    ...row,
    schedule_anchor_at: row.schedule_anchor_at || scheduleAnchorAt,
    next_run_at: row.next_run_at || nextRunAt,
    last_scheduled_at: row.last_scheduled_at || lastScheduledAt
  };
}

async function hydratePlan(plan) {
  if (!plan) return null;

  const [overrideResult, runResult, scheduleResult] = await Promise.all([
    query(
      `
        SELECT *
        FROM preventive_automation_overrides
        WHERE plan_id = $1
        ORDER BY created_at ASC
      `,
      [plan.id]
    ),
    query(
      `
        SELECT *
        FROM preventive_automation_runs
        WHERE plan_id = $1
        ORDER BY created_at DESC
      `,
      [plan.id]
    ),
    query(
      `
        SELECT *
        FROM preventive_automation_asset_schedules
        WHERE plan_id = $1
        ORDER BY next_run_at ASC NULLS LAST, created_at ASC
      `,
      [plan.id]
    )
  ]);

  const runs = runResult.rows.map(fromRunRow);
  const overrides = overrideResult.rows.map(fromOverrideRow);
  const assetSchedules = scheduleResult.rows.map(fromAssetScheduleRow);

  return {
    ...plan,
    overrides,
    assetSchedules,
    overrideCount: overrides.filter((override) => override.active !== false).length,
    latestRun: runs[0] || null,
    recentRuns: runs.slice(0, 10)
  };
}

export async function listPreventiveAutomationPlans() {
  const result = await query(`
    SELECT automation.*,
           plans.name AS preventive_plan_name
    FROM preventive_automation_plans automation
    LEFT JOIN preventive_plans plans ON plans.id = automation.preventive_plan_id
    ORDER BY automation.created_at DESC
  `);

  const rows = [];
  for (const row of result.rows) {
    rows.push(await ensurePlanRowSchedule(row));
  }

  return Promise.all(rows.map((row) => hydratePlan(fromPlanRow(row))));
}

export async function findPreventiveAutomationPlanById(id) {
  const result = await query(
    `
      SELECT automation.*,
             plans.name AS preventive_plan_name
      FROM preventive_automation_plans automation
      LEFT JOIN preventive_plans plans ON plans.id = automation.preventive_plan_id
      WHERE automation.id = $1
    `,
    [id]
  );
  const row = await ensurePlanRowSchedule(result.rows[0]);
  return hydratePlan(fromPlanRow(row));
}

export async function findPreventiveAutomationPlanByPreventivePlanId(preventivePlanId) {
  const result = await query(
    `
      SELECT automation.*,
             plans.name AS preventive_plan_name
      FROM preventive_automation_plans automation
      LEFT JOIN preventive_plans plans ON plans.id = automation.preventive_plan_id
      WHERE automation.preventive_plan_id = $1
      ORDER BY automation.created_at DESC
      LIMIT 1
    `,
    [preventivePlanId]
  );
  const row = await ensurePlanRowSchedule(result.rows[0]);
  return hydratePlan(fromPlanRow(row));
}

export async function createPreventiveAutomationPlanRecord(payload = {}, user = null, db = query) {
  const normalized = normalizePlanPayload(payload);
  await validateScripts(normalized.defaultScriptIds);
  const assets = await validateScopeSelection(normalized);

  const id = payload.id || randomUUID();
  const scheduleAnchorAt = new Date().toISOString();
  const nextRunAt = computeNextScheduledFor(normalized, scheduleAnchorAt);

  await db(
    `
      INSERT INTO preventive_automation_plans (
        id, preventive_plan_id, name, description, active, recurrence_type, recurrence_interval,
        preferred_time, timezone, scope_type, scope_id, default_script_ids,
        asset_ids, notes, indicator_color, last_scheduled_at, next_run_at, schedule_anchor_at, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    `,
    [
      id,
      normalized.preventivePlanId,
      normalized.name,
      normalized.description,
      normalized.active,
      normalized.recurrenceType,
      normalized.recurrenceInterval,
      normalized.preferredTime,
      normalized.timezone,
      normalized.scopeType,
      normalized.scopeId,
      JSON.stringify(normalized.defaultScriptIds),
      JSON.stringify(normalized.assetIds),
      normalized.notes,
      normalized.indicatorColor,
      nextRunAt,
      nextRunAt,
      scheduleAnchorAt,
      user?.id || null
    ]
  );

  const overrides = normalized.overrides || [];
  await replaceOverrides(id, overrides, db);
  await syncAssetSchedulesForPlan({ ...normalized, id, overrides, scheduleAnchorAt, createdAt: scheduleAnchorAt }, assets, db);
  await addLog({
    type: "preventive_automation_created",
    message: `Automacao preventiva criada: ${normalized.name}. Rotina aguardando agente seguro.`,
    userId: user?.id || null,
    meta: {
      preventivePlanId: normalized.preventivePlanId,
      preventiveAutomationPlanId: id,
      scopeType: normalized.scopeType,
      scopeId: normalized.scopeId,
      assetIds: normalized.assetIds,
      nextRunAt
    },
    db
  });

  return id;
}

export async function createPreventiveAutomationPlan(payload = {}, user = null) {
  const normalized = normalizePlanPayload(payload);
  await validateScripts(normalized.defaultScriptIds);
  const assets = await validateScopeSelection(normalized);

  const id = randomUUID();
  const scheduleAnchorAt = new Date().toISOString();
  const nextRunAt = computeNextScheduledFor(normalized, scheduleAnchorAt);

  await withTransaction(async (db) => {
    await db(
      `
        INSERT INTO preventive_automation_plans (
          id, name, description, active, recurrence_type, recurrence_interval,
          preferred_time, timezone, scope_type, scope_id, default_script_ids,
          asset_ids, notes, indicator_color, last_scheduled_at, next_run_at, schedule_anchor_at, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `,
      [
        id,
        normalized.name,
        normalized.description,
        normalized.active,
        normalized.recurrenceType,
        normalized.recurrenceInterval,
        normalized.preferredTime,
        normalized.timezone,
        normalized.scopeType,
        normalized.scopeId,
        JSON.stringify(normalized.defaultScriptIds),
        JSON.stringify(normalized.assetIds),
        normalized.notes,
        normalized.indicatorColor,
        nextRunAt,
        nextRunAt,
        scheduleAnchorAt,
        user?.id || null
      ]
    );

    const overrides = normalized.overrides || [];
    await replaceOverrides(id, overrides, db);
    await syncAssetSchedulesForPlan({ ...normalized, id, overrides, scheduleAnchorAt, createdAt: scheduleAnchorAt }, assets, db);
    await addLog({
      type: "preventive_automation_created",
      message: `Automação preventiva criada: ${normalized.name}. Rotina aguardando agente seguro.`,
      userId: user?.id || null,
      meta: {
        preventiveAutomationPlanId: id,
        scopeType: normalized.scopeType,
        scopeId: normalized.scopeId,
        assetIds: normalized.assetIds,
        nextRunAt
      },
      db
    });
  });

  return findPreventiveAutomationPlanById(id);
}

export async function updatePreventiveAutomationPlan(id, payload = {}, user = null) {
  const current = await findPreventiveAutomationPlanById(id);
  if (!current) return null;

  const normalized = normalizePlanPayload(payload, current);
  await validateScripts(normalized.defaultScriptIds);
  const assets = await validateScopeSelection(normalized);

  const scheduleAnchorAt = current.scheduleAnchorAt || new Date().toISOString();
  const nextRunAt = computeNextScheduledFor(normalized, new Date());

  await withTransaction(async (db) => {
    await db(
      `
        UPDATE preventive_automation_plans
        SET name = $2,
            description = $3,
            active = $4,
            recurrence_type = $5,
            recurrence_interval = $6,
            preferred_time = $7,
            timezone = $8,
            scope_type = $9,
            scope_id = $10,
            default_script_ids = $11,
            asset_ids = $12,
            notes = $13,
            indicator_color = $14,
            last_scheduled_at = COALESCE(last_scheduled_at, $15),
            next_run_at = COALESCE(next_run_at, $16),
            schedule_anchor_at = COALESCE(schedule_anchor_at, $17),
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        id,
        normalized.name,
        normalized.description,
        normalized.active,
        normalized.recurrenceType,
        normalized.recurrenceInterval,
        normalized.preferredTime,
        normalized.timezone,
        normalized.scopeType,
        normalized.scopeId,
        JSON.stringify(normalized.defaultScriptIds),
        JSON.stringify(normalized.assetIds),
        normalized.notes,
        normalized.indicatorColor,
        nextRunAt,
        nextRunAt,
        scheduleAnchorAt
      ]
    );

    const overrides = normalized.overrides || current.overrides || [];
    if (normalized.overrides) {
      await replaceOverrides(id, overrides, db);
    }
    await syncAssetSchedulesForPlan({ ...normalized, id, overrides, scheduleAnchorAt }, assets, db);
    await addLog({
      type: "preventive_automation_updated",
      message: `Automação preventiva atualizada: ${normalized.name}.`,
      userId: user?.id || null,
      meta: { preventiveAutomationPlanId: id, scopeType: normalized.scopeType, scopeId: normalized.scopeId, assetIds: normalized.assetIds, nextRunAt },
      db
    });
  });

  return findPreventiveAutomationPlanById(id);
}

export async function disablePreventiveAutomationPlan(id, user = null) {
  const current = await findPreventiveAutomationPlanById(id);
  if (!current) return null;

  await withTransaction(async (db) => {
    await db(
      `
        UPDATE preventive_automation_plans
        SET active = FALSE,
            updated_at = NOW()
        WHERE id = $1
      `,
      [id]
    );
    await db(
      `
        UPDATE preventive_automation_asset_schedules
        SET active = FALSE,
            updated_at = NOW()
        WHERE plan_id = $1
      `,
      [id]
    );

    await addLog({
      type: "preventive_automation_disabled",
      message: `Automação preventiva desativada: ${current.name}.`,
      userId: user?.id || null,
      meta: { preventiveAutomationPlanId: id },
      db
    });
  });

  return findPreventiveAutomationPlanById(id);
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

export function resolveAssetListDevices(assetIds = [], devices = []) {
  const ids = normalizeAssetIds(assetIds);
  if (!ids.length) {
    throw createHttpError("Selecione pelo menos uma maquina para automatizar a preventiva.", 400);
  }

  const devicesById = new Map(devices.map((device) => [String(device.id), device]));
  const missingIds = ids.filter((id) => !devicesById.has(String(id)));
  if (missingIds.length) {
    throw createHttpError("Uma ou mais maquinas selecionadas nao existem.", 400);
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

async function assertScopeExists(plan, devices) {
  if (plan.scopeType === "asset") {
    if (devices.some((device) => String(device.id) === String(plan.scopeId))) return;
    throw createHttpError("O escopo selecionado não existe.", 400);
  }

  if (plan.scopeType === "asset_list") {
    resolveAssetListDevices(plan.assetIds, devices);
    return;
  }

  if (plan.scopeType === "segment") {
    if (devices.some((device) => String(device.segmentId) === String(plan.scopeId))) return;
    const result = await query("SELECT id FROM inventory_segments WHERE id = $1 LIMIT 1", [plan.scopeId]);
    if (result.rows.length) return;
    throw createHttpError("O escopo selecionado não existe.", 400);
  }

  if (plan.scopeType === "group") {
    const result = await query("SELECT id FROM segment_groups WHERE id = $1 LIMIT 1", [plan.scopeId]);
    if (result.rows.length) return;
    throw createHttpError("O escopo selecionado não existe.", 400);
  }
}

async function resolvePlanAssets(plan) {
  const devices = await listDevices({});
  await assertScopeExists(plan, devices);

  if (plan.scopeType === "asset") {
    return devices.filter((device) => String(device.id) === String(plan.scopeId));
  }

  if (plan.scopeType === "asset_list") {
    return resolveAssetListDevices(plan.assetIds, devices);
  }

  if (plan.scopeType === "segment") {
    return devices.filter((device) => String(device.segmentId) === String(plan.scopeId));
  }

  if (plan.scopeType === "group") {
    const segmentResult = await query("SELECT id FROM inventory_segments WHERE group_id = $1", [plan.scopeId]);
    const segmentIds = new Set(segmentResult.rows.map((row) => String(row.id)));
    return devices.filter((device) => segmentIds.has(String(device.segmentId)));
  }

  return devices;
}

async function validateScopeSelection(plan, { requireAssets = true } = {}) {
  const assets = await resolvePlanAssets(plan);
  if (requireAssets && !assets.length) {
    throw createHttpError("O escopo selecionado não possui máquinas disponíveis para a rotina preventiva.", 400);
  }
  return assets;
}

async function validatePlanForPreparation(plan) {
  if (plan.active === false) {
    throw createHttpError("Um plano inativo não pode ser preparado.", 409);
  }

  const scripts = await validateScripts(plan.defaultScriptIds);
  const assets = await validateScopeSelection(plan);

  return { scripts, assets };
}

export async function backfillPreventiveAutomationAssetSchedules({ user = null } = {}) {
  const result = await query(`
    SELECT *
    FROM preventive_automation_plans
    ORDER BY created_at ASC
  `);
  const summary = {
    analyzedPlanCount: result.rows.length,
    createdScheduleCount: 0,
    updatedScheduleCount: 0,
    ignoredScheduleCount: 0,
    deactivatedScheduleCount: 0,
    failedPlanCount: 0,
    plans: []
  };

  for (const row of result.rows) {
    const plan = fromPlanRow(await ensurePlanRowSchedule(row));

    try {
      const overrideResult = await query(
        `
          SELECT *
          FROM preventive_automation_overrides
          WHERE plan_id = $1
          ORDER BY created_at ASC
        `,
        [plan.id]
      );
      const planWithOverrides = {
        ...plan,
        overrides: overrideResult.rows.map(fromOverrideRow)
      };
      const beforeResult = await query(
        `
          SELECT *
          FROM preventive_automation_asset_schedules
          WHERE plan_id = $1
        `,
        [plan.id]
      );
      const beforeByAsset = new Map(beforeResult.rows.map((schedule) => [String(schedule.asset_id), fromAssetScheduleRow(schedule)]));
      const assets = await resolvePlanAssets(planWithOverrides);

      await withTransaction(async (db) => {
        await syncAssetSchedulesForPlan(planWithOverrides, assets, db);
      });

      const afterResult = await query(
        `
          SELECT *
          FROM preventive_automation_asset_schedules
          WHERE plan_id = $1
        `,
        [plan.id]
      );
      let created = 0;
      let updated = 0;
      let ignored = 0;
      let deactivated = 0;

      for (const rowAfter of afterResult.rows) {
        const after = fromAssetScheduleRow(rowAfter);
        const before = beforeByAsset.get(String(after.assetId));
        if (!before) {
          created += 1;
          continue;
        }
        if (before.active && !after.active) {
          deactivated += 1;
          continue;
        }
        if (
          before.nextRunAt !== after.nextRunAt ||
          before.recurrenceSource !== after.recurrenceSource ||
          before.recurrenceType !== after.recurrenceType ||
          before.recurrenceIntervalDays !== after.recurrenceIntervalDays ||
          before.preferredTime !== after.preferredTime ||
          before.timezone !== after.timezone ||
          before.active !== after.active
        ) {
          updated += 1;
        } else {
          ignored += 1;
        }
      }

      summary.createdScheduleCount += created;
      summary.updatedScheduleCount += updated;
      summary.ignoredScheduleCount += ignored;
      summary.deactivatedScheduleCount += deactivated;
      summary.plans.push({
        planId: plan.id,
        status: "ok",
        assetCount: assets.length,
        created,
        updated,
        ignored,
        deactivated
      });
    } catch (error) {
      summary.failedPlanCount += 1;
      summary.plans.push({
        planId: plan.id,
        status: "failed",
        message: error.message
      });
    }
  }

  await addLog({
    type: "preventive_automation_schedule_backfill",
    message:
      `Backfill de agendas preventivas: ${summary.createdScheduleCount} criada(s), ` +
      `${summary.updatedScheduleCount} atualizada(s), ${summary.failedPlanCount} falha(s).`,
    userId: user?.id || null,
    meta: {
      analyzedPlanCount: summary.analyzedPlanCount,
      createdScheduleCount: summary.createdScheduleCount,
      updatedScheduleCount: summary.updatedScheduleCount,
      ignoredScheduleCount: summary.ignoredScheduleCount,
      deactivatedScheduleCount: summary.deactivatedScheduleCount,
      failedPlanCount: summary.failedPlanCount
    }
  });

  return summary;
}

export function buildRunIdempotencyKey(planId, assetId, scheduledFor) {
  return `${planId}:${assetId}:${serializeTimestamp(scheduledFor) || scheduledFor}`;
}

async function findExistingRun(planId, assetId, scheduledFor, db = query) {
  const result = await db(
    `
      SELECT *
      FROM preventive_automation_runs
      WHERE plan_id = $1
        AND asset_id = $2
        AND scheduled_for = $3
      LIMIT 1
    `,
    [planId, assetId, scheduledFor]
  );
  return result.rows[0] ? fromRunRow(result.rows[0]) : null;
}

async function insertPreparedRun({ plan, asset, recurrence, scheduledFor, scripts, user, triggerType = "scheduled", db = query }) {
  const existingRun = await findExistingRun(plan.id, asset.id, scheduledFor, db);
  if (existingRun) return { run: existingRun, created: false };

  const runId = randomUUID();
  const nextRunAt = computeFollowingScheduledFor(
    {
      recurrenceType: recurrence.recurrenceType,
      recurrenceInterval: recurrence.recurrenceIntervalDays,
      preferredTime: recurrence.preferredTime || plan.preferredTime,
      timezone: plan.timezone
    },
    scheduledFor
  );
  const scriptSummary = scripts.length ? `${scripts.length} script(s) previsto(s)` : "Nenhum script vinculado";
  const logSummary =
    `Rotina preparada para ${asset.name || asset.id}. ${scriptSummary}. ` +
    `Recorrência efetiva: ${recurrence.source}/${recurrence.recurrenceIntervalDays} dia(s). ` +
    "Scripts reais dependem de agente seguro.";
  const idempotencyKey = buildRunIdempotencyKey(plan.id, asset.id, scheduledFor);

  try {
    const result = await db(
      `
        INSERT INTO preventive_automation_runs (
          id, plan_id, asset_id, status, scheduled_for, started_at,
          finished_at, result, log_summary, error_detected, idempotency_key,
          schedule_slot, recurrence_source, recurrence_interval, preferred_time, next_run_at,
          trigger_type
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6, $7, FALSE, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `,
      [
        runId,
        plan.id,
        asset.id,
        normalizeRunStatus("prepared"),
        scheduledFor,
        "prepared",
        logSummary,
        idempotencyKey,
        scheduledFor,
        recurrence.source,
        recurrence.recurrenceIntervalDays,
        recurrence.preferredTime || plan.preferredTime,
        nextRunAt,
        triggerType
      ]
    );

    await addAssetHistory({
      assetId: asset.id,
      eventType: "preventive_automation_prepared",
      message: `Automação preventiva '${plan.name}' preparada. Rotina aguardando agente seguro.`,
      newValue: logSummary,
      userId: user?.id || null,
      userName: user?.name || user?.email || "Sistema",
      db
    });

    return { run: fromRunRow(result.rows[0]), created: true };
  } catch (error) {
    if (error.code === "23505" || /unique/i.test(error.message || "")) {
      const run = await findExistingRun(plan.id, asset.id, scheduledFor, db);
      if (run) return { run, created: false };
    }

    throw error;
  }
}

async function listDueAssetSchedulesForPlan(planId, options = {}, db = query) {
  const now = toValidDate(options.now || new Date()).toISOString();
  const scheduleIds = Array.isArray(options.scheduleIds)
    ? options.scheduleIds.map((item) => trimString(item, 120)).filter(Boolean)
    : [];

  if (scheduleIds.length) {
    const placeholders = scheduleIds.map((_, index) => `$${index + 2}`).join(", ");
    const result = await db(
      `
        SELECT *
        FROM preventive_automation_asset_schedules
        WHERE plan_id = $1
          AND id IN (${placeholders})
          AND active = TRUE
        ORDER BY next_run_at ASC NULLS LAST, created_at ASC
      `,
      [planId, ...scheduleIds]
    );
    return result.rows.map(fromAssetScheduleRow);
  }

  const result = await db(
    `
      SELECT *
      FROM preventive_automation_asset_schedules
      WHERE plan_id = $1
        AND active = TRUE
        AND next_run_at IS NOT NULL
        AND next_run_at <= $2
      ORDER BY next_run_at ASC, created_at ASC
    `,
    [planId, now]
  );

  return result.rows.map(fromAssetScheduleRow);
}

export async function preparePreventiveAutomationPlan(id, user = null, options = {}) {
  const plan = await findPreventiveAutomationPlanById(id);
  if (!plan) return null;

  const { scripts, assets } = await validatePlanForPreparation(plan);
  const triggerType = options.triggerType || (options.scheduleIds ? "scheduled" : "manual");
  const manualScheduledFor = normalizeScheduleSlot(options.scheduledFor || new Date());
  const assetById = new Map(assets.map((asset) => [String(asset.id), asset]));
  const dueSchedules = triggerType === "scheduled"
    ? await listDueAssetSchedulesForPlan(plan.id, options)
    : [];
  const scheduledTargets = triggerType === "scheduled"
    ? dueSchedules
        .map((schedule) => ({ schedule, asset: assetById.get(String(schedule.assetId)) }))
        .filter((item) => item.asset)
    : assets.map((asset) => ({ asset, schedule: null }));
  const runs = [];
  let createdRuns = 0;

  if (triggerType === "scheduled" && !scheduledTargets.length) {
    return {
      preventiveAutomationPlan: plan,
      runs,
      preparedCount: 0,
      skippedExistingCount: 0
    };
  }

  await withTransaction(async (db) => {
    for (const target of scheduledTargets) {
      const asset = target.asset;
      const recurrence = target.schedule
        ? {
            recurrenceType: target.schedule.recurrenceType,
            recurrenceIntervalDays: target.schedule.recurrenceIntervalDays,
            preferredTime: target.schedule.preferredTime,
            timezone: target.schedule.timezone,
            source: target.schedule.recurrenceSource
          }
        : resolveEffectiveRecurrence(plan, asset);
      const scheduledFor = triggerType === "scheduled"
        ? normalizeScheduleSlot(target.schedule.nextRunAt)
        : manualScheduledFor;
      const { run, created } = await insertPreparedRun({
        plan,
        asset,
        recurrence,
        scheduledFor,
        scripts,
        user,
        triggerType,
        db
      });

      runs.push(run);
      if (created) createdRuns += 1;

      if (triggerType === "scheduled" && target.schedule) {
        await db(
          `
            UPDATE preventive_automation_asset_schedules
            SET last_scheduled_at = $2,
                last_prepared_at = NOW(),
                next_run_at = $3,
                updated_at = NOW()
            WHERE id = $1
          `,
          [target.schedule.id, scheduledFor, run.nextRunAt]
        );
      }
    }

    if (createdRuns > 0) {
      const preparedAt = new Date().toISOString();
      const nextRunAt = triggerType === "scheduled"
        ? await updatePlanNextRunFromAssetSchedules(plan.id, db)
        : plan.nextRunAt;

      await db(
        `
          UPDATE preventive_automation_plans
          SET last_prepared_at = $2,
              last_scheduled_at = CASE WHEN $5 = 'scheduled' THEN $3 ELSE last_scheduled_at END,
              next_run_at = COALESCE($4, next_run_at),
              updated_at = NOW()
          WHERE id = $1
        `,
        [plan.id, preparedAt, triggerType === "scheduled" ? runs[0]?.scheduledFor : null, nextRunAt, triggerType]
      );

      await addLog({
        type: triggerType === "scheduled" ? "preventive_automation_scheduled_prepared" : "preventive_automation_manual_prepared",
        message: `Automação preventiva preparada: ${plan.name}. Rotina aguardando agente seguro.`,
        userId: user?.id || null,
        meta: {
          preventiveAutomationPlanId: plan.id,
          assetCount: scheduledTargets.length,
          runCount: createdRuns,
          triggerType,
          nextRunAt
        },
        db
      });
    }
  });

  return {
    preventiveAutomationPlan: await findPreventiveAutomationPlanById(plan.id),
    runs,
    preparedCount: createdRuns,
    skippedExistingCount: runs.length - createdRuns
  };
}

export async function listDuePreventiveAutomationPlans(now = new Date()) {
  const result = await query(
    `
      SELECT DISTINCT plans.*
      FROM preventive_automation_asset_schedules schedules
      INNER JOIN preventive_automation_plans plans ON plans.id = schedules.plan_id
      WHERE plans.active = TRUE
        AND schedules.active = TRUE
        AND schedules.next_run_at IS NOT NULL
        AND schedules.next_run_at <= $1
      ORDER BY plans.next_run_at ASC NULLS LAST, plans.created_at ASC
    `,
    [toValidDate(now).toISOString()]
  );

  const rows = [];
  for (const row of result.rows) {
    rows.push(await ensurePlanRowSchedule(row));
  }

  return Promise.all(rows.map((row) => hydratePlan(fromPlanRow(row))));
}

export async function processDuePreventiveAutomationPlans(user = null) {
  const duePlans = await listDuePreventiveAutomationPlans();
  const plans = [];
  let preparedPlans = 0;
  let preparedRuns = 0;
  let skippedPlans = 0;
  let failedPlans = 0;

  for (const plan of duePlans) {
    try {
      const dueSchedules = await listDueAssetSchedulesForPlan(plan.id);
      const result = await preparePreventiveAutomationPlan(plan.id, user, {
        triggerType: "scheduled",
        scheduleIds: dueSchedules.map((schedule) => schedule.id)
      });
      const preparedCount = Number(result?.preparedCount || 0);

      if (preparedCount > 0) preparedPlans += 1;
      preparedRuns += preparedCount;
      if (!preparedCount) skippedPlans += 1;
      plans.push({
        planId: plan.id,
        status: preparedCount > 0 ? "prepared" : "skipped",
        preparedCount,
        skippedExistingCount: Number(result?.skippedExistingCount || 0),
        message: preparedCount > 0 ? "Plano preparado." : "Nenhuma máquina vencida para preparar."
      });
    } catch (error) {
      failedPlans += 1;
      plans.push({
        planId: plan.id,
        status: "failed",
        preparedCount: 0,
        message: error.message
      });
      await addLog({
        type: "preventive_automation_scheduler_plan_failed",
        message: `Falha ao processar plano preventivo ${plan.id}: ${error.message}`,
        userId: user?.id || null,
        meta: { preventiveAutomationPlanId: plan.id }
      });
    }
  }

  return {
    duePlanCount: duePlans.length,
    preparedPlanCount: preparedPlans,
    preparedRunCount: preparedRuns,
    skippedPlanCount: skippedPlans,
    failedPlanCount: failedPlans,
    plans
  };
}

export async function processScheduledMaintenanceTasks(user = null) {
  const backfill = await backfillPreventiveAutomationAssetSchedules({ user });
  const preventiveAutomation = await processDuePreventiveAutomationPlans(user);
  const scriptValidations = await refreshDueScriptValidations({ summary: true });

  return {
    backfill,
    preventiveAutomation,
    scriptValidations
  };
}
