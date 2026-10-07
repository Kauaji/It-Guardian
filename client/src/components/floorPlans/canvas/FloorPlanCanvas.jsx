import RoomPlacementPreview from "../rooms/RoomPlacementPreview.jsx";
import RoomSelectionOverlay from "../rooms/RoomSelectionOverlay.jsx";
import { isRoomZone } from "../utils/roomGeometry.js";
import { DEFAULT_PLAN_SIZE } from "../utils/editorGeometry.js";
import { DEFAULT_FLOOR_PLAN_LAYERS } from "../utils/layers.js";
import { getCanvasScene } from "../utils/canvasScene.js";
import CanvasBackdrop from "./CanvasBackdrop.jsx";
import { PointLayer, PowerLinkLayer, RouteLayer } from "./ConnectionLayers.jsx";
import EditorEmptyState from "./EditorEmptyState.jsx";
import ObjectLayer from "./ObjectLayer.jsx";
import ObjectSelectionOverlay from "./ObjectSelectionOverlay.jsx";
import { PaintDraftOverlay } from "./PaintShapes.jsx";
import { CatalogPlacementPreview, MeasurementPlacementPreview, WallPlacementPreview } from "./PlacementPreviews.jsx";
import ZoneLayer from "./ZoneLayer.jsx";

const EMPTY_HEATMAP = new Map();
const NO_GUIDES = [];
const NO_IDS = [];

function AlignmentGuides({ guides, width, height }) {
  return guides.map((guide) =>
    guide.axis === "x" ? (
      <line key={`x-${guide.value}`} className="floor-plan-alignment-guide" x1={guide.value} y1="0" x2={guide.value} y2={height} />
    ) : (
      <line key={`y-${guide.value}`} className="floor-plan-alignment-guide" x1="0" y1={guide.value} x2={width} y2={guide.value} />
    )
  );
}

function getWrapClassName({ viewport, placement }) {
  const { selectedTool, spacePressed = false, isPanning = false, showGrid = true } = viewport;
  return `floor-plan-canvas-wrap tool-${selectedTool}${placement?.kind === "catalog" ? " tool-place" : ""}${spacePressed ? " space-pan-ready" : ""}${isPanning ? " is-panning" : ""} ${showGrid ? "" : "no-grid"}`;
}

function CanvasOverlays({ editor, scene, selection, overlays, handlers }) {
  const { selected, selectionBox, alignmentGuides = NO_GUIDES } = selection;
  const { placement } = overlays;
  const selectedObject = scene.objects.find((object) => selected?.type === "object" && selected.id === object.id);
  return (
    <>
      <CatalogPlacementPreview placement={placement} />
      <RoomPlacementPreview preview={placement?.kind === "room" ? placement.preview : null} plan={editor.plan} />
      <WallPlacementPreview placement={placement} />
      <MeasurementPlacementPreview placement={placement} plan={editor?.plan} />
      <RoomSelectionOverlay
        zone={scene.zones.find((zone) => selected?.type === "zone" && selected.id === zone.id && isRoomZone(zone))}
        plan={editor.plan}
        onResizeStart={handlers.onResizeStart}
        onDuplicate={handlers.onDuplicateSelected}
        onDelete={handlers.onDeleteSelected}
        onRotate={handlers.onRotateSelected}
      />
      <ObjectSelectionOverlay object={selectedObject} onResizeStart={handlers.onObjectResizeStart} />
      <AlignmentGuides guides={alignmentGuides} width={scene.width} height={scene.height} />
      {selectionBox ? <rect className="floor-plan-marquee-selection" {...selectionBox} /> : null}
    </>
  );
}

/**
 * Canvas 2D (SVG) da planta. Os props sao agrupados: `selection` (selecao e
 * guias), `handlers` (eventos), `overlays` (posicionamento e pincel),
 * `viewport` (zoom, camadas e ferramenta), `background` e `heatmap`.
 */
export default function FloorPlanCanvas({ editor, activeFloorId, selection, handlers, overlays, viewport, background = {}, heatmap = {} }) {
  const { selected, selectedObjectIds = NO_IDS } = selection;
  const { placement, paintDraft, justPlacedObjectId } = overlays;
  const { viewBox, svgRef, showGrid = true, visibleLayers = DEFAULT_FLOOR_PLAN_LAYERS } = viewport;
  const { src: backgroundSrc = "", settings: backgroundSettings = {} } = background;
  const { byObject: heatmapByObject = EMPTY_HEATMAP, mode: heatmapMode = "normal" } = heatmap;
  const scene = getCanvasScene({ editor, activeFloorId, visibleLayers });
  const { floor, layerState, width, height } = scene;

  if (!floor) return <EditorEmptyState />;

  const gridSize = editor?.plan?.gridSize || DEFAULT_PLAN_SIZE.gridSize;
  const viewBoxValue = viewBox || { x: 0, y: 0, width, height };
  const isEmpty = scene.zones.length + scene.objects.length + scene.points.length + scene.routes.length === 0;

  return (
    <div className={getWrapClassName({ viewport, placement })} onContextMenu={(event) => event.preventDefault()}>
      <svg
        ref={svgRef}
        className={`floor-plan-canvas ${layerState.labels ? "" : "layers-hide-labels"}`}
        viewBox={`${viewBoxValue.x} ${viewBoxValue.y} ${viewBoxValue.width} ${viewBoxValue.height}`}
        role="img"
        aria-label="Editor 2D da planta"
        onPointerDown={handlers.onCanvasPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerLeave={handlers.onPointerUp}
        onWheel={handlers.onWheel}
      >
        <CanvasBackdrop
          width={width}
          height={height}
          gridSize={gridSize}
          showGrid={showGrid}
          backgroundSrc={backgroundSrc}
          backgroundSettings={backgroundSettings}
        />
        <ZoneLayer
          zones={[...scene.roomZones, ...scene.areaZones]}
          selected={selected}
          plan={editor.plan}
          onPointerDown={handlers.onPointerDown}
          onSelect={handlers.onSelect}
        />
        {layerState.areas && paintDraft?.cells?.length ? <PaintDraftOverlay paintDraft={paintDraft} /> : null}
        <RouteLayer routes={scene.routes} selected={selected} onSelect={handlers.onSelect} />
        <PowerLinkLayer powerLinks={scene.powerLinks} />
        <ObjectLayer
          objects={scene.objects}
          plan={editor?.plan}
          handlers={handlers}
          view={{ selected, selectedIdSet: new Set(selectedObjectIds), justPlacedObjectId, heatmapByObject, heatmapMode }}
        />
        <PointLayer points={scene.points} selected={selected} onPointerDown={handlers.onPointerDown} onSelect={handlers.onSelect} />
        {isEmpty && (
          <foreignObject x={width / 2 - 180} y={height / 2 - 55} width="360" height="110">
            <EditorEmptyState />
          </foreignObject>
        )}
        <CanvasOverlays editor={editor} scene={scene} selection={selection} overlays={overlays} handlers={handlers} />
      </svg>
    </div>
  );
}
