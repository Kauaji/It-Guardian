import { ROLLUP_FAILURE_SUMMARY, ROLLUP_SUCCESS_SUMMARY } from "../domain/agentScriptJobs.js";
import {
  countFailedJobsForAutomationRun,
  countFailedJobsForPlanAsset,
  countFailedPlanAssets,
  countOpenJobsForAutomationRun,
  countOpenJobsForPlanAsset,
  countUnfinishedPlanAssets,
  finishAutomationRun,
  finishPlanAsset,
  setPreventivePlanStatus
} from "../repositories/agentScriptJobs/jobCompletionRepository.js";

/**
 * Consolidacao dos trabalhos do agente em agregados operacionais: quando o
 * ultimo trabalho de uma execucao de automacao (ou de um ativo dentro de um
 * plano preventivo) termina, a execucao/ativo/plano e fechado como sucesso ou
 * falha. Chamado dentro da transacao de conclusao do trabalho.
 */

/** Fecha a execucao de automacao quando nao resta nenhum outro trabalho aberto. */
export async function rollUpAutomationRun(db, job, jobStatus) {
  const target = { automationRunId: job.automation_run_id, excludeJobId: job.id };
  if ((await countOpenJobsForAutomationRun(db, target)) > 0) return;

  const runFailed = jobStatus !== "succeeded" || (await countFailedJobsForAutomationRun(db, target)) > 0;
  await finishAutomationRun(db, {
    automationRunId: job.automation_run_id,
    status: runFailed ? "error" : "success",
    summary: runFailed ? ROLLUP_FAILURE_SUMMARY : ROLLUP_SUCCESS_SUMMARY,
    errorDetected: runFailed
  });
}

async function closePreventivePlanWhenFinished(db, preventivePlanId) {
  if ((await countUnfinishedPlanAssets(db, preventivePlanId)) > 0) return;

  const hasFailedAssets = (await countFailedPlanAssets(db, preventivePlanId)) > 0;
  await setPreventivePlanStatus(db, { preventivePlanId, status: hasFailedAssets ? "failed" : "completed" });
}

/**
 * Fecha o ativo do plano preventivo quando nao resta outro trabalho aberto
 * para ele e, em seguida, o plano inteiro quando todos os ativos terminaram.
 */
export async function rollUpPreventivePlan(db, job, preventivePlanId, jobStatus) {
  const target = { preventivePlanId, assetId: job.asset_id, excludeJobId: job.id };
  if ((await countOpenJobsForPlanAsset(db, target)) > 0) return;

  const assetFailed = jobStatus !== "succeeded" || (await countFailedJobsForPlanAsset(db, target)) > 0;
  await finishPlanAsset(db, {
    preventivePlanId,
    assetId: job.asset_id,
    status: assetFailed ? "failed" : "completed",
    log: assetFailed ? ROLLUP_FAILURE_SUMMARY : ROLLUP_SUCCESS_SUMMARY
  });
  await closePreventivePlanWhenFinished(db, preventivePlanId);
}
