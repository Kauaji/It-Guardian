import { buildEnrichedAlert, buildEnrichedSuggestion } from "../../domain/alerts/alertInsights.js";
import { findAlertById, listAlertComments, listServiceOrderSuggestions as listSuggestions } from "../../repositories/alertRepository.js";
import { listSegmentGroups } from "../../repositories/segmentGroupRepository.js";
import { listDeviceSegmentMap } from "../../repositories/segmentRepository.js";
import { listServiceOrders } from "../../repositories/serviceOrderRepository.js";

export async function buildAlertEnrichmentContext() {
  const [serviceOrders, suggestions, segmentMap, groups] = await Promise.all([
    listServiceOrders(),
    listSuggestions(),
    listDeviceSegmentMap(),
    listSegmentGroups()
  ]);

  return {
    serviceOrders,
    suggestions,
    segmentMap,
    groupMap: new Map(groups.map((group) => [String(group.id), group]))
  };
}

export async function enrichAlerts(alerts = [], context = null) {
  const nextContext = context || (await buildAlertEnrichmentContext());
  const commentsByAlert = new Map();

  await Promise.all(
    alerts.map(async (alert) => {
      commentsByAlert.set(alert.id, await listAlertComments(alert.id));
    })
  );

  return alerts.map((alert) => buildEnrichedAlert(alert, nextContext, commentsByAlert.get(alert.id) || []));
}

export async function enrichSuggestions(suggestions = []) {
  const context = await buildAlertEnrichmentContext();
  const alertIds = [...new Set(suggestions.map((suggestion) => suggestion.alertId).filter(Boolean))];
  const alerts = await Promise.all(alertIds.map((id) => findAlertById(id)));
  const alertMap = new Map(alerts.filter(Boolean).map((alert) => [alert.id, alert]));
  const enrichedAlerts = await enrichAlerts(alerts.filter(Boolean), context);
  const enrichedAlertMap = new Map(enrichedAlerts.map((alert) => [alert.id, alert]));

  return suggestions.map((suggestion) => {
    const alert = enrichedAlertMap.get(suggestion.alertId) || alertMap.get(suggestion.alertId);
    return buildEnrichedSuggestion(suggestion, alert, context);
  });
}
