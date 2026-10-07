import { query } from "../../database.js";
import { fromLogRow } from "./scriptMappers.js";

/**
 * SQL dos logs de execucao de scripts (script_execution_logs) e da atividade
 * de scripts de uma Ordem de Servico. Sem regras de negocio: a interpretacao
 * do log bruto acontece antes, em domain/maintenanceScripts/logInterpretation.js.
 */

export async function insertScriptExecutionLog(values, db = query) {
  const result = await db(
    `
      INSERT INTO script_execution_logs (
        id, script_id, asset_id, service_order_id, alert_id, suggestion_id,
        preventive_plan_id, mode, status, executed_by, notes, raw_log,
        parsed_summary, error_detected, error_type, error_code, error_category,
        error_severity, probable_cause, suggested_solution, requires_admin,
        requires_logged_user, attention_required
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23
      )
      RETURNING *
    `,
    [
      values.id,
      values.scriptId,
      values.assetId,
      values.serviceOrderId,
      values.alertId,
      values.suggestionId,
      values.preventivePlanId,
      values.mode,
      values.status,
      values.executedBy,
      values.notes,
      values.rawLog,
      values.parsedSummary,
      values.errorDetected,
      values.errorType,
      values.errorCode,
      values.errorCategory,
      values.errorSeverity,
      values.probableCause,
      values.suggestedSolution,
      values.requiresAdmin,
      values.requiresLoggedUser,
      values.attentionRequired
    ]
  );

  return fromLogRow(result.rows[0]);
}

export async function listServiceOrderScriptActivity(serviceOrderId) {
  const result = await query(
    `
      SELECT logs.*,
             scripts.name AS script_name,
             jobs.id AS job_id,
             jobs.status AS job_status,
             jobs.claimed_at AS job_claimed_at,
             jobs.completed_at AS job_completed_at,
             jobs.exit_code AS job_exit_code,
             jobs.timed_out AS job_timed_out,
             jobs.stdout AS job_stdout,
             jobs.stderr AS job_stderr,
             jobs.error_message AS job_error_message
      FROM script_execution_logs logs
      LEFT JOIN maintenance_scripts scripts ON scripts.id = logs.script_id
      LEFT JOIN agent_script_jobs jobs ON jobs.execution_log_id = logs.id
      WHERE logs.service_order_id = $1
      ORDER BY logs.created_at DESC
    `,
    [serviceOrderId]
  );

  return result.rows.map((row) => ({
    ...fromLogRow(row),
    scriptName: row.script_name || "",
    job: row.job_id
      ? {
          id: row.job_id,
          status: row.job_status,
          claimedAt: row.job_claimed_at,
          completedAt: row.job_completed_at,
          exitCode: row.job_exit_code,
          timedOut: row.job_timed_out === true,
          stdout: row.job_stdout || "",
          stderr: row.job_stderr || "",
          errorMessage: row.job_error_message || ""
        }
      : null
  }));
}

export async function listPendingScriptLogs() {
  const result = await query(
    `
      SELECT logs.*,
             scripts.name AS script_name
      FROM script_execution_logs logs
      LEFT JOIN maintenance_scripts scripts ON scripts.id = logs.script_id
      WHERE logs.attention_required = TRUE
        AND logs.acknowledged_at IS NULL
      ORDER BY logs.created_at DESC
    `
  );

  return result.rows.map((row) => ({
    ...fromLogRow(row),
    scriptName: row.script_name || ""
  }));
}

export async function listRecentScriptExecutionLogs({ limit = 10 } = {}) {
  const result = await query(
    `
      SELECT logs.*,
             scripts.name AS script_name
      FROM script_execution_logs logs
      LEFT JOIN maintenance_scripts scripts ON scripts.id = logs.script_id
      ORDER BY logs.created_at DESC
      LIMIT $1::INTEGER
    `,
    [limit]
  );

  return result.rows.map((row) => ({
    ...fromLogRow(row),
    scriptName: row.script_name || ""
  }));
}

export async function findScriptLogById(id) {
  const result = await query(
    `
      SELECT logs.*,
             scripts.name AS script_name
      FROM script_execution_logs logs
      LEFT JOIN maintenance_scripts scripts ON scripts.id = logs.script_id
      WHERE logs.id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0]
    ? {
        ...fromLogRow(result.rows[0]),
        scriptName: result.rows[0].script_name || ""
      }
    : null;
}

/** Marca o log como reconhecido; devolve null quando o log nao existe. */
export async function acknowledgeScriptLogRow({ id, userId }) {
  const result = await query(
    `
      UPDATE script_execution_logs
      SET attention_required = FALSE,
          acknowledged_at = NOW(),
          acknowledged_by = $2
      WHERE id = $1
      RETURNING *
    `,
    [id, userId]
  );

  return result.rows[0] ? fromLogRow(result.rows[0]) : null;
}

export async function registerSuggestedSolutionRow(db, { id, notes, userId }) {
  const result = await db(
    `
      UPDATE script_execution_logs
      SET corrective_action_status = 'suggested_solution_registered',
          corrective_action_notes = $2,
          attention_required = FALSE,
          acknowledged_at = COALESCE(acknowledged_at, NOW()),
          acknowledged_by = COALESCE(acknowledged_by, $3)
      WHERE id = $1
      RETURNING *
    `,
    [id, notes, userId]
  );

  return fromLogRow(result.rows[0]);
}
