import { DragOverlay } from "@dnd-kit/core";
import AssetDragCompactOverlay from "../../components/inventory/AssetDragCompactOverlay.jsx";
import BulkAssetLabelPrint from "../../components/inventory/BulkAssetLabelPrint.jsx";
import SegmentDragOverlay from "../../components/inventory/SegmentDragOverlay.jsx";
import { useInventory, useLayout } from "../context/workspaceContexts.js";
import { inventoryDropAnimation, keepDragOverlayNearCursor } from "./dragGeometry.js";

// Overlay do item arrastado e a area oculta de impressao de etiquetas em lote.
export default function InventoryDragLayer() {
  const { model, persistence, selection } = useInventory();
  const { bulkPrint, drag } = useLayout();
  const { activeDragMachine, activeDragSegment } = drag;
  const { selectedAssetIds } = selection;
  const machineSelected = Boolean(activeDragMachine && selectedAssetIds.has(activeDragMachine.id));

  return (
    <>
      <DragOverlay zIndex={1000} dropAnimation={inventoryDropAnimation} modifiers={[keepDragOverlayNearCursor]}>
        {activeDragMachine ? (
          <AssetDragCompactOverlay
            asset={activeDragMachine}
            segmentColor={model.activeSegments.find((segment) => segment.id === activeDragMachine?.segmentId)?.color}
            alias={activeDragMachine ? persistence.machineAliases[activeDragMachine.id] : ""}
            selected={machineSelected}
            selectionCount={machineSelected ? selectedAssetIds.size : 0}
          />
        ) : activeDragSegment ? (
          <SegmentDragOverlay
            segment={activeDragSegment}
            count={drag.activeDragSegmentCount}
            groupName={drag.activeDragSegmentGroupName}
          />
        ) : null}
      </DragOverlay>
      <BulkAssetLabelPrint
        assets={bulkPrint.bulkPrintAssets}
        aliases={persistence.machineAliases}
        onReadyToPrint={bulkPrint.handleBulkPrintReady}
      />
    </>
  );
}
