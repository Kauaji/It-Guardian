import { query } from "../database.js";
import { serializeTimestamp } from "../lib/textUtils.js";
import {
  DEFAULT_PREFERRED_TIME,
  DEFAULT_TIMEZONE,
  normalizeRecurrenceIntervalDays,
  normalizeRecurrenceType
} from "../domain/preventiveSchedule.js";
import {
  normalizeAssetIds,
  normalizeIndicatorColor,
  parseJsonArray
} from "../domain/preventiveAutomationNormalizers.js";

/** Indicadores de automacao (bolinhas coloridas) por ativo, a partir das agendas ativas. */

export function fromAutomationIndicatorRow(row) {
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

/** Indicadores ativos agrupados por id de ativo (um `Map` de listas). */
export async function listAutomationIndicatorsByAssetIds(assetIds = []) {
  const normalizedAssetIds = normalizeAssetIds(assetIds);

  if (!normalizedAssetIds.length) {
    return new Map();
  }

  const placeholders = normalizedAssetIds.map((_, index) => `$${index + 1}`).join(", ");
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
      WHERE schedules.asset_id IN (${placeholders})
        AND schedules.active = TRUE
        AND plans.active = TRUE
        AND plans.deleted_at IS NULL
      ORDER BY schedules.asset_id ASC, schedules.next_run_at ASC NULLS LAST, plans.created_at ASC
    `,
    normalizedAssetIds
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
