/**
 * SQL da conclusao de trabalhos do agente: grava o resultado no trabalho, no
 * log de execucao e na validacao de aviso, e consulta/fecha os agregados de
 * execucao de automacao e de plano preventivo. Sem regras de negocio.
 */

export async function findJobForCompletion(db, { jobId, enrollmentId }) {
  const current = await db(
    `
      SELECT jobs.*, scripts.name AS script_name, users.name AS requested_by_name,
             logs.alert_id AS log_alert_id
      FROM agent_script_jobs jobs
      INNER JOIN maintenance_scripts scripts ON scripts.id = jobs.script_id
      LEFT JOIN users ON users.id = jobs.requested_by
      LEFT JOIN script_execution_logs logs ON logs.id = jobs.execution_log_id
      WHERE jobs.id = $1 AND jobs.enrollment_id = $2
      LIMIT 1
    `,
    [jobId, enrollmentId]
  );
  return current.rows[0] || null;
}

export async function saveJobResult(db, { jobId, status, exitCode, timedOut, stdout, stderr, errorMessage }) {
  await db(
    `
      UPDATE agent_script_jobs
      SET status = $2, completed_at = NOW(), exit_code = $3, timed_out = $4,
          stdout = $5, stderr = $6, error_message = $7, updated_at = NOW()
      WHERE id = $1
    `,
    [jobId, status, exitCode, timedOut, stdout, stderr, errorMessage]
  );
}

export async function saveExecutionLogResult(db, { executionLogId, status, rawLog, summary, failed }) {
  await db(
    `
      UPDATE script_execution_logs
      SET mode = 'agent', status = $2, executed_at = NOW(), raw_log = $3,
          parsed_summary = $4, error_detected = $5::BOOLEAN,
          attention_required = $5::BOOLEAN
      WHERE id = $1
    `,
    [executionLogId, status, rawLog, summary, failed]
  );
}

export async function saveValidationRunResult(db, { validationId, status, summary }) {
  await db(
    `
      UPDATE script_validation_runs
      SET status = $2, finished_at = NOW(), result_summary = $3,
          active_key = NULL, updated_at = NOW()
      WHERE id = $1
    `,
    [validationId, status, summary]
  );
}

export async function findPreventivePlanIdForExecutionLog(db, executionLogId) {
  const executionLog = await db(
    "SELECT preventive_plan_id FROM script_execution_logs WHERE id = $1",
    [executionLogId]
  );
  return executionLog.rows[0]?.preventive_plan_id || null;
}

// ---- Execucao de automacao preventiva -------------------------------------

export async function countOpenJobsForAutomationRun(db, { automationRunId, excludeJobId }) {
  const pending = await db(
    `
      SELECT COUNT(*)::INTEGER AS count
      FROM agent_script_jobs
      WHERE automation_run_id = $1
        AND id <> $2
        AND status IN ('queued', 'claimed')
    `,
    [automationRunId, excludeJobId]
  );
  return Number(pending.rows[0]?.count || 0);
}

export async function countFailedJobsForAutomationRun(db, { automationRunId, excludeJobId }) {
  const failures = await db(
    `
      SELECT COUNT(*)::INTEGER AS count
      FROM agent_script_jobs
      WHERE automation_run_id = $1
        AND id <> $2
        AND status IN ('failed', 'timed_out')
    `,
    [automationRunId, excludeJobId]
  );
  return Number(failures.rows[0]?.count || 0);
}

export async function finishAutomationRun(db, { automationRunId, status, summary, errorDetected }) {
  await db(
    `
      UPDATE preventive_automation_runs
      SET status = $2, finished_at = NOW(), result = $3::TEXT,
          log_summary = $3::TEXT, error_detected = $4
      WHERE id = $1
    `,
    [automationRunId, status, summary, errorDetected]
  );
}

// ---- Plano preventivo -------------------------------------------------------

export async function countOpenJobsForPlanAsset(db, { preventivePlanId, assetId, excludeJobId }) {
  const pending = await db(
    `
      SELECT COUNT(*)::INTEGER AS count
      FROM agent_script_jobs jobs
      INNER JOIN script_execution_logs logs ON logs.id = jobs.execution_log_id
      WHERE logs.preventive_plan_id = $1
        AND jobs.asset_id = $2
        AND jobs.id <> $3
        AND jobs.status IN ('queued', 'claimed')
    `,
    [preventivePlanId, assetId, excludeJobId]
  );
  return Number(pending.rows[0]?.count || 0);
}

export async function countFailedJobsForPlanAsset(db, { preventivePlanId, assetId, excludeJobId }) {
  const failures = await db(
    `
      SELECT COUNT(*)::INTEGER AS count
      FROM agent_script_jobs jobs
      INNER JOIN script_execution_logs logs ON logs.id = jobs.execution_log_id
      WHERE logs.preventive_plan_id = $1
        AND jobs.asset_id = $2
        AND jobs.id <> $3
        AND jobs.status IN ('failed', 'timed_out')
    `,
    [preventivePlanId, assetId, excludeJobId]
  );
  return Number(failures.rows[0]?.count || 0);
}

export async function finishPlanAsset(db, { preventivePlanId, assetId, status, log }) {
  await db(
    `
      UPDATE preventive_plan_assets
      SET status = $3, completed_at = NOW(), log = $4
      WHERE preventive_plan_id = $1 AND asset_id = $2
    `,
    [preventivePlanId, assetId, status, log]
  );
}

export async function countUnfinishedPlanAssets(db, preventivePlanId) {
  const unfinished = await db(
    `
      SELECT COUNT(*)::INTEGER AS count
      FROM preventive_plan_assets
      WHERE preventive_plan_id = $1
        AND status NOT IN ('completed', 'failed', 'cancelled')
    `,
    [preventivePlanId]
  );
  return Number(unfinished.rows[0]?.count || 0);
}

export async function countFailedPlanAssets(db, preventivePlanId) {
  const failedAssets = await db(
    `
      SELECT COUNT(*)::INTEGER AS count
      FROM preventive_plan_assets
      WHERE preventive_plan_id = $1 AND status = 'failed'
    `,
    [preventivePlanId]
  );
  return Number(failedAssets.rows[0]?.count || 0);
}

export async function setPreventivePlanStatus(db, { preventivePlanId, status }) {
  await db(
    `
      UPDATE preventive_plans
      SET status = $2, updated_at = NOW()
      WHERE id = $1
    `,
    [preventivePlanId, status]
  );
}
