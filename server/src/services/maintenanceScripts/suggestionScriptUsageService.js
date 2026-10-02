import { randomUUID } from "node:crypto";
import { withTransaction } from "../../database.js";
import {
  assertExecutionConfirmed,
  assertRiskAcknowledged,
  assertScriptAvailable,
  assertSuggestionAcceptsScripts,
  buildQueuedExecutionRawLog,
  clampValidationWindowMinutes,
  HIGH_RISK_USAGE_MESSAGE,
  QUEUED_LOG_PARSED_SUMMARY
} from "../../domain/maintenanceScripts/usagePolicy.js";
import { maxLengths } from "../../domain/maintenanceScripts/scriptVocabulary.js";
import { notFoundError } from "../../lib/errors.js";
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
import { createScriptSimulationLog } from "./scriptLogService.js";

/**
 * Uso de um script cadastrado a partir de uma sugestao de OS: enfileira a
 * execucao para o agente autenticado e abre uma observacao do aviso. O servidor
 * nunca executa o script; reenvios para a mesma sugestao+script sao idempotentes.
 */

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
