import { query } from "../../database.js";
import { normalizeSuggestionStatusAfterObservation } from "../../domain/alerts/alertConfiguration.js";
import { resolveAlertIfActive } from "../../repositories/alerts/alertRecordRepository.js";
import { findSuggestionStatusRow, updateSuggestionObservation } from "../../repositories/alerts/alertSuggestionRepository.js";

/**
 * Registra o resultado de uma observacao/validacao na sugestao. Sugestao ja
 * aceita/recusada mantem o status; "observed_resolved" encerra tambem o aviso.
 */
export async function markSuggestionValidated({ id, status = "validated", resultSummary = "", validationId = null, db = query }) {
  const current = await findSuggestionStatusRow(db, id);
  const currentStatus = current?.status || "pending";
  const alertId = current?.alert_id;
  const nextStatus = normalizeSuggestionStatusAfterObservation(currentStatus, status);
  const updated = await updateSuggestionObservation(db, {
    id,
    status: nextStatus,
    observationStatus: status,
    resultSummary,
    validationId
  });

  if (status === "observed_resolved" && alertId) {
    await resolveAlertIfActive(db, alertId);
  }

  return updated;
}
