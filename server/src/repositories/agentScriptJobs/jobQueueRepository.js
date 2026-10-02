import { query } from "../../database.js";

/**
 * SQL da fila de trabalhos do agente (agent_script_jobs): enfileirar, buscar o
 * proximo, marcar como entregue e recusar trabalhos adulterados. Sem regras de
 * negocio: quem decide o que fazer e services/agentScriptJobService.js.
 */

export async function insertAgentScriptJob(
  { id, assetId, enrollmentId, scriptId, executionLogId, validationId, automationRunId, scriptType, scriptContent, contentHash, timeoutSeconds, requestedBy },
  db = query
) {
  const result = await db(
    `
      INSERT INTO agent_script_jobs (
        id, asset_id, enrollment_id, script_id, execution_log_id, validation_id,
        automation_run_id, script_type, script_content, content_hash, timeout_seconds, requested_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `,
    [
      id,
      assetId,
      enrollmentId,
      scriptId,
      executionLogId,
      validationId,
      automationRunId,
      scriptType,
      scriptContent,
      contentHash,
      timeoutSeconds,
      requestedBy
    ]
  );
  return result.rows[0];
}

/** Proximo trabalho na fila da maquina/enrollment, ja com o script vigente para conferir o hash. */
export async function findNextQueuedJob(db, { assetId, enrollmentId }) {
  const pending = await db(
    `
      SELECT jobs.*, scripts.name AS script_name, scripts.content AS current_script_content,
             scripts.active AS script_active, scripts.requires_admin, scripts.requires_logged_user
      FROM agent_script_jobs jobs
      INNER JOIN maintenance_scripts scripts ON scripts.id = jobs.script_id
      WHERE jobs.asset_id = $1
        AND jobs.enrollment_id = $2
        AND jobs.status = 'queued'
      ORDER BY jobs.created_at ASC
      LIMIT 1
    `,
    [assetId, enrollmentId]
  );
  return pending.rows[0] || null;
}

export async function markJobClaimed(db, jobId) {
  const claimed = await db(
    `
      UPDATE agent_script_jobs
      SET status = 'claimed', claimed_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'queued'
      RETURNING *
    `,
    [jobId]
  );
  return claimed.rows[0] || null;
}

export async function markJobRejected(db, { jobId, summary }) {
  await db(
    `
      UPDATE agent_script_jobs
      SET status = 'failed', completed_at = NOW(), error_message = $2, updated_at = NOW()
      WHERE id = $1
    `,
    [jobId, summary]
  );
}

export async function markExecutionLogRejected(db, { executionLogId, summary }) {
  await db(
    `
      UPDATE script_execution_logs
      SET mode = 'agent', status = 'failed', executed_at = NOW(),
          parsed_summary = $2, error_detected = TRUE, attention_required = TRUE
      WHERE id = $1
    `,
    [executionLogId, summary]
  );
}

export async function markValidationRunRejected(db, { validationId, summary }) {
  await db(
    `
      UPDATE script_validation_runs
      SET status = 'execution_failed', finished_at = NOW(), result_summary = $2,
          active_key = NULL, updated_at = NOW()
      WHERE id = $1
    `,
    [validationId, summary]
  );
}
