import { normalizeComparableText, normalizeTokenList } from "./listNormalization.js";
import { normalizeRiskLevel } from "./scriptVocabulary.js";

/**
 * Pontuacao e ordenacao de scripts recomendados para o contexto de um aviso,
 * sugestao de OS ou ativo. Modulo puro.
 */

function buildRecommendationContext(context = {}) {
  const tags = normalizeTokenList(context.tags);
  const technicalCategory = context.technicalCategory || inferTechnicalCategory(context);
  const fields = [
    context.alertType,
    context.metric,
    context.category,
    technicalCategory,
    context.severity,
    context.priority,
    context.title,
    context.description,
    context.probableCause,
    context.recommendedAction,
    context.problemType,
    context.assetType,
    context.operatingSystem,
    context.segmentName,
    context.groupName,
    ...tags
  ];
  const text = normalizeComparableText(fields.filter(Boolean).join(" "));

  return {
    ...context,
    normalizedText: text,
    alertType: normalizeComparableText(context.alertType),
    metric: normalizeComparableText(context.metric),
    category: normalizeComparableText(context.category),
    technicalCategory: normalizeComparableText(technicalCategory),
    severity: normalizeComparableText(context.severity),
    priority: normalizeComparableText(context.priority),
    problemType: normalizeComparableText(context.problemType),
    assetType: normalizeComparableText(context.assetType),
    operatingSystem: normalizeComparableText(context.operatingSystem),
    segmentName: normalizeComparableText(context.segmentName),
    groupName: normalizeComparableText(context.groupName),
    tags
  };
}

export function inferTechnicalCategory(source = {}) {
  const text = normalizeComparableText([
    source.alertType,
    source.metric,
    source.title,
    source.description,
    source.problemType,
    source.probableCause,
    source.recommendedAction,
    source.technicalCategory,
    source.category
  ].filter(Boolean).join(" "));

  if (/(disco|disk|storage|hd|ssd)/.test(text)) return "Armazenamento";
  if (/(ram|memoria|memory)/.test(text)) return "Memoria";
  if (/(cpu|processador)/.test(text)) return "Processamento";
  if (/(rede|network|ping|offline|indisponivel)/.test(text)) return "Rede";
  if (/(impressora|printer)/.test(text)) return "Impressoras";
  if (/(servico|service)/.test(text)) return "Servicos";
  return source.technicalCategory || source.category || "";
}

function matchesContextValue(values, candidates) {
  return values.some((value) =>
    candidates.some((candidate) => candidate && (value === candidate || candidate.includes(value) || value.includes(candidate)))
  );
}

export function scoreMaintenanceScriptForContext(script = {}, context = {}) {
  if (!script || script.active === false) return null;

  const normalized = buildRecommendationContext(context);
  const relatedAlertTypes = normalizeTokenList(script.relatedAlertTypes);
  const relatedProblemTypes = normalizeTokenList(script.relatedProblemTypes);
  const recommendedForCategories = normalizeTokenList(script.recommendedForCategories);
  const tags = normalizeTokenList(script.tags);
  const scriptFields = normalizeComparableText([
    script.name,
    script.description,
    script.category,
    script.alertType,
    script.problemType,
    script.estimatedSummary,
    ...tags,
    ...relatedAlertTypes,
    ...relatedProblemTypes,
    ...recommendedForCategories
  ].filter(Boolean).join(" "));
  const compatibilityWarnings = [];
  const reasons = [];
  let score = 0;

  const scriptAlertType = normalizeComparableText(script.alertType);
  if (
    normalized.alertType &&
    (scriptAlertType === normalized.alertType || relatedAlertTypes.includes(normalized.alertType))
  ) {
    score += 40;
    reasons.push("tipo de aviso compatível");
  }

  if (
    normalized.problemType &&
    (normalizeComparableText(script.problemType) === normalized.problemType || relatedProblemTypes.includes(normalized.problemType))
  ) {
    score += 35;
    reasons.push("tipo de problema compatível");
  }

  const scriptCategory = normalizeComparableText(script.category);
  if (
    normalized.technicalCategory &&
    (scriptCategory === normalized.technicalCategory || recommendedForCategories.includes(normalized.technicalCategory))
  ) {
    score += 25;
    reasons.push("categoria compatível");
  }

  const tagMatches = tags.filter((tag) =>
    tag && (normalized.normalizedText.includes(tag) || normalized.tags.includes(tag))
  );
  if (tagMatches.length) {
    score += tagMatches.length * 10;
    reasons.push(`tags relacionadas: ${tagMatches.slice(0, 3).join(", ")}`);
  }

  if (normalized.assetType && scriptFields.includes(normalized.assetType)) {
    score += 20;
    reasons.push("tipo de ativo compativel");
  }

  if (normalized.operatingSystem && scriptFields.includes(normalized.operatingSystem)) {
    score += 20;
    reasons.push("sistema operacional compativel");
  }

  const keywordMatches = [
    "disco",
    "ram",
    "memoria",
    "cpu",
    "rede",
    "offline",
    "ping",
    "impressora",
    "servico",
    "temperatura"
  ].filter((keyword) => normalized.normalizedText.includes(keyword) && scriptFields.includes(keyword));
  if (keywordMatches.length) {
    score += keywordMatches.length * 5;
    reasons.push(`palavras-chave: ${keywordMatches.slice(0, 3).join(", ")}`);
  }

  const supportedSystems = normalizeTokenList(script.supportedOperatingSystems || script.operatingSystems);
  if (normalized.operatingSystem && supportedSystems.length && !matchesContextValue(supportedSystems, [normalized.operatingSystem])) {
    return null;
  }

  if (script.requiresAdmin) {
    compatibilityWarnings.push("Pode exigir permissão administrativa em execução futura.");
  }
  if (script.requiresLoggedUser) {
    compatibilityWarnings.push("Pode exigir usuário logado no ativo em execução futura.");
  }
  if (["high", "critical"].includes(normalizeRiskLevel(script.riskLevel, "medium"))) {
    compatibilityWarnings.push("Script de risco elevado: revisar antes de usar.");
    score = Math.max(0, score - 5);
  }

  return {
    ...script,
    recommendationScore: score,
    recommendationReason: reasons.length
      ? `Recomendado por ${reasons.join("; ")}.`
      : "Sem correspondência forte com o contexto do aviso.",
    compatibilityWarnings,
    isRecommended: score > 0
  };
}

export function recommendMaintenanceScripts(context = {}, scripts = []) {
  const scored = scripts
    .map((script) => scoreMaintenanceScriptForContext(script, context))
    .filter(Boolean)
    .sort((left, right) => {
      if (right.recommendationScore !== left.recommendationScore) {
        return right.recommendationScore - left.recommendationScore;
      }
      return String(left.name || "").localeCompare(String(right.name || ""));
    });

  return {
    recommended: scored.filter((script) => script.isRecommended),
    others: scored.filter((script) => !script.isRecommended)
  };
}

export function toRecommendedScriptResponse(script) {
  return {
    id: script.id,
    name: script.name,
    category: script.category,
    riskLevel: script.riskLevel,
    estimatedSummary: script.estimatedSummary,
    recommendationScore: script.recommendationScore || 0,
    recommendationReason: script.recommendationReason || "",
    compatibilityWarnings: script.compatibilityWarnings || [],
    requiresLoggedUser: script.requiresLoggedUser === true,
    requiresAdmin: script.requiresAdmin === true,
    supportedVariables: script.supportedVariables || [],
    isRecommended: script.isRecommended === true,
    matchedAssetIds: script.matchedAssetIds || [],
    matchedAlertIds: script.matchedAlertIds || []
  };
}

/** Monta o contexto de recomendacao a partir de uma sugestao de OS e do aviso de origem. */
export function buildSuggestionRecommendationContext(suggestion, alert) {
  return {
    alertType: alert?.type || suggestion.suggestedProblemTypeId || "",
    metric: alert?.metric || "",
    category: "",
    technicalCategory: inferTechnicalCategory({
      alertType: alert?.type,
      metric: alert?.metric,
      title: suggestion.title || alert?.title,
      description: suggestion.description || alert?.description,
      problemType: suggestion.suggestedProblemTypeId
    }),
    severity: alert?.severity || "",
    priority: suggestion.suggestedPriority || "",
    title: suggestion.title || alert?.title || "",
    description: suggestion.description || alert?.description || "",
    probableCause: suggestion.probableCause || "",
    recommendedAction: suggestion.recommendedAction || "",
    problemType: suggestion.suggestedProblemTypeId || "",
    assetType: suggestion.assetType || "",
    operatingSystem: suggestion.operatingSystem || ""
  };
}
