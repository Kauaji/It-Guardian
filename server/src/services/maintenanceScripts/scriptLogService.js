import { randomUUID } from "node:crypto";
import { interpretScriptLogWithMetadata } from "../../domain/maintenanceScripts/logInterpretation.js";
import { maxLengths, simulationModes } from "../../domain/maintenanceScripts/scriptVocabulary.js";
import { notFoundError } from "../../lib/errors.js";
import { trimString } from "../../lib/textUtils.js";
import { withTransaction } from "../../database.js";
import { addAssetHistory } from "../../repositories/assetHistoryRepository.js";
import { addLog } from "../../repositories/logRepository.js";
import {
  acknowledgeScriptLogRow,
  findScriptLogById,
  insertScriptExecutionLog,
  listPendingScriptLogs,
  listRecentScriptExecutionLogs,
  registerSuggestedSolutionRow
} from "../../repositories/maintenanceScripts/scriptLogRepository.js";

/**
 * Logs de execucao de scripts: criacao com interpretacao automatica do log
 * bruto, reconhecimento e registro de solucao sugerida. Nunca executa nada:
 * so registra.
 */

export { findScriptLogById, listPendingScriptLogs, listRecentScriptExecutionLogs };

/**
 * Registra um log de execucao. Valores explicitos tem precedencia; o que nao
 * for informado vem da interpretacao do log bruto (erro, causa, solucao).
 */
export async function createScriptSimulationLog({
  scriptId,
  assetId = null,
  serviceOrderId = null,
  alertId = null,
  suggestionId = null,
  preventivePlanId = null,
  mode = "simulated",
  status = "registered",
  executedBy = null,
  notes = "",
  rawLog = "",
  parsedSummary = "",
  errorDetected = null,
  errorType = "",
  errorCode = "",
  errorCategory = "",
  errorSeverity = "",
  probableCause = "",
  suggestedSolution = "",
  requiresAdmin = null,
  requiresLoggedUser = null,
  attentionRequired = null,
  db
}) {
  const safeMode = simulationModes.has(mode) ? mode : "simulated";
  const interpreted = interpretScriptLogWithMetadata(rawLog, status);
  const hasError = errorDetected ?? interpreted.errorDetected;

  return insertScriptExecutionLog(
    {
      id: randomUUID(),
      scriptId,
      assetId: assetId || null,
      serviceOrderId: serviceOrderId || null,
      alertId: alertId || null,
      suggestionId: suggestionId || null,
      preventivePlanId: preventivePlanId || null,
      mode: safeMode,
      status: hasError ? "error" : (interpreted.status || status),
      executedBy: executedBy || null,
      notes: trimString(notes, maxLengths.notes),
      rawLog: rawLog || "",
      parsedSummary: parsedSummary || interpreted.parsedSummary,
      errorDetected: hasError,
      errorType: errorType || interpreted.errorType || null,
      errorCode: errorCode || interpreted.errorCode || null,
      errorCategory: errorCategory || interpreted.errorCategory || null,
      errorSeverity: errorSeverity || interpreted.errorSeverity || null,
      probableCause: probableCause || interpreted.probableCause || null,
      suggestedSolution: suggestedSolution || interpreted.suggestedSolution || null,
      requiresAdmin: requiresAdmin ?? interpreted.requiresAdmin,
      requiresLoggedUser: requiresLoggedUser ?? interpreted.requiresLoggedUser,
      attentionRequired: attentionRequired ?? hasError
    },
    db
  );
}

export async function acknowledgeScriptLog(id, user = null) {
  const log = await acknowledgeScriptLogRow({ id, userId: user?.id || null });
  if (!log) {
    throw notFoundError("Log de script não encontrado.");
  }

  return log;
}

/** Registra a solucao sugerida do log para acompanhamento; nenhum comando e executado. */
export async function applyScriptLogSuggestedSolution(id, payload = {}, user = null) {
  const log = await findScriptLogById(id);
  if (!log) {
    throw notFoundError("Log de script não encontrado.");
  }

  const notes = trimString(
    payload.notes ||
      "Ação corretiva sugerida registrada para acompanhamento. Nenhum comando foi executado automaticamente.",
    maxLengths.notes
  );
  return await withTransaction(async (db) => {
    const updated = await registerSuggestedSolutionRow(db, { id, notes, userId: user?.id || null });

    if (log.assetId) {
      await addAssetHistory({
        assetId: log.assetId,
        eventType: "script_log_solution_registered",
        message:
          `${user?.name || "Usuário"} registrou solução sugerida para o log do script '${log.scriptName || log.scriptId}'. ` +
          "Nenhum comando foi executado automaticamente.",
        oldValue: log.errorType || null,
        newValue: notes,
        userId: user?.id || null,
        userName: user?.name || null,
        db
      });
    }

    await addLog({
      type: "script_log_solution_registered",
      message: "Solução sugerida registrada para log de script. Nenhum comando foi executado.",
      userId: user?.id || null,
      meta: { logId: id, suggestionId: log.suggestionId, assetId: log.assetId },
      db
    });

    return updated;
  });
}
