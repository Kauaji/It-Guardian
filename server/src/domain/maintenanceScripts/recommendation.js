import { normalizeComparableText, normalizeTokenList } from "./listNormalization.js";
import { normalizeRiskLevel } from "./scriptVocabulary.js";

/**
 * Pontuacao e ordenacao de scripts recomendados para o contexto de um aviso,
 * sugestao de OS ou ativo. Modulo puro.
 */

/**
 * Contexto de um aviso/sugestao/ativo contra o qual os scripts sao pontuados.
 * @typedef {object} RecommendationContext
 * @property {string | null} [alertType]
 * @property {string | null} [metric]
 * @property {string | null} [category]
 * @property {string | null} [technicalCategory]
 * @property {string | null} [severity]
 * @property {string | null} [priority]
 * @property {string | null} [title]
 * @property {string | null} [description]
 * @property {string | null} [probableCause]
 * @property {string | null} [recommendedAction]
 * @property {string | null} [problemType]
 * @property {string | null} [assetType]
 * @property {string | null} [operatingSystem]
 * @property {string | null} [segmentName]
 * @property {string | null} [groupName]
 * @property {unknown} [tags]
 * @property {string | null} [assetId]
 * @property {string | null} [alertId]
 */

/**
 * Script de manutencao como o ranking o enxerga (campos de lista aceitam array, JSON ou CSV).
 * @typedef {object} RecommendableScript
 * @property {string} [id]
 * @property {string} [name]
 * @property {string} [description]
 * @property {string} [category]
 * @property {string} [alertType]
 * @property {string} [problemType]
 * @property {string} [estimatedSummary]
 * @property {string} [riskLevel]
 * @property {boolean} [active]
 * @property {boolean} [requiresAdmin]
 * @property {boolean} [requiresLoggedUser]
 * @property {unknown} [relatedAlertTypes]
 * @property {unknown} [relatedProblemTypes]
 * @property {unknown} [recommendedForCategories]
 * @property {unknown} [tags]
 * @property {unknown} [supportedOperatingSystems]
 * @property {unknown} [operatingSystems]
 * @property {unknown[]} [supportedVariables]
 */

/**
 * Script ja pontuado.
 * @typedef {RecommendableScript & {
 *   recommendationScore: number, recommendationReason: string, compatibilityWarnings: string[], isRecommended: boolean
 * }} ScoredScript
 */

/** @param {RecommendationContext} [context] */
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

/**
 * @param {RecommendationContext} [source]
 * @returns {string} Categoria tecnica inferida do texto (ou a informada, ou "").
 */
export function inferTechnicalCategory(source = {}) {
  const text = normalizeComparableText(
    [
      source.alertType,
      source.metric,
      source.title,
      source.description,
      source.problemType,
      source.probableCause,
      source.recommendedAction,
      source.technicalCategory,
      source.category
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (/(disco|disk|storage|hd|ssd)/.test(text)) return "Armazenamento";
  if (/(ram|memoria|memory)/.test(text)) return "Memoria";
  if (/(cpu|processador)/.test(text)) return "Processamento";
  if (/(rede|network|ping|offline|indisponivel)/.test(text)) return "Rede";
  if (/(impressora|printer)/.test(text)) return "Impressoras";
  if (/(servico|service)/.test(text)) return "Servicos";
  return source.technicalCategory || source.category || "";
}

/**
 * @param {string[]} values
 * @param {string[]} candidates
 */
function matchesContextValue(values, candidates) {
  return values.some((value) =>
    candidates.some((candidate) => candidate && (value === candidate || candidate.includes(value) || value.includes(candidate)))
  );
}

const CONTEXT_KEYWORDS = ["disco", "ram", "memoria", "cpu", "rede", "offline", "ping", "impressora", "servico", "temperatura"];

// Campos normalizados do script usados na comparacao com o contexto.
/** @param {RecommendableScript} script */
function profileScriptForScoring(script) {
  const relatedAlertTypes = normalizeTokenList(script.relatedAlertTypes);
  const relatedProblemTypes = normalizeTokenList(script.relatedProblemTypes);
  const recommendedForCategories = normalizeTokenList(script.recommendedForCategories);
  const tags = normalizeTokenList(script.tags);
  const fields = normalizeComparableText(
    [
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
    ]
      .filter(Boolean)
      .join(" ")
  );

  return { relatedAlertTypes, relatedProblemTypes, recommendedForCategories, tags, fields };
}

// Cada criterio compativel contribui com pontos e um motivo legivel, nesta ordem.
/**
 * @param {RecommendableScript} script
 * @param {ReturnType<typeof buildRecommendationContext> & { normalizedText: string }} normalized
 * @param {ReturnType<typeof profileScriptForScoring>} profile
 */
function collectScoreEntries(script, normalized, profile) {
  /** @type {Array<{ points: number, reason: string }>} */
  const entries = [];

  if (
    normalized.alertType &&
    (normalizeComparableText(script.alertType) === normalized.alertType || profile.relatedAlertTypes.includes(normalized.alertType))
  ) {
    entries.push({ points: 40, reason: "tipo de aviso compatível" });
  }

  if (
    normalized.problemType &&
    (normalizeComparableText(script.problemType) === normalized.problemType || profile.relatedProblemTypes.includes(normalized.problemType))
  ) {
    entries.push({ points: 35, reason: "tipo de problema compatível" });
  }

  if (
    normalized.technicalCategory &&
    (normalizeComparableText(script.category) === normalized.technicalCategory ||
      profile.recommendedForCategories.includes(normalized.technicalCategory))
  ) {
    entries.push({ points: 25, reason: "categoria compatível" });
  }

  const tagMatches = profile.tags.filter((tag) => tag && (normalized.normalizedText.includes(tag) || normalized.tags.includes(tag)));
  if (tagMatches.length) {
    entries.push({ points: tagMatches.length * 10, reason: `tags relacionadas: ${tagMatches.slice(0, 3).join(", ")}` });
  }

  if (normalized.assetType && profile.fields.includes(normalized.assetType)) {
    entries.push({ points: 20, reason: "tipo de ativo compativel" });
  }

  if (normalized.operatingSystem && profile.fields.includes(normalized.operatingSystem)) {
    entries.push({ points: 20, reason: "sistema operacional compativel" });
  }

  const keywordMatches = CONTEXT_KEYWORDS.filter(
    (keyword) => normalized.normalizedText.includes(keyword) && profile.fields.includes(keyword)
  );
  if (keywordMatches.length) {
    entries.push({ points: keywordMatches.length * 5, reason: `palavras-chave: ${keywordMatches.slice(0, 3).join(", ")}` });
  }

  return entries;
}

// Script que declara sistemas operacionais suportados e nao inclui o do ativo e descartado.
/**
 * @param {RecommendableScript} script
 * @param {{ operatingSystem: string }} normalized
 */
function isIncompatibleWithOperatingSystem(script, normalized) {
  const supportedSystems = normalizeTokenList(script.supportedOperatingSystems || script.operatingSystems);
  return Boolean(
    normalized.operatingSystem && supportedSystems.length && !matchesContextValue(supportedSystems, [normalized.operatingSystem])
  );
}

/** @param {RecommendableScript} script */
function isElevatedRisk(script) {
  return ["high", "critical"].includes(normalizeRiskLevel(script.riskLevel, "medium"));
}

/**
 * @param {RecommendableScript} [script]
 * @param {RecommendationContext} [context]
 * @returns {ScoredScript | null} null para script inativo ou incompativel com o SO do ativo.
 */
export function scoreMaintenanceScriptForContext(script = {}, context = {}) {
  if (!script || script.active === false) return null;

  const normalized = buildRecommendationContext(context);
  const entries = collectScoreEntries(script, normalized, profileScriptForScoring(script));
  if (isIncompatibleWithOperatingSystem(script, normalized)) return null;

  /** @type {string[]} */
  const compatibilityWarnings = [];
  let score = entries.reduce((total, entry) => total + entry.points, 0);

  if (script.requiresAdmin) {
    compatibilityWarnings.push("Pode exigir permissão administrativa em execução futura.");
  }
  if (script.requiresLoggedUser) {
    compatibilityWarnings.push("Pode exigir usuário logado no ativo em execução futura.");
  }
  if (isElevatedRisk(script)) {
    compatibilityWarnings.push("Script de risco elevado: revisar antes de usar.");
    score = Math.max(0, score - 5);
  }

  const reasons = entries.map((entry) => entry.reason);
  return {
    ...script,
    recommendationScore: score,
    recommendationReason: reasons.length ? `Recomendado por ${reasons.join("; ")}.` : "Sem correspondência forte com o contexto do aviso.",
    compatibilityWarnings,
    isRecommended: score > 0
  };
}

/**
 * @param {RecommendationContext} [context]
 * @param {RecommendableScript[]} [scripts]
 * @returns {{ recommended: ScoredScript[], others: ScoredScript[] }}
 */
export function recommendMaintenanceScripts(context = {}, scripts = []) {
  const scored = scripts
    .map((script) => scoreMaintenanceScriptForContext(script, context))
    .filter((script) => script !== null)
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

/** @param {Partial<ScoredScript> & { matchedAssetIds?: string[], matchedAlertIds?: string[] }} script */
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
/**
 * @param {{ suggestedProblemTypeId?: string | null, title?: string, description?: string, suggestedPriority?: string, probableCause?: string, recommendedAction?: string, assetType?: string, operatingSystem?: string }} suggestion
 * @param {{ type?: string, metric?: string, title?: string, description?: string, severity?: string } | null | undefined} alert
 * @returns {RecommendationContext}
 */
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
