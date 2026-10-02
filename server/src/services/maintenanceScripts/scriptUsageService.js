import { randomUUID } from "node:crypto";
import { withTransaction } from "../../database.js";
import {
  assertExecutionConfirmed,
  assertRiskAcknowledged,
  assertScriptAvailable,
  assertSuggestionAcceptsScripts,
  buildQueuedExecutionRawLog,
  clampValidationWindowMinutes,
  QUEUED_LOG_PARSED_SUMMARY
} from "../../domain/maintenanceScripts/usagePolicy.js";
import { maxLengths, resolveScriptRiskLevel, simulationModes } from "../../domain/maintenanceScripts/scriptVocabulary.js";
import { badRequest, conflict, notFoundError } from "../../lib/errors.js";
import { trimString } from "../../lib/textUtils.js";
import { queueAgentScriptJob } from "../agentScriptJobService.js";
import {
  addAlertComment,
  findAlertById,
  findServiceOrderSuggestionById,
  getAlertSettings
} from "../../repositories/alertRepository.js";
import { addAssetHistory } from "../../repositories/assetHistoryRepository.js";
import { addLog } from "../../repositories/logRepository.js";
import { findMaintenanceScriptById } from "../../repositories/maintenanceScripts/scriptCatalogRepository.js";
import { findScriptLogById } from "../../repositories/maintenanceScripts/scriptLogRepository.js";
import {
  attachLogToValidationRun,
  findActiveScriptValidationForSuggestion,
  insertActiveValidationRun
} from "../../repositories/maintenanceScripts/scriptValidationRepository.js";
import {
  addServiceOrderHistory,
  findServiceOrderById,
  getFinalStatus,
  getServiceOrderSettings
} from "../../repositories/serviceOrderRepository.js";
import { createScriptSimulationLog } from "./scriptLogService.js";

/**
 * Casos de uso de um script cadastrado: registrar simulacao, enfileirar a
 * execucao a partir de uma sugestao de OS (com observacao do aviso) e
 * enfileirar a execucao a partir de uma Ordem de Servico. O servidor nunca
 * executa o script: apenas registra e enfileira para o agente autenticado.
 */

const HIGH_RISK_SIMULATION_MESSAGE =
  "Scripts de alto risco exigem confirmação extra antes de registrar a simulação.";
const HIGH_RISK_USAGE_MESSAGE =
  "Scripts de alto risco exigem confirmação extra antes de registrar o uso.";

// ---- Simulacao ---------------------------------------------------------------

async function recordSimulationAudit(db, { script, riskLevel, assetId, serviceOrderId, alertId, mode, notes, user }) {
  const userName = user?.name || "Usuário";
  const historySummary = [
    `Script: ${script.name}`,
    `Tipo: ${script.type}`,
    `Risco: ${riskLevel}`,
    `Resumo estimado: ${script.estimatedSummary || "Não informado"}`,
    notes ? `Observação: ${notes}` : "",
    "Nenhum comando foi executado."
  ].filter(Boolean).join("\n");

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

  if (!script || script.active === false) {
    throw notFoundError("Script de manutenção não encontrado ou inativo.");
  }

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

// ---- Uso a partir de sugestao de OS -------------------------------------------

async function loadSuggestionUsageContext(suggestionId, scriptId) {
  const [suggestion, script, settings] = await Promise.all([
    findServiceOrderSuggestionById(suggestionId),
    findMaintenanceScriptById(scriptId),
    getAlertSettings()
  ]);

  if (!suggestion) {
    throw notFoundError("Sugestão de OS não encontrada.");
  }
  assertSuggestionAcceptsScripts(suggestion);
  assertScriptAvailable(script);

  return { suggestion, script, settings };
}

// Reuso idempotente: ja existe uma observacao ativa para a mesma sugestao e script.
async function buildReusedResult({ suggestion, script }, validation) {
  const log = validation?.logId ? await findScriptLogById(validation.logId) : null;
  return { suggestion, script, log, validation, reused: true };
}

async function recordSuggestionQueueAudit(db, { suggestion, script, assetId, job, validation, validationDue, validationWindowMinutes, user }) {
  const userName = user?.name || "Usuário";

  if (assetId) {
    await addAssetHistory({
      assetId,
      eventType: "script_execution_queued",
      message:
        `Script '${script.name}' foi enfileirado pela sugestão ${suggestion.id}. ` +
        `Solicitado por ${userName}; aguardando o agente da máquina.`,
      oldValue: null,
      newValue: JSON.stringify({
        jobId: job.id,
        scriptId: script.id,
        scriptName: script.name,
        status: "queued",
        validationDueAt: validationDue.toISOString()
      }),
      userId: user?.id || null,
      userName,
      db
    });
  }

  await addLog({
    type: "agent_script_execution_queued",
    message: `Script enfileirado para o agente a partir da sugestão de OS: ${script.name}.`,
    userId: user?.id || null,
    meta: {
      suggestionId: suggestion.id,
      alertId: suggestion.alertId,
      assetId,
      scriptId: script.id,
      jobId: job.id,
      validationId: validation.id,
      validationWindowMinutes
    },
    db
  });
}

// Cria a observacao ativa, o log, o trabalho do agente e o historico, tudo na mesma transacao.
async function enqueueSuggestionScript(db, request) {
  const { suggestion, script, assetId, payload, user, notes, validationWindowMinutes, validationDue } = request;
  const duplicatedValidation = await findActiveScriptValidationForSuggestion(suggestion.id, script.id, db);
  if (duplicatedValidation) {
    return buildReusedResult(request, duplicatedValidation);
  }

  const activeKey = `${suggestion.id}:${script.id}`;
  const validationInsert = await insertActiveValidationRun(db, {
    id: randomUUID(),
    suggestionId: suggestion.id,
    alertId: suggestion.alertId || null,
    assetId,
    scriptId: script.id,
    startedBy: user?.id || null,
    validationWindowMinutes,
    validationDueAt: validationDue.toISOString(),
    resultSummary: "Script enfileirado e aguardando execução pelo agente autenticado.",
    activeKey,
    observationSlot: `${suggestion.id}:${script.id}:active`
  });

  if (!validationInsert) {
    const reusedValidation = await findActiveScriptValidationForSuggestion(suggestion.id, script.id, db);
    return buildReusedResult(request, reusedValidation);
  }

  const log = await createScriptSimulationLog({
    scriptId: script.id,
    assetId,
    alertId: suggestion.alertId,
    suggestionId: suggestion.id,
    mode: "agent",
    status: "queued",
    executedBy: user?.id || null,
    notes,
    rawLog: buildQueuedExecutionRawLog("suggestion"),
    parsedSummary: QUEUED_LOG_PARSED_SUMMARY,
    errorDetected: false,
    attentionRequired: false,
    db
  });

  const validation = await attachLogToValidationRun(db, {
    validationId: validationInsert.id,
    logId: log.id,
    scriptName: script.name
  });
  const job = await queueAgentScriptJob({
    script,
    assetId,
    executionLogId: log.id,
    validationId: validation.id,
    userId: user?.id || null,
    timeoutSeconds: payload.timeoutSeconds,
    db
  });

  await recordSuggestionQueueAudit(db, {
    suggestion,
    script,
    assetId,
    job,
    validation,
    validationDue,
    validationWindowMinutes,
    user
  });

  return { suggestion, script, log, validation, job };
}

export async function useScriptFromSuggestion({ suggestionId, scriptId, payload = {}, user = null }) {
  const { suggestion, script, settings } = await loadSuggestionUsageContext(suggestionId, scriptId);

  assertExecutionConfirmed(payload);
  assertRiskAcknowledged(script, payload, HIGH_RISK_USAGE_MESSAGE);

  const validationWindowMinutes = clampValidationWindowMinutes(
    payload.validationWindowMinutes,
    settings.scriptValidationWindowMinutes
  );
  const alert = suggestion.alertId ? await findAlertById(suggestion.alertId) : null;
  const request = {
    suggestion,
    script,
    payload,
    user,
    assetId: suggestion.assetId || alert?.assetId || null,
    notes: trimString(payload.notes, maxLengths.notes),
    validationWindowMinutes,
    validationDue: new Date(Date.now() + validationWindowMinutes * 60000)
  };

  const existingValidation = await findActiveScriptValidationForSuggestion(suggestion.id, script.id);
  if (existingValidation) {
    return buildReusedResult(request, existingValidation);
  }

  const result = await withTransaction((db) => enqueueSuggestionScript(db, request));

  // Comentario no proprio timeline do alerta (mecanismo separado de
  // asset_history) - so nos ramos que de fato enfileiraram algo novo,
  // nunca nos ramos de reuso idempotente (reused:true), pra nao poluir
  // o timeline em cliques repetidos.
  if (!result.reused && suggestion.alertId) {
    await addAlertComment({
      alertId: suggestion.alertId,
      userId: user?.id || null,
      message: `Script "${script.name}" enfileirado para execução pelo agente autenticado desta máquina.`
    });
  }

  return result;
}

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
