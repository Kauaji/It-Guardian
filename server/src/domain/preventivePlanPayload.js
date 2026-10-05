/** @import { AutomationPlan } from "./preventiveTypes.js" */
import { badRequest } from "../lib/errors.js";
import { trimString } from "../lib/textUtils.js";

/**
 * Regras puras do plano preventivo manual: normalizacao do payload, confirmacao
 * de risco, resumo da automacao vinculada e textos de registro.
 */

const allowedStatuses = new Set(["prepared", "simulated", "completed", "failed", "cancelled"]);
const highRiskLevels = new Set(["high", "critical"]);

/**
 * @param {unknown} value
 * @param {string} [fallback]
 */
export function normalizePreventivePlanStatus(value, fallback = "prepared") {
  const status = String(value || "").trim().toLowerCase();
  return allowedStatuses.has(status) ? status : fallback;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeIdList(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((id) => trimString(id, 120)).filter(Boolean))]
    : [];
}

/**
 * Valida e normaliza o corpo de criacao de um plano preventivo manual.
 *
 * @param {Record<string, unknown>} [payload]
 * @throws {import("../lib/errors.js").AppError} 400 sem nome (3+), maquinas ou scripts.
 */
export function normalizePreventivePlanPayload(payload = {}) {
  const name = trimString(payload.name, 120);
  const assetIds = normalizeIdList(payload.assetIds);
  const scriptIds = normalizeIdList(payload.scriptIds);

  if (name.length < 3) {
    throw badRequest("Informe um nome de plano preventivo com pelo menos 3 caracteres.");
  }

  if (!assetIds.length) {
    throw badRequest("Selecione pelo menos uma máquina para a preventiva.");
  }

  if (!scriptIds.length) {
    throw badRequest("Selecione pelo menos uma verificação/script cadastrado para compor o plano.");
  }

  return {
    name,
    description: trimString(payload.description, 500),
    source: trimString(payload.source, 80, "manual"),
    originAlertId: trimString(payload.originAlertId, 120) || null,
    originSuggestionId: trimString(payload.originSuggestionId, 120) || null,
    notes: trimString(payload.notes, 1000),
    status: normalizePreventivePlanStatus(payload.status, "prepared"),
    riskAcknowledged: payload.riskAcknowledged === true,
    assetIds,
    scriptIds
  };
}

/**
 * @param {Array<{ riskLevel?: string, suggestedRiskLevel?: string }>} scripts
 * @param {boolean} riskAcknowledged
 * @throws {import("../lib/errors.js").AppError} 400 quando ha script de alto risco sem confirmacao.
 */
export function assertRiskAcknowledged(scripts, riskAcknowledged) {
  const hasHighRiskScript = scripts.some((script) => highRiskLevels.has(String(script.riskLevel || script.suggestedRiskLevel)));
  if (hasHighRiskScript && !riskAcknowledged) {
    throw badRequest("Scripts de alto risco exigem confirmação extra antes de preparar a preventiva.");
  }
}

/**
 * @param {(AutomationPlan & { overrideCount?: number, nextScheduledFor?: string, nextRunAt?: string, assetSchedules?: unknown[], notes?: string }) | null | undefined} automation
 */
export function summarizeAutomation(automation) {
  if (!automation) return { enabled: false };
  return {
    enabled: true,
    id: automation.id,
    preventivePlanId: automation.preventivePlanId,
    name: automation.name,
    active: automation.active !== false,
    recurrenceType: automation.recurrenceType,
    recurrenceInterval: automation.recurrenceInterval,
    recurrenceIntervalDays: automation.recurrenceIntervalDays,
    preferredTime: automation.preferredTime,
    timezone: automation.timezone,
    scopeType: automation.scopeType,
    scopeId: automation.scopeId,
    assetIds: automation.assetIds || [],
    defaultScriptIds: automation.defaultScriptIds || [],
    notes: automation.notes || "",
    indicatorColor: automation.indicatorColor,
    nextRunAt: automation.nextRunAt,
    nextScheduledFor: automation.nextScheduledFor,
    overrideCount: automation.overrideCount || 0,
    overrides: automation.overrides || [],
    assetSchedules: automation.assetSchedules || []
  };
}

/**
 * @param {{ assetId: string, scriptNames: string, automationEnabled: boolean }} input
 * @returns {string}
 */
export function buildAssetRegistrationLog({ assetId, scriptNames, automationEnabled }) {
  return (
    `Preventiva registrada para ${assetId} com as verificações: ${scriptNames}. ` +
    (automationEnabled
      ? "Execução será iniciada pela agenda de automação."
      : "Scripts enfileirados para execução pelo agente autenticado.")
  );
}

/** Payload do plano de automacao criado junto do plano preventivo (escopo = lista de maquinas). */
/**
 * @param {{ automationPayload?: Record<string, unknown>, planId: string, normalized: ReturnType<typeof normalizePreventivePlanPayload> }} input
 */
export function buildLinkedAutomationPayload({ automationPayload = {}, planId, normalized }) {
  return {
    ...automationPayload,
    preventivePlanId: planId,
    name: trimString(automationPayload.name, 120, normalized.name),
    description: trimString(automationPayload.description, 1000, normalized.description),
    notes: trimString(automationPayload.notes, 1000, normalized.notes),
    scopeType: "asset_list",
    scopeId: null,
    assetIds: normalized.assetIds,
    defaultScriptIds: normalized.scriptIds,
    active: automationPayload.active !== false
  };
}

/** Dados da OS preventiva gerada a partir do plano (nenhum comando e executado). */
/**
 * @param {{ plan: { id: string, name: string, assets?: Array<{ assetId?: string }>, scripts?: Array<{ scriptName?: string, name?: string }> }, user?: { name?: string } | null }} input
 */
export function buildServiceOrderDraft({ plan, user }) {
  const assetIds = (plan.assets || []).map((asset) => asset.assetId).filter(Boolean);
  const scriptNames = (plan.scripts || []).map((script) => script.scriptName || script.name).filter(Boolean);
  const assetSummary = assetIds.length ? assetIds.join(", ") : "Nenhuma máquina vinculada";
  const scriptSummary = scriptNames.length ? scriptNames.join(", ") : "Nenhuma verificação selecionada";
  const titleScope = assetIds.length === 1 ? assetIds[0] : `${assetIds.length} máquina(s)`;

  return {
    assetIds,
    payload: {
      title: `Manutenção preventiva — ${titleScope}`,
      description:
        `OS preventiva criada a partir do plano preventivo '${plan.name}'. ` +
        `Máquinas selecionadas: ${assetSummary}. ` +
        `Verificações selecionadas: ${scriptSummary}. ` +
        "Nenhum comando foi executado automaticamente.",
      priority: "low",
      category: "Preventiva",
      problemType: "Manutenção preventiva",
      serviceName: "Manutenção preventiva",
      source: "Plano Preventivo",
      requesterName: user?.name || "Técnico",
      assignedTechnicianName: user?.name || null,
      assetId: assetIds.length === 1 ? assetIds[0] : null,
      relatedAssetText: assetSummary,
      notes: [
        "Origem: Plano Preventivo",
        `Plano preventivo: ${plan.name}`,
        `Verificações selecionadas: ${scriptSummary}`,
        "Nenhum comando foi executado automaticamente."
      ].join("\n"),
      preventivePlanId: plan.id,
      autoPriorityEnabled: false
    }
  };
}
