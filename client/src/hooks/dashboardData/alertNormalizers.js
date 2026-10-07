// Normalização dos avisos e sugestões vindos da API (textos, severidade, local e listas).
import { formatDisplayText } from "../../components/alerts/alertUtils.js";

export function normalizeAlertLocation(location) {
  if (!location || typeof location !== "object") return location;
  return {
    ...location,
    group: formatDisplayText(location.group, ""),
    groupName: formatDisplayText(location.groupName || location.group, "Sem grupo"),
    segment: formatDisplayText(location.segment, ""),
    segmentName: formatDisplayText(location.segmentName || location.segment, "Não organizadas")
  };
}

export function normalizeAlertSeverity(severity) {
  const value = formatDisplayText(severity, "warning")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (value.includes("crit")) return "critical";
  if (value.includes("info")) return "info";
  if (value.includes("ok") || value.includes("resol")) return "ok";
  if (value.includes("alta") || value.includes("high")) return "high";
  return value || "warning";
}

export function normalizeAlertRecord(alert = {}) {
  const title = formatDisplayText(alert.title, "Aviso ativo");
  const description = formatDisplayText(alert.description || alert.message || alert.summary, title);
  const hostName = formatDisplayText(
    alert.machineAlias || alert.assetName || alert.hostName || alert.hostname || alert.assetId,
    "Máquina não vinculada"
  );

  return {
    ...alert,
    id: formatDisplayText(alert.id, `${hostName}-${title}`),
    title,
    description,
    hostName,
    assetName: formatDisplayText(alert.machineAlias || alert.assetName || hostName, hostName),
    status: formatDisplayText(alert.status, "active"),
    severity: normalizeAlertSeverity(alert.severity),
    type: formatDisplayText(alert.type, ""),
    metric: formatDisplayText(alert.metric, ""),
    category: formatDisplayText(alert.category, ""),
    priorityReason: formatDisplayText(alert.priorityReason, ""),
    operationalImpact: formatDisplayText(alert.operationalImpact, ""),
    probableCause: formatDisplayText(alert.probableCause, ""),
    recommendedAction: formatDisplayText(alert.recommendedAction, ""),
    location: normalizeAlertLocation(alert.location),
    checklist: Array.isArray(alert.checklist) ? alert.checklist.map((item) => formatDisplayText(item, "Item")) : [],
    comments: Array.isArray(alert.comments)
      ? alert.comments.map((comment) => ({
          ...comment,
          id: formatDisplayText(comment.id, `${hostName}-comment`),
          userName: formatDisplayText(comment.userName || comment.author, "Usuário"),
          message: formatDisplayText(comment.message || comment.body || comment.text, "")
        }))
      : []
  };
}

export function normalizeSuggestionRecord(suggestion = {}) {
  const title = formatDisplayText(suggestion.title, "Aviso preventivo");
  const machineLabel = formatDisplayText(
    suggestion.machineAlias || suggestion.assetName || suggestion.hostName || suggestion.hostname,
    "Máquina não vinculada"
  );

  return {
    ...suggestion,
    id: formatDisplayText(suggestion.id, `${machineLabel}-${title}`),
    title,
    description: formatDisplayText(suggestion.description || suggestion.summary, title),
    machineAlias: formatDisplayText(suggestion.machineAlias, ""),
    assetName: formatDisplayText(suggestion.assetName || machineLabel, machineLabel),
    hostName: machineLabel,
    category: formatDisplayText(suggestion.category, ""),
    priorityReason: formatDisplayText(suggestion.priorityReason, ""),
    operationalImpact: formatDisplayText(suggestion.operationalImpact, ""),
    probableCause: formatDisplayText(suggestion.probableCause, ""),
    recommendedAction: formatDisplayText(suggestion.recommendedAction, ""),
    location: normalizeAlertLocation(suggestion.location),
    problemLabels: Array.isArray(suggestion.problemLabels)
      ? suggestion.problemLabels.map((item) => formatDisplayText(item, "Aviso"))
      : suggestion.problemLabels
  };
}
