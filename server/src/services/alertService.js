import { addLog } from "../repositories/logRepository.js";
import { addAssetHistory } from "../repositories/assetHistoryRepository.js";
import {
  attachAcknowledgements,
  deleteAcknowledgement,
  findAcknowledgement,
  listAcknowledgements,
  upsertAcknowledgement
} from "../repositories/alertAcknowledgementRepository.js";
import {
  createSuggestionForAlert,
  findAlertById,
  findServiceOrderSuggestionById,
  listAlertRules,
  listAlerts,
  listServiceOrderSuggestions as listSuggestions,
  markSuggestionAccepted,
  markSuggestionRejected,
  updateAlertRule,
  upsertAlert
} from "../repositories/alertRepository.js";
import {
  addServiceOrderHistory,
  createServiceOrder,
  findServiceOrderById
} from "../repositories/serviceOrderRepository.js";
import { getActiveAlerts, getAlertHistory, getHostAlerts } from "./zabbixService.js";

const alertTypeLabels = {
  ram_high: "Memória RAM acima do limite",
  cpu_high: "CPU acima do limite",
  disk_high: "Disco acima do limite",
  disk_health_low: "Saúde do disco abaixo do limite",
  machine_offline: "Máquina offline",
  network_high: "Alto uso de rede",
  temperature_high: "Temperatura alta",
  ping_failure: "Falha recorrente em ping",
  service_unavailable: "Serviço crítico indisponível"
};

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function classifyAlert(alert = {}) {
  const text = normalizeText(`${alert.title || ""} ${alert.description || ""}`);

  if (text.includes("memory") || text.includes("memoria") || text.includes("ram")) {
    return { type: "ram_high", metric: "ram", threshold: 90, value: 94 };
  }
  if (text.includes("cpu")) {
    return { type: "cpu_high", metric: "cpu", threshold: 90, value: 92 };
  }
  if (text.includes("disk") || text.includes("disco") || text.includes("storage") || text.includes("armazenamento")) {
    return { type: "disk_high", metric: "disk", threshold: 90, value: 94 };
  }
  if (text.includes("health") || text.includes("saude")) {
    return { type: "disk_health_low", metric: "disk_health", threshold: 80, value: 72 };
  }
  if (text.includes("ping")) {
    return { type: "ping_failure", metric: "ping", threshold: 0, value: 0 };
  }
  if (text.includes("network") || text.includes("rede")) {
    return { type: "network_high", metric: "network", threshold: 85, value: 88 };
  }
  if (text.includes("temperature") || text.includes("temperatura")) {
    return { type: "temperature_high", metric: "temperature", threshold: 80, value: 84 };
  }
  if (text.includes("service") || text.includes("servico")) {
    return { type: "service_unavailable", metric: "service", threshold: 0, value: 0 };
  }

  return { type: "machine_offline", metric: "availability", threshold: 0, value: 0 };
}

function simulatedOccurrences(alert = {}, type) {
  if (alert.status === "resolved") return 1;
  if (alert.severity === "critical") return 3;
  if (type === "ram_high" || type === "disk_high" || type === "machine_offline") return 3;
  return 2;
}

function suggestedPriority(alert = {}) {
  if (alert.type === "disk_health_low" || alert.severity === "critical") return "critical";
  if (["ram_high", "cpu_high", "disk_high", "machine_offline", "ping_failure"].includes(alert.type)) return "high";
  return alert.severity === "warning" ? "medium" : "low";
}

function buildSuggestionPayload(alert = {}) {
  const label = alertTypeLabels[alert.type] || "Aviso recorrente";
  const hostName = alert.hostName || "ativo monitorado";
  const priority = suggestedPriority(alert);

  return {
    title: `Verificação preventiva: ${label.toLowerCase()} em ${hostName}`,
    description:
      `O sistema identificou ${label.toLowerCase()} acima do limite configurado em ` +
      `${alert.occurrencesCount || 1} ocorrência(s) no período analisado. ` +
      "Recomenda-se análise preventiva do ativo antes de impacto operacional.",
    suggestedPriority: priority,
    suggestedProblemTypeId: alert.type,
    occurrencesCount: alert.occurrencesCount || 1
  };
}

function normalizeMonitoringAlert(alert = {}) {
  const classification = classifyAlert(alert);
  const occurrencesCount = simulatedOccurrences(alert, classification.type);
  return {
    id: alert.id,
    assetId: alert.hostId,
    hostId: alert.hostId,
    hostName: alert.hostName,
    type: classification.type,
    metric: classification.metric,
    title: alertTypeLabels[classification.type] || alert.title || "Aviso de monitoramento",
    description: alert.description || "",
    severity: alert.severity || "warning",
    value: classification.value,
    threshold: classification.threshold,
    status: alert.status || "active",
    firstSeenAt: alert.startedAt || new Date().toISOString(),
    lastSeenAt: alert.resolvedAt || alert.startedAt || new Date().toISOString(),
    resolvedAt: alert.resolvedAt || null,
    occurrencesCount,
    source: "mock"
  };
}

async function syncMockAlerts() {
  const mockAlerts = await getAlertHistory();
  for (const alert of mockAlerts.map(normalizeMonitoringAlert)) {
    await upsertAlert(alert);
  }
}

async function attachCurrentAcknowledgements(alerts) {
  const acknowledgements = await listAcknowledgements();
  return attachAcknowledgements(alerts, acknowledgements);
}

export async function getActiveAlertsWithAcknowledgements() {
  await syncMockAlerts();
  const alerts = await listAlerts({ status: "active" });
  return attachCurrentAcknowledgements(alerts);
}

export async function getAlertHistoryWithAcknowledgements() {
  await syncMockAlerts();
  const alerts = await listAlerts();
  return attachCurrentAcknowledgements(alerts);
}

export async function getHostAlertsWithAcknowledgements(hostId) {
  await syncMockAlerts();
  const alerts = (await listAlerts()).filter((alert) => alert.hostId === hostId || alert.assetId === hostId);
  return attachCurrentAcknowledgements(alerts);
}

export async function getAlertRules() {
  return listAlertRules();
}

export async function updateAlertRuleById({ id, payload, user }) {
  const rule = await updateAlertRule(id, payload);
  await addLog({
    type: "alert_rule_update",
    message: `Regra de aviso atualizada: ${rule.type}`,
    userId: user?.id,
    meta: { ruleId: rule.id, type: rule.type }
  });
  return rule;
}

export async function evaluateAlertsForSuggestions(user = null) {
  await syncMockAlerts();
  const [alerts, rules] = await Promise.all([listAlerts({ status: "active" }), listAlertRules()]);
  const enabledRules = new Map(rules.filter((rule) => rule.enabled).map((rule) => [rule.type, rule]));
  const createdSuggestions = [];

  for (const alert of alerts) {
    const rule = enabledRules.get(alert.type);
    if (!rule?.createsSuggestion) continue;
    if ((alert.occurrencesCount || 1) < (rule.recurrenceCount || 1)) continue;

    const result = await createSuggestionForAlert(alert, buildSuggestionPayload(alert));
    if (result.created && result.suggestion) {
      createdSuggestions.push(result.suggestion);
      if (alert.assetId) {
        await addAssetHistory({
          assetId: alert.assetId,
          eventType: "alert_suggestion_created",
          message: `Sugestão de OS criada por aviso recorrente: ${alert.title}.`,
          newValue: result.suggestion.title,
          userId: user?.id || null,
          userName: user?.name || "Sistema"
        });
      }
    }
  }

  return {
    alerts,
    rules,
    suggestions: await listSuggestions(),
    createdSuggestions
  };
}

export async function listServiceOrderSuggestions() {
  await evaluateAlertsForSuggestions();
  return listSuggestions();
}

export async function acceptServiceOrderSuggestion({ id, user }) {
  const suggestion = await findServiceOrderSuggestionById(id);
  if (!suggestion) {
    const error = new Error("Sugestão de OS não encontrada.");
    error.statusCode = 404;
    throw error;
  }
  if (suggestion.status === "accepted" && suggestion.createdServiceOrderId) {
    const serviceOrder = await findServiceOrderById(suggestion.createdServiceOrderId, user);
    return { suggestion, serviceOrder };
  }
  if (suggestion.status !== "pending") {
    const error = new Error("Apenas sugestões pendentes podem ser aceitas.");
    error.statusCode = 409;
    throw error;
  }

  const alert = await findAlertById(suggestion.alertId);
  const serviceOrder = await createServiceOrder({
    payload: {
      title: suggestion.title,
      description: suggestion.description,
      priority: suggestion.suggestedPriority,
      category: "Monitoramento",
      problemType: alert?.type || suggestion.suggestedProblemTypeId || "alerta",
      assetId: suggestion.assetId || alert?.assetId || null,
      relatedAssetText: alert?.hostName || null,
      source: "alert_suggestion",
      notes: `Origem: aviso/sugestão de OS. Tipo: ${alert?.title || suggestion.title}.`
    },
    user
  });

  await addServiceOrderHistory({
    serviceOrderId: serviceOrder.id,
    eventType: "alert_suggestion_accepted",
    message:
      `OS criada a partir de sugestão de aviso. Tipo: ${alert?.title || "Aviso"}. ` +
      `Métrica: ${alert?.metric || "monitoramento"}. Ocorrências: ${suggestion.occurrencesCount}.`,
    newValue: suggestion.id,
    user
  });

  if (suggestion.assetId || alert?.assetId) {
    await addAssetHistory({
      assetId: suggestion.assetId || alert.assetId,
      eventType: "alert_suggestion_accepted",
      message: `${user?.name || "Usuário"} aceitou sugestão de OS gerada por ${alert?.title || "aviso recorrente"}.`,
      newValue: serviceOrder.number,
      userId: user?.id || null,
      userName: user?.name || null
    });
  }

  const updatedSuggestion = await markSuggestionAccepted({
    id: suggestion.id,
    userId: user?.id,
    serviceOrderId: serviceOrder.id
  });

  await addLog({
    type: "alert_suggestion_accepted",
    message: `Sugestão de OS aceita: ${serviceOrder.number}`,
    userId: user?.id,
    meta: { suggestionId: suggestion.id, alertId: suggestion.alertId, serviceOrderId: serviceOrder.id }
  });

  return { suggestion: updatedSuggestion, serviceOrder };
}

export async function rejectServiceOrderSuggestion({ id, reason, user }) {
  const suggestion = await findServiceOrderSuggestionById(id);
  if (!suggestion) {
    const error = new Error("Sugestão de OS não encontrada.");
    error.statusCode = 404;
    throw error;
  }
  if (suggestion.status !== "pending") {
    const error = new Error("Apenas sugestões pendentes podem ser recusadas.");
    error.statusCode = 409;
    throw error;
  }

  const updatedSuggestion = await markSuggestionRejected({ id, userId: user?.id, reason });
  const alert = await findAlertById(suggestion.alertId);

  if (suggestion.assetId || alert?.assetId) {
    await addAssetHistory({
      assetId: suggestion.assetId || alert.assetId,
      eventType: "alert_suggestion_rejected",
      message: `${user?.name || "Usuário"} recusou sugestão de OS gerada por ${alert?.title || "aviso recorrente"}.`,
      oldValue: suggestion.title,
      newValue: reason || null,
      userId: user?.id || null,
      userName: user?.name || null
    });
  }

  await addLog({
    type: "alert_suggestion_rejected",
    message: "Sugestão de OS recusada",
    userId: user?.id,
    meta: { suggestionId: suggestion.id, alertId: suggestion.alertId, reason: reason || null }
  });

  return updatedSuggestion;
}

export async function acknowledgeAlert({ alertId, user, note }) {
  const alerts = await getAlertHistory();
  const alert = alerts.find((item) => item.id === alertId);

  if (!alert) {
    const error = new Error("Alert not found");
    error.statusCode = 404;
    throw error;
  }

  const acknowledgement = await upsertAcknowledgement({ alertId, userId: user.id, note });

  await addLog({
    type: "alert_acknowledgement",
    message: `Alert acknowledged: ${alert.title}`,
    userId: user.id,
    meta: { alertId, hostId: alert.hostId, note: note || null }
  });

  return { ...alert, acknowledgement };
}

export async function unacknowledgeAlert({ alertId, user }) {
  const acknowledgement = await findAcknowledgement(alertId);

  if (!acknowledgement) {
    const error = new Error("Alert acknowledgement not found");
    error.statusCode = 404;
    throw error;
  }

  await deleteAcknowledgement(alertId);

  await addLog({
    type: "alert_unacknowledgement",
    message: "Alert acknowledgement removed",
    userId: user.id,
    meta: { alertId }
  });

  return { alertId };
}
