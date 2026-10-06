/**
 * Ponto de entrada historico do dominio de ordens de servico. A
 * implementacao foi dividida por responsabilidade:
 *
 * - regras puras (prioridade, SLA, configuracoes, itens, acesso, anexos,
 *   montagem de linhas e historico de alteracoes): domain/serviceOrders/*
 * - SQL e mapeamento de linhas:                    repositories/serviceOrders/*
 * - orquestracao (criar/atualizar/status/reabrir/excluir, avaliacao, anexos,
 *   numeracao e jobs de prioridade/SLA):          services/serviceOrders/*
 *
 * Este barril reexporta apenas a parte de leitura/persistencia e as regras
 * puras que outros modulos e testes ja importam. As operacoes de orquestracao
 * (createServiceOrder, updateServiceOrder, updateServiceOrderStatus,
 * deleteServiceOrder, reopenServiceOrder, submitServiceOrderFeedback,
 * createServiceOrderAttachment, deleteServiceOrderAttachment,
 * syncAutoPriorities, syncSlaBreaches) agora sao importadas direto de
 * services/serviceOrders/*, porque um repositorio nao pode depender de
 * servicos.
 */
export {
  maxServiceOrderStatuses,
  defaultServiceOrderStatuses,
  formatServiceOrderNumber,
  getFinalStatus,
  getInitialStatus,
  hasServiceOrderStatus
} from "../domain/serviceOrders/serviceOrderSettings.js";
export { serviceOrderPriorities } from "../domain/serviceOrders/serviceOrderPriority.js";
export { canViewAllServiceOrders, canViewServiceOrder } from "../domain/serviceOrders/serviceOrderAccess.js";
export { SLA_STATUSES, calculateServiceOrderSla, computeServiceOrderSlaDueAt } from "../domain/serviceOrders/serviceOrderSla.js";
export { serviceOrderAttachmentCategories } from "../domain/serviceOrders/serviceOrderAttachments.js";
export { getServiceOrderSettings, updateServiceOrderSettings } from "./serviceOrders/serviceOrderSettingsRepository.js";
export { findServiceOrderById, listServiceOrders, listServiceOrdersByAssetId } from "./serviceOrders/serviceOrderReadRepository.js";
export { listServiceOrderItemsByOrderIds } from "./serviceOrders/serviceOrderItemRepository.js";
export { addServiceOrderHistory, listServiceOrderHistory } from "./serviceOrders/serviceOrderHistoryRepository.js";
export { findServiceOrderFeedback, listServiceOrderFeedbackByOrderIds } from "./serviceOrders/serviceOrderFeedbackRepository.js";
export { listServiceOrderAttachments } from "./serviceOrders/serviceOrderAttachmentRepository.js";
export { setFirstResponseAtIfNeeded } from "./serviceOrders/serviceOrderWriteRepository.js";
