import { makeHttpError } from "./floorPlanErrors.js";

/** @import { AssetSnapshot, HeatmapFilters, InfrastructureAssetRow, InfrastructureData, InfrastructureObjectRow, LinkedInfrastructureObject } from "./types.js" */

/**
 * @param {string} metric
 * @param {number} value
 * @param {string} status
 * @returns {"low" | "medium" | "high" | "critical"}
 */
export function assetHeatmapSeverity(metric, value, status) {
  if (metric === "availability") {
    return status === "online" ? "low" : status === "offline" ? "critical" : "medium";
  }
  if (metric === "alerts" || metric === "service_orders") {
    return value >= 5 ? "critical" : value >= 3 ? "high" : value >= 1 ? "medium" : "low";
  }
  return value >= 85 ? "critical" : value >= 65 ? "high" : value >= 35 ? "medium" : "low";
}

/**
 * @param {InfrastructureAssetRow | null | undefined} asset
 * @returns {AssetSnapshot}
 */
export function assetSnapshot(asset) {
  if (!asset) return { status: "no_agent", cpu: null, ram: null, disk: null, lastSeenAt: null };
  const ram = Number(asset.memory_total_bytes) > 0 ? Math.round(Number(asset.memory_used_bytes || 0) / Number(asset.memory_total_bytes) * 100) : null;
  const disk = Number(asset.disk_total_bytes) > 0 ? Math.round((1 - Number(asset.disk_free_bytes || 0) / Number(asset.disk_total_bytes)) * 100) : null;
  const age = Date.now() - new Date(asset.last_seen_at ?? 0).getTime();
  const status = age <= Math.max(180_000, Number(asset.interval_seconds || 60) * 3_000) ? "online" : "offline";
  return { status, cpu: asset.cpu_usage_percent == null ? null : Number(asset.cpu_usage_percent), ram, disk, lastSeenAt: asset.last_seen_at, name: asset.machine_alias || asset.hostname };
}

/**
 * @param {InfrastructureObjectRow[]} objects
 * @param {HeatmapFilters} [filters]
 * @returns {InfrastructureObjectRow[]}
 */
export function filterInfrastructureObjects(objects, { groupId, segmentId } = {}) {
  return objects.filter((item) => (
    (!groupId || item.group_id === groupId)
    && (!segmentId || item.segment_id === segmentId)
  ));
}

/**
 * @param {InfrastructureObjectRow} item
 * @returns {item is LinkedInfrastructureObject}
 */
function isLinkedObject(item) {
  return Boolean(item.linked_asset_id);
}

const allowedMetrics = new Set(["availability", "cpu", "ram", "disk", "alerts", "service_orders"]);

/**
 * @param {string} metric
 * @returns {void}
 * @throws {Error} 400 para metrica desconhecida.
 */
export function assertAssetHeatmapMetric(metric) {
  if (!allowedMetrics.has(metric)) throw makeHttpError(400, "Métrica de ativos inválida.");
}

/**
 * @param {{ asset_id: string }[]} rows
 * @returns {Map<string, number>}
 */
function countByAsset(rows) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const row of rows) counts.set(row.asset_id, (counts.get(row.asset_id) || 0) + 1);
  return counts;
}

/**
 * @param {string} metric
 * @param {AssetSnapshot} snapshot
 * @param {number} alerts
 * @param {number} orders
 * @returns {number | null}
 */
function metricValue(metric, snapshot, alerts, orders) {
  if (metric === "cpu") return snapshot.cpu;
  if (metric === "ram") return snapshot.ram;
  if (metric === "disk") return snapshot.disk;
  if (metric === "alerts") return alerts;
  if (metric === "service_orders") return orders;
  return snapshot.status === "online" ? 0 : snapshot.status === "offline" ? 100 : 50;
}

/**
 * Mapa de calor por ativo vinculado a componentes da planta (funcao pura).
 *
 * @param {InfrastructureData} data
 * @param {string} metric
 * @param {HeatmapFilters} [filters]
 */
export function buildAssetHeatmap(data, metric, filters = {}) {
  const assetMap = new Map(data.assets.map((item) => [item.asset_id, item]));
  const alertsByAsset = countByAsset(data.alerts);
  const ordersByAsset = countByAsset(data.orders);
  const components = filterInfrastructureObjects(data.objects, filters)
    .filter(isLinkedObject)
    .map((item) => {
      const snapshot = assetSnapshot(assetMap.get(item.linked_asset_id));
      const alerts = alertsByAsset.get(item.linked_asset_id) || 0;
      const serviceOrders = ordersByAsset.get(item.linked_asset_id) || 0;
      const value = metricValue(metric, snapshot, alerts, serviceOrders);
      return {
        componentId: item.id,
        assetId: item.linked_asset_id,
        label: item.label,
        ...snapshot,
        alerts,
        serviceOrders,
        score: value ?? 0,
        severity: assetHeatmapSeverity(metric, value ?? 0, snapshot.status)
      };
    });
  return { metric, filters: { groupId: filters.groupId || null, segmentId: filters.segmentId || null }, components };
}

/**
 * Periodo valido: datas reais, fim depois do inicio e no maximo 366 dias.
 *
 * @param {string | number | Date} startDate
 * @param {string | number | Date} endDate
 * @returns {{ start: Date, end: Date }}
 * @throws {Error} 400 para datas invalidas, fim <= inicio ou mais de 366 dias.
 */
export function parseHeatmapPeriod(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || (end.getTime() - start.getTime()) > 366 * 86400000) {
    throw makeHttpError(400, "Informe um período válido de até 366 dias.");
  }
  return { start, end };
}

/**
 * Mapa de calor de OS por componente no periodo informado (funcao pura).
 *
 * @param {InfrastructureData} data
 * @param {Date} start
 * @param {Date} end
 * @param {HeatmapFilters} [filters]
 */
export function buildServiceOrderHeatmap(data, start, end, filters = {}) {
  /** @type {Map<string, InfrastructureData["orders"]>} */
  const byAsset = new Map();
  for (const order of data.orders) {
    const created = new Date(order.created_at);
    if (created < start || created >= end) continue;
    const list = byAsset.get(order.asset_id) || [];
    list.push(order);
    byAsset.set(order.asset_id, list);
  }
  const components = filterInfrastructureObjects(data.objects, filters)
    .filter(isLinkedObject)
    .map((item) => {
      const orders = byAsset.get(item.linked_asset_id) || [];
      const open = orders.filter((order) => !order.closed_at).length;
      const overdue = orders.filter((order) => !order.closed_at && order.sla_due_at && new Date(order.sla_due_at) < new Date()).length;
      const score = orders.length + open * 2 + overdue * 3;
      return {
        componentId: item.id,
        assetId: item.linked_asset_id,
        label: item.label,
        totalServiceOrders: orders.length,
        openServiceOrders: open,
        overdueServiceOrders: overdue,
        score,
        severity: score >= 10 ? "critical" : score >= 6 ? "high" : score >= 3 ? "medium" : "low"
      };
    });
  return {
    period: { startDate: start.toISOString(), endDate: end.toISOString() },
    filters: { groupId: filters.groupId || null, segmentId: filters.segmentId || null },
    components,
    summary: {
      totalServiceOrders: components.reduce((sum, item) => sum + item.totalServiceOrders, 0),
      openServiceOrders: components.reduce((sum, item) => sum + item.openServiceOrders, 0),
      overdueServiceOrders: components.reduce((sum, item) => sum + item.overdueServiceOrders, 0)
    }
  };
}

/**
 * Resumo da infraestrutura da planta (funcao pura).
 *
 * @param {InfrastructureData} data
 * @param {HeatmapFilters} [filters]
 */
export function buildInfrastructureSummary(data, filters = {}) {
  const objects = filterInfrastructureObjects(data.objects, filters);
  const assetMap = new Map(data.assets.map((item) => [item.asset_id, item]));
  const linked = objects.filter(isLinkedObject);
  const snapshots = linked.map((item) => assetSnapshot(assetMap.get(item.linked_asset_id)));
  const linkedIds = new Set(linked.map((item) => item.linked_asset_id));
  return {
    totalComponents: objects.length,
    linkedAssets: linked.length,
    onlineAssets: snapshots.filter((item) => item.status === "online").length,
    offlineAssets: snapshots.filter((item) => item.status === "offline").length,
    assetsWithoutAgent: snapshots.filter((item) => item.status === "no_agent").length,
    openServiceOrders: data.orders.filter((item) => linkedIds.has(item.asset_id) && !item.closed_at).length,
    overdueServiceOrders: data.orders.filter((item) => linkedIds.has(item.asset_id) && !item.closed_at && item.sla_due_at && new Date(item.sla_due_at) < new Date()).length,
    criticalAlerts: data.alerts.filter((item) => linkedIds.has(item.asset_id) && ["critical", "high"].includes(item.severity)).length,
    segmentsRepresented: new Set(objects.map((item) => item.segment_id).filter(Boolean)).size,
    groupsRepresented: new Set(objects.map((item) => item.group_id).filter(Boolean)).size
  };
}
