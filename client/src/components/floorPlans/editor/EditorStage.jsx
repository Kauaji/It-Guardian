import { lazy, Suspense } from "react";
import { Plus } from "lucide-react";
import { FloorPlanQuickActions } from "../FloorPlanEditorChrome.jsx";
import FloorPlanCanvas from "../canvas/FloorPlanCanvas.jsx";
import InfrastructureObjectPanel from "../infrastructure/InfrastructureObjectPanel.jsx";
import FloorPlanInspector from "../inspector/FloorPlanInspector.jsx";
import { DEFAULT_PLAN_SIZE } from "../utils/editorGeometry.js";
import { getSelectionActionState } from "../utils/selectionActions.js";
import { getZoomPercent } from "../utils/viewportGeometry.js";
import FloorPlanSelectionDock from "../viewer/FloorPlanSelectionDock.jsx";
import FloorPlanViewerControls from "../viewer/FloorPlanViewerControls.jsx";

const FloorPlanScene3D = lazy(() => import("../FloorPlanScene3D.jsx"));
const noop = () => {};

function ExpandButton({ axis, label, letter, onExpand }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={() => onExpand(axis)}>
      <Plus size={13} aria-hidden="true" />
      <span>{letter}</span>
    </button>
  );
}

function DimensionsBadge({ floor, isEditing, onExpand }) {
  return (
    <span className="floor-plan-dimensions-badge">
      <span>
        {Math.round(floor?.width || DEFAULT_PLAN_SIZE.width)} x {Math.round(floor?.height || DEFAULT_PLAN_SIZE.height)}
      </span>
      {isEditing ? (
        <span className="floor-plan-canvas-expand-actions">
          <ExpandButton axis="width" label="Aumentar largura da área" letter="L" onExpand={onExpand} />
          <ExpandButton axis="height" label="Aumentar altura da área" letter="A" onExpand={onExpand} />
        </span>
      ) : null}
    </span>
  );
}

function Stage2D({ workspace }) {
  const { session, doc, ui, viewport, entities, transforms, pointer, infra, background } = workspace;
  const isEditing = session.isEditing;
  return (
    <FloorPlanCanvas
      editor={doc.editor}
      activeFloorId={doc.activeFloorId}
      selection={{
        selected: ui.selected,
        selectedObjectIds: isEditing ? ui.selectedObjectIds : [],
        selectionBox: isEditing ? ui.selectionBox : null,
        alignmentGuides: isEditing ? ui.alignmentGuides : []
      }}
      handlers={{
        onSelect: entities.handleEntitySelect,
        onPointerDown: isEditing ? pointer.beginDrag : noop,
        onCanvasPointerDown: pointer.handleCanvasPointerDown,
        onPointerMove: pointer.handleCanvasPointerMove,
        onPointerUp: pointer.endDrag,
        onResizeStart: isEditing ? pointer.beginRoomResize : noop,
        onObjectResizeStart: isEditing ? pointer.beginObjectResize : noop,
        onDuplicateSelected: transforms.duplicateSelected,
        onDeleteSelected: entities.deleteSelectedEntity,
        onRotateSelected: transforms.rotateSelected,
        onWheel: viewport.handleWheel
      }}
      overlays={{ placement: ui.placement, paintDraft: ui.paintDraft, justPlacedObjectId: ui.justPlacedObjectId }}
      viewport={{
        viewBox: viewport.canvasViewBox,
        svgRef: viewport.svgRef,
        isPanning: viewport.isPanning,
        spacePressed: viewport.spacePressed,
        showGrid: ui.showGrid,
        visibleLayers: ui.visibleLayers,
        selectedTool: ui.zoomMode ? "zoom" : ui.selectedTool
      }}
      background={{ src: background.src, settings: background.settings }}
      heatmap={{ byObject: infra.heatmapByObject, mode: infra.mode }}
    />
  );
}

function Stage3D({ workspace }) {
  const { session, doc, ui, entities } = workspace;
  const isEditing = session.isEditing;
  const canEdit = Boolean(isEditing && ui.selectedTool !== "delete");
  return (
    <Suspense fallback={<div className="floor-plan-loading">Carregando 3D...</div>}>
      <FloorPlanScene3D
        data={doc.editor}
        activeFloorId={doc.activeFloorId}
        selected={isEditing ? ui.selected : null}
        onSelect={isEditing ? entities.handleEntitySelect : undefined}
        onMoveObject={canEdit ? entities.moveObjectFrom3D : undefined}
        editable={canEdit}
        showGrid={ui.showGrid}
        onGridChange={ui.setShowGrid}
      />
    </Suspense>
  );
}

function StageSelectionDock({ workspace }) {
  const { doc, ui, entities, transforms } = workspace;
  const actions = getSelectionActionState({ editor: doc.editor, selected: ui.selected, selectedObjectIds: ui.selectedObjectIds });
  return (
    <FloorPlanSelectionDock
      count={Math.max(1, ui.selectedObjectIds.length)}
      canDuplicate={actions.canDuplicate}
      canRotate={actions.canRotate}
      canDelete={actions.canDelete}
      canLock={actions.objectSelectionActive}
      locked={actions.allLocked}
      onDuplicate={transforms.duplicateSelected}
      onRotate={transforms.rotateSelected}
      onDelete={entities.deleteSelectedEntity}
      onToggleLock={entities.toggleSelectedObjectLock}
      onClear={() => {
        ui.clearSelection();
        ui.setSelectionBox(null);
      }}
    />
  );
}

/** Painel de propriedades (edicao) ou detalhes operacionais (visualizacao). */
function StageSidePanel({ workspace, devices, groups, segments, permissions }) {
  const { session, doc, ui, entities, infra, linkObject } = workspace;
  const { selected } = ui;
  if (session.isEditing) {
    if (!selected || ui.paintDraft) return null;
    return (
      <FloorPlanInspector
        editor={doc.editor}
        selected={selected}
        onChangeSelected={entities.updateSelectedEntity}
        onClearSelected={ui.clearSelection}
        devices={devices}
        groups={groups}
        segments={segments}
        permissions={permissions}
        onLinkObject={linkObject}
      />
    );
  }
  if (selected?.type !== "object") return null;
  const object = (doc.editor?.objects || []).find((entry) => entry.id === selected.id);
  return (
    <InfrastructureObjectPanel
      object={object}
      device={object?.linkedAssetId ? devices.find((entry) => entry.id === object.linkedAssetId) : null}
      heatmap={infra.heatmapByObject.get(selected.id)}
      mode={infra.mode}
      onClose={() => ui.setSelected(null)}
    />
  );
}

/** Palco da planta: canvas 2D ou cena 3D, controles de zoom/camadas, selecao e painel lateral. */
export default function EditorStage({ workspace, stageRef, devices, groups, segments, permissions }) {
  const { session, doc, ui, viewport } = workspace;
  const isEditing = session.isEditing;
  const floor = doc.activeFloorRecord;
  const showDock = isEditing && ui.mode === "2d" && !ui.paintDraft && (ui.selected || ui.selectedObjectIds.length > 0);

  return (
    <div className={`floor-plan-stage floor-plan-stage-${ui.mode}`} ref={stageRef}>
      <DimensionsBadge floor={floor} isEditing={isEditing} onExpand={viewport.expandCanvas} />
      <FloorPlanViewerControls
        mode={ui.mode}
        visibleLayers={ui.visibleLayers}
        zoomPercent={getZoomPercent(floor, viewport.canvasViewBox)}
        onToggleLayer={ui.toggleVisibleLayer}
        onFit={viewport.fitToFloor}
        onReset={viewport.resetZoom}
        onZoomIn={viewport.zoomIn}
        onZoomOut={viewport.zoomOut}
      />
      {ui.mode === "2d" ? <Stage2D workspace={workspace} /> : <Stage3D workspace={workspace} />}
      {showDock ? <StageSelectionDock workspace={workspace} /> : null}
      {isEditing && ui.mode === "3d" ? (
        <FloorPlanQuickActions activeSection={ui.activeCatalog} onSectionChange={ui.setActiveCatalog} />
      ) : null}
      <StageSidePanel workspace={workspace} devices={devices} groups={groups} segments={segments} permissions={permissions} />
    </div>
  );
}
