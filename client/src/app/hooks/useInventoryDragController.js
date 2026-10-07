import { useRef, useState } from "react";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { getSegmentGroupId } from "../../components/inventory/inventoryUtils.js";
import { useInventoryDragAndDrop } from "../../components/inventory/useInventoryDragAndDrop.js";
import { findSegmentById } from "../inventory/inventoryModel.js";

// Orquestra o arrastar-e-soltar do inventario: alvo na sidebar, overlay,
// movimentacao de ativos e de segmentos entre grupos e a rolagem de retorno.
export function useInventoryDragController({ activeView, data, inventory, moves, segmentMutations, sidebar }) {
  const { notify } = useAppSession();
  const { filters, model, selection } = inventory;
  const { activeAllDevices, activeSegmentGroups, activeSegments } = model;
  const [activeDragMachine, setActiveDragMachine] = useState(null);
  const [activeDragSegment, setActiveDragSegment] = useState(null);
  const dragStartScrollY = useRef(0);

  const {
    handleDragEnd: handleInventoryDragEnd,
    machinesBySegment,
    sensors
  } = useInventoryDragAndDrop({
    devices: filters.inventoryViewDevices,
    filteredDevices: filters.filteredInventoryDevices,
    segments: filters.inventoryViewSegments,
    selectedAssetIds: selection.selectedAssetIds,
    onMoveMachine: moves.handleMoveMachine,
    onMoveMachines: moves.handleMoveMachines
  });

  function handleDragStart(event) {
    if (activeView !== "inventory") return;

    const machineId = event.active?.data?.current?.machineId;
    const segmentId = event.active?.data?.current?.segmentId;
    const activeType = event.active?.data?.current?.type;
    window.dispatchEvent(new CustomEvent("it-guardian:close-popovers"));
    document.body.classList.add("is-inventory-dragging");
    dragStartScrollY.current = window.scrollY;
    sidebar.beginDrag();
    setActiveDragMachine(activeType === "machine" ? activeAllDevices.find((device) => device.id === machineId) || null : null);
    setActiveDragSegment(activeType === "segment" ? activeSegments.find((segment) => segment.id === segmentId) || null : null);
    if (machineId && !selection.selectedAssetIds.has(machineId)) {
      selection.selectOnly(machineId);
    }
  }

  function handleDragCancel({ forceCollapse = false } = {}) {
    document.body.classList.remove("is-inventory-dragging");
    setActiveDragMachine(null);
    setActiveDragSegment(null);
    sidebar.endDrag({ forceCollapse });
  }

  function animateScrollForDrop(result) {
    if (!result?.moved) return;

    const target = document.getElementById(`inventory-segment-${result.targetSegmentId}`);

    if (target) {
      window.setTimeout(() => {
        target.classList.add("drop-confirm-highlight");
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 110);

      window.setTimeout(() => {
        target.classList.remove("drop-confirm-highlight");
      }, 1150);
    }

    window.setTimeout(
      () => {
        window.scrollTo({ top: dragStartScrollY.current, behavior: "smooth" });
      },
      target ? 920 : 260
    );
  }

  // Soltar um segmento sobre um grupo (area principal ou sidebar) o move.
  function dropSegmentOnGroup(event, overType) {
    const segmentId = event.active?.data?.current?.segmentId;
    const groupId = event.over?.data?.current?.groupId;

    if (!segmentId || (overType !== "segment-group-drop" && overType !== "sidebar-segment-group-drop") || groupId === undefined) {
      return null;
    }

    const segment = findSegmentById(segmentId, activeSegments, data.segments);
    const currentGroupId = getSegmentGroupId(segment, activeSegmentGroups);
    if (!segment || segment.isDefault || currentGroupId === groupId) return null;

    segmentMutations.moveSegmentToGroup(segmentId, groupId);
    notify(
      groupId
        ? `${segment.name} movido para ${activeSegmentGroups.find((group) => group.id === groupId)?.name || "grupo"}.`
        : `${segment.name} movido para Sem grupo.`,
      "ok"
    );
    return { moved: true, targetSegmentId: segmentId };
  }

  function handleBoardDragEnd(event) {
    let result = null;
    let droppedViaSidebar = false;
    if (activeView === "inventory") {
      const activeType = event.active?.data?.current?.type;
      const overType = event.over?.data?.current?.type;
      droppedViaSidebar = overType === "sidebar-segment" || overType === "sidebar-segment-group-drop";

      result = activeType === "segment" ? dropSegmentOnGroup(event, overType) : handleInventoryDragEnd(event);
    }
    handleDragCancel({ forceCollapse: droppedViaSidebar });
    animateScrollForDrop(result);
  }

  const activeDragSegmentGroupId = activeDragSegment ? getSegmentGroupId(activeDragSegment, activeSegmentGroups) : "";
  const activeDragSegmentGroupName = activeDragSegmentGroupId
    ? activeSegmentGroups.find((group) => group.id === activeDragSegmentGroupId)?.name || ""
    : "Sem grupo";
  const activeDragSegmentCount = activeDragSegment
    ? activeAllDevices.filter((device) => device.segmentId === activeDragSegment.id).length
    : 0;

  return {
    activeDragMachine,
    activeDragSegment,
    activeDragSegmentCount,
    activeDragSegmentGroupName,
    handleDragCancel,
    handleDragEnd: handleBoardDragEnd,
    handleDragStart,
    machinesBySegment,
    sensors
  };
}
