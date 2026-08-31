import { filterDashboardEvents } from "./widgetFilters.js";

const FILTERED_RECENT_LOG_LIMIT = 500;

function clampLimit(value, fallback = 10, max = 30) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(1, Math.round(number)));
}

export async function fetchScriptExecutions(config, ctx) {
  const limit = clampLimit(config?.limit);
  const logs = await ctx.getRecentScriptExecutionLogs(ctx.hasFilters ? FILTERED_RECENT_LOG_LIMIT : limit);
  const scopedLogs = ctx.hasFilters
    ? filterDashboardEvents(logs.map((log) => ({ ...log, meta: {
      assetId: log.assetId, alertId: log.alertId, serviceOrderId: log.serviceOrderId
    } })), await ctx.getScopedEventReferences())
    : logs;
  return {
    ...(ctx.hasFilters ? { filterScope: "asset", warnings: ["recent_window_only"], windowLimit: FILTERED_RECENT_LOG_LIMIT } : {}),
    rows: scopedLogs.slice(0, limit).map((log) => ({
      id: log.id,
      scriptName: log.scriptName,
      assetId: log.assetId,
      status: log.status,
      errorDetected: log.errorDetected,
      executedBy: log.executedBy,
      executedAt: log.executedAt,
      createdAt: log.createdAt
    }))
  };
}
