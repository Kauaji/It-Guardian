import { analyzeMaintenanceScriptContent } from "../domain/maintenanceScripts/contentAnalysis.js";
import {
  describeScriptForDiagnosis,
  executionDiagnosisContextPermissions,
  isScriptDiagnosisSatisfied
} from "../domain/maintenanceScripts/executionDiagnosis.js";
import { resolveScriptRiskLevel } from "../domain/maintenanceScripts/scriptVocabulary.js";
import { requiresSecondReviewer } from "../domain/agentScriptJobs.js";
import { badRequest, forbidden, notFoundError } from "../lib/errors.js";
import { hasPermission } from "../permissions.js";
import { isAgentAssetFresh } from "../lib/agentFreshness.js";
import { isRemoteScriptExecutionEnabled } from "../config/environment.js";
import { findActiveAgentEnrollmentForAsset, findAgentAssetById } from "../repositories/agentRepository.js";
import { listServiceOrderScriptActivity } from "../repositories/maintenanceScripts/scriptLogRepository.js";
import {
  createMaintenanceScript,
  deactivateMaintenanceScript,
  findMaintenanceScriptById,
  listMaintenanceScripts,
  updateMaintenanceScript
} from "./maintenanceScripts/scriptCatalogService.js";
import {
  acknowledgeScriptLog,
  applyScriptLogSuggestedSolution,
  findScriptLogById,
  listPendingScriptLogs
} from "./maintenanceScripts/scriptLogService.js";
import {
  registerMaintenanceScriptSimulation,
  useScriptForServiceOrder,
  useScriptFromSuggestion
} from "./maintenanceScripts/scriptUsageService.js";
import {
  cancelScriptValidation,
  listScriptValidationsForSuggestion
} from "./maintenanceScripts/scriptValidationService.js";
import { listRecommendedScriptsForSuggestion } from "./maintenanceScripts/suggestionRecommendationService.js";
import { listRecommendedScriptsForContext } from "./maintenanceScriptRecommendationService.js";

// Reforca o segundo revisor: assertSecondReviewer (na fila do agente) so
// impede a MESMA pessoa que editou o script de enfileirar risco alto/
// critico, mas nao garante que quem enfileira tenha autoridade pra
// isso. Essa checagem na camada de servico exige a permissao dedicada
// alem do identity-diff ja existente - defesa em profundidade.
async function assertCanQueueScript(scriptId, user) {
  const script = await findMaintenanceScriptById(scriptId);
  if (!script) return;
  if (requiresSecondReviewer(resolveScriptRiskLevel(script)) && !hasPermission(user, "scripts.approve_high_risk")) {
    throw forbidden("Scripts de risco alto ou crítico exigem um revisor com permissão de aprovação (scripts.approve_high_risk).");
  }
}

export async function listAllMaintenanceScripts(includeInactive) {
  return listMaintenanceScripts({ includeInactive });
}

export function analyzeScriptContent(content) {
  return analyzeMaintenanceScriptContent(content || "");
}

export async function createScript(payload, user) {
  return createMaintenanceScript(payload || {}, user);
}

export async function updateScript(id, payload, user) {
  const script = await updateMaintenanceScript(id, payload || {}, user);
  if (!script) throw notFoundError("Script de manutenção não encontrado.");
  return script;
}

export async function deactivateScript(id) {
  const script = await deactivateMaintenanceScript(id);
  if (!script) throw notFoundError("Script de manutenção não encontrado.");
  return script;
}

export async function registerSimulationForScript(scriptId, payload, user) {
  return registerMaintenanceScriptSimulation({ scriptId, payload: payload || {}, user });
}

export async function useScriptForSuggestion(suggestionId, scriptId, payload, user) {
  await assertCanQueueScript(scriptId, user);
  return useScriptFromSuggestion({ suggestionId, scriptId, payload: payload || {}, user });
}

export async function useScriptForServiceOrderEntry(serviceOrderId, scriptId, payload, user) {
  await assertCanQueueScript(scriptId, user);
  return useScriptForServiceOrder({ serviceOrderId, scriptId, payload: payload || {}, user });
}

export async function listScriptActivityForServiceOrder(serviceOrderId) {
  return listServiceOrderScriptActivity(serviceOrderId);
}

export async function listValidationsForSuggestion(suggestionId) {
  return listScriptValidationsForSuggestion(suggestionId);
}

export async function listRecommendedForSuggestion(suggestionId) {
  return listRecommendedScriptsForSuggestion(suggestionId);
}

export async function listRecommendedForContext(context) {
  return listRecommendedScriptsForContext(context || {});
}

export async function cancelValidationById(id, user) {
  return cancelScriptValidation(id, user);
}

export async function listPendingLogs() {
  return listPendingScriptLogs();
}

export async function getLogById(id) {
  const log = await findScriptLogById(id);
  if (!log) throw notFoundError("Log de script não encontrado.");
  return log;
}

export async function acknowledgeLogById(id, user) {
  return acknowledgeScriptLog(id, user);
}

export async function applySuggestedSolutionToLog(id, payload, user) {
  return applyScriptLogSuggestedSolution(id, payload || {}, user);
}

// O diagnostico precisa combinar dado de varias fontes (flag do servidor,
// agente, permissao, script) num unico resultado somente-leitura para a UI
// explicar por que a execucao esta bloqueada, sem duplicar os mesmos
// criterios que useScriptForServiceOrder/useScriptFromSuggestion ja aplicam
// de verdade (as regras do script vivem em domain/maintenanceScripts/executionDiagnosis.js).
export async function getScriptExecutionDiagnosis({ assetId, scriptId = null, context, user = null }) {
  if (!String(assetId || "").trim()) {
    throw badRequest("Informe o ativo para calcular o diagnostico de execucao.");
  }
  const basePermission =
    executionDiagnosisContextPermissions[context] || executionDiagnosisContextPermissions.service_order;
  const serverEnabled = isRemoteScriptExecutionEnabled();
  const userHasPermission = hasPermission(user, basePermission);
  const userHasHighRiskApproval = hasPermission(user, "scripts.approve_high_risk");

  const [agentAsset, activeEnrollment] = await Promise.all([
    findAgentAssetById(assetId),
    findActiveAgentEnrollmentForAsset(assetId)
  ]);
  const agentRegistered = Boolean(activeEnrollment);
  const agentActive =
    agentRegistered && Boolean(agentAsset) && isAgentAssetFresh(agentAsset.lastSeenAt, agentAsset.intervalSeconds);

  const script = scriptId ? await findMaintenanceScriptById(scriptId) : null;
  const scriptDiagnosis = script ? describeScriptForDiagnosis(script, user) : null;

  return {
    serverEnabled,
    agentRegistered,
    agentActive,
    agentLastSeenAt: agentAsset?.lastSeenAt || null,
    // O servidor nao tem visibilidade do enableRemoteScriptExecution
    // local do coletor (nao e enviado no heartbeat) - "unknown" e mais
    // honesto do que inferir um "sim" que pode estar errado.
    agentLocalConfigStatus: "unknown",
    userHasPermission,
    userHasHighRiskApproval,
    script: scriptDiagnosis,
    overallAvailable:
      serverEnabled &&
      agentRegistered &&
      agentActive &&
      userHasPermission &&
      isScriptDiagnosisSatisfied(scriptDiagnosis, userHasHighRiskApproval)
  };
}
