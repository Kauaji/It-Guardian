import { buildAgentAlerts } from "../../domain/alerts/agentAlerts.js";
import { listAgentAssets } from "../../repositories/agentRepository.js";
import { getAlertSettings, resolveInactiveAgentAlerts, upsertAlert } from "../../repositories/alertRepository.js";

/** Avisos do agente conforme o ambiente atual (limites de "offline" lidos no momento da chamada). */
export function buildAgentAlertsFromEnvironment(asset, now = new Date()) {
  return buildAgentAlerts(asset, now, {
    offlineAfterSecondsSetting: process.env.AGENT_OFFLINE_AFTER_SECONDS,
    offlineAfterMinutesSetting: process.env.AGENT_OFFLINE_AFTER_MINUTES
  });
}

/** Grava os avisos atuais de cada ativo com agente e encerra os que deixaram de ocorrer. */
export async function syncAgentAlerts() {
  const [assets, settings] = await Promise.all([listAgentAssets(), getAlertSettings()]);
  for (const asset of assets) {
    const activeAlerts = buildAgentAlertsFromEnvironment(asset);
    for (const alert of activeAlerts) {
      await upsertAlert(alert);
    }
    await resolveInactiveAgentAlerts({
      assetId: asset.id,
      activeAlertIds: activeAlerts.map((alert) => alert.id),
      inactiveHours: settings.inactiveAlertAutoResolveHours
    });
  }
}
