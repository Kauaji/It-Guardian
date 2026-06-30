import { query } from "../database.js";

const recurrenceTypes = new Set(["daily", "weekly", "biweekly", "monthly", "custom_days"]);
const recurrenceIntervalDefaults = {
  daily: 1,
  weekly: 7,
  biweekly: 15,
  monthly: 30,
  custom_days: 30
};
const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_PREFERRED_TIME = "08:00";
const DEFAULT_INDICATOR_COLOR = "#1f7a61";

function trimString(value, maxLength = 1000, fallback = "") {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : fallback;
}

function normalizeAssetIds(value = []) {
  return [
    ...new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => trimString(item, 120))
        .filter(Boolean)
    )
  ];
}

function normalizeIndicatorColor(value, fallback = DEFAULT_INDICATOR_COLOR) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
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

function normalizeRecurrenceType(value, fallback = "monthly") {
  const normalized = String(value || "").trim().toLowerCase();
  return recurrenceTypes.has(normalized) ? normalized : fallback;
}

function defaultIntervalForType(type) {
  return recurrenceIntervalDefaults[normalizeRecurrenceType(type)] || recurrenceIntervalDefaults.monthly;
}

function normalizeRecurrenceIntervalDays(value, type = "monthly") {
  const recurrenceType = normalizeRecurrenceType(type);
  if (recurrenceType !== "custom_days") {
    return defaultIntervalForType(recurrenceType);
  }

  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 365) {
    return parsed;
  }

  return defaultIntervalForType(recurrenceType);
}

function fromAutomationIndicatorRow(row) {
  const recurrenceType = normalizeRecurrenceType(row.recurrence_type);
  const recurrenceIntervalDays = normalizeRecurrenceIntervalDays(row.recurrence_interval, recurrenceType);

  return {
    id: row.automation_plan_id,
    automationPlanId: row.automation_plan_id,
    preventivePlanId: row.preventive_plan_id || null,
    preventivePlanName: row.preventive_plan_name || null,
    assetId: row.asset_id,
    planName: row.plan_name,
    name: row.plan_name,
    indicatorColor: normalizeIndicatorColor(row.indicator_color),
    recurrenceSource: row.recurrence_source || "plan",
    recurrenceType,
    recurrenceInterval: recurrenceIntervalDays,
    recurrenceIntervalDays,
    preferredTime: row.preferred_time || DEFAULT_PREFERRED_TIME,
    timezone: row.timezone || DEFAULT_TIMEZONE,
    nextRunAt: serializeTimestamp(row.schedule_next_run_at || row.plan_next_run_at),
    nextScheduledFor: serializeTimestamp(row.schedule_next_run_at || row.plan_next_run_at),
    active: row.plan_active !== false && row.schedule_active !== false,
    scriptCount: parseJsonArray(row.default_script_ids).length
  };
}

export async function listAutomationIndicatorsByAssetIds(assetIds = []) {
  const normalizedAssetIds = normalizeAssetIds(assetIds);

  if (!normalizedAssetIds.length) {
    return new Map();
  }

  const result = await query(
    `
      SELECT
        schedules.asset_id,
        schedules.active AS schedule_active,
        schedules.recurrence_source,
        schedules.recurrence_type,
        schedules.recurrence_interval,
        schedules.preferred_time,
        schedules.timezone,
        schedules.next_run_at AS schedule_next_run_at,
        plans.id AS automation_plan_id,
        plans.preventive_plan_id,
        preventive_plans.name AS preventive_plan_name,
        plans.name AS plan_name,
        plans.active AS plan_active,
        plans.indicator_color,
        plans.default_script_ids,
        plans.next_run_at AS plan_next_run_at
      FROM preventive_automation_asset_schedules schedules
      INNER JOIN preventive_automation_plans plans ON plans.id = schedules.plan_id
      LEFT JOIN preventive_plans ON preventive_plans.id = plans.preventive_plan_id
      WHERE schedules.asset_id = ANY($1)
        AND schedules.active = TRUE
        AND plans.active = TRUE
        AND plans.deleted_at IS NULL
      ORDER BY schedules.asset_id ASC, schedules.next_run_at ASC NULLS LAST, plans.created_at ASC
    `,
    [normalizedAssetIds]
  );

  const indicatorsByAsset = new Map();

  for (const row of result.rows) {
    const assetId = String(row.asset_id);
    const indicators = indicatorsByAsset.get(assetId) || [];
    indicators.push(fromAutomationIndicatorRow(row));
    indicatorsByAsset.set(assetId, indicators);
  }

  return indicatorsByAsset;
}
