import {
  findSuggestionDevice as findSuggestionDeviceInList,
  formatCompactSuggestionTitle,
  formatDisplayText,
  getDeviceDisplayName,
  getSuggestionMachineLabel,
  normalizeText
} from "./alertUtils.js";

function indexById(items) {
  return new Map(items.map((item) => [String(item.id), item]));
}

// Resolve maquina, localizacao e rotulos de avisos/sugestoes a partir do
// inventario (dispositivos, segmentos, grupos e abas).
export function createAlertLookups({ devices = [], segments = [], segmentGroups = [], inventoryTabs = [] } = {}) {
  const deviceById = indexById(devices);
  const segmentById = indexById(segments);
  const groupById = indexById(segmentGroups);
  const tabById = indexById(inventoryTabs);

  function findAlertDevice(alert) {
    const identifiers = [alert.assetId, alert.hostId, alert.hostName].filter(Boolean).map(String);

    for (const id of identifiers) {
      if (deviceById.has(id)) return deviceById.get(id);
    }

    const hostLabel = normalizeText(alert.hostName || "");
    return (
      devices.find((device) => {
        const names = [
          device.id,
          device.displayName,
          device.machineAlias,
          device.agent?.machineAlias,
          device.name,
          device.hostname,
          device.agent?.hostname,
          device.manualAsset?.hostname,
          device.hardware?.hostname
        ]
          .filter(Boolean)
          .map(normalizeText);
        return names.includes(hostLabel);
      }) || null
    );
  }

  function findSuggestionDevice(suggestion) {
    return findSuggestionDeviceInList(suggestion, devices);
  }

  function getDeviceLocation(device) {
    const segment = device?.segmentId ? segmentById.get(String(device.segmentId)) : null;
    const groupId = segment?.groupId || device?.segmentGroupId || "";
    const group = groupId ? groupById.get(String(groupId)) : null;

    return {
      segmentName: formatDisplayText(segment?.name || device?.segmentName, "Não organizadas"),
      groupName: formatDisplayText(group?.name, "Sem grupo")
    };
  }

  function getAlertLocation(alert) {
    return getDeviceLocation(findAlertDevice(alert));
  }

  function getSuggestionLocation(suggestion) {
    return getDeviceLocation(findSuggestionDevice(suggestion));
  }

  function getDevicePreventiveLocation(device) {
    const segment = device?.segmentId ? segmentById.get(String(device.segmentId)) : null;
    const groupId = segment?.groupId || device?.segmentGroupId || "";
    const group = groupId ? groupById.get(String(groupId)) : null;
    const tabId = device?.tabId || segment?.tabId || group?.tabId || "";
    const tab = tabId ? tabById.get(String(tabId)) : null;

    return {
      tabName: tab?.name || device?.tabName || device?.environment || "Ambiente atual",
      groupName: group?.name || "Sem grupo",
      segmentName: segment?.name || device?.segmentName || "Não organizadas",
      segmentId: segment?.id || device?.segmentId || "unorganized"
    };
  }

  function getAlertMachineLabel(alert) {
    const device = findAlertDevice(alert);
    return device ? getDeviceDisplayName(device) : formatDisplayText(alert.hostName || alert.assetId, "Máquina não vinculada");
  }

  function getResolvedAlertTitle(alert) {
    const title = formatDisplayText(alert.title, "Aviso");
    const originalName = formatDisplayText(alert.hostName, "");
    const resolvedName = formatDisplayText(getAlertMachineLabel(alert), "");
    if (!originalName || !resolvedName || originalName === resolvedName) return title;
    return title.split(originalName).join(resolvedName);
  }

  function getResolvedSuggestionMachineLabel(suggestion) {
    const device = findSuggestionDevice(suggestion);
    return device
      ? getDeviceDisplayName(device)
      : formatDisplayText(suggestion.machineAlias || getSuggestionMachineLabel(suggestion), "Máquina não vinculada");
  }

  function getResolvedSuggestionTitle(suggestion) {
    const resolvedName = String(getResolvedSuggestionMachineLabel(suggestion) || "");
    return formatDisplayText(formatCompactSuggestionTitle(suggestion, resolvedName), "Aviso preventivo");
  }

  return {
    devices,
    findAlertDevice,
    findSuggestionDevice,
    getAlertLocation,
    getSuggestionLocation,
    getDevicePreventiveLocation,
    getAlertMachineLabel,
    getResolvedAlertTitle,
    getResolvedSuggestionMachineLabel,
    getResolvedSuggestionTitle
  };
}
