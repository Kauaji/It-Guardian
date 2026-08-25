import { calculateServiceOrderSla } from "../repositories/serviceOrderRepository.js";

export function buildIsFinalServiceOrderStatus(statusSettings) {
  const statusById = new Map(statusSettings.statuses.map((status) => [status.id, status]));
  return (statusId) => statusById.get(statusId)?.isFinal ?? statusId === "closed";
}

/**
 * Computa o SLA de cada OS aberta uma unica vez e separa em vencidas/proximas
 * do vencimento. Nao inventa "vencida" para OS sem sla_due_at -
 * calculateServiceOrderSla ja devolve not_applicable nesse caso.
 */
export function splitServiceOrdersBySla(openOrders, settings) {
  const overdueOrders = [];
  const nearDueOrders = [];
  for (const order of openOrders) {
    const sla = calculateServiceOrderSla(order, settings);
    if (sla.breached) overdueOrders.push({ ...order, sla });
    else if (sla.nearDue) nearDueOrders.push({ ...order, sla });
  }
  return { overdueOrders, nearDueOrders };
}
