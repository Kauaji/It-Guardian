import { useEffect, useState } from "react";

// Estado de interface do quadro: maquina aberta, popover, modo de visualizacao e
// segmentos selecionados, com os efeitos que os mantem coerentes.
export default function useInventoryBoardState({ devices, activeTabId, selectedGroupId, selectedSegmentId, floorPlansView, topologyView }) {
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [activePopoverId, setActivePopoverId] = useState(null);
  const [inventoryViewMode, setInventoryViewMode] = useState(() =>
    window.location.pathname.startsWith("/plantas") ? "floor-plans" : "board"
  );
  const [selectedSegmentIds, setSelectedSegmentIds] = useState(new Set());
  const [searchFocused, setSearchFocused] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!activePopoverId) return undefined;

    function closeActivePopover(event) {
      if (!event.key || event.key === "Escape") {
        setActivePopoverId(null);
      }
    }

    document.addEventListener("click", closeActivePopover);
    document.addEventListener("keydown", closeActivePopover);
    return () => {
      document.removeEventListener("click", closeActivePopover);
      document.removeEventListener("keydown", closeActivePopover);
    };
  }, [activePopoverId]);

  useEffect(() => {
    function closeActivePopover() {
      setActivePopoverId(null);
    }

    window.addEventListener("it-guardian:close-popovers", closeActivePopover);
    return () => window.removeEventListener("it-guardian:close-popovers", closeActivePopover);
  }, []);

  useEffect(() => {
    function openInventoryBoard(event) {
      setInventoryViewMode("board");
      const assetId = event?.detail?.assetId;
      if (assetId) setSelectedMachine(devices.find((device) => device.id === assetId) || null);
    }
    window.addEventListener("it-guardian:open-inventory-board", openInventoryBoard);
    return () => window.removeEventListener("it-guardian:open-inventory-board", openInventoryBoard);
  }, [devices]);

  useEffect(() => {
    setActivePopoverId(null);
    setSelectedSegmentIds(new Set());
  }, [activeTabId, selectedGroupId, selectedSegmentId]);

  useEffect(() => {
    setActivePopoverId(null);
  }, [inventoryViewMode]);

  useEffect(() => {
    if (inventoryViewMode === "floor-plans" && !floorPlansView) {
      setInventoryViewMode("board");
    }
    if (inventoryViewMode === "topology" && !topologyView) {
      setInventoryViewMode("board");
    }
  }, [floorPlansView, inventoryViewMode, topologyView]);

  useEffect(() => {
    if (!selectedMachine) return undefined;

    document.body.classList.add("machine-details-open");
    setActivePopoverId(null);

    return () => {
      document.body.classList.remove("machine-details-open");
    };
  }, [selectedMachine]);

  function handleSelectSegment(segmentId, additive = false) {
    setSelectedSegmentIds((current) => {
      if (!additive) return new Set([segmentId]);
      const next = new Set(current);
      if (next.has(segmentId)) next.delete(segmentId);
      else next.add(segmentId);
      return next;
    });
  }

  return {
    selectedMachine,
    setSelectedMachine,
    activePopoverId,
    setActivePopoverId,
    inventoryViewMode,
    setInventoryViewMode,
    selectedSegmentIds,
    handleSelectSegment,
    searchFocused,
    setSearchFocused,
    filtersOpen,
    setFiltersOpen
  };
}
