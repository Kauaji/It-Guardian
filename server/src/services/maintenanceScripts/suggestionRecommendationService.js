import {
  buildSuggestionRecommendationContext,
  recommendMaintenanceScripts,
  toRecommendedScriptResponse
} from "../../domain/maintenanceScripts/recommendation.js";
import { notFoundError } from "../../lib/errors.js";
import { findAlertById, findServiceOrderSuggestionById } from "../../repositories/alertRepository.js";
import { listMaintenanceScripts } from "../../repositories/maintenanceScripts/scriptCatalogRepository.js";

/** Scripts recomendados para uma sugestao de OS, a partir do aviso que a originou. */
export async function listRecommendedScriptsForSuggestion(suggestionId) {
  const suggestion = await findServiceOrderSuggestionById(suggestionId);

  if (!suggestion) {
    throw notFoundError("Sugestão de OS não encontrada.");
  }

  const [alert, scripts] = await Promise.all([
    suggestion.alertId ? findAlertById(suggestion.alertId) : null,
    listMaintenanceScripts({ includeInactive: false })
  ]);
  const recommendations = recommendMaintenanceScripts(buildSuggestionRecommendationContext(suggestion, alert), scripts);

  return {
    recommended: recommendations.recommended.map(toRecommendedScriptResponse),
    others: recommendations.others.map(toRecommendedScriptResponse)
  };
}
