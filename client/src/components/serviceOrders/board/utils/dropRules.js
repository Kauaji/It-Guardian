// Regras de soltar uma OS em outra coluna do quadro.

/** Mensagem de negacao (permissoes) ou "" quando a mudanca de status e permitida. */
export function getDropDenial({ targetStatus, configuredStatuses, canChangeStatus, canFinishOrders }) {
  if (!canChangeStatus) return "Você não possui permissão para alterar status de OS.";
  if (configuredStatuses.find((status) => status.id === targetStatus)?.isFinal && !canFinishOrders) {
    return "Você não possui permissão para finalizar esta Ordem de Serviço.";
  }
  return "";
}
