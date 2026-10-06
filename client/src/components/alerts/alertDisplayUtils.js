import { formatDisplayText, suggestionStatusLabels } from "./alertUtils.js";

// Formatadores "seguros": aceitam objetos, listas e valores ausentes vindos da API.

export function getSafeCommentMessage(comment) {
  return formatDisplayText(comment?.message || comment?.text || comment, "Comentário sem mensagem.");
}

export function getSafeSummary(value, fallback = "Não informado") {
  return formatDisplayText(value?.summary ?? value, fallback);
}

export function getSafeListItem(item, fallback = "Item sem descrição") {
  return formatDisplayText(item, fallback);
}

export function getSafeStatusLabel(status, fallback = "Pendente") {
  const normalizedStatus = typeof status === "string" ? status : formatDisplayText(status, "");
  return suggestionStatusLabels[normalizedStatus] || formatDisplayText(status, fallback);
}

export function getSafeScriptLabel(script, fallback = "Script cadastrado") {
  return formatDisplayText(script?.name || script?.label || script?.title || script, fallback);
}

export function normalizeAlertLocation(location = {}) {
  return {
    segmentName: formatDisplayText(location.segmentName || location.segment, "Não organizadas"),
    groupName: formatDisplayText(location.groupName || location.group, "Sem grupo")
  };
}

export function isHighRiskScript(script) {
  return script?.riskLevel === "high" || script?.riskLevel === "critical";
}

// Monta o objeto de log exibido no modal a partir da validacao mais recente de uma sugestao.
export function buildScriptLogFromValidation(validation) {
  return {
    ...validation.log,
    scriptName: validation.scriptName,
    validationStatus: validation.status,
    validationId: validation.id
  };
}
