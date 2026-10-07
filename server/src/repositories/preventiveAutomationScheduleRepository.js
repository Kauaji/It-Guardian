import { query } from "../database.js";
import { serializeTimestamp } from "../lib/textUtils.js";
import { fromAssetScheduleRow } from "./preventiveAutomationMappers.js";

/** SQL da tabela preventive_automation_asset_schedules (agenda por maquina). */

function placeholdersFrom(values, offset = 0) {
  return values.map((_, index) => `$${index + 1 + offset}`).join(", ");
}

export async function listSchedulesByPlan(planId, db = query) {
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

export async function listSchedulesByPlanIds(planIds, db = query) {
  if (!planIds.length) return [];
  const result = await db(
    `
      SELECT *
      FROM preventive_automation_asset_schedules
      WHERE plan_id IN (${placeholdersFrom(planIds)})
      ORDER BY next_run_at ASC NULLS LAST, created_at ASC
    `,
    planIds
  );
  return result.rows.map(fromAssetScheduleRow);
}

export async function findActiveScheduleForAsset(planId, assetId, db = query) {
  const result = await db(
    `SELECT * FROM preventive_automation_asset_schedules WHERE plan_id = $1 AND asset_id = $2 AND active = TRUE LIMIT 1`,
    [planId, assetId]
  );
  return fromAssetScheduleRow(result.rows[0]);
}

/** Agendas ativas vencidas em `nowIso`, da mais antiga para a mais nova. */
export async function listDueSchedulesForPlan(planId, nowIso, db = query) {
  const result = await db(
    `
      SELECT *
      FROM preventive_automation_asset_schedules
      WHERE plan_id = $1
        AND active = TRUE
        AND next_run_at <= $2
      ORDER BY next_run_at ASC, created_at ASC
    `,
    [planId, nowIso]
  );
  return result.rows.map(fromAssetScheduleRow);
}

export async function listActiveSchedulesByIds(planId, scheduleIds, db = query) {
  const result = await db(
    `
      SELECT *
      FROM preventive_automation_asset_schedules
      WHERE plan_id = $1
        AND id IN (${placeholdersFrom(scheduleIds, 1)})
        AND active = TRUE
      ORDER BY next_run_at ASC NULLS LAST, created_at ASC
    `,
    [planId, ...scheduleIds]
  );
  return result.rows.map(fromAssetScheduleRow);
}

export async function upsertSchedule(
  db,
  { id, planId, assetId, source, recurrenceType, recurrenceIntervalDays, preferredTime, timezone, nextRunAt, active }
) {
  await db(
    `
      INSERT INTO preventive_automation_asset_schedules (
        id, plan_id, asset_id, recurrence_source, recurrence_type,
        recurrence_interval, preferred_time, timezone, next_run_at, active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (plan_id, asset_id)
      DO UPDATE SET recurrence_source = EXCLUDED.recurrence_source,
                    recurrence_type = EXCLUDED.recurrence_type,
                    recurrence_interval = EXCLUDED.recurrence_interval,
                    preferred_time = EXCLUDED.preferred_time,
                    timezone = EXCLUDED.timezone,
                    active = EXCLUDED.active,
                    next_run_at = EXCLUDED.next_run_at,
                    updated_at = NOW()
    `,
    [id, planId, assetId, source, recurrenceType, recurrenceIntervalDays, preferredTime, timezone, nextRunAt, active]
  );
}

export async function deactivateScheduleById(db, scheduleId) {
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

export async function deactivateSchedulesOfPlan(db, planId) {
  await db(
    `
      UPDATE preventive_automation_asset_schedules
      SET active = FALSE,
          updated_at = NOW()
      WHERE plan_id = $1
    `,
    [planId]
  );
}

export async function deactivateAssetSchedule(db, planId, assetId) {
  await db(
    `
      UPDATE preventive_automation_asset_schedules
      SET active = FALSE,
          updated_at = NOW()
      WHERE plan_id = $1
        AND asset_id = $2
    `,
    [planId, assetId]
  );
}

export async function reactivateAssetSchedule(db, { planId, assetId, nextRunAt }) {
  await db(
    `
      UPDATE preventive_automation_asset_schedules
      SET active = TRUE,
          next_run_at = $3,
          updated_at = NOW()
      WHERE plan_id = $1
        AND asset_id = $2
    `,
    [planId, assetId, nextRunAt]
  );
}

/** Marca a agenda como preparada e avanca para a proxima execucao. */
export async function markSchedulePrepared(db, { id, scheduledFor, nextRunAt }) {
  await db(
    `
      UPDATE preventive_automation_asset_schedules
      SET last_scheduled_at = $2,
          last_prepared_at = NOW(),
          next_run_at = $3,
          updated_at = NOW()
      WHERE id = $1
    `,
    [id, scheduledFor, nextRunAt]
  );
}

/** Menor proxima execucao entre as agendas ativas do plano (ou null). */
export async function findEarliestNextRun(planId, db = query) {
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
  return serializeTimestamp(result.rows[0]?.next_run_at);
}
