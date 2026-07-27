import { zabbixService } from "../integrations/zabbix/ZabbixService.js";
import {
  findIntegrationAsset,
  listIntegrationAlerts,
  listIntegrationAssets
} from "../repositories/integrationRepository.js";

function toLegacyHost(asset) {
  return {
    id: asset.externalId,
    integrationAssetId: asset.id,
    source: "zabbix",
    name: asset.displayName || asset.hostname || asset.externalId,
    hostname: asset.hostname,
    ip: asset.ip,
    status: asset.status,
    uptimeHours: asset.hardware?.uptimeHours ?? null,
    metrics: asset.metrics || {},
    history: [],
    collectedAt: asset.collectedAt,
    lastSeenAt: asset.lastSeenAt,
    sourceConflicts: asset.correlation?.conflict
      ? [{ source: "zabbix", externalId: asset.externalId }]
      : []
  };
}

function toLegacyAlert(alert) {
  return {
    id: alert.externalId,
    source: "zabbix",
    hostId: alert.assetExternalId,
    hostName: alert.assetHostname,
    severity: alert.severity,
    title: alert.name,
    description: alert.metadata?.description || alert.name,
    status: alert.status,
    startedAt: alert.occurredAt,
    resolvedAt: alert.resolvedAt,
    tags: alert.metadata?.tags || []
  };
}

export async function getHosts() {
  if (zabbixService.mode === "mock") {
    return zabbixService.getHosts();
  }

  const assets = await listIntegrationAssets({ source: "zabbix" });
  return assets.map(toLegacyHost);
}

export async function getHostById(id) {
  if (zabbixService.mode === "mock") {
    return zabbixService.getHostById(id);
  }

  const asset = await findIntegrationAsset("zabbix", id);
  return asset ? toLegacyHost(asset) : null;
}

export async function getActiveAlerts() {
  const alerts = await getAlertHistory();
  return alerts.filter((alert) => alert.status === "active");
}

export async function getAlertHistory() {
  if (zabbixService.mode === "mock") {
    return zabbixService.getAlerts();
  }

  const alerts = await listIntegrationAlerts({ source: "zabbix" });
  return alerts.map(toLegacyAlert);
}

export async function getHostAlerts(hostId) {
  const alerts = await getAlertHistory();
  return alerts.filter((alert) => alert.hostId === hostId);
}
