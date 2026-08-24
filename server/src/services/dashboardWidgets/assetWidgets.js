import { isMetricCritical } from "../../domain/assetMetricThresholds.js";
import { calculateInfrastructureHealth } from "../../domain/infrastructureHealth.js";
import { buildIsFinalServiceOrderStatus, splitServiceOrdersBySla } from "../../domain/serviceOrderAggregates.js";

const RECURRING_ALERT_THRESHOLD = 3;

function clampLimit(value, fallback = 5, max = 15) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(1, Math.round(number)));
}

/**
 * Mesma nota de saude que /api/dashboard/summary calcula (calculateInfrastructureHealth
 * com as mesmas fontes reais), so que isolada para uso por widget. Nao
 * importa buildOverview de dashboardService.js (privada, acoplada ao
 * relatorio monolitico inteiro) -- refaz a mesma agregacao a partir das
 * mesmas fontes memoizadas no contexto da requisicao.
 */
export async function fetchStatusOverview(config, ctx) {
  const [devices, activeAlerts, allAlerts, serviceOrders, serviceOrderSettings] = await Promise.all([
    ctx.getDevices(),
    ctx.getActiveAlerts(),
    ctx.getAllAlerts(),
    ctx.getServiceOrders(),
    ctx.getServiceOrderSettings()
  ]);

  const isFinalStatus = buildIsFinalServiceOrderStatus(serviceOrderSettings);
  const openOrders = serviceOrders.filter((order) => !isFinalStatus(order.status));
  const { overdueOrders } = splitServiceOrdersBySla(openOrders, serviceOrderSettings);

  const totalAssets = devices.length;
  const onlineAssets = devices.filter((device) => device.status === "online").length;
  const offlineAssets = devices.filter((device) => device.status === "offline").length;
  const criticalAssets = devices.filter((device) => device.status === "problem").length;
  const criticalAlerts = activeAlerts.filter((alert) => alert.severity === "critical").length;
  const criticalDiskAssets = devices.filter((device) => isMetricCritical(device.metrics?.disk)).length;
  const criticalPerformanceAssets = devices.filter(
    (device) => isMetricCritical(device.metrics?.cpu) || isMetricCritical(device.metrics?.ram)
  ).length;
  const recurringProblemAssets = new Set(
    allAlerts
      .filter((alert) => Number(alert.occurrencesCount || 1) >= RECURRING_ALERT_THRESHOLD)
      .map((alert) => alert.hostId)
      .filter(Boolean)
  ).size;

  const health = calculateInfrastructureHealth({
    totalAssets,
    offlineAssets,
    criticalAlerts,
    overdueServiceOrders: overdueOrders.length,
    criticalDiskAssets,
    criticalPerformanceAssets,
    staleHeartbeatAssets: criticalAssets,
    recurringProblemAssets
  });

  return {
    health,
    totalAssets,
    onlineAssets,
    offlineAssets,
    criticalAssets,
    openServiceOrders: openOrders.length,
    overdueServiceOrders: overdueOrders.length,
    criticalAlerts
  };
}

export async function fetchAssetAvailability(config, ctx) {
  const devices = await ctx.getDevices();
  const byStatus = { online: 0, offline: 0, problem: 0, unknown: 0 };
  for (const device of devices) {
    const key = Object.prototype.hasOwnProperty.call(byStatus, device.status) ? device.status : "unknown";
    byStatus[key] += 1;
  }
  return { total: devices.length, byStatus };
}

function buildTopAssetsFetcher(metricKey) {
  return async function fetchTopAssets(config, ctx) {
    const devices = await ctx.getDevices();
    const limit = clampLimit(config?.limit);
    const rows = devices
      .filter((device) => Number.isFinite(device.metrics?.[metricKey]))
      .map((device) => ({ id: device.id, name: device.name, status: device.status, value: device.metrics[metricKey] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
    // "basis: current" deixa explicito que isso e um ranking pelo valor
    // atual, nao uma tendencia historica -- nao existe consulta multi-ativo
    // em asset_metric_history ainda para ranquear por media/periodo.
    return { metric: metricKey, limit, basis: "current", rows };
  };
}

export const fetchTopAssetsCpu = buildTopAssetsFetcher("cpu");
export const fetchTopAssetsRam = buildTopAssetsFetcher("ram");
export const fetchTopAssetsDisk = buildTopAssetsFetcher("disk");

export async function fetchCriticalAssets(config, ctx) {
  const devices = await ctx.getDevices();
  const limit = clampLimit(config?.limit, 5, 30);
  const rows = devices
    .filter(
      (device) =>
        device.status === "problem" ||
        isMetricCritical(device.metrics?.cpu) ||
        isMetricCritical(device.metrics?.ram) ||
        isMetricCritical(device.metrics?.disk)
    )
    .slice(0, limit)
    .map((device) => ({ id: device.id, name: device.name, status: device.status, metrics: device.metrics || null }));
  return { limit, rows };
}
