import { useEffect, useMemo } from "react";
import { defaultInventoryTab } from "../../components/inventory/inventoryLocalState.js";
import { getOccupiedInventorySegmentIds } from "../../components/inventory/inventoryBoardSections.js";
import { decorateDevices, decorateSegmentGroups, decorateSegments, selectActiveSegments } from "../inventory/inventoryModel.js";

// Modelo de inventario derivado: abas, grupos/segmentos/ativos "decorados"
// com a aba local de cada um e as listas da aba ativa.
export function useInventoryModel({ data, persistence }) {
  const { activeInventoryTabId, inventoryTabMeta, inventoryTabs, machineAliases, setActiveInventoryTabId } = persistence;
  const { allDevices, devices, segmentGroups, segments } = data;

  const fallbackInventoryTabId = inventoryTabs[0]?.id || defaultInventoryTab.id;
  const activeInventoryTab = inventoryTabs.find((tab) => tab.id === activeInventoryTabId) || inventoryTabs[0] || defaultInventoryTab;

  const decoratedSegmentGroups = useMemo(
    () => decorateSegmentGroups(segmentGroups, inventoryTabMeta, fallbackInventoryTabId),
    [fallbackInventoryTabId, inventoryTabMeta, segmentGroups]
  );
  const decoratedSegments = useMemo(
    () => decorateSegments(segments, inventoryTabMeta, fallbackInventoryTabId),
    [fallbackInventoryTabId, inventoryTabMeta, segments]
  );
  const defaultSegmentIds = useMemo(
    () => new Set(decoratedSegments.filter((segment) => segment.isDefault).map((segment) => segment.id)),
    [decoratedSegments]
  );
  const decoratedAllDevices = useMemo(
    () =>
      decorateDevices(allDevices, {
        defaultSegmentIds,
        fallbackTabId: fallbackInventoryTabId,
        machineAliases,
        meta: inventoryTabMeta
      }),
    [allDevices, defaultSegmentIds, fallbackInventoryTabId, inventoryTabMeta, machineAliases]
  );
  const activeAllDevices = useMemo(
    () =>
      decoratedAllDevices.filter((device) => device.isGlobalBackup || device.isGlobalUnorganized || device.tabId === activeInventoryTab.id),
    [activeInventoryTab.id, decoratedAllDevices]
  );
  const occupiedActiveSegmentIds = useMemo(() => getOccupiedInventorySegmentIds({ devices: activeAllDevices }), [activeAllDevices]);
  const activeSegmentGroups = useMemo(
    () => decoratedSegmentGroups.filter((group) => group.tabId === activeInventoryTab.id),
    [activeInventoryTab.id, decoratedSegmentGroups]
  );
  const activeSegments = useMemo(
    () =>
      selectActiveSegments({
        activeTabId: activeInventoryTab.id,
        decoratedAllDevices,
        decoratedSegments,
        occupiedSegmentIds: occupiedActiveSegmentIds
      }),
    [activeInventoryTab.id, occupiedActiveSegmentIds, decoratedAllDevices, decoratedSegments]
  );

  useEffect(() => {
    if (!inventoryTabs.some((tab) => tab.id === activeInventoryTabId)) {
      setActiveInventoryTabId(fallbackInventoryTabId);
    }
  }, [activeInventoryTabId, fallbackInventoryTabId, inventoryTabs]);

  function findDecoratedDevice(deviceId) {
    return (
      decoratedAllDevices.find((device) => device.id === deviceId) ||
      allDevices.find((device) => device.id === deviceId) ||
      devices.find((device) => device.id === deviceId)
    );
  }

  return {
    activeAllDevices,
    activeInventoryTab,
    activeSegmentGroups,
    activeSegments,
    decoratedAllDevices,
    decoratedSegmentGroups,
    decoratedSegments,
    fallbackInventoryTabId,
    findDecoratedDevice,
    inventoryTabs
  };
}
