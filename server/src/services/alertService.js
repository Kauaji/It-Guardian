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
  addAlertComment,
  findAlertById,
  findServiceOrderSuggestionById,
  getAlertSettings,
  listAlertRules,
  listAlerts,
  listAlertComments,
  listServiceOrderSuggestions as listSuggestions,
  markSuggestionAccepted,
  markSuggestionRejected,
  updatePendingSuggestionPrioritiesForAlertType,
  updateAlertSettings,
  updateAlertRule
} from "../repositories/alertRepository.js";
import { addServiceOrderHistory, findServiceOrderById } from "../repositories/serviceOrderRepository.js";
import { createServiceOrder } from "./serviceOrders/serviceOrderCreationService.js";
import { createSuggestionForAlert } from "./alerts/alertSuggestionCreationService.js";
import { buildAgentAlertsFromEnvironment, syncAgentAlerts } from "./alerts/agentAlertSyncService.js";
import { buildAlertCorrelations, buildAlertInsights, buildSuggestionPayload } from "../domain/alerts/alertInsights.js";
import { buildAlertEnrichmentContext, enrichAlerts, enrichSuggestions } from "./alerts/alertEnrichmentService.js";
import { refreshDueScriptValidations } from "./maintenanceScripts/maintenanceScriptsFacade.js";
import { startMaintenanceForAsset } from "../repositories/assetLifecycleRepository.js";
import { conflict, notFoundError } from "../lib/errors.js";

// Fachada historica: rotulos/categorias puros e geracao de avisos do agente
// vivem em domain/alerts/*; aqui ficam so a orquestracao e os casos de uso.
export { getAlertCategory, getAlertCompactLabel } from "../domain/alerts/alertCatalog.js";
export { buildAgentAlertsFromEnvironment as buildAgentAlerts };

async function attachCurrentAcknowledgements(alerts) {
  const acknowledgements = await listAcknowledgements();
  return attachAcknowledgements(alerts, acknowledgements);
}

export async function getActiveAlertsWithAcknowledgements() {
  await syncAgentAlerts();
  const alerts = await listAlerts({ status: "active" });
  return enrichAlerts(await attachCurrentAcknowledgements(alerts));
}

export async function getAlertHistoryWithAcknowledgements() {
  await syncAgentAlerts();
  const alerts = await listAlerts();
  return enrichAlerts(await attachCurrentAcknowledgements(alerts));
}

export async function getHostAlertsWithAcknowledgements(hostId) {
  await syncAgentAlerts();
  const alerts = (await listAlerts()).filter((alert) => alert.hostId === hostId || alert.assetId === hostId);
  return enrichAlerts(await attachCurrentAcknowledgements(alerts));
}

export async function getAlertRules() {
  return listAlertRules();
}

export async function getAlertSettingsData() {
  return getAlertSettings();
}

export async function updateAlertSettingsData({ payload, user }) {
  const settings = await updateAlertSettings(payload);
  await addLog({
    type: "alert_settings_update",
    message: "Configurações de prioridade dos avisos atualizadas.",
    userId: user?.id,
    meta: { keys: Object.keys(payload || {}) }
  });
  return settings;
}

export async function updateAlertRuleById({ id, payload, user }) {
  const rule = await updateAlertRule(id, payload);
  if (Object.prototype.hasOwnProperty.call(payload || {}, "suggestedPriority")) {
    await updatePendingSuggestionPrioritiesForAlertType(rule.type, rule.suggestedPriority);
  }
  await addLog({
    type: "alert_rule_update",
    message: `Regra de aviso atualizada: ${rule.type}`,
    userId: user?.id,
    meta: { ruleId: rule.id, type: rule.type }
  });
  return rule;
}

export async function evaluateAlertsForSuggestions(user = null) {
  await syncAgentAlerts();
  const [alerts, rules] = await Promise.all([listAlerts({ status: "active" }), listAlertRules()]);
  const enabledRules = new Map(rules.filter((rule) => rule.enabled).map((rule) => [rule.type, rule]));
  const createdSuggestions = [];

  for (const alert of alerts) {
    const rule = enabledRules.get(alert.type) || null;

    const result = await createSuggestionForAlert(alert, buildSuggestionPayload(alert, rule));
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
    alerts: await enrichAlerts(alerts),
    rules,
    suggestions: await enrichSuggestions(await listSuggestions()),
    createdSuggestions
  };
}

export async function listServiceOrderSuggestions() {
  await refreshDueScriptValidations();
  await evaluateAlertsForSuggestions();
  return enrichSuggestions(await listSuggestions());
}

export async function getAlertCorrelations() {
  await syncAgentAlerts();
  const context = await buildAlertEnrichmentContext();
  const alerts = await enrichAlerts(await listAlerts({ status: "active" }), context);
  return buildAlertCorrelations(alerts);
}

export async function getAlertInsights() {
  await syncAgentAlerts();
  return buildAlertInsights(await enrichAlerts(await listAlerts({ status: "active" })));
}

export async function listCommentsForAlert(alertId) {
  const alert = await findAlertById(alertId);
  if (!alert) {
    throw notFoundError("Aviso não encontrado.");
  }

  return listAlertComments(alertId);
}

export async function addCommentToAlert({ alertId, message, user }) {
  const alert = await findAlertById(alertId);
  if (!alert) {
    throw notFoundError("Aviso não encontrado.");
  }

  const comment = await addAlertComment({
    alertId,
    message,
    userId: user?.id || null
  });

  await addLog({
    type: "alert_comment_created",
    message: `Comentário registrado no aviso: ${alert.title}`,
    userId: user?.id,
    meta: { alertId }
  });

  return {
    ...comment,
    userName: user?.name || comment.userName
  };
}

export async function acceptServiceOrderSuggestion({ id, user }) {
  const suggestion = await findServiceOrderSuggestionById(id);
  if (!suggestion) {
    throw notFoundError("Sugestão de OS não encontrada.");
  }
  if (suggestion.status === "accepted" && suggestion.createdServiceOrderId) {
    const serviceOrder = await findServiceOrderById(suggestion.createdServiceOrderId, user);
    return { suggestion, serviceOrder };
  }
  if (suggestion.status !== "pending") {
    throw conflict("Apenas sugestões pendentes podem ser aceitas.");
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

  if (serviceOrder.assetId) {
    try {
      await startMaintenanceForAsset({
        assetId: serviceOrder.assetId,
        serviceOrderId: serviceOrder.id,
        notes: "Manutencao iniciada ao aceitar uma sugestao de aviso.",
        user
      });
    } catch (error) {
      if (error.statusCode !== 409) throw error;
    }
  }

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
    throw notFoundError("Sugestão de OS não encontrada.");
  }
  if (suggestion.status !== "pending") {
    throw conflict("Apenas sugestões pendentes podem ser recusadas.");
  }

  const settings = await getAlertSettings();
  const silenceHours = Math.max(1, Number(settings.rejectedAlertSilenceHours || 24));
  const updatedSuggestion = await markSuggestionRejected({
    id,
    userId: user?.id,
    reason,
    silenceHours
  });
  const alert = await findAlertById(suggestion.alertId);

  if (suggestion.assetId || alert?.assetId) {
    await addAssetHistory({
      assetId: suggestion.assetId || alert.assetId,
      eventType: "alert_suggestion_rejected",
      message:
        `${user?.name || "Usuário"} recusou sugestão de OS gerada por ${alert?.title || "aviso recorrente"}. ` +
        `Aviso ignorado por ${silenceHours} hora(s).`,
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
    meta: {
      suggestionId: suggestion.id,
      alertId: suggestion.alertId,
      reason: reason || null,
      silenceHours,
      ignoredUntil: updatedSuggestion?.ignoredUntil || null
    }
  });

  return updatedSuggestion;
}

export async function acknowledgeAlert({ alertId, user, note }) {
  await syncAgentAlerts();
  const alert = await findAlertById(alertId);

  if (!alert) {
    throw notFoundError("Alert not found");
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
    throw notFoundError("Alert acknowledgement not found");
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
