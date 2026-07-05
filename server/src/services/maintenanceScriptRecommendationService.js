import {
  inferTechnicalCategory,
  listMaintenanceScripts,
  scoreMaintenanceScriptForContext,
  toRecommendedScriptResponse
} from "../repositories/maintenanceScriptRepository.js";
import { findAlertById, listAlerts } from "../repositories/alertRepository.js";
import { listDevices } from "./monitoringService.js";

function buildContexts(payload, devices, activeAlerts, selectedAlerts) {
  const assetIds = new Set((Array.isArray(payload.assetIds) ? payload.assetIds : []).map(String));
  const alertsById = new Map(selectedAlerts.map((alert) => [String(alert.id), alert]));
  const assets = devices.filter((device) => assetIds.has(String(device.id)));

  for (const alert of activeAlerts) {
    if (assetIds.has(String(alert.assetId))) alertsById.set(String(alert.id), alert);
  }

  const alerts = [...alertsById.values()];
  const contexts = [];

  for (const asset of assets) {
    const assetAlerts = alerts.filter((alert) => String(alert.assetId || "") === String(asset.id));
    for (const alert of assetAlerts.length ? assetAlerts : [null]) {
      contexts.push({
        ...(payload.context || {}),
        alertType: payload.context?.alertType || alert?.type || "",
        metric: payload.context?.metric || alert?.metric || "",
        technicalCategory: payload.context?.technicalCategory || inferTechnicalCategory(alert || payload.context || {}),
        severity: payload.context?.severity || alert?.severity || "",
        title: payload.context?.title || alert?.title || "",
        description: payload.context?.description || alert?.description || "",
        assetType: payload.context?.assetType || asset.type || "",
        operatingSystem: payload.context?.operatingSystem || asset.operatingSystem || "",
        segmentName: payload.context?.segmentName || asset.segmentName || "",
        groupName: payload.context?.groupName || asset.groupName || "",
        tags: payload.context?.tags || [],
        assetId: asset.id,
        alertId: alert?.id || null
      });
    }
  }

  for (const alert of alerts.filter((item) => !assetIds.has(String(item.assetId || "")))) {
    contexts.push({
      ...(payload.context || {}),
      alertType: payload.context?.alertType || alert.type || "",
      metric: payload.context?.metric || alert.metric || "",
      technicalCategory: payload.context?.technicalCategory || inferTechnicalCategory(alert),
      severity: payload.context?.severity || alert.severity || "",
      title: payload.context?.title || alert.title || "",
      description: payload.context?.description || alert.description || "",
      tags: payload.context?.tags || [],
      assetId: alert.assetId || null,
      alertId: alert.id
    });
  }

  return contexts.length ? contexts : [{ ...(payload.context || {}), tags: payload.context?.tags || [] }];
}

function rankScripts(scripts, contexts) {
  return scripts
    .map((script) => {
      const matches = contexts
        .map((context) => ({ context, result: scoreMaintenanceScriptForContext(script, context) }))
        .filter((item) => item.result);
      if (!matches.length) return null;

      const best = matches.sort((left, right) => right.result.recommendationScore - left.result.recommendationScore)[0];
      return {
        ...best.result,
        matchedAssetIds: [...new Set(matches.map((item) => item.context.assetId).filter(Boolean).map(String))],
        matchedAlertIds: [...new Set(matches.map((item) => item.context.alertId).filter(Boolean).map(String))]
      };
    })
    .filter(Boolean)
    .sort((left, right) => (
      right.recommendationScore - left.recommendationScore
      || String(left.name || "").localeCompare(String(right.name || ""))
    ));
}

export async function listRecommendedScriptsForContext(payload = {}) {
  const alertIds = Array.isArray(payload.alertIds) ? payload.alertIds : [];
  const [scripts, devices, activeAlerts, selectedAlerts] = await Promise.all([
    listMaintenanceScripts({ includeInactive: false }),
    listDevices({}),
    listAlerts({ status: "active" }),
    Promise.all(alertIds.map((alertId) => findAlertById(alertId)))
  ]);
  const contexts = buildContexts(payload, devices, activeAlerts, selectedAlerts.filter(Boolean));
  const scored = rankScripts(scripts, contexts);

  return {
    recommended: scored.filter((script) => script.isRecommended).map(toRecommendedScriptResponse),
    others: scored.filter((script) => !script.isRecommended).map(toRecommendedScriptResponse),
    context: contexts[0],
    contextCount: contexts.length
  };
}
