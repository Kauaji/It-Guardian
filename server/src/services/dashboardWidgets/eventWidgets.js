import { filterDashboardEvents } from "./widgetFilters.js";

function clampLimit(value, fallback = 10, max = 50) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(1, Math.round(number)));
}

export async function fetchRecentEvents(config, ctx) {
  const logs = await ctx.getRecentEventLogs();
  const scopedLogs = ctx.hasFilters
    ? filterDashboardEvents(logs, await ctx.getScopedEventReferences())
    : logs;
  const limit = clampLimit(config?.limit);
  return {
    // The repository reads the latest 500 audit events. Filtering this bounded
    // window is explicit; it must not be presented as a complete event history.
    ...(ctx.hasFilters ? { filterScope: "asset", warnings: ["recent_window_only"], windowLimit: 500 } : {}),
    total: scopedLogs.length,
    rows: scopedLogs.slice(0, limit).map((log) => ({
      id: log.id,
      type: log.type,
      message: log.message,
      userName: log.user?.name || null,
      createdAt: log.createdAt
    }))
  };
}
