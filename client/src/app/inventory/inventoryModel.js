import { backupSegmentId, backupSegmentName } from "../../components/inventory/inventoryLocalState.js";
import { formatSoftwareLabel } from "../../components/inventory/hardwarePresentation.js";
import { isMaintenanceSegmentName } from "../../utils/display.js";

// Funcoes puras que montam o modelo de inventario (grupos, segmentos e
// dispositivos "decorados" com aba/ordem locais). Extraidas do antigo
// Dashboard para poderem ser testadas sem React.

export function readItemTabId(meta, kind, id, fallbackTabId) {
  return meta[kind]?.[id]?.tabId || fallbackTabId;
}

export function readItemOrder(meta, kind, id, fallback) {
  const order = meta[kind]?.[id]?.order;
  return Number.isFinite(order) ? order : fallback;
}

export function decorateSegmentGroups(groups, meta, fallbackTabId) {
  return groups
    .map((group, index) => ({
      ...group,
      tabId: readItemTabId(meta, "groups", group.id, fallbackTabId),
      order: readItemOrder(meta, "groups", group.id, index)
    }))
    .sort((left, right) => left.order - right.order);
}

export function decorateSegments(segments, meta, fallbackTabId) {
  return segments
    .map((segment, index) => ({
      ...segment,
      tabId:
        segment.isDefault || isMaintenanceSegmentName(segment.name)
          ? "shared"
          : readItemTabId(meta, "segments", segment.id, fallbackTabId),
      order: readItemOrder(meta, "segments", segment.id, index)
    }))
    .sort((left, right) => left.order - right.order);
}

export function decorateDevices(devices, { defaultSegmentIds, fallbackTabId, machineAliases, meta }) {
  return devices.map((device, index) => {
    const isAvailableBackup = Boolean(device.isBackup) && device.backupStatus !== "in_use";
    const rawSegmentId = device.segmentId;
    const rawSegmentName = device.segmentName;
    const isGlobalUnorganized = !isAvailableBackup && defaultSegmentIds.has(rawSegmentId);
    const displayName =
      machineAliases[device.id]?.trim() ||
      device.machineAlias ||
      device.agent?.machineAlias ||
      device.name ||
      device.hostname ||
      device.id;
    const technicalName = device.name || device.hostname || device.agent?.hostname || device.id;

    return {
      ...device,
      name: displayName,
      displayName,
      technicalName,
      backupRealSegmentId: device.backupOriginalSegmentId || rawSegmentId,
      backupRealSegmentName: device.backupOriginalSegmentName || rawSegmentName,
      segmentId: isAvailableBackup ? backupSegmentId : rawSegmentId,
      segmentName: isAvailableBackup ? backupSegmentName : rawSegmentName,
      tabId: isAvailableBackup
        ? "global-backup"
        : isGlobalUnorganized
          ? "global-unorganized"
          : readItemTabId(meta, "devices", device.id, fallbackTabId),
      isGlobalBackup: isAvailableBackup,
      isGlobalUnorganized,
      order: readItemOrder(meta, "devices", device.id, index)
    };
  });
}

// Segmento virtual "Backup": so existe quando ha ao menos um ativo reserva.
export function buildBackupSegment(devices) {
  return devices.some((device) => device.isBackup)
    ? [{
        id: backupSegmentId,
        name: backupSegmentName,
        color: "#f59e0b",
        isDefault: true,
        isBackupSegment: true,
        tabId: "shared",
        order: -1
      }]
    : [];
}

export function selectActiveSegments({
  activeTabId,
  decoratedAllDevices,
  decoratedSegments,
  occupiedSegmentIds
}) {
  const activeNonDefaultSegments = decoratedSegments.filter(
    (segment) =>
      !segment.isDefault &&
      (segment.tabId === activeTabId || isMaintenanceSegmentName(segment.name)) &&
      (!isMaintenanceSegmentName(segment.name) || occupiedSegmentIds.has(segment.id))
  );
  // "Nao organizadas" e compartilhado entre abas (por isso fora do filtro de
  // tabId acima) - mesma logica do segmento de manutencao: so aparece quando
  // tem pelo menos uma maquina de verdade nele. Checa contra a lista de
  // dispositivos ao vivo (nao segment.machineCount, que vem de uma chamada
  // separada e pode ficar defasado) - useInventoryDragAndDrop reaproveita
  // esse mesmo array pra montar machinesBySegment, entao os dois ficam
  // sempre em sincronia.
  const sharedDefaultSegments = decoratedSegments.filter(
    (segment) => segment.isDefault && decoratedAllDevices.some((device) => device.segmentId === segment.id)
  );

  return [...buildBackupSegment(decoratedAllDevices), ...sharedDefaultSegments, ...activeNonDefaultSegments];
}

export function buildSearchSegments(decoratedAllDevices, decoratedSegments) {
  return [...buildBackupSegment(decoratedAllDevices), ...decoratedSegments];
}

function deviceSearchValues(device, { aliasOf, group, segment, tab }) {
  const hardware = device.hardware;
  const manual = device.manualAsset;
  return [
    device.name,
    aliasOf,
    device.ip,
    device.statusLabel,
    device.segmentName,
    segment?.name,
    group?.name,
    tab?.name,
    device.assetType,
    device.type,
    device.source,
    manual?.brand,
    manual?.model,
    manual?.assetTag,
    manual?.macAddress,
    manual?.hostname,
    manual?.location,
    hardware?.os,
    hardware?.manufacturer,
    hardware?.model,
    hardware?.assetTag,
    hardware?.serialNumber,
    hardware?.macAddress,
    (Array.isArray(hardware?.software) ? hardware.software : []).map(formatSoftwareLabel).join(" ")
  ];
}

// Aplica a busca textual do inventario. Sem termo, devolve uma copia da lista
// original; com termo, acrescenta `inventorySearchTabName` a cada achado.
export function filterInventoryDevices({
  devices,
  groupById,
  groups,
  machineAliases,
  searchTerm,
  segmentById,
  tabById
}) {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return [...devices];

  return devices.flatMap((device) => {
    const segment = segmentById.get(device.segmentId);
    const groupId =
      segment?.groupId ||
      groups.find((item) => (item.segmentIds || []).includes(device.segmentId))?.id;
    const group = groupId ? groupById.get(groupId) : null;
    const tab = tabById.get(device.tabId);

    const matches = deviceSearchValues(device, {
      aliasOf: machineAliases[device.id],
      group,
      segment,
      tab
    })
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));

    return matches
      ? [{
          ...device,
          inventorySearchTabName: tab?.name || (device.isGlobalBackup ? "Backup" : "Não organizadas")
        }]
      : [];
  });
}

// Procura um segmento por id em listas na ordem informada (cada chamada do
// App original tinha uma ordem propria de fallback, preservada via argumento).
export function findSegmentById(segmentId, ...lists) {
  for (const list of lists) {
    const found = list.find((segment) => segment.id === segmentId);
    if (found) return found;
  }
  return undefined;
}
