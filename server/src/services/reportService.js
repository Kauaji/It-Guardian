import {
  buildAlertsReport,
  buildAssetsReport,
  buildMonthlyReport,
  buildRemoteAssistanceReport,
  buildScriptsReport,
  buildServiceOrdersReport,
  buildSlaReport
} from "../domain/reportBuilders.js";
import { REPORT_COLUMNS, toCsv } from "../domain/reportCsv.js";
import { listAlerts, listServiceOrderSuggestions } from "../repositories/alertRepository.js";
import {
  findServiceOrderNumbersByIds,
  listAlertIdsWithScriptExecution,
  listReportRemoteAssistanceSessions,
  listReportScriptJobs,
  recordReportExport
} from "../repositories/reportRepository.js";
import { calculateServiceOrderSla, getServiceOrderSettings, listServiceOrders } from "../repositories/serviceOrderRepository.js";
import { getSystemSettings } from "../repositories/systemSettingsRepository.js";
import { getActiveAlertsWithAcknowledgements, getAlertCategory, getAlertCompactLabel } from "./alertService.js";
import { listDevices } from "./monitoringService.js";

/**
 * Fonte unica da permissao exigida por tipo de relatorio - usada tanto
 * pelas rotas (preview/export) quanto por qualquer UI futura, para nunca
 * duplicar a lista de ids espalhada em varios lugares.
 */
export const reportTypePermissions = {
  monthly: ["reports.view"],
  service_orders: ["reports.view", "reports.view_service_orders"],
  sla: ["reports.view", "reports.view_service_orders"],
  assets: ["reports.view", "reports.view_assets"],
  alerts: ["reports.view", "reports.view_alerts"],
  scripts: ["reports.view", "reports.view_scripts"],
  remote_assistance: ["reports.view", "reports.view_remote_assistance"]
};

async function buildDeviceMap() {
  const devices = await listDevices({});
  return { devices, deviceMap: new Map(devices.map((device) => [String(device.id), device])) };
}

export async function previewMonthlyReport({ user, filters = {} } = {}) {
  const { startDate, endDate } = filters;
  const [{ devices }, alerts, serviceOrders, statusSettings, systemSettings] = await Promise.all([
    buildDeviceMap(),
    listAlerts({}),
    listServiceOrders(user),
    getServiceOrderSettings(),
    getSystemSettings()
  ]);

  return buildMonthlyReport({
    devices,
    alerts,
    serviceOrders,
    statusSettings,
    systemMode: systemSettings.systemMode,
    startDate,
    endDate
  });
}

export async function previewServiceOrdersReport({ user, filters = {} } = {}) {
  const [{ deviceMap }, serviceOrders, statusSettings] = await Promise.all([
    buildDeviceMap(),
    listServiceOrders(user),
    getServiceOrderSettings()
  ]);
  const statusById = new Map(statusSettings.statuses.map((status) => [status.id, status]));

  return buildServiceOrdersReport({ serviceOrders, deviceMap, statusById }, filters);
}

export async function previewSlaReport({ user, filters = {} } = {}) {
  const [serviceOrders, statusSettings] = await Promise.all([
    listServiceOrders(user),
    getServiceOrderSettings()
  ]);

  return buildSlaReport({ serviceOrders, statusSettings, calculateSla: calculateServiceOrderSla }, filters);
}

export async function previewAssetsReport({ filters = {} } = {}) {
  const [{ devices }, activeAlerts] = await Promise.all([buildDeviceMap(), getActiveAlertsWithAcknowledgements()]);
  return buildAssetsReport({ devices, alerts: activeAlerts }, filters);
}

export async function previewAlertsReport({ filters = {} } = {}) {
  const [{ deviceMap }, allAlerts, suggestions, executedAlertIds] = await Promise.all([
    buildDeviceMap(),
    listAlerts({}),
    listServiceOrderSuggestions(),
    listAlertIdsWithScriptExecution()
  ]);

  const numberByOrderId = await findServiceOrderNumbersByIds(
    suggestions.map((suggestion) => suggestion.createdServiceOrderId)
  );

  const enrichedAlerts = allAlerts.map((alert) => ({
    ...alert,
    category: getAlertCategory(alert),
    typeLabel: getAlertCompactLabel(alert)
  }));

  const suggestionByAlertId = new Map(
    suggestions.map((suggestion) => [
      suggestion.alertId,
      {
        status: suggestion.status,
        createdServiceOrderNumber: numberByOrderId.get(suggestion.createdServiceOrderId) || null
      }
    ])
  );

  return buildAlertsReport(
    {
      alerts: enrichedAlerts,
      deviceMap,
      suggestionByAlertId,
      scriptExecutedAlertIds: new Set(executedAlertIds)
    },
    filters
  );
}

export async function previewScriptsReport({ filters = {} } = {}) {
  const [{ deviceMap }, jobs] = await Promise.all([buildDeviceMap(), listReportScriptJobs(filters)]);

  const jobsWithAssetName = jobs.map((job) => ({
    ...job,
    assetName: deviceMap.get(String(job.assetId))?.name || null
  }));

  return buildScriptsReport({ jobs: jobsWithAssetName }, filters);
}

export async function previewRemoteAssistanceReport({ filters = {} } = {}) {
  const [{ deviceMap }, sessions] = await Promise.all([
    buildDeviceMap(),
    listReportRemoteAssistanceSessions(filters)
  ]);

  const sessionsWithAssetName = sessions.map((session) => ({
    ...session,
    assetName: deviceMap.get(String(session.assetId))?.name || null
  }));

  return buildRemoteAssistanceReport({ sessions: sessionsWithAssetName }, filters);
}

const previewByType = {
  monthly: previewMonthlyReport,
  service_orders: previewServiceOrdersReport,
  sla: previewSlaReport,
  assets: previewAssetsReport,
  alerts: previewAlertsReport,
  scripts: previewScriptsReport,
  remote_assistance: previewRemoteAssistanceReport
};

export async function previewReport(type, { user, filters = {} } = {}) {
  const preview = previewByType[type];
  if (!preview) {
    const error = new Error("Tipo de relatorio desconhecido.");
    error.statusCode = 404;
    throw error;
  }
  return preview({ user, filters });
}

export async function exportReportCsv(type, { user, filters = {} } = {}) {
  const columns = REPORT_COLUMNS[type];
  if (!columns) {
    const error = new Error("Tipo de relatorio desconhecido.");
    error.statusCode = 404;
    throw error;
  }

  const { rows } = await previewReport(type, { user, filters });
  const csv = toCsv(columns, rows);

  await recordReportExport({
    reportType: type,
    format: "csv",
    filters,
    requestedBy: user?.id || null,
    rowCount: rows.length
  });

  return csv;
}
