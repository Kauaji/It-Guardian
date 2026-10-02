import { isExecutableScriptType, requiresSecondReviewer } from "../agentScriptJobs.js";
import { resolveScriptRiskLevel } from "./scriptVocabulary.js";

/**
 * Regras do diagnostico somente-leitura de execucao de scripts: combina o
 * estado do servidor, do agente, da permissao e do script para explicar por
 * que a execucao esta (ou nao) disponivel. Modulo puro.
 */

/** Permissao base exigida em cada ponto de disparo (OS ou aviso). */
export const executionDiagnosisContextPermissions = {
  service_order: "service_orders.run_scripts",
  alert: "scripts.use_from_alert"
};

/** Resumo do script para o diagnostico (ativo, tipo executavel e controle duplo). */
export function describeScriptForDiagnosis(script, user) {
  const riskLevel = resolveScriptRiskLevel(script);
  const riskRequiresSecondReviewer = requiresSecondReviewer(riskLevel);
  const secondReviewerSatisfied = !riskRequiresSecondReviewer
    ? null
    : !(user?.id && script.contentUpdatedBy && user.id === script.contentUpdatedBy);

  return {
    scriptActive: script.active !== false,
    scriptTypeAllowed: isExecutableScriptType(script.type),
    riskLevel,
    riskRequiresSecondReviewer,
    secondReviewerSatisfied
  };
}

/** O script selecionado (se houver) permite a execucao para este usuario? */
export function isScriptDiagnosisSatisfied(scriptDiagnosis, userHasHighRiskApproval) {
  if (!scriptDiagnosis) return true;
  return Boolean(
    scriptDiagnosis.scriptActive &&
      scriptDiagnosis.scriptTypeAllowed &&
      (!scriptDiagnosis.riskRequiresSecondReviewer ||
        (scriptDiagnosis.secondReviewerSatisfied && userHasHighRiskApproval))
  );
}
