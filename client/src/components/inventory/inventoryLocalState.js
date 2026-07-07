import { getSegmentGroupId } from "./inventoryUtils.js";
import { normalizeMaintenanceName } from "../../utils/display.js";

export const aliasKey = "it_guardian_machine_aliases";
export const observationsKey = "it_guardian_machine_observations";
export const peripheralRemovalsKey = "it_guardian_removed_peripherals";
export const peripheralHistoryKey = "it_guardian_peripheral_history";
export const inventoryTabsKey = "it_guardian_inventory_tabs";
export const activeInventoryTabKey = "it_guardian_active_inventory_tab";
export const inventoryTabMetaKey = "it_guardian_inventory_tab_meta";
export const maintenanceRecordsKey = "it_guardian_maintenance_records";

export const backupSegmentId = "system-backup";
export const backupSegmentName = "Backup";

export const defaultInventoryTab = {
  id: "tab-default",
  name: "Novo ambiente",
  color: "#2563eb",
  order: 0
};

export const segmentPalette = [
  "#2563eb",
  "#16a34a",
  "#7c3aed",
  "#0891b2",
  "#d97706",
  "#dc2626",
  "#ea580c",
  "#db2777"
];

export function pickSegmentColor(segments) {
  const lastColor = segments.filter((segment) => !segment.isDefault).at(-1)?.color;
  const index = Math.max(0, segments.filter((segment) => !segment.isDefault).length);
  const preferred = segmentPalette[index % segmentPalette.length];

  if (preferred !== lastColor) return preferred;
  return segmentPalette[(index + 1) % segmentPalette.length];
}

export function pickUnusedPaletteColor(items = []) {
  const usedColors = new Set(
    items
      .map((item) => item?.color?.toLowerCase())
      .filter(Boolean)
  );
  const unusedColor = segmentPalette.find((color) => !usedColors.has(color.toLowerCase()));

  return unusedColor || pickSegmentColor(items);
}

export function isReservedSegmentName(name = "") {
  const normalizedName = normalizeMaintenanceName(name).replace(/\s+/g, " ");
  return normalizedName === "manutencao" || normalizedName === "nao organizadas";
}

export function getNextInventoryTabName(tabs = []) {
  const usedNames = new Set(tabs.map((tab) => tab.name?.trim().toLowerCase()).filter(Boolean));
  if (!usedNames.has("novo ambiente")) return "Novo ambiente";

  let nextNumber = 2;
  while (usedNames.has(`novo ambiente ${nextNumber}`)) {
    nextNumber += 1;
  }
  return `Novo ambiente ${nextNumber}`;
}

export function readStoredJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

export function normalizeInventoryTabs(value) {
  const tabs = Array.isArray(value) && value.length ? value : [defaultInventoryTab];
  const normalized = [];

  for (const [index, tab] of tabs.entries()) {
    const requestedName = tab.name?.trim();
    const name =
      !requestedName || requestedName === "Sem nome"
        ? getNextInventoryTabName(normalized)
        : requestedName;

    normalized.push({
      ...defaultInventoryTab,
      ...tab,
      id: tab.id || `tab-${index}`,
      name,
      color: tab.color || segmentPalette[index % segmentPalette.length],
      order: Number.isFinite(tab.order) ? tab.order : index
    });
  }

  return normalized.sort((left, right) => left.order - right.order);
}

export function normalizeInventoryTabMeta(value) {
  return {
    groups: value?.groups || {},
    segments: value?.segments || {},
    devices: value?.devices || {}
  };
}

export function applySegmentGroups(segmentList, groups) {
  return segmentList.map((segment) => ({
    ...segment,
    groupId: getSegmentGroupId(segment, groups)
  }));
}

export function peripheralKey(peripheral) {
  return peripheral?.id || `${peripheral?.type || "item"}-${peripheral?.brand || ""}-${peripheral?.assetTag || ""}`;
}

export function applyInventoryLocalState(devices, removedPeripherals, peripheralHistory, maintenanceRecords = {}) {
  return devices.map((device) => {
    const removed = new Set(removedPeripherals[device.id] || []);
    const peripherals = device.hardware?.peripherals || [];
    const maintenanceRecord = maintenanceRecords[device.id];

    return {
      ...device,
      maintenance: Boolean(maintenanceRecord?.active),
      maintenanceOrigin: maintenanceRecord?.origin || null,
      assetHistory: [...(peripheralHistory[device.id] || []), ...(device.assetHistory || [])],
      hardware: {
        ...device.hardware,
        peripherals: peripherals.filter((peripheral) => !removed.has(peripheralKey(peripheral)))
      }
    };
  });
}
