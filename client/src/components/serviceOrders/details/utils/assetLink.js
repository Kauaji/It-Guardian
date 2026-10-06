import { normalizeSearchText } from "./text.js";

// Filtros do assistente que vincula uma maquina do inventario a OS.

export function buildGroupOptions(segments, groups, tabId) {
  const groupById = new Map(groups.map((group) => [String(group.id), group]));
  const groupOptions = new Map();
  let hasUngroupedSegments = false;
  segments
    .filter((segment) => !segment.isDefault && (!tabId || segment.tabId === tabId))
    .forEach((segment) => {
      const groupId = segment.groupId || segment.group?.id || "";
      if (!groupId) {
        hasUngroupedSegments = true;
        return;
      }
      const group = groupById.get(String(groupId));
      groupOptions.set(String(groupId), {
        id: String(groupId),
        name: group?.name || segment.groupName || segment.group?.name || "Grupo sem nome"
      });
    });
  if (hasUngroupedSegments) {
    groupOptions.set("ungrouped", { id: "ungrouped", name: "Sem grupo" });
  }
  return [...groupOptions.values()].sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export function filterSegmentsForLink(segments, { tabId, groupId }) {
  return segments.filter((segment) => {
    if (segment.isDefault) return false;
    if (tabId && segment.tabId !== tabId) return false;
    if (groupId) {
      const segmentGroupId = segment.groupId || segment.group?.id || "ungrouped";
      if (String(segmentGroupId) !== groupId) return false;
    }
    return true;
  });
}

export function filterDevicesForLink(devices, segments, linkDraft) {
  const segmentById = new Map(segments.map((segment) => [segment.id, segment]));
  const term = normalizeSearchText(linkDraft.search);
  return devices.filter((device) => {
    if (linkDraft.tabId && device.tabId !== linkDraft.tabId && !device.isGlobalUnorganized) return false;
    if (linkDraft.segmentId && device.segmentId !== linkDraft.segmentId) return false;
    if (linkDraft.groupId) {
      const deviceSegment = segmentById.get(device.segmentId);
      const deviceGroupId = device.groupId || device.segmentGroupId || device.group?.id || deviceSegment?.groupId || deviceSegment?.group?.id || "ungrouped";
      if (String(deviceGroupId) !== linkDraft.groupId) return false;
    }
    if (!term) return true;
    return normalizeSearchText([device.name, device.ip, device.statusLabel, device.segmentName, device.groupName, device.segmentGroupName]
      .filter(Boolean)
      .join(" "))
      .includes(term);
  });
}

/** Maquinas Backup livres: nao em uso, nem a principal, nem o backup ja vinculado. */
export function filterAvailableBackups(devices, serviceOrder) {
  return devices.filter(
    (device) =>
      device.isBackup &&
      device.backupStatus !== "in_use" &&
      device.id !== serviceOrder?.assetId &&
      device.id !== serviceOrder?.backupAssetId
  );
}

export const emptyLinkDraft = { tabId: "", groupId: "", segmentId: "", search: "" };
