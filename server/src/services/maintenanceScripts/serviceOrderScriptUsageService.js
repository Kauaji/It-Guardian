import { withTransaction } from "../../database.js";
import {
  assertExecutionConfirmed,
  assertRiskAcknowledged,
  assertScriptAvailable,
  buildQueuedExecutionRawLog,
  HIGH_RISK_USAGE_MESSAGE,
  QUEUED_LOG_PARSED_SUMMARY
} from "../../domain/maintenanceScripts/usagePolicy.js";
import { maxLengths } from "../../domain/maintenanceScripts/scriptVocabulary.js";
import { conflict, notFoundError } from "../../lib/errors.js";
import { trimString } from "../../lib/textUtils.js";
import { queueAgentScriptJob } from "../agentScriptJobService.js";
import { addAssetHistory } from "../../repositories/assetHistoryRepository.js";
import { addLog } from "../../repositories/logRepository.js";
import { findMaintenanceScriptById } from "../../repositories/maintenanceScripts/scriptCatalogRepository.js";
import {
  addServiceOrderHistory,
  findServiceOrderById,
  getFinalStatus,
  getServiceOrderSettings
} from "../../repositories/serviceOrderRepository.js";
import { createScriptSimulationLog } from "./scriptLogService.js";

/**
 * Uso de um script cadastrado a partir de uma Ordem de Servico com ativo
 * vinculado: enfileira a execucao para o agente autenticado da maquina.
 */

// ---- Uso a partir de Ordem de Servico -------------------------------------------

async function loadServiceOrderUsageContext(serviceOrderId, scriptId) {
  const [order, script, settings] = await Promise.all([
    findServiceOrderById(serviceOrderId),
    findMaintenanceScriptById(scriptId),
    getServiceOrderSettings()
  ]);

  if (!order) {
    throw notFoundError("Ordem de serviço não encontrada.");
  }
  if (!order.assetId) {
    throw conflict("Esta Ordem de Serviço não tem uma máquina/ativo vinculado. Vincule um ativo antes de executar scripts.");
  }
  if (order.status === getFinalStatus(settings).id) {
    throw conflict("Não é possível executar scripts em uma Ordem de Serviço finalizada. Reabra a OS antes de continuar.");
  }
  assertScriptAvailable(script);

  return { order, script };
}

async function recordServiceOrderQueueAudit(db, { order, script, job, user }) {
  const userName = user?.name || "Usuário";
  const queuedState = JSON.stringify({ jobId: job.id, scriptId: script.id, scriptName: script.name, status: "queued" });

  await addServiceOrderHistory({
    serviceOrderId: order.id,
    eventType: "script_execution_queued",
    message: `Script '${script.name}' foi enfileirado por ${userName}; aguardando o agente da máquina.`,
    oldValue: null,
    newValue: queuedState,
    user,
    db
  });

  await addAssetHistory({
    assetId: order.assetId,
    eventType: "script_execution_queued",
    message: `Script '${script.name}' foi enfileirado pela Ordem de Serviço ${order.number || order.id}. Solicitado por ${userName}.`,
    oldValue: null,
    newValue: queuedState,
    userId: user?.id || null,
    userName,
    db
  });

  await addLog({
    type: "agent_script_execution_queued",
    message: `Script enfileirado para o agente a partir da Ordem de Serviço: ${script.name}.`,
    userId: user?.id || null,
    meta: {
      serviceOrderId: order.id,
      assetId: order.assetId,
      scriptId: script.id,
      jobId: job.id
    },
    db
  });
}

// Disparo direto a partir de uma Ordem de Servico. Diferente de
// useScriptFromSuggestion, nao usa script_validation_runs (heuristica
// de "observar se o alerta se resolve sozinho" especifica de sugestao,
// sem sentido aqui): a conclusao real vem do proprio agente via
// completeAgentScriptJob, que ja atualiza o script_execution_logs
// vinculado por execution_log_id.
export async function useScriptForServiceOrder({ serviceOrderId, scriptId, payload = {}, user = null }) {
  const { order, script } = await loadServiceOrderUsageContext(serviceOrderId, scriptId);

  assertExecutionConfirmed(payload);
  assertRiskAcknowledged(script, payload, HIGH_RISK_USAGE_MESSAGE);

  const notes = trimString(payload.notes, maxLengths.notes);

  return await withTransaction(async (db) => {
    const log = await createScriptSimulationLog({
      scriptId: script.id,
      assetId: order.assetId,
      serviceOrderId: order.id,
      mode: "agent",
      status: "queued",
      executedBy: user?.id || null,
      notes,
      rawLog: buildQueuedExecutionRawLog("serviceOrder"),
      parsedSummary: QUEUED_LOG_PARSED_SUMMARY,
      errorDetected: false,
      attentionRequired: false,
      db
    });

    const job = await queueAgentScriptJob({
      script,
      assetId: order.assetId,
      executionLogId: log.id,
      userId: user?.id || null,
      timeoutSeconds: payload.timeoutSeconds,
      db
    });

    await recordServiceOrderQueueAudit(db, { order, script, job, user });

    return { serviceOrder: order, script, log, job };
  });
}
