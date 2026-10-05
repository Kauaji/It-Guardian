import { normalizeText } from "./serviceOrderText.js";

export const serviceOrderPriorities = new Set(["low", "medium", "high", "critical"]);

export const priorityRank = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};

export function sanitizePriority(value, fallback = "medium") {
  return serviceOrderPriorities.has(value) ? value : fallback;
}

export function chooseHigherPriority(current, candidate) {
  if (!serviceOrderPriorities.has(candidate)) return current;
  return priorityRank[candidate] > priorityRank[current] ? candidate : current;
}

/**
 * Prioridade configurada por regras: parte da prioridade informada (ou do
 * padrao do servico) e so sobe quando uma regra ativa casa com o alvo. Funcao
 * pura: as regras chegam ja lidas do banco.
 */
export function resolveConfiguredPriority(payload = {}, sector = {}, service = {}, rules = []) {
  let priority = sanitizePriority(payload.priority, sanitizePriority(service.defaultPriority, "medium"));
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
