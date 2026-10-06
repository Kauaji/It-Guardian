/**
 * Ponto de entrada historico do dominio de avisos. A implementacao foi dividida:
 *
 * - regras puras (padroes de regras/configuracoes, normalizacao, decisao de
 *   reabrir sugestao): domain/alerts/*
 * - SQL e mapeamento de linhas:                  repositories/alerts/*
 * - orquestracao (criar sugestao de aviso, registrar observacao/validacao):
 *                                                services/alerts/*
 *
 * Este barril reexporta a leitura/persistencia que outros modulos e testes ja
 * importam. createSuggestionForAlert e markSuggestionValidated agora vivem em
 * services/alerts/* (um repositorio nao depende de servicos).
 */
export { defaultAlertRules } from "../domain/alerts/alertConfiguration.js";
export { listAlertRules, updateAlertRule } from "./alerts/alertRuleRepository.js";
export { getAlertSettings, updateAlertSettings } from "./alerts/alertSettingsRepository.js";
export {
  addAlertComment,
  findAlertById,
  listAlertComments,
  listAlerts,
  resolveInactiveAgentAlerts,
  upsertAlert
} from "./alerts/alertRecordRepository.js";
export {
  findServiceOrderSuggestionById,
  findServiceOrderSuggestionByServiceOrderId,
  listServiceOrderSuggestions,
  markSuggestionAccepted,
  markSuggestionRejected,
  updatePendingSuggestionPrioritiesForAlertType
} from "./alerts/alertSuggestionRepository.js";
