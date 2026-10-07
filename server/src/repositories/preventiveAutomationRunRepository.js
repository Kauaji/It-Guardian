import { query } from "../database.js";
import { fromRunRow } from "./preventiveAutomationMappers.js";
import { latestRunKey } from "../domain/preventiveAutomationViews.js";

/** SQL da tabela preventive_automation_runs (execucoes preparadas). */

export async function listRunsByPlan(planId, db = query) {
  const result = await db(
    `
      SELECT *
      FROM preventive_automation_runs
      WHERE plan_id = $1
      ORDER BY created_at DESC
    `,
    [planId]
  );
  return result.rows.map(fromRunRow);
}

/**
 * Execucao mais recente por par plano/maquina, sem limite global e sem
 * funcoes de janela (compativel com o pg-mem). Devolve um Map por
 * `planId:assetId`.
 */
export async function listLatestRunsByPlanIds(planIds, db = query) {
  const latestByAsset = new Map();
  if (!planIds.length) return latestByAsset;

  const placeholders = planIds.map((_, index) => `$${index + 1}`).join(", ");
  const result = await db(
    `
      SELECT runs.*
      FROM preventive_automation_runs runs
      LEFT JOIN preventive_automation_runs newer
        ON newer.plan_id = runs.plan_id
       AND newer.asset_id = runs.asset_id
       AND (
         newer.created_at > runs.created_at
         OR (newer.created_at = runs.created_at AND newer.id > runs.id)
       )
      WHERE runs.plan_id IN (${placeholders})
        AND newer.id IS NULL
    `,
    planIds
  );

  for (const row of result.rows) {
    const key = latestRunKey(row.plan_id, row.asset_id);
    if (!latestByAsset.has(key)) latestByAsset.set(key, fromRunRow(row));
  }
  return latestByAsset;
}

export async function findLatestRunForAsset(planId, assetId, db = query) {
  const result = await db(
    `SELECT * FROM preventive_automation_runs WHERE plan_id = $1 AND asset_id = $2 ORDER BY created_at DESC LIMIT 1`,
    [planId, assetId]
  );
  return result.rows[0] ? fromRunRow(result.rows[0]) : null;
}

export async function findRunBySlot(planId, assetId, scheduledFor, db = query) {
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

export async function insertRun(db, run) {
  const result = await db(
    `
      INSERT INTO preventive_automation_runs (
        id, plan_id, asset_id, status, scheduled_for, started_at,
        finished_at, result, log_summary, error_detected, idempotency_key,
        schedule_slot, recurrence_source, recurrence_interval, preferred_time, next_run_at,
        trigger_type
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NULL, $6, $7, FALSE, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `,
    [
      run.id,
      run.planId,
      run.assetId,
      run.status,
      run.scheduledFor,
      run.result,
      run.logSummary,
      run.idempotencyKey,
      run.scheduledFor,
      run.recurrenceSource,
      run.recurrenceIntervalDays,
      run.preferredTime,
      run.nextRunAt,
      run.triggerType
    ]
  );
  return fromRunRow(result.rows[0]);
}
