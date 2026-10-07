import { normalizeText } from "./serviceOrderText.js";

/** @import { PriorityRule, ServiceOrderPayload, ServiceOrderSector, ServiceOrderService } from "./types.js" */

export const serviceOrderPriorities = new Set(["low", "medium", "high", "critical"]);

/** @type {Record<string, number>} Ordem crescente de gravidade. */
export const priorityRank = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};

/**
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string} `value` quando e uma prioridade valida, senao `fallback`.
 */
export function sanitizePriority(value, fallback = "medium") {
  return typeof value === "string" && serviceOrderPriorities.has(value) ? value : fallback;
}

/**
 * @param {string} current
 * @param {unknown} candidate
 * @returns {string} A mais grave entre as duas (`candidate` invalida mantem `current`).
 */
export function chooseHigherPriority(current, candidate) {
  if (typeof candidate !== "string" || !serviceOrderPriorities.has(candidate)) return current;
  return priorityRank[candidate] > priorityRank[current] ? candidate : current;
}

/**
 * Prioridade configurada por regras: parte da prioridade informada (ou do
 * padrao do servico) e so sobe quando uma regra ativa casa com o alvo. Funcao
 * pura: as regras chegam ja lidas do banco.
 *
 * @param {ServiceOrderPayload} [payload]
 * @param {ServiceOrderSector} [sector]
 * @param {ServiceOrderService} [service]
 * @param {PriorityRule[]} [rules]
 * @returns {string}
 */
export function resolveConfiguredPriority(payload = {}, sector = {}, service = {}, rules = []) {
  let priority = sanitizePriority(payload.priority, sanitizePriority(service.defaultPriority, "medium"));
  /** @type {Record<string, string | null | undefined>} */
  const targets = {
    client: payload.environmentName,
    sector: sector.sectorName,
    problem_type: payload.problemType,
    service: service.serviceCode || service.serviceName || payload.serviceName,
    category: payload.category,
    equipment_category: payload.category
  };

  for (const rule of rules.filter((item) => item.active !== false)) {
    const target = normalizeText(rule.targetValue);
    if (!target || !targets[rule.ruleType]) continue;
    if (normalizeText(targets[rule.ruleType]) === target) {
      priority = chooseHigherPriority(priority, rule.priority);
    }
  }

  return priority;
}
