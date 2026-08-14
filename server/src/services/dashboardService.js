import { calculateInfrastructureHealth } from "../domain/infrastructureHealth.js";
import { listAlerts } from "../repositories/alertRepository.js";
import { listActiveMaintenanceRecordsMap } from "../repositories/assetLifecycleRepository.js";
import { getServiceOrderSettings, listServiceOrders } from "../repositories/serviceOrderRepository.js";
import { getSystemSettings } from "../repositories/systemSettingsRepository.js";
import { getActiveAlertsWithAcknowledgements, getAlertCategory, getAlertCompactLabel } from "./alertService.js";
import { listDevices } from "./monitoringService.js";

const periodDaysByKey = { today: 1, "7d": 7, "15d": 15, "30d": 30, "90d": 90 };
const defaultPeriod = "30d";

const statusLabels = { online: "Online", offline: "Offline", problem: "Erro", unknown: "Sem dados" };
const priorityLabels = { low: "Baixa", medium: "Media", high: "Alta", critical: "Critica" };
const severityLabels = { critical: "Critica", high: "Alta", medium: "Media", low: "Baixa", warning: "Atencao" };

const CRITICAL_METRIC_THRESHOLD = 90;
const WARNING_METRIC_THRESHOLD = 85;
const RECURRING_ALERT_THRESHOLD = 3;
const RANKING_LIMIT = 5;

function resolvePeriodDays(period) {
  return periodDaysByKey[period] || periodDaysByKey[defaultPeriod];
}

function dayKey(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function withinPeriod(value, sinceDate) {
  const time = Date.parse(value);
  return Number.isFinite(time) && time >= sinceDate.getTime();
}

function isMetricCritical(value) {
  return Number.isFinite(value) && value >= CRITICAL_METRIC_THRESHOLD;
}

function isMetricWarning(value) {
  return Number.isFinite(value) && value >= WARNING_METRIC_THRESHOLD;
}

function countBy(list, keyFn, labelFn = (key) => String(key)) {
  const counts = new Map();
  for (const item of list) {
    const key = keyFn(item);
    if (key == null || key === "") continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: labelFn(key), count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Serie diaria continua (sem buracos) dentro do periodo, mesmo quando um dia
 * nao teve nenhum evento — importante para o grafico de tendencia nao
 * "pular" datas.
 */
function buildDailySeries(items, dateFn, sinceDate, days) {
  const buckets = new Map();
  const cursor = new Date(sinceDate);
  cursor.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < days; i += 1) {
    buckets.set(cursor.toISOString().slice(0, 10), 0);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  for (const item of items) {
    const key = dayKey(dateFn(item));
    if (key && buckets.has(key)) buckets.set(key, buckets.get(key) + 1);
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
}

function rankAssetsByAlerts(alerts, devices, limit = RANKING_LIMIT) {
  const deviceById = new Map(devices.map((device) => [String(device.id), device]));
  const totals = new Map();
  for (const alert of alerts) {
    const id = String(alert.hostId || "");
    if (!id) continue;
    const current = totals.get(id) || { count: 0, occurrences: 0, hostName: alert.hostName };
    current.count += 1;
    current.occurrences += Number(alert.occurrencesCount || 1);
    totals.set(id, current);
  }
  return Array.from(totals.entries())
    .map(([assetId, data]) => {
      const device = deviceById.get(assetId);
      return {
        assetId,
        name: device?.name || data.hostName || assetId,
        status: device?.status || null,
        statusLabel: device ? statusLabels[device.status] || device.status : null,
        alertCount: data.count,
        occurrences: data.occurrences
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, limit);
}

function buildOverview({ devices, activeAlerts, allAlerts, serviceOrders, isFinalStatus, maintenanceMap }) {
  const totalAssets = devices.length;
  const onlineAssets = devices.filter((device) => device.status === "online").length;
  const offlineAssets = devices.filter((device) => device.status === "offline").length;
  const criticalAssets = devices.filter((device) => device.status === "problem").length;
  const warningAssets = devices.filter((device) => {
    const metrics = device.metrics;
    return Boolean(
      metrics && (isMetricWarning(metrics.cpu) || isMetricWarning(metrics.ram) || isMetricWarning(metrics.disk))
    );
  }).length;

  const openServiceOrders = serviceOrders.filter((order) => !isFinalStatus(order.status)).length;
  const criticalAlerts = activeAlerts.filter((alert) => alert.severity === "critical").length;
  const todayKey = dayKey(new Date());
  const resolvedAlertsToday = allAlerts.filter(
    (alert) => alert.status === "resolved" && dayKey(alert.resolvedAt) === todayKey
  ).length;

  const criticalDiskAssets = devices.filter((device) => isMetricCritical(device.metrics?.disk)).length;
  const criticalPerformanceAssets = devices.filter(
    (device) => isMetricCritical(device.metrics?.cpu) || isMetricCritical(device.metrics?.ram)
  ).length;
  const recurringProblemAssets = new Set(
    allAlerts.filter((alert) => Number(alert.occurrencesCount || 1) >= RECURRING_ALERT_THRESHOLD)
      .map((alert) => alert.hostId)
      .filter(Boolean)
  ).size;

  const infrastructureHealth = calculateInfrastructureHealth({
    totalAssets,
    offlineAssets,
    criticalAlerts,
    overdueServiceOrders: 0,
    criticalDiskAssets,
    criticalPerformanceAssets,
    staleHeartbeatAssets: criticalAssets,
    recurringProblemAssets
  });

  return {
    totalAssets,
    onlineAssets,
    offlineAssets,
    warningAssets,
    criticalAssets,
    openServiceOrders,
    overdueServiceOrders: 0,
    overdueServiceOrdersAvailable: false,
    criticalAlerts,
    resolvedAlertsToday,
    inMaintenanceAssets: maintenanceMap.size,
    infrastructureHealth
  };
}

function buildAssetsSection(devices, activeAlerts) {
  const byStatus = countBy(devices, (device) => device.status, (key) => statusLabels[key] || key);
  const byType = countBy(devices, (device) => device.assetType || "other");
  const bySegment = countBy(devices, (device) => device.segmentName || "Nao organizadas");

  const notSeenRecently = devices
    .filter((device) => device.status === "offline" || device.status === "problem")
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "problem" ? -1 : 1))
    .slice(0, 10)
    .map((device) => ({
      id: device.id,
      name: device.name,
      status: device.status,
      statusLabel: statusLabels[device.status] || device.status,
      segmentName: device.segmentName,
      lastSeenAt: device.lastSeenAt || null
    }));

  const recentlySeen = devices
    .filter((device) => device.status === "online")
    .slice(0, RANKING_LIMIT)
    .map((device) => ({
      id: device.id,
      name: device.name,
      segmentName: device.segmentName,
      lastSeenAt: device.lastSeenAt || null
    }));

  return {
    byStatus,
    byType,
    bySegment,
    recentlySeen,
    notSeenRecently,
    mostProblematic: rankAssetsByAlerts(activeAlerts, devices)
  };
}

function buildServiceOrdersSection(serviceOrders, statusSettings, isFinalStatus, sinceDate, periodDays) {
  const statusById = new Map(statusSettings.statuses.map((status) => [status.id, status]));
  const open = serviceOrders.filter((order) => !isFinalStatus(order.status));

  const byStatus = countBy(serviceOrders, (order) => order.status, (id) => statusById.get(id)?.name || id);
  const byPriority = countBy(serviceOrders, (order) => order.priority, (id) => priorityLabels[id] || id);

  const recent = [...serviceOrders]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, RANKING_LIMIT)
    .map((order) => ({
      id: order.id,
      number: order.number,
      title: order.title,
      status: order.status,
      statusLabel: statusById.get(order.status)?.name || order.status,
      priority: order.priority,
      createdAt: order.createdAt
    }));

  const oldestOpen = [...open]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .slice(0, RANKING_LIMIT)
    .map((order) => ({
      id: order.id,
      number: order.number,
      title: order.title,
      status: order.status,
      priority: order.priority,
      createdAt: order.createdAt
    }));

  const createdInPeriod = serviceOrders.filter((order) => withinPeriod(order.createdAt, sinceDate));
  const closedInPeriod = serviceOrders.filter((order) => order.closedAt && withinPeriod(order.closedAt, sinceDate));
  const trend = buildDailySeries(createdInPeriod, (order) => order.createdAt, sinceDate, periodDays);

  const byTechnician = countBy(
    serviceOrders.filter((order) => order.assignedTechnicianName && isFinalStatus(order.status)),
    (order) => order.assignedTechnicianName
  ).slice(0, 10);

  return {
    byStatus,
    byPriority,
    recent,
    oldestOpen,
    overdue: [],
    overdueAvailable: false,
    trend,
    byTechnician,
    openCount: open.length,
    createdInPeriodCount: createdInPeriod.length,
    closedInPeriodCount: closedInPeriod.length
  };
}

function buildAlertsSection(allAlerts, activeAlerts, devices, sinceDate, periodDays) {
  const bySeverity = countBy(activeAlerts, (alert) => alert.severity, (id) => severityLabels[id] || id);

  const recent = [...activeAlerts]
    .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt))
    .slice(0, RANKING_LIMIT)
    .map((alert) => ({
      id: alert.id,
      hostId: alert.hostId,
      hostName: alert.hostName,
      type: alert.type,
      typeLabel: getAlertCompactLabel(alert),
      severity: alert.severity,
      lastSeenAt: alert.lastSeenAt
    }));

  const inPeriod = allAlerts.filter((alert) => withinPeriod(alert.firstSeenAt || alert.lastSeenAt, sinceDate));
  const trend = buildDailySeries(inPeriod, (alert) => alert.firstSeenAt || alert.lastSeenAt, sinceDate, periodDays);

  return {
    bySeverity,
    recent,
    trend,
    topRecurringAssets: rankAssetsByAlerts(inPeriod, devices),
    topCategories: countBy(activeAlerts, getAlertCategory).slice(0, 6)
  };
}

/**
 * Nao existe isolamento por organizacao no schema (nenhuma tabela referencia
 * clients.id) — "cliente" em Ordens de Servico e o campo livre
 * environment_name. A visao Business usa esse campo real; nunca inventa
 * organizacoes nem finge que alertas/ativos tem vinculo com o cadastro de
 * clientes, que hoje nao existe.
 */
function buildBusinessSection(serviceOrders, systemMode) {
  if (systemMode !== "business") {
    return {
      enabled: false,
      byEnvironment: [],
      clientsWithMostOpenOrders: [],
      clientsWithMostAlertsAvailable: false,
      message: "Ative o modo Business nas configuracoes do sistema para ver a visao por cliente/ambiente."
    };
  }

  const withEnvironment = serviceOrders.filter((order) => order.environmentName);
  if (!withEnvironment.length) {
    return {
      enabled: true,
      byEnvironment: [],
      clientsWithMostOpenOrders: [],
      clientsWithMostAlertsAvailable: false,
      message: "Dados por cliente serao exibidos quando houver ordens de servico vinculadas a um ambiente/organizacao."
    };
  }

  return {
    enabled: true,
    byEnvironment: countBy(withEnvironment, (order) => order.environmentName).slice(0, 10),
    clientsWithMostOpenOrders: countBy(
      withEnvironment.filter((order) => order.status !== "closed"),
      (order) => order.environmentName
    ).slice(0, RANKING_LIMIT),
    clientsWithMostAlertsAvailable: false,
    message: null
  };
}

export async function getDashboardSummaryReport({ period = defaultPeriod, user = null } = {}) {
  const periodDays = resolvePeriodDays(period);
  const sinceDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const [devices, activeAlerts, allAlerts, serviceOrders, statusSettings, maintenanceMap, systemSettings] =
    await Promise.all([
      listDevices({}),
      getActiveAlertsWithAcknowledgements(),
      listAlerts({}),
      listServiceOrders(user),
      getServiceOrderSettings(),
      listActiveMaintenanceRecordsMap(),
      getSystemSettings()
    ]);

  const statusById = new Map(statusSettings.statuses.map((status) => [status.id, status]));
  const isFinalStatus = (statusId) => statusById.get(statusId)?.isFinal ?? statusId === "closed";

  return {
    overview: buildOverview({ devices, activeAlerts, allAlerts, serviceOrders, isFinalStatus, maintenanceMap }),
    assets: buildAssetsSection(devices, activeAlerts),
    serviceOrders: buildServiceOrdersSection(serviceOrders, statusSettings, isFinalStatus, sinceDate, periodDays),
    alerts: buildAlertsSection(allAlerts, activeAlerts, devices, sinceDate, periodDays),
    business: buildBusinessSection(serviceOrders, systemSettings.systemMode),
    metadata: {
      generatedAt: new Date().toISOString(),
      mode: systemSettings.systemMode,
      period,
      periodDays
    }
  };
}
