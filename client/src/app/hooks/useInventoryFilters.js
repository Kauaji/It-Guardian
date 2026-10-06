import { useEffect, useMemo, useState } from "react";
import { buildSearchSegments, filterInventoryDevices } from "../inventory/inventoryModel.js";

// Busca, grupo e segmento selecionados no inventario, mais as listas que a
// tela efetivamente mostra (todas as abas quando ha busca ativa).
export function useInventoryFilters({ model, persistence }) {
  const { activeSegmentGroups, activeSegments, activeAllDevices, decoratedAllDevices, decoratedSegmentGroups, decoratedSegments } = model;
  const { inventoryTabs, machineAliases } = persistence;
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedInventoryGroup, setSelectedInventoryGroup] = useState("all");
  const [selectedInventorySegment, setSelectedInventorySegment] = useState("all");

  const inventorySearchActive = Boolean(inventorySearch.trim());
  const inventorySearchSegments = useMemo(
    () => buildSearchSegments(decoratedAllDevices, decoratedSegments),
    [decoratedAllDevices, decoratedSegments]
  );
  const inventoryViewDevices = inventorySearchActive ? decoratedAllDevices : activeAllDevices;
  const inventoryViewSegments = inventorySearchActive ? inventorySearchSegments : activeSegments;
  const inventoryViewGroups = inventorySearchActive ? decoratedSegmentGroups : activeSegmentGroups;
  const inventorySegmentById = useMemo(
    () => new Map(inventoryViewSegments.map((segment) => [segment.id, segment])),
    [inventoryViewSegments]
  );
  const inventoryGroupById = useMemo(() => new Map(inventoryViewGroups.map((group) => [group.id, group])), [inventoryViewGroups]);
  const inventoryTabById = useMemo(() => new Map(inventoryTabs.map((tab) => [tab.id, tab])), [inventoryTabs]);
  const filteredInventoryDevices = useMemo(
    () =>
      filterInventoryDevices({
        devices: inventoryViewDevices,
        groupById: inventoryGroupById,
        groups: decoratedSegmentGroups,
        machineAliases,
        searchTerm: inventorySearch,
        segmentById: inventorySegmentById,
        tabById: inventoryTabById
      }),
    [
      decoratedSegmentGroups,
      inventoryGroupById,
      inventorySearch,
      inventorySegmentById,
      inventoryTabById,
      inventoryViewDevices,
      machineAliases
    ]
  );

  useEffect(() => {
    if (selectedInventorySegment === "all") return;

    const segment = activeSegments.find((item) => item.id === selectedInventorySegment);

    if (!segment) {
      setSelectedInventorySegment("all");
    }
  }, [activeSegments, selectedInventorySegment]);

  useEffect(() => {
    if (selectedInventoryGroup === "all" || selectedInventoryGroup === "ungrouped") return;

    if (!activeSegmentGroups.some((group) => group.id === selectedInventoryGroup)) {
      setSelectedInventoryGroup("all");
      setSelectedInventorySegment("all");
    }
  }, [activeSegmentGroups, selectedInventoryGroup]);

  function selectInventoryGroup(groupId) {
    setSelectedInventoryGroup(groupId);
    setSelectedInventorySegment("all");
  }

  function selectInventorySegment(segmentId) {
    setSelectedInventorySegment(segmentId);

    if (segmentId === "all") {
      setSelectedInventoryGroup("all");
      return;
    }

    const segment = activeSegments.find((item) => item.id === segmentId);
    if (segment) {
      setSelectedInventoryGroup(segment.groupId || "ungrouped");
    }
  }

  function resetInventoryFilters() {
    setSelectedInventoryGroup("all");
    setSelectedInventorySegment("all");
    setInventorySearch("");
  }

  return {
    filteredInventoryDevices,
    inventorySearch,
    inventorySearchActive,
    inventoryViewDevices,
    inventoryViewGroups,
    inventoryViewSegments,
    resetInventoryFilters,
    selectInventoryGroup,
    selectInventorySegment,
    selectedInventoryGroup,
    selectedInventorySegment,
    setInventorySearch,
    setSelectedInventoryGroup,
    setSelectedInventorySegment
  };
}
