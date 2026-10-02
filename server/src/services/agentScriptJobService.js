import { randomUUID } from "node:crypto";
import { withTransaction } from "../database.js";
import { isRemoteScriptExecutionEnabled } from "../config/environment.js";
import {
  assertSecondReviewer,
  clampTimeoutSeconds,
  evaluateJobResult,
  hashScriptContent,
  isExecutableScriptType,
  isJobContentStillApproved,
  TAMPERED_JOB_SUMMARY,
  terminalJobStatuses,
  validationStatusForJob
} from "../domain/agentScriptJobs.js";
import { badRequest, conflict, notFoundError, serviceUnavailable } from "../lib/errors.js";
import { findActiveAgentEnrollmentForAsset } from "../repositories/agentRepository.js";
import { addAlertComment } from "../repositories/alertRepository.js";
import { addAssetHistory } from "../repositories/assetHistoryRepository.js";
import { publicJob } from "../repositories/agentScriptJobs/jobMappers.js";
import {
  findJobForCompletion,
  findPreventivePlanIdForExecutionLog,
  saveExecutionLogResult,
  saveJobResult,
  saveValidationRunResult
} from "../repositories/agentScriptJobs/jobCompletionRepository.js";
import {
  findNextQueuedJob,
  insertAgentScriptJob,
  markExecutionLogRejected,
  markJobClaimed,
  markJobRejected,
  markValidationRunRejected
} from "../repositories/agentScriptJobs/jobQueueRepository.js";
import { addLog } from "../repositories/logRepository.js";
import { rollUpAutomationRun, rollUpPreventivePlan } from "./agentJobRollupService.js";

/**
 * Ciclo de vida dos trabalhos de script entregues ao agente Windows:
 * enfileirar (queueAgentScriptJob), entregar no heartbeat
 * (claimNextAgentScriptJob) e concluir com o resultado (completeAgentScriptJob).
 * Estes tres contratos sao estaveis; o SQL fica em repositories/agentScriptJobs/.
 */

function assertRemoteScriptExecutionEnabled() {
  if (isRemoteScriptExecutionEnabled()) return;
  throw serviceUnavailable(
    "A execucao remota esta desabilitada nesta instalacao. O registro pode ser mantido em modo de simulacao.",
    { code: "REMOTE_SCRIPT_EXECUTION_DISABLED" }
  );
}

export async function queueAgentScriptJob({
  script,
  assetId,
  executionLogId,
  validationId = null,
  automationRunId = null,
  userId = null,
  timeoutSeconds = 120,
  db
}) {
  assertRemoteScriptExecutionEnabled();
  if (!script || !isExecutableScriptType(script.type)) {
    throw badRequest("Somente scripts BAT, CMD e PowerShell podem ser enviados ao agente.");
  }
  if (!String(script.content || "").trim()) {
    throw badRequest("O script cadastrado nao possui conteudo executavel.");
  }
  assertSecondReviewer(script, userId);

  const asset = await findActiveAgentEnrollmentForAsset(assetId, db);
  if (!asset) {
    throw conflict("A maquina selecionada nao possui um agente ativo para executar o script.");
  }

  const row = await insertAgentScriptJob(
    {
      id: randomUUID(),
      assetId: asset.assetId,
      enrollmentId: asset.enrollmentId,
      scriptId: script.id,
      executionLogId,
      validationId,
      automationRunId,
      scriptType: String(script.type).toLowerCase(),
      scriptContent: script.content,
      contentHash: hashScriptContent(script.content),
      timeoutSeconds: clampTimeoutSeconds(timeoutSeconds),
      requestedBy: userId
    },
    db
  );
  return publicJob(row);
}

async function rejectTamperedJob(db, job) {
  const summary = TAMPERED_JOB_SUMMARY;

  await markJobRejected(db, { jobId: job.id, summary });
  await markExecutionLogRejected(db, { executionLogId: job.execution_log_id, summary });
  if (job.validation_id) {
    await markValidationRunRejected(db, { validationId: job.validation_id, summary });
  }
  await addAssetHistory({
    assetId: job.asset_id,
    eventType: "script_execution_blocked_content_mismatch",
    message: summary,
    newValue: JSON.stringify({ jobId: job.id, scriptId: job.script_id, scriptName: job.script_name }),
    userId: job.requested_by,
    userName: "Sistema",
    db
  });
  await addLog({
    type: "agent_script_execution_content_mismatch",
    message: summary,
    userId: job.requested_by,
    meta: { jobId: job.id, assetId: job.asset_id, scriptId: job.script_id },
    db
  });
}

export async function claimNextAgentScriptJob({ assetId, enrollmentId }) {
  if (!isRemoteScriptExecutionEnabled()) return null;
  return withTransaction(async (db) => {
    const job = await findNextQueuedJob(db, { assetId, enrollmentId });
    if (!job) return null;

    const approved = isJobContentStillApproved({
      scriptActive: job.script_active,
      currentContent: job.current_script_content,
      expectedHash: job.content_hash
    });
    if (!approved) {
      await rejectTamperedJob(db, job);
      return null;
    }

    const claimed = await markJobClaimed(db, job.id);
    return claimed ? publicJob({ ...job, ...claimed }) : null;
  });
}

async function persistJobResult(db, job, evaluation) {
  const { status } = evaluation;
  await saveJobResult(db, { jobId: job.id, ...evaluation });
  await saveExecutionLogResult(db, {
    executionLogId: job.execution_log_id,
    status,
    rawLog: evaluation.rawLog,
    summary: evaluation.summary,
    failed: status !== "succeeded"
  });
  if (job.validation_id) {
    await saveValidationRunResult(db, {
      validationId: job.validation_id,
      status: validationStatusForJob(status),
      summary: evaluation.summary
    });
  }
}

async function rollUpJobGroups(db, job, status) {
  if (job.automation_run_id) {
    await rollUpAutomationRun(db, job, status);
  }
  const preventivePlanId = await findPreventivePlanIdForExecutionLog(db, job.execution_log_id);
  if (preventivePlanId && !job.automation_run_id) {
    await rollUpPreventivePlan(db, job, preventivePlanId, status);
  }
}

async function recordJobCompletionAudit(db, job, evaluation) {
  const { status, exitCode, timedOut, summary } = evaluation;
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
}

export async function completeAgentScriptJob({ jobId, enrollmentId, result }) {
  let alertCommentInfo = null;

  const outcome = await withTransaction(async (db) => {
    const job = await findJobForCompletion(db, { jobId, enrollmentId });
    if (!job) {
      throw notFoundError("Trabalho do agente nao encontrado.");
    }
    if (terminalJobStatuses.has(job.status)) return { id: job.id, status: job.status, reused: true };
    if (job.status !== "claimed") {
      throw conflict("O trabalho ainda nao foi entregue a este agente.");
    }

    const evaluation = evaluateJobResult(result, job.script_name);
    await persistJobResult(db, job, evaluation);
    await rollUpJobGroups(db, job, evaluation.status);
    await recordJobCompletionAudit(db, job, evaluation);

    if (job.log_alert_id) {
      alertCommentInfo = { alertId: job.log_alert_id, userId: job.requested_by, message: evaluation.summary };
    }

    return { id: job.id, status: evaluation.status, exitCode: evaluation.exitCode, timedOut: evaluation.timedOut };
  });

  if (alertCommentInfo) {
    await addAlertComment(alertCommentInfo);
  }

  return outcome;
}
