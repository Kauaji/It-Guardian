import {
  buildRecommendationContexts,
  rankScriptsForContexts
} from "../domain/maintenanceScripts/recommendationContexts.js";
import { toRecommendedScriptResponse } from "../domain/maintenanceScripts/recommendation.js";
import { findAlertById, listAlerts } from "../repositories/alertRepository.js";
import { listMaintenanceScripts } from "../repositories/maintenanceScripts/scriptCatalogRepository.js";
import { listDevices } from "./monitoringService.js";

/**
 * Recomendacao de scripts para um contexto livre: ativos selecionados, avisos
 * informados e avisos ativos dos ativos. A pontuacao e pura
 * (domain/maintenanceScripts); aqui so se reunem os dados.
 */
export async function listRecommendedScriptsForContext(payload = {}) {
  const alertIds = Array.isArray(payload.alertIds) ? payload.alertIds : [];
  const [scripts, devices, activeAlerts, selectedAlerts] = await Promise.all([
    listMaintenanceScripts({ includeInactive: false }),
    listDevices({}),
    listAlerts({ status: "active" }),
    Promise.all(alertIds.map((alertId) => findAlertById(alertId)))
  ]);
  const contexts = buildRecommendationContexts(payload, devices, activeAlerts, selectedAlerts.filter(Boolean));
  const scored = rankScriptsForContexts(scripts, contexts);

  return {
    recommended: scored.filter((script) => script.isRecommended).map(toRecommendedScriptResponse),
    others: scored.filter((script) => !script.isRecommended).map(toRecommendedScriptResponse),
    context: contexts[0],
    contextCount: contexts.length
  };
}
