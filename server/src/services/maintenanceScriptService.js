import { badRequest, forbidden, notFoundError } from "../lib/errors.js";
import { hasPermission } from "../permissions.js";
import {
  analyzeMaintenanceScriptContent,
  acknowledgeScriptLog,
  applyScriptLogSuggestedSolution,
  cancelScriptValidation,
  createMaintenanceScript,
  deactivateMaintenanceScript,
  findMaintenanceScriptById,
  findScriptLogById,
  listMaintenanceScripts,
  listPendingScriptLogs,
  listRecommendedScriptsForSuggestion,
  listScriptValidationsForSuggestion,
  listServiceOrderScriptActivity,
  normalizeRiskLevel,
  registerMaintenanceScriptSimulation,
  updateMaintenanceScript,
  useScriptForServiceOrder,
  useScriptFromSuggestion
} from "../repositories/maintenanceScriptRepository.js";
import { executableTypes } from "../repositories/agentScriptJobRepository.js";
import { findActiveAgentEnrollmentForAsset, findAgentAssetById } from "../repositories/agentRepository.js";
import { isAgentAssetFresh } from "../lib/agentFreshness.js";
import { isRemoteScriptExecutionEnabled } from "../config/environment.js";
import { listRecommendedScriptsForContext } from "./maintenanceScriptRecommendationService.js";

const dualControlRiskLevels = new Set(["high", "critical"]);
const diagnosisContextPermissions = {
  service_order: "service_orders.run_scripts",
  alert: "scripts.use_from_alert"
};

// Reforca o segundo revisor: assertSecondReviewer (na repository) so
// impede a MESMA pessoa que editou o script de enfileirar risco alto/
// critico, mas nao garante que quem enfileira tenha autoridade pra
// isso. Essa checagem na camada de servico exige a permissao dedicada
// alem do identity-diff ja existente - defesa em profundidade.
async function assertCanQueueScript(scriptId, user) {
  const script = await findMaintenanceScriptById(scriptId);
  if (!script) return;
  const riskLevel = normalizeRiskLevel(script.riskLevel || script.suggestedRiskLevel, "medium");
  if (dualControlRiskLevels.has(riskLevel) && !hasPermission(user, "scripts.approve_high_risk")) {
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

// Unica funcao deste arquivo com logica de verdade (as demais sao
// wrappers de uma linha para a repository) - o diagnostico precisa
// combinar dado de varias fontes (flag do servidor, agente, permissao,
// script) num unico resultado somente-leitura para a UI explicar por
// que a execucao esta bloqueada, sem duplicar os mesmos criterios que
// useScriptForServiceOrder/useScriptFromSuggestion ja aplicam de verdade.
export async function getScriptExecutionDiagnosis({ assetId, scriptId = null, context, user = null }) {
  if (!String(assetId || "").trim()) {
    throw badRequest("Informe o ativo para calcular o diagnostico de execucao.");
  }
  const basePermission = diagnosisContextPermissions[context] || diagnosisContextPermissions.service_order;
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

  const diagnosis = {
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
    script: null
  };

  if (scriptId) {
    const script = await findMaintenanceScriptById(scriptId);
    if (script) {
      const riskLevel = normalizeRiskLevel(script.riskLevel || script.suggestedRiskLevel, "medium");
      const riskRequiresSecondReviewer = dualControlRiskLevels.has(riskLevel);
      const secondReviewerSatisfied = !riskRequiresSecondReviewer
        ? null
        : !(user?.id && script.contentUpdatedBy && user.id === script.contentUpdatedBy);
      diagnosis.script = {
        scriptActive: script.active !== false,
        scriptTypeAllowed: executableTypes.has(String(script.type || "").toLowerCase()),
        riskLevel,
        riskRequiresSecondReviewer,
        secondReviewerSatisfied
      };
    }
  }

  const scriptOk =
    !diagnosis.script ||
    (diagnosis.script.scriptActive &&
      diagnosis.script.scriptTypeAllowed &&
      (!diagnosis.script.riskRequiresSecondReviewer ||
        (diagnosis.script.secondReviewerSatisfied && userHasHighRiskApproval)));

  diagnosis.overallAvailable = serverEnabled && agentRegistered && agentActive && userHasPermission && scriptOk;

  return diagnosis;
}
