import { decideSuggestionRefresh } from "../../domain/alerts/alertConfiguration.js";
import {
  findSuggestionRowByAlertId,
  insertSuggestionForAlert,
  refreshPendingSuggestionForAlert,
  reopenSuggestionForAlert
} from "../../repositories/alerts/alertSuggestionRepository.js";

/**
 * Cria (ou atualiza) a sugestao de OS de um aviso. Sugestao aceita nunca e
 * recriada; recusada e ainda silenciada e ignorada; as demais sao reabertas.
 */
export async function createSuggestionForAlert(alert, suggestion) {
  const existing = await findSuggestionRowByAlertId(alert.id);

  if (existing) {
    const decision = decideSuggestionRefresh(existing);
    if (decision === "skip_accepted") return { suggestion: null, created: false };
    if (decision === "skip_silenced") return { suggestion: null, created: false, ignored: true };

    return { suggestion: await reopenSuggestionForAlert(alert, suggestion), created: false };
  }

  const inserted = await insertSuggestionForAlert(alert, suggestion);
  if (!inserted) {
    // Outra criacao concorrente chegou primeiro: atualiza a pendente em vez de duplicar.
    return { suggestion: await refreshPendingSuggestionForAlert(alert, suggestion), created: false };
  }

  return { suggestion: inserted, created: true };
}
