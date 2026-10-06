import { makeHttpError } from "./serviceOrderErrors.js";
import { getFinalStatus, getInitialStatus } from "./serviceOrderSettings.js";
import { computeServiceOrderSlaDueAt } from "./serviceOrderSla.js";

/** @import { ServiceOrder, ServiceOrderSettingsInput } from "./types.js" */

/**
 * Descreve o evento de historico gerado por uma mudanca de status: finalizar
 * vira "closed", voltar ao status inicial vira "reopened" e os demais
 * "status". `assetMessage` e o texto equivalente no historico da maquina.
 *
 * @param {string} status
 * @param {ServiceOrderSettingsInput} [settings]
 * @returns {{ eventType: string, message: string, assetMessage: string }}
 */
export function describeStatusChange(status, settings) {
  const initialStatus = getInitialStatus(settings).id;
  const finalStatus = getFinalStatus(settings).id;
  if (status === finalStatus) {
    return { eventType: "closed", message: "OS finalizada.", assetMessage: "finalizada." };
  }
  if (status === initialStatus) {
    return { eventType: "reopened", message: "OS reaberta.", assetMessage: "reaberta." };
  }
  return { eventType: "status", message: "Status da OS alterado.", assetMessage: "status alterado." };
}

/**
 * Valida a reabertura (so OS finalizada, com motivo) e calcula o novo status
 * e o novo prazo de SLA, reiniciado a partir de `now` (funcao pura).
 *
 * @param {{ current: Pick<ServiceOrder, "status" | "priority">, settings: ServiceOrderSettingsInput, reason: unknown, now?: Date }} input
 * @returns {{ reason: string, initialStatusId: string, nextSlaDueAt: string | null }}
 */
export function planServiceOrderReopen({ current, settings, reason, now = new Date() }) {
  if (current.status !== getFinalStatus(settings).id) {
    throw makeHttpError("Só é possível reabrir uma Ordem de Serviço finalizada.");
  }

  const normalizedReason = String(reason || "").trim();
  if (normalizedReason.length < 3) {
    throw makeHttpError("Informe o motivo da reabertura.");
  }

  return {
    reason: normalizedReason,
    initialStatusId: getInitialStatus(settings).id,
    nextSlaDueAt: computeServiceOrderSlaDueAt(current.priority, settings, now)
  };
}
