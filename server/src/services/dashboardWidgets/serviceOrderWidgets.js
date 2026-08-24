import { averageMinutesBetween } from "../../domain/assetMetricThresholds.js";
import { buildIsFinalServiceOrderStatus, splitServiceOrdersBySla } from "../../domain/serviceOrderAggregates.js";

function clampLimit(value, fallback = 5, max = 15) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(1, Math.round(number)));
}

function countByStatus(serviceOrders, statusSettings) {
  const statusById = new Map(statusSettings.statuses.map((status) => [status.id, status]));
  const counts = new Map();
  for (const order of serviceOrders) {
    const label = statusById.get(order.status)?.name || order.status;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export async function fetchServiceOrdersByStatus(config, ctx) {
  const [serviceOrders, settings] = await Promise.all([ctx.getServiceOrders(), ctx.getServiceOrderSettings()]);
  return { total: serviceOrders.length, rows: countByStatus(serviceOrders, settings) };
}

export async function fetchServiceOrdersSla(config, ctx) {
  const [serviceOrders, settings] = await Promise.all([ctx.getServiceOrders(), ctx.getServiceOrderSettings()]);
  const isFinalStatus = buildIsFinalServiceOrderStatus(settings);
  const openOrders = serviceOrders.filter((order) => !isFinalStatus(order.status));
  const { overdueOrders, nearDueOrders } = splitServiceOrdersBySla(openOrders, settings);

  return {
    openCount: openOrders.length,
    overdueCount: overdueOrders.length,
    nearDueCount: nearDueOrders.length,
    averageResolutionMinutes: averageMinutesBetween(
      serviceOrders.filter((order) => isFinalStatus(order.status) && order.closedAt),
      "createdAt",
      "closedAt"
    ),
    averageFirstResponseMinutes: averageMinutesBetween(
      serviceOrders.filter((order) => order.firstResponseAt),
      "createdAt",
      "firstResponseAt"
    )
  };
}

export async function fetchServiceOrdersOverdue(config, ctx) {
  const [serviceOrders, settings] = await Promise.all([ctx.getServiceOrders(), ctx.getServiceOrderSettings()]);
  const isFinalStatus = buildIsFinalServiceOrderStatus(settings);
  const openOrders = serviceOrders.filter((order) => !isFinalStatus(order.status));
  const { overdueOrders } = splitServiceOrdersBySla(openOrders, settings);
  const limit = clampLimit(config?.limit);

  const rows = [...overdueOrders]
    .sort((a, b) => Date.parse(a.sla.dueAt) - Date.parse(b.sla.dueAt))
    .slice(0, limit)
    .map((order) => ({
      id: order.id,
      number: order.number,
      title: order.title,
      status: order.status,
      priority: order.priority,
      dueAt: order.sla.dueAt,
      overdueMinutes: Math.abs(order.sla.remainingMinutes ?? 0)
    }));

  return { total: overdueOrders.length, rows };
}
