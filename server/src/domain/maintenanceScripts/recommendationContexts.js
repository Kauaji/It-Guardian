/** @import { RecommendableScript, RecommendationContext, ScoredScript } from "./recommendation.js" */
import { inferTechnicalCategory, scoreMaintenanceScriptForContext } from "./recommendation.js";

/**
 * Montagem dos contextos de recomendacao (ativos selecionados, avisos ativos e
 * contexto livre) e ranqueamento dos scripts contra todos eles. Modulo puro.
 */

/** @typedef {{ id: string, assetId?: string | null, type?: string, metric?: string, severity?: string, title?: string, description?: string }} ContextAlert */
/** @typedef {{ id: string, type?: string, operatingSystem?: string, segmentName?: string, groupName?: string }} ContextDevice */

/**
 * @param {{ assetIds?: unknown, context?: RecommendationContext }} payload
 * @param {ContextDevice[]} devices
 * @param {ContextAlert[]} activeAlerts
 * @param {ContextAlert[]} selectedAlerts
 * @returns {RecommendationContext[]}
 */
export function buildRecommendationContexts(payload, devices, activeAlerts, selectedAlerts) {
  const assetIds = new Set((Array.isArray(payload.assetIds) ? payload.assetIds : []).map(String));
  const alertsById = new Map(selectedAlerts.map((alert) => [String(alert.id), alert]));
  const assets = devices.filter((device) => assetIds.has(String(device.id)));

  for (const alert of activeAlerts) {
    if (assetIds.has(String(alert.assetId))) alertsById.set(String(alert.id), alert);
  }

  const alerts = [...alertsById.values()];
  /** @type {RecommendationContext[]} */
  const contexts = [];

  for (const asset of assets) {
    const assetAlerts = alerts.filter((alert) => String(alert.assetId || "") === String(asset.id));
    for (const alert of /** @type {Array<ContextAlert | null>} */ (assetAlerts.length ? assetAlerts : [null])) {
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

/**
 * @param {RecommendableScript[]} scripts
 * @param {RecommendationContext[]} contexts
 * @returns {Array<ScoredScript & { matchedAssetIds: string[], matchedAlertIds: string[] }>}
 */
export function rankScriptsForContexts(scripts, contexts) {
  return scripts
    .map((script) => {
      const matches = contexts
        .map((context) => ({ context, result: scoreMaintenanceScriptForContext(script, context) }))
        .filter(/** @returns {item is { context: RecommendationContext, result: ScoredScript }} */ (item) => item.result !== null);
      if (!matches.length) return null;

      const best = matches.sort((left, right) => right.result.recommendationScore - left.result.recommendationScore)[0];
      return {
        ...best.result,
        matchedAssetIds: [
          ...new Set(
            matches
              .map((item) => item.context.assetId)
              .filter(Boolean)
              .map(String)
          )
        ],
        matchedAlertIds: [
          ...new Set(
            matches
              .map((item) => item.context.alertId)
              .filter(Boolean)
              .map(String)
          )
        ]
      };
    })
    .filter((item) => item !== null)
    .sort(
      (left, right) =>
        right.recommendationScore - left.recommendationScore || String(left.name || "").localeCompare(String(right.name || ""))
    );
}
