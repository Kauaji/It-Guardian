import { calculateServiceOrderSla } from "./serviceOrders/serviceOrderSla.js";

/** @import { ServiceOrder, ServiceOrderSettingsInput, ServiceOrderSla, ServiceOrderStatus } from "./serviceOrders/types.js" */

/**
 * @param {{ statuses: ServiceOrderStatus[] }} statusSettings
 * @returns {(statusId: string) => boolean} Verdadeiro para status final (sem status configurado, so `closed`).
 */
export function buildIsFinalServiceOrderStatus(statusSettings) {
  const statusById = new Map(statusSettings.statuses.map((status) => [status.id, status]));
  return (statusId) => statusById.get(statusId)?.isFinal ?? statusId === "closed";
}

/**
 * Computa o SLA de cada OS aberta uma unica vez e separa em vencidas/proximas
 * do vencimento. Nao inventa "vencida" para OS sem sla_due_at -
 * calculateServiceOrderSla ja devolve not_applicable nesse caso.
 *
 * @template {Pick<ServiceOrder, "status" | "priority" | "slaDueAt" | "closedAt" | "slaBreachedAt">} T
 * @param {T[]} openOrders
 * @param {ServiceOrderSettingsInput} settings
 * @returns {{ overdueOrders: (T & { sla: ServiceOrderSla })[], nearDueOrders: (T & { sla: ServiceOrderSla })[] }}
 */
export function splitServiceOrdersBySla(openOrders, settings) {
  /** @type {(T & { sla: ServiceOrderSla })[]} */
  const overdueOrders = [];
  /** @type {(T & { sla: ServiceOrderSla })[]} */
  const nearDueOrders = [];
  for (const order of openOrders) {
    const sla = calculateServiceOrderSla(order, settings);
    if (sla.breached) overdueOrders.push({ ...order, sla });
    else if (sla.nearDue) nearDueOrders.push({ ...order, sla });
  }
  return { overdueOrders, nearDueOrders };
}
