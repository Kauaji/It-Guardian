import { getAlertHistory, getHostById, getHosts } from "./zabbixService.js";
import { getInventory, getInventoryByHostId } from "./ocsService.js";
import { getHostAlertsWithAcknowledgements } from "./alertService.js";
import { listAssetHistory } from "../repositories/assetHistoryRepository.js";
import { findDeviceMetadata, listDeviceMetadataMap } from "../repositories/deviceMetadataRepository.js";
import { findManualAssetById, listManualAssets } from "../repositories/manualAssetRepository.js";
import {
  DEFAULT_SEGMENT_ID,
  DEFAULT_SEGMENT_NAME,
  listDeviceSegmentMap
} from "../repositories/segmentRepository.js";
import { listAutomationIndicatorsByAssetIds } from "../repositories/automationIndicatorRepository.js";
import { findAgentAssetById, listAgentAssets } from "../repositories/agentRepository.js";

function normalizeStatus(status) {
  return {
    online: "Online",
    offline: "Erro",
    problem: "Problema"
  }[status] || status;
}

function inferAssetType(host, inventory) {
  const text = `${host?.id || ""} ${host?.name || ""} ${inventory?.model || ""} ${inventory?.os || ""}`.toLowerCase();

  if (text.includes("notebook") || text.includes("macbook") || text.startsWith("nb-")) return "notebook";
  if (text.includes("switch") || text.startsWith("sw-")) return "switch";
  if (text.includes("fortigate") || text.includes("router") || text.includes("fw-")) return "router";
  if (text.includes("printer") || text.includes("impressora") || text.startsWith("prd-")) return "printer";
  if (text.includes("nvr") || text.includes("camera") || text.startsWith("cam-")) return "camera_ip";
  if (text.includes("server") || text.includes("linux") || text.includes("srv-")) return "server";
  return "desktop";
}

function backupMetadata(metadata) {
  return {
    isBackup: Boolean(metadata?.isBackup),
    backupStatus: metadata?.backupStatus || "available",
    backupOrderId: metadata?.backupOrderId || null,
    backupOriginalSegmentId: metadata?.backupOriginalSegmentId || null,
    backupOriginalSegmentName: metadata?.backupOriginalSegmentName || null
  };
}

function enrichDevice(host, inventory, segment, metadata) {
  const assetType = metadata?.assetType || inferAssetType(host, inventory);

  return {
    id: host.id,
    name: host.name,
    source: "ocs",
    assetType,
    type: assetType,
    ip: host.ip,
    status: host.status,
    statusLabel: normalizeStatus(host.status),
    segmentId: segment?.segmentId || DEFAULT_SEGMENT_ID,
    segmentName: segment?.segmentName || DEFAULT_SEGMENT_NAME,
    segmentGroupId: segment?.segmentGroupId || "",
    ...backupMetadata(metadata),
    uptimeHours: host.uptimeHours,
    metrics: host.metrics,
    history: host.history,
    hardware: inventory
  };
}

function buildManualDevice(asset, segment, metadata) {
  const lastPingAt = asset.lastPingAt || new Date().toISOString();
  const assetType = metadata?.assetType || asset.type;

  return {
    id: asset.id,
    name: asset.name,
    source: "manual",
    assetType,
    type: assetType,
    ip: asset.ip,
    status: asset.status,
    statusLabel: normalizeStatus(asset.status),
    segmentId: segment?.segmentId || DEFAULT_SEGMENT_ID,
    segmentName: segment?.segmentName || DEFAULT_SEGMENT_NAME,
    segmentGroupId: segment?.segmentGroupId || "",
    ...backupMetadata(metadata),
    uptimeHours: asset.status === "online" ? 1 : 0,
    metrics: null,
    lastPingAt,
    pingMessage:
      asset.status === "online"
        ? "Ativo respondeu ao ultimo ping."
        : "Nao respondeu ao ping. Verifique se o IP mudou ou configure reserva DHCP.",
    history: [
      { time: "08:00", status: asset.status },
      { time: "09:00", status: asset.status },
      { time: "10:00", status: asset.status },
      { time: "11:00", status: asset.status }
    ],
    manualAsset: asset,
    hardware: {
      hostId: asset.id,
      manufacturer: asset.brand,
      model: asset.model,
      assetTag: asset.assetTag,
      serialNumber: asset.assetTag,
      loggedUser: "Nao aplicavel",
      macAddress: asset.macAddress,
      os: "Ativo de rede manual",
      cpuModel: "Nao aplicavel",
      cpuCores: null,
      ramGb: null,
      disks: [],
      peripherals: [],
      changeHistory: [],
      software: [],
      lastInventoryAt: asset.updatedAt
    }
  };
}

function agentStatus(asset) {
  const configuredThreshold = Math.max(60, Number(process.env.AGENT_OFFLINE_AFTER_SECONDS || 180));
  const thresholdSeconds = Math.max(configuredThreshold, Number(asset.intervalSeconds || 60) * 3);
  return Date.now() - new Date(asset.lastSeenAt).getTime() <= thresholdSeconds * 1000
    ? "online"
    : "offline";
}

function buildAgentDevice(asset, segment, metadata) {
  const status = agentStatus(asset);
  const diskUsedPercent =
    asset.diskTotalBytes > 0 && asset.diskFreeBytes != null
      ? Math.round(((asset.diskTotalBytes - asset.diskFreeBytes) / asset.diskTotalBytes) * 100)
      : null;

  return {
    id: asset.id,
    name: asset.machineAlias || asset.hostname,
    source: "agent",
    assetType: metadata?.assetType || "desktop",
    type: metadata?.assetType || "desktop",
    ip: asset.localIp || "Nao informado",
    status,
    statusLabel: normalizeStatus(status),
    segmentId: segment?.segmentId || DEFAULT_SEGMENT_ID,
    segmentName: segment?.segmentName || asset.segment || DEFAULT_SEGMENT_NAME,
    segmentGroupId: segment?.segmentGroupId || "",
    ...backupMetadata(metadata),
    uptimeHours: asset.uptimeSeconds == null ? null : Math.floor(asset.uptimeSeconds / 3600),
    metrics: diskUsedPercent == null ? null : { cpu: null, ram: null, disk: diskUsedPercent },
    history: [],
    lastSeenAt: asset.lastSeenAt,
    agent: asset,
    hardware: {
      hostId: asset.id,
      manufacturer: "Coletado pelo agente",
      model: asset.cpuModel || "Nao informado",
      assetTag: null,
      serialNumber: null,
      loggedUser: asset.loggedUser || "Coleta desativada",
      macAddress: asset.macAddress,
      os: [asset.operatingSystem, asset.windowsVersion, asset.osArchitecture].filter(Boolean).join(" - "),
      cpuModel: asset.cpuModel,
      cpuCores: null,
      ramGb: asset.memoryTotalBytes == null
        ? null
        : Math.round((asset.memoryTotalBytes / 1024 ** 3) * 10) / 10,
      disks: asset.diskTotalBytes == null
        ? []
        : [{
            name: "Disco do sistema",
            totalBytes: asset.diskTotalBytes,
            freeBytes: asset.diskFreeBytes
          }],
      peripherals: [],
      changeHistory: [],
      software: [],
      lastInventoryAt: asset.collectedAt
    }
  };
}

function mergeAgentDevice(baseDevice, agentDevice) {
  if (!baseDevice) return agentDevice;
  return {
    ...baseDevice,
    ...agentDevice,
    source: "agent",
    upstreamSource: baseDevice.source,
    assetType: baseDevice.assetType || agentDevice.assetType,
    type: baseDevice.type || agentDevice.type,
    segmentId: baseDevice.segmentId || agentDevice.segmentId,
    segmentName: baseDevice.segmentName || agentDevice.segmentName,
    segmentGroupId: baseDevice.segmentGroupId || agentDevice.segmentGroupId,
    hardware: {
      ...baseDevice.hardware,
      ...agentDevice.hardware,
      peripherals: baseDevice.hardware?.peripherals || [],
      software: baseDevice.hardware?.software || []
    }
  };
}

export async function listDevices({ search = "", status = "" }) {
  const [hosts, inventory, deviceSegments, metadataMap, manualAssets, agentAssets] = await Promise.all([
    getHosts(),
    getInventory(),
    listDeviceSegmentMap(),
    listDeviceMetadataMap(),
    listManualAssets(),
    listAgentAssets()
  ]);
  const term = search.trim().toLowerCase();

  const baseDevices = [
    ...hosts
      .filter((host) => !metadataMap.get(host.id)?.removedAt)
      .map((host) =>
        enrichDevice(
          host,
          inventory.find((item) => item.hostId === host.id),
          deviceSegments.get(host.id),
          metadataMap.get(host.id)
        )
      ),
    ...manualAssets.map((asset) => buildManualDevice(asset, deviceSegments.get(asset.id), metadataMap.get(asset.id)))
  ];
  const devicesById = new Map(baseDevices.map((device) => [String(device.id), device]));
  for (const asset of agentAssets) {
    const agentDevice = buildAgentDevice(asset, deviceSegments.get(asset.id), metadataMap.get(asset.id));
    devicesById.set(String(asset.id), mergeAgentDevice(devicesById.get(String(asset.id)), agentDevice));
  }
  const devices = Array.from(devicesById.values());
  const automationIndicatorsByAsset = await listAutomationIndicatorsByAssetIds(devices.map((device) => device.id));

  return devices
    .map((device) => ({
      ...device,
      automationIndicators: automationIndicatorsByAsset.get(String(device.id)) || []
    }))
    .filter((device) => {
      const searchable = [
        device.name,
        device.ip,
        device.status,
        device.statusLabel,
        device.segmentName,
        device.assetType,
        device.hardware?.manufacturer,
        device.hardware?.model,
        device.hardware?.assetTag,
        device.hardware?.serialNumber,
        device.hardware?.macAddress,
        device.manualAsset?.hostname,
        device.manualAsset?.location,
        device.manualAsset?.notes,
        device.agent?.agentVersion,
        device.agent?.operatingSystem,
        device.agent?.windowsVersion,
        device.agent?.environment,
        device.agent?.group
      ].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch =
        !term ||
        searchable.includes(term);

      const matchesStatus = !status || device.status === status;
      return matchesSearch && matchesStatus;
    });
}

export async function getDeviceDetails(id) {
  const [host, inventory, alerts, deviceSegments, metadata, automationIndicatorsByAsset, agentAsset] = await Promise.all([
    getHostById(id),
    getInventoryByHostId(id),
    getHostAlertsWithAcknowledgements(id),
    listDeviceSegmentMap(),
    findDeviceMetadata(id),
    listAutomationIndicatorsByAssetIds([id]),
    findAgentAssetById(id)
  ]);
  const automationIndicators = automationIndicatorsByAsset.get(String(id)) || [];

  if (host) {
    if (metadata?.removedAt) return null;

    const hostDevice = enrichDevice(host, inventory, deviceSegments.get(host.id), metadata);
    const device = agentAsset
      ? mergeAgentDevice(hostDevice, buildAgentDevice(agentAsset, deviceSegments.get(id), metadata))
      : hostDevice;
    return {
      ...device,
      automationIndicators,
      assetHistory: await listAssetHistory(id),
      alerts
    };
  }

  const manualAsset = await findManualAssetById(id);

  if (!manualAsset && !agentAsset) {
    return null;
  }

  const baseDevice = manualAsset
    ? buildManualDevice(manualAsset, deviceSegments.get(manualAsset.id), metadata)
    : null;
  const device = agentAsset
    ? mergeAgentDevice(baseDevice, buildAgentDevice(agentAsset, deviceSegments.get(id), metadata))
    : baseDevice;

  return {
    ...device,
    automationIndicators,
    assetHistory: await listAssetHistory(id),
    alerts: []
  };
}

export async function getDashboardSummary() {
  const [devices, alerts] = await Promise.all([listDevices({}), getAlertHistory()]);
  const activeAlerts = alerts.filter((alert) => alert.status === "active");

  return {
    totalDevices: devices.length,
    online: devices.filter((device) => device.status === "online").length,
    offline: devices.filter((device) => device.status === "offline").length,
    problem: devices.filter((device) => device.status === "problem").length,
    criticalAlerts: activeAlerts.filter((alert) => alert.severity === "critical").length,
    activeAlerts: activeAlerts.length
  };
}
