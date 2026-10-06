import { alertTypeLabels } from "./alertCatalog.js";

function percentage(used, total) {
  if (!Number.isFinite(Number(used)) || !Number.isFinite(Number(total)) || Number(total) <= 0) return null;
  return Math.round((Number(used) / Number(total)) * 100);
}

/**
 * Avisos gerados a partir da leitura atual de um ativo com agente. O limite de
 * "offline" combina os parametros de ambiente informados (em segundos e em
 * minutos, lidos pelo chamador) com 3x o intervalo de coleta do agente.
 */
export function buildAgentAlerts(asset, now = new Date(), { offlineAfterSecondsSetting = 0, offlineAfterMinutesSetting = 10 } = {}) {
  const alerts = [];
  const hostName = asset.machineAlias || asset.hostname || "Maquina monitorada";
  const lastSeenAt = asset.lastSeenAt ? new Date(asset.lastSeenAt) : null;
  const intervalSeconds = Math.max(60, Number(asset.intervalSeconds || 300));
  const offlineAfterSeconds = Math.max(
    Number(offlineAfterSecondsSetting || 0),
    Number(offlineAfterMinutesSetting || 10) * 60,
    intervalSeconds * 3
  );
  const stale = !lastSeenAt || now.getTime() - lastSeenAt.getTime() > offlineAfterSeconds * 1000;
  const measuredAt = asset.collectedAt || asset.lastSeenAt || now.toISOString();
  const addMetricAlert = ({ type, metric, value, threshold = 85 }) => {
    if (value == null || value < threshold) return;
    alerts.push({
      id: `agent:${asset.id}:${type}`,
      assetId: asset.id,
      hostId: asset.id,
      hostName,
      type,
      metric,
      title: alertTypeLabels[type],
      description: `${hostName} registrou ${value}% em ${metric}.`,
      severity: value >= 95 ? "critical" : "high",
      value,
      threshold,
      status: "active",
      firstSeenAt: measuredAt,
      lastSeenAt: measuredAt,
      occurrencesCount: 1,
      source: "agent"
    });
  };

  if (stale) {
    alerts.push({
      id: `agent:${asset.id}:machine_offline`,
      assetId: asset.id,
      hostId: asset.id,
      hostName,
      type: "machine_offline",
      metric: "heartbeat",
      title: alertTypeLabels.machine_offline,
      description: `${hostName} nao envia heartbeat dentro do intervalo esperado.`,
      severity: "critical",
      value: lastSeenAt ? Math.floor((now.getTime() - lastSeenAt.getTime()) / 1000) : null,
      threshold: offlineAfterSeconds,
      status: "active",
      firstSeenAt: asset.lastSeenAt || now.toISOString(),
      lastSeenAt: now.toISOString(),
      occurrencesCount: 1,
      source: "agent"
    });
  } else {
    addMetricAlert({ type: "cpu_high", metric: "CPU", value: asset.cpuUsagePercent });
    addMetricAlert({
      type: "ram_high",
      metric: "memoria RAM",
      value: percentage(asset.memoryUsedBytes, asset.memoryTotalBytes)
    });
    const diskUsage = percentage(
      Number(asset.diskTotalBytes) - Number(asset.diskFreeBytes),
      asset.diskTotalBytes
    );
    addMetricAlert({
      type: diskUsage >= 95 ? "disk_full" : "disk_high",
      metric: "disco",
      value: diskUsage,
      threshold: diskUsage >= 95 ? 95 : 85
    });
  }

  return alerts;
}
