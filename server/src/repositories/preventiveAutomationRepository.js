import { randomUUID } from "node:crypto";
import { query } from "../database.js";
import { addAssetHistory } from "./assetHistoryRepository.js";
import { addLog } from "./logRepository.js";
import { findMaintenanceScriptById } from "./maintenanceScriptRepository.js";
import { listDevices } from "../services/monitoringService.js";

const recurrenceTypes = new Set(["daily", "weekly", "biweekly", "monthly", "custom_days"]);
const scopeTypes = new Set(["asset", "segment", "group", "all"]);
const runStatuses = new Set(["scheduled", "prepared", "waiting_agent", "success", "error", "cancelled", "skipped"]);
const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_PREFERRED_TIME = "08:00";

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

export function normalizeRecurrenceType(value, fallback = "monthly") {
  const normalized = String(value || "").trim().toLowerCase();
  return recurrenceTypes.has(normalized) ? normalized : fallback;
}

export function defaultIntervalForType(type) {
  return recurrenceIntervalDefaults[normalizeRecurrenceType(type)] || recurrenceIntervalDefaults.monthly;
}

export function normalizeRecurrenceIntervalDays(value, type = "monthly") {
  const recurrenceType = normalizeRecurrenceType(type);
  if (recurrenceType !== "custom_days") {
    return defaultIntervalForType(recurrenceType);
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(365, Math.round(parsed));
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
    defaultScriptIds: parseJsonArray(row.default_script_ids),
    notes: row.notes || "",
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

function normalizeOverridePayload(item = {}) {
  const assetId = trimString(item.assetId, 120) || null;
  const segmentId = trimString(item.segmentId, 120) || null;
  const recurrenceType = normalizeRecurrenceType(item.recurrenceType);

  if (!assetId && !segmentId) return null;

  return {
    assetId,
    segmentId,
    recurrenceType,
    recurrenceInterval: normalizeRecurrenceIntervalDays(item.recurrenceIntervalDays ?? item.recurrenceInterval, recurrenceType),
    preferredTime: item.preferredTime ? normalizePreferredTime(item.preferredTime) : null,
    active: normalizeBoolean(item.active, true)
  };
}

function normalizePlanPayload(payload = {}, current = null) {
  const name = trimString(payload.name ?? current?.name, 120);
  const recurrenceType = normalizeRecurrenceType(payload.recurrenceType ?? current?.recurrenceType);
  const scopeType = normalizeScopeType(payload.scopeType ?? current?.scopeType);
  const scopeId = scopeType === "all" ? null : trimString(payload.scopeId ?? current?.scopeId, 120) || null;
  const defaultScriptIds = normalizeScriptIds(payload.defaultScriptIds ?? current?.defaultScriptIds);

  if (name.length < 3) {
    throw createHttpError("Informe um nome para a automacao preventiva com pelo menos 3 caracteres.", 400);
  }

  if (scopeType !== "all" && !scopeId) {
    throw createHttpError("Informe o escopo da automacao preventiva.", 400);
  }

  return {
    name,
    description: trimString(payload.description ?? current?.description, 1000),
    active: normalizeBoolean(payload.active, current ? current.active : true),
    recurrenceType,
    recurrenceInterval: normalizeRecurrenceIntervalDays(
      payload.recurrenceIntervalDays ?? payload.recurrenceInterval ?? current?.recurrenceIntervalDays ?? current?.recurrenceInterval,
      recurrenceType
    ),
    preferredTime: normalizePreferredTime(payload.preferredTime ?? current?.preferredTime),
    timezone: normalizeTimezone(payload.timezone ?? current?.timezone),
    scopeType,
    scopeId,
    defaultScriptIds,
    notes: trimString(payload.notes ?? current?.notes, 1000),
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
      throw createHttpError("Um dos scripts selecionados nao existe ou esta inativo.", 400);
    }
    scripts.push(script);
  }

  return scripts;
}

async function replaceOverrides(planId, overrides = []) {
  await query("DELETE FROM preventive_automation_overrides WHERE plan_id = $1", [planId]);

  for (const override of overrides) {
    await query(
      `
        INSERT INTO preventive_automation_overrides (
          id, plan_id, asset_id, segment_id, recurrence_type,
          recurrence_interval, preferred_time, active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        randomUUID(),
        planId,
        override.assetId,
        override.segmentId,
        override.recurrenceType,
        override.recurrenceInterval,
        override.preferredTime,
        override.active
      ]
    );
  }
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

  const [overrideResult, runResult] = await Promise.all([
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
    )
  ]);

  const runs = runResult.rows.map(fromRunRow);
  const overrides = overrideResult.rows.map(fromOverrideRow);

  return {
    ...plan,
    overrides,
    overrideCount: overrides.filter((override) => override.active !== false).length,
    latestRun: runs[0] || null,
    recentRuns: runs.slice(0, 10)
  };
}

export async function listPreventiveAutomationPlans() {
  const result = await query(`
    SELECT *
    FROM preventive_automation_plans
    ORDER BY created_at DESC
  `);

  const rows = [];
  for (const row of result.rows) {
    rows.push(await ensurePlanRowSchedule(row));
  }

  return Promise.all(rows.map((row) => hydratePlan(fromPlanRow(row))));
}

export async function findPreventiveAutomationPlanById(id) {
  const result = await query("SELECT * FROM preventive_automation_plans WHERE id = $1", [id]);
  const row = await ensurePlanRowSchedule(result.rows[0]);
  return hydratePlan(fromPlanRow(row));
}

export async function createPreventiveAutomationPlan(payload = {}, user = null) {
  const normalized = normalizePlanPayload(payload);
  await validateScripts(normalized.defaultScriptIds);
  await validateScopeSelection(normalized);

  const id = randomUUID();
  const scheduleAnchorAt = new Date().toISOString();
  const nextRunAt = computeNextScheduledFor(normalized, scheduleAnchorAt);

  await query(
    `
      INSERT INTO preventive_automation_plans (
        id, name, description, active, recurrence_type, recurrence_interval,
        preferred_time, timezone, scope_type, scope_id, default_script_ids,
        notes, last_scheduled_at, next_run_at, schedule_anchor_at, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
      normalized.notes,
      nextRunAt,
      nextRunAt,
      scheduleAnchorAt,
      user?.id || null
    ]
  );

  await replaceOverrides(id, normalized.overrides || []);
  await addLog({
    type: "preventive_automation_created",
    message: `Automacao preventiva criada: ${normalized.name}. Rotina aguardando agente seguro.`,
    userId: user?.id || null,
    meta: {
      preventiveAutomationPlanId: id,
      scopeType: normalized.scopeType,
      scopeId: normalized.scopeId,
      nextRunAt
    }
  });

  return findPreventiveAutomationPlanById(id);
}

export async function updatePreventiveAutomationPlan(id, payload = {}, user = null) {
  const current = await findPreventiveAutomationPlanById(id);
  if (!current) return null;

  const normalized = normalizePlanPayload(payload, current);
  await validateScripts(normalized.defaultScriptIds);
  await validateScopeSelection(normalized);

  const scheduleAnchorAt = current.scheduleAnchorAt || new Date().toISOString();
  const nextRunAt = computeNextScheduledFor(normalized, new Date());

  await query(
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
          notes = $12,
          last_scheduled_at = $13,
          next_run_at = $14,
          schedule_anchor_at = COALESCE(schedule_anchor_at, $15),
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
      normalized.notes,
      nextRunAt,
      nextRunAt,
      scheduleAnchorAt
    ]
  );

  if (normalized.overrides) {
    await replaceOverrides(id, normalized.overrides);
  }

  await addLog({
    type: "preventive_automation_updated",
    message: `Automacao preventiva atualizada: ${normalized.name}.`,
    userId: user?.id || null,
    meta: { preventiveAutomationPlanId: id, nextRunAt }
  });

  return findPreventiveAutomationPlanById(id);
}

export async function disablePreventiveAutomationPlan(id, user = null) {
  const current = await findPreventiveAutomationPlanById(id);
  if (!current) return null;

  await query(
    `
      UPDATE preventive_automation_plans
      SET active = FALSE,
          updated_at = NOW()
      WHERE id = $1
    `,
    [id]
  );

  await addLog({
    type: "preventive_automation_disabled",
    message: `Automacao preventiva desativada: ${current.name}.`,
    userId: user?.id || null,
    meta: { preventiveAutomationPlanId: id }
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

async function assertScopeExists(plan, devices) {
  if (plan.scopeType === "asset") {
    if (devices.some((device) => String(device.id) === String(plan.scopeId))) return;
    throw createHttpError("O escopo selecionado nao existe.", 400);
  }

  if (plan.scopeType === "segment") {
    if (devices.some((device) => String(device.segmentId) === String(plan.scopeId))) return;
    const result = await query("SELECT id FROM inventory_segments WHERE id = $1 LIMIT 1", [plan.scopeId]);
    if (result.rows.length) return;
    throw createHttpError("O escopo selecionado nao existe.", 400);
  }

  if (plan.scopeType === "group") {
    const result = await query("SELECT id FROM segment_groups WHERE id = $1 LIMIT 1", [plan.scopeId]);
    if (result.rows.length) return;
    throw createHttpError("O escopo selecionado nao existe.", 400);
  }
}

async function resolvePlanAssets(plan) {
  const devices = await listDevices({});
  await assertScopeExists(plan, devices);

  if (plan.scopeType === "asset") {
    return devices.filter((device) => String(device.id) === String(plan.scopeId));
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
    throw createHttpError("O escopo selecionado nao possui maquinas disponiveis para a rotina preventiva.", 400);
  }
  return assets;
}

async function validatePlanForPreparation(plan) {
  if (plan.active === false) {
    throw createHttpError("Um plano inativo nao pode ser preparado.", 409);
  }

  const scripts = await validateScripts(plan.defaultScriptIds);
  const assets = await validateScopeSelection(plan);

  return { scripts, assets };
}

export function buildRunIdempotencyKey(planId, assetId, scheduledFor) {
  return `${planId}:${assetId}:${serializeTimestamp(scheduledFor) || scheduledFor}`;
}

async function findExistingRun(planId, assetId, scheduledFor) {
  const result = await query(
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

async function insertPreparedRun({ plan, asset, recurrence, scheduledFor, scripts, user }) {
  const existingRun = await findExistingRun(plan.id, asset.id, scheduledFor);
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
    `Recorrencia efetiva: ${recurrence.source}/${recurrence.recurrenceIntervalDays} dia(s). ` +
    "Scripts reais dependem de agente seguro.";
  const idempotencyKey = buildRunIdempotencyKey(plan.id, asset.id, scheduledFor);

  try {
    const result = await query(
      `
        INSERT INTO preventive_automation_runs (
          id, plan_id, asset_id, status, scheduled_for, started_at,
          finished_at, result, log_summary, error_detected, idempotency_key,
          schedule_slot, recurrence_source, recurrence_interval, preferred_time, next_run_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6, $7, FALSE, $8, $9, $10, $11, $12, $13)
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
        nextRunAt
      ]
    );

    await addAssetHistory({
      assetId: asset.id,
      eventType: "preventive_automation_prepared",
      message: `Automacao preventiva '${plan.name}' preparada. Rotina aguardando agente seguro.`,
      newValue: logSummary,
      userId: user?.id || null,
      userName: user?.name || user?.email || "Sistema"
    });

    return { run: fromRunRow(result.rows[0]), created: true };
  } catch (error) {
    if (error.code === "23505" || /unique/i.test(error.message || "")) {
      const run = await findExistingRun(plan.id, asset.id, scheduledFor);
      if (run) return { run, created: false };
    }

    throw error;
  }
}

export async function preparePreventiveAutomationPlan(id, user = null, options = {}) {
  const plan = await findPreventiveAutomationPlanById(id);
  if (!plan) return null;

  const { scripts, assets } = await validatePlanForPreparation(plan);
  const scheduledFor = options.scheduledFor
    ? normalizeScheduleSlot(options.scheduledFor)
    : (plan.nextRunAt || computeNextScheduledFor(plan, new Date()));
  const runs = [];
  let createdRuns = 0;

  for (const asset of assets) {
    const recurrence = resolveEffectiveRecurrence(plan, asset);
    const { run, created } = await insertPreparedRun({
      plan,
      asset,
      recurrence,
      scheduledFor,
      scripts,
      user
    });
    runs.push(run);
    if (created) createdRuns += 1;
  }

  if (createdRuns > 0) {
    const preparedAt = new Date().toISOString();
    const nextRunAt =
      runs.reduce((earliest, run) => {
        const candidate = serializeTimestamp(run?.nextRunAt);
        if (!candidate) return earliest;
        if (!earliest) return candidate;
        return new Date(candidate) < new Date(earliest) ? candidate : earliest;
      }, null) || computeFollowingScheduledFor(plan, scheduledFor);

    await query(
      `
        UPDATE preventive_automation_plans
        SET last_prepared_at = $2,
            last_scheduled_at = $3,
            next_run_at = $4,
            updated_at = NOW()
        WHERE id = $1
      `,
      [plan.id, preparedAt, scheduledFor, nextRunAt]
    );

    await addLog({
      type: "preventive_automation_prepared",
      message: `Automacao preventiva preparada: ${plan.name}. Rotina aguardando agente seguro.`,
      userId: user?.id || null,
      meta: {
        preventiveAutomationPlanId: plan.id,
        assetCount: assets.length,
        runCount: createdRuns,
        scheduleSlot: scheduledFor,
        nextRunAt
      }
    });
  }

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
      SELECT *
      FROM preventive_automation_plans
      WHERE active = TRUE
        AND next_run_at IS NOT NULL
        AND next_run_at <= $1
      ORDER BY next_run_at ASC
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
  const results = [];
  let preparedPlans = 0;
  let preparedRuns = 0;

  for (const plan of duePlans) {
    const result = await preparePreventiveAutomationPlan(plan.id, user, { scheduledFor: plan.nextRunAt });
    if (result) {
      results.push(result);
      if (result.preparedCount > 0) preparedPlans += 1;
      preparedRuns += Number(result.preparedCount || 0);
    }
  }

  return {
    duePlanCount: duePlans.length,
    preparedPlanCount: preparedPlans,
    preparedRunCount: preparedRuns,
    results
  };
}
