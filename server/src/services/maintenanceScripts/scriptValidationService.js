import { withTransaction } from "../../database.js";
import { resolveObservationOutcome } from "../../domain/maintenanceScripts/usagePolicy.js";
import { notFoundError } from "../../lib/errors.js";
import { markSuggestionValidated } from "../../repositories/alertRepository.js";
import { addAssetHistory } from "../../repositories/assetHistoryRepository.js";
import { addLog } from "../../repositories/logRepository.js";
import {
  cancelValidationRun,
  finishDueValidationRun,
  listDueScriptValidations,
  listScriptValidationsForSuggestion
} from "../../repositories/maintenanceScripts/scriptValidationRepository.js";

/**
 * Observacoes de scripts ligados a sugestoes de OS: encerramento das
 * observacoes vencidas conforme o estado do aviso e cancelamento manual.
 */

export { listScriptValidationsForSuggestion };

// Encerra uma observacao vencida na propria transacao; devolve null se outra via ja a concluiu.
async function finishDueValidation(row, outcome) {
  return withTransaction(async (db) => {
    const validation = await finishDueValidationRun(db, {
      id: row.id,
      status: outcome.status,
      resultSummary: outcome.resultSummary,
      scriptName: row.script_name
    });
    if (!validation) return null;

    if (row.suggestion_id) {
      await markSuggestionValidated({
        id: row.suggestion_id,
        status: outcome.status,
        resultSummary: outcome.resultSummary,
        validationId: row.id,
        db
      });
    }

    if (row.asset_id) {
      await addAssetHistory({
        assetId: row.asset_id,
        eventType: "script_observation_finished",
        message: outcome.resultSummary,
        oldValue: row.script_name || row.script_id,
        newValue: outcome.status,
        userId: row.started_by || null,
        userName: "Sistema",
        db
      });
    }

    await addLog({
      type: "script_observation_finished",
      message: outcome.resultSummary,
      userId: row.started_by || null,
      meta: {
        validationId: row.id,
        suggestionId: row.suggestion_id,
        alertId: row.alert_id,
        assetId: row.asset_id,
        status: outcome.status
      },
      db
    });

    return validation;
  });
}

function countOutcome(summary, status) {
  summary.updatedCount += 1;
  if (status === "observed_resolved") summary.resolvedCount += 1;
  if (status === "observed_persistent") summary.persistentCount += 1;
  if (status === "insufficient_data") summary.insufficientDataCount += 1;
}

/**
 * Encerra as observacoes vencidas. Devolve a lista de observacoes atualizadas
 * ou, com { summary: true }, o resumo com contagens e falhas por observacao.
 */
export async function refreshDueScriptValidations(options = {}) {
  const dueRows = await listDueScriptValidations();
  const refreshed = [];
  const summary = {
    dueCount: dueRows.length,
    updatedCount: 0,
    resolvedCount: 0,
    persistentCount: 0,
    insufficientDataCount: 0,
    failedValidationCount: 0,
    failedValidations: [],
    validations: refreshed
  };

  for (const row of dueRows) {
    try {
      const outcome = resolveObservationOutcome({ alertId: row.alert_id, alertStatus: row.alert_status });
      const validation = await finishDueValidation(row, outcome);
      if (!validation) continue;

      refreshed.push(validation);
      countOutcome(summary, outcome.status);
    } catch (error) {
      summary.failedValidationCount += 1;
      summary.failedValidations.push({
        validationId: row.id,
        suggestionId: row.suggestion_id,
        alertId: row.alert_id,
        message: error.message
      });
    }
  }

  return options.summary ? summary : refreshed;
}

export async function cancelScriptValidation(id, user = null) {
  return await withTransaction(async (db) => {
    const validation = await cancelValidationRun(db, id);

    if (!validation) {
      throw notFoundError("Observação não encontrada ou já finalizada.");
    }

    if (validation.suggestionId) {
      await markSuggestionValidated({
        id: validation.suggestionId,
        status: "validation_cancelled",
        resultSummary: "Observação cancelada manualmente.",
        validationId: validation.id,
        db
      });
    }

    if (validation.assetId) {
      await addAssetHistory({
        assetId: validation.assetId,
        eventType: "script_validation_cancelled",
        message: `${user?.name || "Usuário"} cancelou a validação de script vinculada à sugestão ${validation.suggestionId}.`,
        oldValue: validation.status,
        newValue: "validation_cancelled",
        userId: user?.id || null,
        userName: user?.name || null,
        db
      });
    }

    return validation;
  });
}
