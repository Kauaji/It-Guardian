import { badRequest } from "../../lib/errors.js";
import { normalizeBoolean, trimString } from "../../lib/textUtils.js";
import { analyzeMaintenanceScriptContent } from "./contentAnalysis.js";
import { assertScriptContentIsSafe } from "./contentSafety.js";
import { normalizeTextList, normalizeVariableList } from "./listNormalization.js";
import { maxLengths, normalizeRiskLevel, normalizeScriptType } from "./scriptVocabulary.js";

/**
 * Valida e normaliza o payload de cadastro/edicao de um script de manutencao.
 * Aplica o bloqueio rigido de conteudo perigoso e a lista fechada de variaveis
 * antes de qualquer gravacao. Modulo puro.
 */

export function normalizeScriptPayload(payload = {}, current = {}) {
  const name = trimString(payload.name ?? current.name, maxLengths.name);
  const content = String(payload.content ?? current.content ?? "").slice(0, maxLengths.content);

  if (!name || name.length < 3) {
    throw badRequest("Informe um nome de script com pelo menos 3 caracteres.");
  }

  if (!content.trim()) {
    throw badRequest("Informe o conteúdo do script como texto.");
  }

  assertScriptContentIsSafe(content);

  const analysis = analyzeMaintenanceScriptContent(content);
  if (analysis.unknownVariables?.length) {
    throw badRequest(`Variaveis nao permitidas no script: ${analysis.unknownVariables.join(", ")}.`);
  }
  const suggestedRiskLevel = normalizeRiskLevel(
    payload.suggestedRiskLevel ?? current.suggestedRiskLevel,
    analysis.suggestedRiskLevel
  );
  const tags = normalizeTextList(payload.tags ?? current.tags);
  const relatedAlertTypes = normalizeTextList(payload.relatedAlertTypes ?? current.relatedAlertTypes);
  const relatedProblemTypes = normalizeTextList(payload.relatedProblemTypes ?? current.relatedProblemTypes);
  const recommendedForCategories = normalizeTextList(payload.recommendedForCategories ?? current.recommendedForCategories);
  const supportedVariables = normalizeVariableList(payload.supportedVariables ?? current.supportedVariables);
  const detectedVariables = normalizeVariableList(analysis.detectedVariables);
  const finalSupportedVariables = [...new Set([...supportedVariables, ...detectedVariables])];

  return {
    name,
    description: trimString(payload.description ?? current.description, maxLengths.description),
    type: normalizeScriptType(payload.type ?? current.type),
    content,
    estimatedSummary: trimString(
      payload.estimatedSummary ?? current.estimatedSummary ?? analysis.estimatedSummary,
      maxLengths.content,
      analysis.estimatedSummary
    ),
    category: trimString(payload.category ?? current.category, maxLengths.category),
    riskLevel: normalizeRiskLevel(payload.riskLevel ?? current.riskLevel, suggestedRiskLevel),
    suggestedRiskLevel,
    requiresConfirmation: normalizeBoolean(payload.requiresConfirmation ?? current.requiresConfirmation, true),
    active: normalizeBoolean(payload.active ?? current.active, true),
    alertType: trimString(payload.alertType ?? current.alertType, maxLengths.alertType),
    problemType: trimString(payload.problemType ?? current.problemType, maxLengths.problemType),
    tags,
    supportedVariables: finalSupportedVariables,
    relatedAlertTypes,
    relatedProblemTypes,
    recommendedForCategories,
    requiresLoggedUser: normalizeBoolean(payload.requiresLoggedUser ?? current.requiresLoggedUser, false),
    requiresAdmin: normalizeBoolean(payload.requiresAdmin ?? current.requiresAdmin, false),
    safePreview: analysis.safePreview || content,
    variableValidationStatus: analysis.variableValidationStatus || "valid"
  };
}
