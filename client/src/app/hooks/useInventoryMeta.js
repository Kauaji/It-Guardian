import { assignDevicesToTab, mergeInventoryMeta } from "../inventory/inventoryMeta.js";

// Atualiza o metadado local (aba/ordem) de grupos, segmentos e ativos.
export function useInventoryMeta({ model, persistence }) {
  const { saveInventoryTabMeta } = persistence;
  const { activeInventoryTab } = model;

  function updateInventoryMeta(kind, id, updates) {
    if (!id) return;

    saveInventoryTabMeta((current) => mergeInventoryMeta(current, kind, id, updates));
  }

  function updateDeviceTabOwnership(deviceIds, targetSegment, targetTabId = activeInventoryTab.id) {
    saveInventoryTabMeta((current) => assignDevicesToTab(current, deviceIds, targetSegment, targetTabId));
  }

  return { updateDeviceTabOwnership, updateInventoryMeta };
}
