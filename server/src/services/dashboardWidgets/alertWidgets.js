import { getAlertCompactLabel } from "../alertService.js";

const severityLabels = { critical: "Critica", high: "Alta", medium: "Media", low: "Baixa", warning: "Atencao", info: "Informativa" };

function clampLimit(value, fallback = 5, max = 20) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(1, Math.round(number)));
}

export async function fetchCurrentProblems(config, ctx) {
  const activeAlerts = await ctx.getActiveAlerts();
  const limit = clampLimit(config?.limit);
  const rows = [...activeAlerts]
    .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt))
    .slice(0, limit)
    .map((alert) => ({
      id: alert.id,
      hostId: alert.hostId,
      hostName: alert.hostName,
      severity: alert.severity,
      severityLabel: severityLabels[alert.severity] || alert.severity,
      typeLabel: getAlertCompactLabel(alert),
      lastSeenAt: alert.lastSeenAt
    }));
  return { total: activeAlerts.length, rows };
}

export async function fetchAlertsBySeverity(config, ctx) {
  const activeAlerts = await ctx.getActiveAlerts();
  const counts = new Map();
  for (const alert of activeAlerts) {
    counts.set(alert.severity, (counts.get(alert.severity) || 0) + 1);
  }
  const rows = Array.from(counts.entries())
    .map(([severity, count]) => ({ severity, label: severityLabels[severity] || severity, count }))
    .sort((a, b) => b.count - a.count);
  return { total: activeAlerts.length, rows };
}
