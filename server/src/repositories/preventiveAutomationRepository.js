import { randomUUID } from "node:crypto";
import { query } from "../database.js";
import { addAssetHistory } from "./assetHistoryRepository.js";
import { addLog } from "./logRepository.js";
import { findMaintenanceScriptById } from "./maintenanceScriptRepository.js";
import { listDevices } from "../services/monitoringService.js";

const recurrenceTypes = new Set(["daily", "weekly", "biweekly", "monthly", "custom_days"]);
const scopeTypes = new Set(["asset", "segment", "group", "all"]);
const runStatuses = new Set(["scheduled", "prepared", "waiting_agent", "success", "error", "cancelled", "skipped"]);

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

function normalizeScriptIds(value = []) {
  return [
    ...new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => trimString(item, 120))
        .filter(Boolean)
    )
  ];
}

function normalizeRecurrenceType(value, fallback = "monthly") {
  const normalized = String(value || "").trim().toLowerCase();
  return recurrenceTypes.has(normalized) ? normalized : fallback;
}

function defaultIntervalForType(type) {
  return {
    daily: 1,
    weekly: 7,
    biweekly: 15,
    monthly: 30,
    custom_days: 30
  }[type] || 30;
}

function normalizeInterval(value, type = "monthly") {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(365, Math.round(parsed));
  }
  return defaultIntervalForType(type);
}

function normalizePreferredTime(value, fallback = "08:00") {
  const text = trimString(value, 5, fallback);
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback;
}

function normalizeScopeType(value, fallback = "all") {
  const normalized = String(value || "").trim().toLowerCase();
  return scopeTypes.has(normalized) ? normalized : fallback;
}

function normalizeRunStatus(value, fallback = "scheduled") {
  const normalized = String(value || "").trim().toLowerCase();
  return runStatuses.has(normalized) ? normalized : fallback;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function recurrenceToDays(type, interval) {
  if (type === "daily") return interval || 1;
  if (type === "weekly") return (interval || 1) * 7;
  if (type === "biweekly") return (interval || 1) * 15;
  if (type === "monthly") return (interval || 1) * 30;
  return interval || 30;
}

function computeNextScheduledFor(source, fromDate = new Date()) {
  const preferredTime = normalizePreferredTime(source?.preferredTime || source?.preferred_time || "08:00");
  const [hours, minutes] = preferredTime.split(":").map(Number);
  const next = new Date(fromDate);
  next.setHours(hours, minutes, 0, 0);

  if (next <= fromDate) {
    const type = normalizeRecurrenceType(source?.recurrenceType || source?.recurrence_type);
    const interval = normalizeInterval(source?.recurrenceInterval || source?.recurrence_interval, type);
    return addDays(next, recurrenceToDays(type, interval)).toISOString();
  }

  return next.toISOString();
}

function fromPlanRow(row) {
  if (!row) return null;
  const recurrenceType = normalizeRecurrenceType(row.recurrence_type);
  const recurrenceInterval = normalizeInterval(row.recurrence_interval, recurrenceType);

  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    active: row.active !== false,
    recurrenceType,
    recurrenceInterval,
    preferredTime: row.preferred_time || "08:00",
    timezone: row.timezone || "America/Sao_Paulo",
    scopeType: row.scope_type || "all",
    scopeId: row.scope_id,
    defaultScriptIds: parseJsonArray(row.default_script_ids),
    notes: row.notes || "",
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    nextScheduledFor: computeNextScheduledFor(row)
  };
}

function fromOverrideRow(row) {
  return {
    id: row.id,
    planId: row.plan_id,
    assetId: row.asset_id,
    segmentId: row.segment_id,
    recurrenceType: normalizeRecurrenceType(row.recurrence_type),
    recurrenceInterval: normalizeInterval(row.recurrence_interval, row.recurrence_type),
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
    scheduledFor: row.scheduled_for,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    result: row.result || "",
    logSummary: row.log_summary || "",
    errorDetected: row.error_detected === true,
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
    recurrenceInterval: normalizeInterval(item.recurrenceInterval, recurrenceType),
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
    const error = new Error("Informe um nome para a automacao preventiva com pelo menos 3 caracteres.");
    error.statusCode = 400;
    throw error;
  }

  if (scopeType !== "all" && !scopeId) {
    const error = new Error("Informe o escopo da automacao preventiva.");
    error.statusCode = 400;
    throw error;
  }

  return {
    name,
    description: trimString(payload.description ?? current?.description, 1000),
    active: normalizeBoolean(payload.active, current ? current.active : true),
    recurrenceType,
    recurrenceInterval: normalizeInterval(payload.recurrenceInterval ?? current?.recurrenceInterval, recurrenceType),
    preferredTime: normalizePreferredTime(payload.preferredTime ?? current?.preferredTime),
    timezone: trimString(payload.timezone ?? current?.timezone, 80, "America/Sao_Paulo"),
    scopeType,
    scopeId,
    defaultScriptIds,
    notes: trimString(payload.notes ?? current?.notes, 1000),
    overrides: Array.isArray(payload.overrides)
      ? payload.overrides.map(normalizeOverridePayload).filter(Boolean)
      : undefined
  };
}

async function validateScripts(scriptIds) {
  const scripts = [];

  for (const scriptId of scriptIds) {
    const script = await findMaintenanceScriptById(scriptId);
    if (!script || script.active === false) {
      const error = new Error("Um dos scripts selecionados nao existe ou esta inativo.");
      error.statusCode = 400;
      throw error;
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

  return {
    ...plan,
    overrides: overrideResult.rows.map(fromOverrideRow),
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

  return Promise.all(result.rows.map((row) => hydratePlan(fromPlanRow(row))));
}

export async function findPreventiveAutomationPlanById(id) {
  const result = await query("SELECT * FROM preventive_automation_plans WHERE id = $1", [id]);
  return hydratePlan(fromPlanRow(result.rows[0]));
}

export async function createPreventiveAutomationPlan(payload = {}, user = null) {
  const normalized = normalizePlanPayload(payload);
  await validateScripts(normalized.defaultScriptIds);

  const id = randomUUID();
  await query(
    `
      INSERT INTO preventive_automation_plans (
        id, name, description, active, recurrence_type, recurrence_interval,
        preferred_time, timezone, scope_type, scope_id, default_script_ids,
        notes, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
      user?.id || null
    ]
  );

  await replaceOverrides(id, normalized.overrides || []);
  await addLog({
    type: "preventive_automation_created",
    message: `Automacao preventiva criada: ${normalized.name}. Nenhum comando foi executado.`,
    userId: user?.id || null,
    meta: { preventiveAutomationPlanId: id, scopeType: normalized.scopeType, scopeId: normalized.scopeId }
  });

  return findPreventiveAutomationPlanById(id);
}

export async function updatePreventiveAutomationPlan(id, payload = {}, user = null) {
  const current = await findPreventiveAutomationPlanById(id);
  if (!current) return null;

  const normalized = normalizePlanPayload(payload, current);
  await validateScripts(normalized.defaultScriptIds);

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
      normalized.notes
    ]
  );

  if (normalized.overrides) {
    await replaceOverrides(id, normalized.overrides);
  }

  await addLog({
    type: "preventive_automation_updated",
    message: `Automacao preventiva atualizada: ${normalized.name}.`,
    userId: user?.id || null,
    meta: { preventiveAutomationPlanId: id }
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

function resolveOverrideForAsset(plan, asset) {
  const activeOverrides = (plan.overrides || []).filter((override) => override.active !== false);
  const assetOverride = activeOverrides.find((override) => override.assetId && String(override.assetId) === String(asset.id));
  if (assetOverride) return { ...assetOverride, source: "machine" };

  const segmentOverride = activeOverrides.find(
    (override) => override.segmentId && String(override.segmentId) === String(asset.segmentId)
  );
  if (segmentOverride) return { ...segmentOverride, source: "segment" };

  return {
    recurrenceType: plan.recurrenceType,
    recurrenceInterval: plan.recurrenceInterval,
    preferredTime: plan.preferredTime,
    source: "plan"
  };
}

async function resolvePlanAssets(plan) {
  const devices = await listDevices({});

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

export async function preparePreventiveAutomationPlan(id, user = null) {
  const plan = await findPreventiveAutomationPlanById(id);
  if (!plan) return null;

  const assets = await resolvePlanAssets(plan);
  const runs = [];

  for (const asset of assets) {
    const recurrence = resolveOverrideForAsset(plan, asset);
    const scheduledFor = computeNextScheduledFor({
      recurrenceType: recurrence.recurrenceType,
      recurrenceInterval: recurrence.recurrenceInterval,
      preferredTime: recurrence.preferredTime || plan.preferredTime
    });
    const runId = randomUUID();
    const scriptSummary = plan.defaultScriptIds.length
      ? `${plan.defaultScriptIds.length} script(s) previsto(s)`
      : "Nenhum script vinculado";
    const logSummary =
      `Rotina preparada para ${asset.name || asset.id}. ${scriptSummary}. ` +
      `Recorrencia: ${recurrence.recurrenceType}/${recurrence.recurrenceInterval}. ` +
      "Execucao real depende de agente seguro instalado na maquina.";

    const result = await query(
      `
        INSERT INTO preventive_automation_runs (
          id, plan_id, asset_id, status, scheduled_for, started_at,
          finished_at, result, log_summary, error_detected
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6, $7, FALSE)
        RETURNING *
      `,
      [
        runId,
        plan.id,
        asset.id,
        normalizeRunStatus("prepared"),
        scheduledFor,
        "prepared",
        logSummary
      ]
    );

    runs.push(fromRunRow(result.rows[0]));

    await addAssetHistory({
      assetId: asset.id,
      eventType: "preventive_automation_prepared",
      message: `Automacao preventiva '${plan.name}' preparada. Nenhum comando foi executado.`,
      newValue: logSummary,
      userId: user?.id || null,
      userName: user?.name || user?.email || "Sistema"
    });
  }

  await addLog({
    type: "preventive_automation_prepared",
    message: `Automacao preventiva preparada: ${plan.name}. Nenhum comando foi executado.`,
    userId: user?.id || null,
    meta: {
      preventiveAutomationPlanId: plan.id,
      assetCount: assets.length,
      runCount: runs.length
    }
  });

  return {
    preventiveAutomationPlan: await findPreventiveAutomationPlanById(plan.id),
    runs
  };
}
