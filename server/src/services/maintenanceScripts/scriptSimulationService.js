import { withTransaction } from "../../database.js";
import { assertRiskAcknowledged, assertScriptAvailable } from "../../domain/maintenanceScripts/usagePolicy.js";
import { maxLengths, resolveScriptRiskLevel, simulationModes } from "../../domain/maintenanceScripts/scriptVocabulary.js";
import { badRequest } from "../../lib/errors.js";
import { trimString } from "../../lib/textUtils.js";
import { addAssetHistory } from "../../repositories/assetHistoryRepository.js";
import { addLog } from "../../repositories/logRepository.js";
import { findMaintenanceScriptById } from "../../repositories/maintenanceScripts/scriptCatalogRepository.js";
import { addServiceOrderHistory } from "../../repositories/serviceOrderRepository.js";
import { createScriptSimulationLog } from "./scriptLogService.js";

/**
 * Registro de simulacao de um script cadastrado: grava o log e o historico do
 * ativo/OS deixando explicito que nenhum comando foi executado.
 */

const HIGH_RISK_SIMULATION_MESSAGE = "Scripts de alto risco exigem confirmação extra antes de registrar a simulação.";

async function recordSimulationAudit(db, { script, riskLevel, assetId, serviceOrderId, alertId, mode, notes, user }) {
  const userName = user?.name || "Usuário";
  const historySummary = [
    `Script: ${script.name}`,
    `Tipo: ${script.type}`,
    `Risco: ${riskLevel}`,
    `Resumo estimado: ${script.estimatedSummary || "Não informado"}`,
    notes ? `Observação: ${notes}` : "",
    "Nenhum comando foi executado."
  ]
    .filter(Boolean)
    .join("\n");

  if (assetId) {
    await addAssetHistory({
      assetId,
      eventType: "script_simulation",
      message: `Usuário ${userName} registrou simulação do script '${script.name}' no ativo ${assetId}. Nenhum comando foi executado.`,
      oldValue: null,
      newValue: historySummary,
      userId: user?.id || null,
      userName,
      db
    });
  }

  if (serviceOrderId) {
    await addServiceOrderHistory({
      serviceOrderId,
      eventType: "script_simulation",
      message: `Simulação de script registrada: ${script.name}. Nenhum comando foi executado.`,
      oldValue: null,
      newValue: historySummary,
      user,
      db
    });
  }

  await addLog({
    type: "maintenance_script_simulation",
    message: `Simulação registrada para o script ${script.name}. Nenhum comando foi executado.`,
    userId: user?.id || null,
    meta: {
      scriptId: script.id,
      assetId: assetId || null,
      serviceOrderId: serviceOrderId || null,
      alertId: alertId || null,
      mode,
      riskLevel
    },
    db
  });
}

export async function registerMaintenanceScriptSimulation({ scriptId, payload = {}, user = null }) {
  const script = await findMaintenanceScriptById(scriptId);

  assertScriptAvailable(script);

  if (payload.confirmed !== true) {
    throw badRequest("Confirme que esta ação registra apenas uma simulação. Nenhum comando será executado.");
  }

  assertRiskAcknowledged(script, payload, HIGH_RISK_SIMULATION_MESSAGE);

  const riskLevel = resolveScriptRiskLevel(script);
  const assetId = trimString(payload.assetId, 120);
  const serviceOrderId = trimString(payload.serviceOrderId, 120);
  const alertId = trimString(payload.alertId, 120);
  const notes = trimString(payload.notes, maxLengths.notes);
  const mode = simulationModes.has(payload.mode) ? payload.mode : "simulated";

  return await withTransaction(async (db) => {
    const log = await createScriptSimulationLog({
      scriptId: script.id,
      assetId,
      serviceOrderId,
      alertId,
      mode,
      status: "registered",
      executedBy: user?.id || null,
      notes,
      db
    });

    await recordSimulationAudit(db, { script, riskLevel, assetId, serviceOrderId, alertId, mode, notes, user });

    return { log, script };
  });
}
