import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";
import { addAssetHistory } from "./assetHistoryRepository.js";
import { addLog } from "./logRepository.js";
import { isRemoteScriptExecutionEnabled } from "../config/environment.js";

const executableTypes = new Set(["bat", "cmd", "powershell"]);
const terminalStatuses = new Set(["succeeded", "failed", "timed_out"]);
const maxOutputLength = 65536;

function assertRemoteScriptExecutionEnabled() {
  if (isRemoteScriptExecutionEnabled()) return;
  const error = new Error(
    "A execucao remota esta desabilitada nesta instalacao. O registro pode ser mantido em modo de simulacao."
  );
  error.statusCode = 503;
  error.expose = true;
  error.code = "REMOTE_SCRIPT_EXECUTION_DISABLED";
  throw error;
}

function clampTimeout(value) {
  return Math.min(600, Math.max(15, Math.round(Number(value || 120))));
}

function truncate(value) {
  return String(value || "").slice(0, maxOutputLength);
}

function publicJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    scriptId: row.script_id,
    name: row.script_name || "Script de manutencao",
    type: row.script_type,
    content: row.script_content,
    timeoutSeconds: Number(row.timeout_seconds || 120),
    requiresAdmin: row.requires_admin === true,
    requiresLoggedUser: row.requires_logged_user === true
  };
}

export async function queueAgentScriptJob({
  script,
  assetId,
  executionLogId,
  validationId = null,
  automationRunId = null,
  userId = null,
  timeoutSeconds = 120,
  db = query
}) {
  assertRemoteScriptExecutionEnabled();
  if (!script || !executableTypes.has(String(script.type || "").toLowerCase())) {
    const error = new Error("Somente scripts BAT, CMD e PowerShell podem ser enviados ao agente.");
    error.statusCode = 400;
    throw error;
  }
  if (!String(script.content || "").trim()) {
    const error = new Error("O script cadastrado nao possui conteudo executavel.");
    error.statusCode = 400;
    throw error;
  }

  const assetResult = await db(
    `
      SELECT assets.asset_id, assets.enrollment_id
      FROM agent_assets assets
      INNER JOIN agent_enrollments enrollments ON enrollments.id = assets.enrollment_id
      WHERE assets.asset_id = $1
        AND enrollments.active = TRUE
      LIMIT 1
    `,
    [assetId]
  );
  const asset = assetResult.rows[0];
  if (!asset) {
    const error = new Error("A maquina selecionada nao possui um agente ativo para executar o script.");
    error.statusCode = 409;
    throw error;
  }

  const result = await db(
    `
      INSERT INTO agent_script_jobs (
        id, asset_id, enrollment_id, script_id, execution_log_id, validation_id,
        automation_run_id, script_type, script_content, timeout_seconds, requested_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `,
    [
      randomUUID(),
      asset.asset_id,
      asset.enrollment_id,
      script.id,
      executionLogId,
      validationId,
      automationRunId,
      String(script.type).toLowerCase(),
      script.content,
      clampTimeout(timeoutSeconds),
      userId
    ]
  );
  return publicJob(result.rows[0]);
}

export async function claimNextAgentScriptJob({ assetId, enrollmentId }) {
  if (!isRemoteScriptExecutionEnabled()) return null;
  return withTransaction(async (db) => {
    const pending = await db(
      `
        SELECT jobs.*, scripts.name AS script_name,
               scripts.requires_admin, scripts.requires_logged_user
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
    if (!pending.rows[0]) return null;

    const claimed = await db(
      `
        UPDATE agent_script_jobs
        SET status = 'claimed', claimed_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND status = 'queued'
        RETURNING *
      `,
      [pending.rows[0].id]
    );
    return claimed.rows[0] ? publicJob({ ...pending.rows[0], ...claimed.rows[0] }) : null;
  });
}

export async function completeAgentScriptJob({ jobId, enrollmentId, result }) {
  return withTransaction(async (db) => {
    const current = await db(
      `
        SELECT jobs.*, scripts.name AS script_name, users.name AS requested_by_name
        FROM agent_script_jobs jobs
        INNER JOIN maintenance_scripts scripts ON scripts.id = jobs.script_id
        LEFT JOIN users ON users.id = jobs.requested_by
        WHERE jobs.id = $1 AND jobs.enrollment_id = $2
        LIMIT 1
      `,
      [jobId, enrollmentId]
    );
    const job = current.rows[0];
    if (!job) {
      const error = new Error("Trabalho do agente nao encontrado.");
      error.statusCode = 404;
      throw error;
    }
    if (terminalStatuses.has(job.status)) return { id: job.id, status: job.status, reused: true };
    if (job.status !== "claimed") {
      const error = new Error("O trabalho ainda nao foi entregue a este agente.");
      error.statusCode = 409;
      throw error;
    }

    const timedOut = result.timedOut === true;
    const exitCode = Number.isInteger(result.exitCode) ? result.exitCode : null;
    const errorMessage = truncate(result.errorMessage);
    const status = timedOut ? "timed_out" : exitCode === 0 && !errorMessage ? "succeeded" : "failed";
    const stdout = truncate(result.stdout);
    const stderr = truncate(result.stderr);
    const rawLog = [
      stdout ? `STDOUT:\n${stdout}` : "",
      stderr ? `STDERR:\n${stderr}` : "",
      errorMessage ? `ERRO:\n${errorMessage}` : ""
    ].filter(Boolean).join("\n\n");
    const summary =
      status === "succeeded"
        ? `Script '${job.script_name}' executado com sucesso pelo agente.`
        : status === "timed_out"
          ? `Script '${job.script_name}' interrompido por tempo limite.`
          : `Script '${job.script_name}' terminou com falha.`;

    await db(
      `
        UPDATE agent_script_jobs
        SET status = $2, completed_at = NOW(), exit_code = $3, timed_out = $4,
            stdout = $5, stderr = $6, error_message = $7, updated_at = NOW()
        WHERE id = $1
      `,
      [job.id, status, exitCode, timedOut, stdout, stderr, errorMessage]
    );
    await db(
      `
        UPDATE script_execution_logs
        SET mode = 'agent', status = $2, executed_at = NOW(), raw_log = $3,
            parsed_summary = $4, error_detected = $5,
            attention_required = $5
        WHERE id = $1
      `,
      [job.execution_log_id, status, rawLog, summary, status !== "succeeded"]
    );
    if (job.validation_id) {
      await db(
        `
          UPDATE script_validation_runs
          SET status = $2, finished_at = NOW(), result_summary = $3,
              active_key = NULL, updated_at = NOW()
          WHERE id = $1
        `,
        [
          job.validation_id,
          status === "succeeded" ? "execution_success" : "execution_failed",
          summary
        ]
      );
    }
    if (job.automation_run_id) {
      const pending = await db(
        `
          SELECT COUNT(*)::INTEGER AS count
          FROM agent_script_jobs
          WHERE automation_run_id = $1
            AND id <> $2
            AND status IN ('queued', 'claimed')
        `,
        [job.automation_run_id, job.id]
      );
      if (Number(pending.rows[0]?.count || 0) === 0) {
        const failures = await db(
          `
            SELECT COUNT(*)::INTEGER AS count
            FROM agent_script_jobs
            WHERE automation_run_id = $1
              AND id <> $2
              AND status IN ('failed', 'timed_out')
          `,
          [job.automation_run_id, job.id]
        );
        const runFailed = status !== "succeeded" || Number(failures.rows[0]?.count || 0) > 0;
        await db(
          `
            UPDATE preventive_automation_runs
            SET status = $2, finished_at = NOW(), result = $3,
                log_summary = $3, error_detected = $4
            WHERE id = $1
          `,
          [
            job.automation_run_id,
            runFailed ? "error" : "success",
            runFailed
              ? "Uma ou mais verificações terminaram com falha no agente."
              : "Todas as verificações foram executadas com sucesso pelo agente.",
            runFailed
          ]
        );
      }
    }
    const executionLog = await db(
      "SELECT preventive_plan_id FROM script_execution_logs WHERE id = $1",
      [job.execution_log_id]
    );
    const preventivePlanId = executionLog.rows[0]?.preventive_plan_id;
    if (preventivePlanId && !job.automation_run_id) {
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
        [preventivePlanId, job.asset_id, job.id]
      );
      if (Number(pending.rows[0]?.count || 0) === 0) {
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
          [preventivePlanId, job.asset_id, job.id]
        );
        const assetFailed = status !== "succeeded" || Number(failures.rows[0]?.count || 0) > 0;
        await db(
          `
            UPDATE preventive_plan_assets
            SET status = $3, completed_at = NOW(), log = $4
            WHERE preventive_plan_id = $1 AND asset_id = $2
          `,
          [
            preventivePlanId,
            job.asset_id,
            assetFailed ? "failed" : "completed",
            assetFailed
              ? "Uma ou mais verificações terminaram com falha no agente."
              : "Todas as verificações foram executadas com sucesso pelo agente."
          ]
        );
        const unfinished = await db(
          `
            SELECT COUNT(*)::INTEGER AS count
            FROM preventive_plan_assets
            WHERE preventive_plan_id = $1
              AND status NOT IN ('completed', 'failed', 'cancelled')
          `,
          [preventivePlanId]
        );
        if (Number(unfinished.rows[0]?.count || 0) === 0) {
          const failedAssets = await db(
            `
              SELECT COUNT(*)::INTEGER AS count
              FROM preventive_plan_assets
              WHERE preventive_plan_id = $1 AND status = 'failed'
            `,
            [preventivePlanId]
          );
          await db(
            `
              UPDATE preventive_plans
              SET status = $2, updated_at = NOW()
              WHERE id = $1
            `,
            [preventivePlanId, Number(failedAssets.rows[0]?.count || 0) > 0 ? "failed" : "completed"]
          );
        }
      }
    }
    await addAssetHistory({
      assetId: job.asset_id,
      eventType: status === "succeeded" ? "script_execution_succeeded" : "script_execution_failed",
      message: summary,
      newValue: JSON.stringify({
        jobId: job.id,
        scriptId: job.script_id,
        scriptName: job.script_name,
        status,
        exitCode,
        timedOut,
        requestedBy: job.requested_by_name || "Sistema"
      }),
      userId: job.requested_by,
      userName: job.requested_by_name || "Sistema",
      db
    });
    await addLog({
      type: "agent_script_execution_completed",
      message: summary,
      userId: job.requested_by,
      meta: { jobId: job.id, assetId: job.asset_id, scriptId: job.script_id, status, exitCode, timedOut },
      db
    });
    return { id: job.id, status, exitCode, timedOut };
  });
}
