import {
  canCreateServiceOrderFromSuggestion,
  consolidateSuggestionsByMachine,
  formatDisplayText,
  getSuggestionMachineLabel,
  priorityLabels
} from "./alertUtils.js";
import { normalizeAlertLocation } from "./alertDisplayUtils.js";

const suggestionPriorityWeight = { critical: 60, high: 45, medium: 25, low: 10 };

export function filterVisibleAlerts(history, severityFilter, statusFilter) {
  return history.filter((alert) => {
    const severityMatches = severityFilter === "all" || alert.severity === severityFilter;
    const statusMatches =
      statusFilter === "all" ||
      (statusFilter === "active" && alert.status === "active") ||
      (statusFilter === "resolved" && alert.status === "resolved");

    return severityMatches && statusMatches;
  });
}

function suggestionWeight(suggestion) {
  const occurrences = Number(suggestion.occurrencesCount || 1);
  return (suggestionPriorityWeight[suggestion.suggestedPriority] || 0) + (occurrences > 1 ? Math.min(occurrences, 8) * 3 : 0);
}

// Sugestoes acionaveis filtradas por status, consolidadas por maquina e
// ordenadas por prioridade/recorrencia (mais recentes primeiro em empate).
export function buildVisibleSuggestions(suggestions, devices, statusFilter) {
  const actionable = suggestions
    .filter(canCreateServiceOrderFromSuggestion)
    .filter((suggestion) => statusFilter === "all" || suggestion.status === statusFilter);

  return consolidateSuggestionsByMachine(actionable, devices).sort((left, right) => {
    const weightDifference = suggestionWeight(right) - suggestionWeight(left);
    if (weightDifference !== 0) return weightDifference;
    return new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0);
  });
}

// Avisos ativos agrupados por maquina (uma lista de avisos por maquina).
export function buildAlertMachineGroups(alerts, lookups) {
  const groups = new Map();

  for (const alert of alerts) {
    if (alert.status === "resolved") continue;
    const device = lookups.findAlertDevice(alert);
    const key = String(device?.id || alert.assetId || alert.hostId || alert.hostName || alert.id);
    const group = groups.get(key) || [];
    group.push(alert);
    groups.set(key, group);
  }

  return Array.from(groups.values());
}

export function buildAlertSummary({ alerts, history, suggestions, devices, lookups }) {
  const machineGroups = buildAlertMachineGroups(alerts, lookups);

  return {
    activeMachines: machineGroups.length,
    criticalAlerts: machineGroups.filter((group) => group.some((alert) => alert.severity === "critical")).length,
    pendingSuggestions: consolidateSuggestionsByMachine(suggestions.filter(canCreateServiceOrderFromSuggestion), devices).length,
    acceptedSuggestions: suggestions.filter((suggestion) => suggestion.status === "accepted").length,
    recurringAlerts: machineGroups.filter((group) => group.some((alert) => (alert.occurrencesCount || 0) >= 3)).length,
    machinesAtRisk: machineGroups.length,
    resolvedAlerts: history.filter((alert) => alert.status === "resolved"),
    handledSuggestions: suggestions.filter((suggestion) => suggestion.status === "accepted" || suggestion.status === "rejected")
  };
}

// Posicao usada no codigo AVISO-AAAA-NNNN do modal de detalhes.
export function findSuggestionCodeIndex(visibleSuggestions, suggestions, selectedId) {
  const visibleIndex = visibleSuggestions.findIndex((suggestion) => suggestion.id === selectedId);
  return visibleIndex >= 0
    ? visibleIndex
    : Math.max(
        0,
        suggestions.findIndex((suggestion) => suggestion.id === selectedId)
      );
}

// Representa a sugestao como um aviso para reaproveitar os formatadores de aviso.
export function buildSuggestionAlertShape(suggestion, lookups) {
  return {
    id: suggestion.alertId,
    type: suggestion.alertType || suggestion.suggestedProblemTypeId,
    metric: suggestion.alertMetric,
    value: suggestion.alertValue,
    threshold: suggestion.alertThreshold,
    severity: suggestion.alertSeverity || (suggestion.suggestedPriority === "critical" ? "critical" : "warning"),
    status: suggestion.status,
    title: lookups.getResolvedSuggestionTitle(suggestion),
    description: formatDisplayText(suggestion.description, "Aviso preventivo"),
    hostName: lookups.getResolvedSuggestionMachineLabel(suggestion),
    occurrencesCount: suggestion.occurrencesCount || 1,
    firstSeenAt: suggestion.alertFirstSeenAt || suggestion.createdAt,
    lastSeenAt: suggestion.alertLastSeenAt || suggestion.updatedAt || suggestion.createdAt,
    createdAt: suggestion.createdAt,
    updatedAt: suggestion.updatedAt
  };
}

export function getSuggestionCorrelations(suggestion, alertCorrelations) {
  const machineLabel = getSuggestionMachineLabel(suggestion);

  return alertCorrelations.filter((correlation) => {
    const relatedAlerts = Array.isArray(correlation.relatedAlerts) ? correlation.relatedAlerts : [];
    const relatedHosts = Array.isArray(correlation.relatedHosts) ? correlation.relatedHosts : [];

    return (
      relatedHosts.includes(machineLabel) ||
      relatedAlerts.some((alert) => alert.id === suggestion.alertId || alert.hostName === machineLabel)
    );
  });
}

// Tudo o que o modal de detalhes da sugestao precisa alem do proprio registro.
export function buildSuggestionInfoModel(suggestion, lookups, alertCorrelations = []) {
  if (!suggestion) return null;

  const priority = suggestion.suggestedPriority || "medium";

  return {
    alert: buildSuggestionAlertShape(suggestion, lookups),
    device: lookups.findSuggestionDevice(suggestion),
    location: normalizeAlertLocation(suggestion.location || lookups.getSuggestionLocation(suggestion)),
    priority,
    priorityLabel: priorityLabels[priority] || priorityLabels.medium,
    machineLabel: lookups.getResolvedSuggestionMachineLabel(suggestion),
    comments: Array.isArray(suggestion.comments) ? suggestion.comments : [],
    checklist: Array.isArray(suggestion.checklist) ? suggestion.checklist : [],
    correlations: getSuggestionCorrelations(suggestion, alertCorrelations)
  };
}
