import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Info,
  Layers3,
  Link2,
  Loader2,
  PaintBucket,
  Paintbrush,
  Plus,
  Search,
  SlidersVertical,
  Trash2,
  Eraser,
  Monitor,
  X
} from "lucide-react";
import {
  createFloorPlan,
  deleteFloorPlan,
  duplicateFloorPlan,
  fetchFloorPlan,
  fetchFloorPlans,
  linkFloorPlanObjectToAsset,
  saveFloorPlanEditorData,
  updateFloorPlan
} from "../../api.js";
import { FLOOR_PLAN_CATALOG, getCatalogItem } from "./floorPlanCatalog.js";
import {
  FloorPlanQuickActions,
  FloorPlanTopbar
} from "./FloorPlanEditorChrome.jsx";
import RoomCatalog from "./rooms/RoomCatalog.jsx";
import RoomPlacementPreview from "./rooms/RoomPlacementPreview.jsx";
import RoomRenderer from "./rooms/RoomRenderer.jsx";
import RoomSelectionOverlay from "./rooms/RoomSelectionOverlay.jsx";
import FloorPlanObjectGlyph from "./FloorPlanObjectGlyph.jsx";
import { createRoomEntitiesFromTemplate } from "./utils/roomTemplates.js";
import {
  clampRoomGeometry,
  getRoomGeometry,
  isRoomPlacementValid,
  isRoomZone,
  normalizeRoomZone,
  resizeRoomGeometry,
  rotateRoomSize,
  snapToGrid
} from "./utils/roomGeometry.js";
import {
  DEFAULT_PLAN_SIZE,
  buildEditorPayload,
  centerAssetOnTable,
  centerDesktopsOnTables,
  centerLinkedAssetsOnTable,
  clamp,
  cloneEditor,
  constrainObjectToBounds,
  findNearestDesktop,
  findObjectsInSelectionRect,
  findNearestTable,
  getActiveFloor,
  getDefaultPlacementBounds,
  getFineSnapSize,
  getObjectCenter,
  getObjectSize,
  isDesktopObject,
  isPowerAccessoryObject,
  isTableObject,
  normalizeSelectionRect,
  normalizeResponsePlan,
  resizeObjectGeometry,
  snap
} from "./utils/editorGeometry.js";
import {
  attachOpeningToWall,
  createWallObjectFromPoints,
  ensureRoomWallObjects,
  findNearestWall,
  getWallSegment,
  getRoomWallId,
  isAnchoredOpening,
  isOpeningObject,
  isWallObject,
  removeObjectCascade,
  removeRoomCascade,
  resolveAnchoredOpening,
  resizeWallEndpoint,
  snapPointToWallEndpoints,
  snapWallEndPoint,
  syncAnchoredOpenings
} from "./utils/wallGeometry.js";
import {
  createPaintAreaZone,
  eraseCells,
  fillRoomCells,
  getBrushCells,
  getPaintCells,
  getPaintCellSize,
  isPaintAreaZone,
  paintCells,
  parseCellKey
} from "./utils/paintAreaGeometry.js";

const FloorPlanScene3D = lazy(() => import("./FloorPlanScene3D.jsx"));

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function planStatusLabel(status) {
  const labels = {
    draft: "Rascunho",
    active: "Ativa",
    archived: "Arquivada"
  };
  return labels[status] || status || "Rascunho";
}

function formatDate(value) {
  if (!value) return "Nao informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function deviceLabel(device) {
  return device?.hostname || device?.name || device?.label || device?.id || "Ativo";
}

function getObjectIcon(objectType) {
  const item = getCatalogItem(objectType);
  return item?.icon || null;
}

function EditorEmptyState() {
  return (
    <div className="floor-plan-empty-canvas">
      <strong>Nenhum elemento nesta planta.</strong>
      <span>Use o catalogo inferior ou os pinceis laterais para montar a infraestrutura.</span>
    </div>
  );
}

function FloorPlansList({ plans, loading, query, onQueryChange, onCreate, onOpen, onDuplicate, onDelete, permissions }) {
  const filteredPlans = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return plans;
    return plans.filter((plan) => {
      return [plan.name, plan.company, plan.unit, plan.floorLabel, plan.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [plans, query]);

  return (
    <section className="floor-plans-view">
      <header className="floor-plans-header">
        <div>
          <span className="eyebrow">Plantas</span>
          <h2>Plantas e Infraestrutura</h2>
          <p>Mapeie ambientes, ativos, pontos, cabos e zonas com vinculo ao inventario.</p>
        </div>
        {permissions.create && (
          <button className="primary-action compact-action" type="button" onClick={onCreate}>
            <Plus size={18} />
            Nova planta
          </button>
        )}
      </header>

      <div className="floor-plans-toolbar">
        <label className="compact-search floor-plan-search">
          <Search size={18} />
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar planta, empresa, andar ou status" />
        </label>
      </div>

      {loading && (
        <div className="floor-plan-loading">
          <Loader2 size={18} />
          Carregando plantas...
        </div>
      )}

      {!loading && filteredPlans.length === 0 && (
        <div className="floor-plan-list-empty">
          <strong>Nenhuma planta cadastrada.</strong>
          <span>Crie a primeira planta para organizar infraestrutura fisica e logica.</span>
        </div>
      )}

      <div className="floor-plan-list-grid">
        {filteredPlans.map((plan) => (
          <article className="floor-plan-card" key={plan.id}>
            <header>
              <span className={`floor-plan-status ${plan.status || "draft"}`}>{planStatusLabel(plan.status)}</span>
              <button className="icon-button" type="button" onClick={() => onOpen(plan.id)} title="Abrir planta">
                <Layers3 size={18} />
              </button>
            </header>
            <h3>{plan.name}</h3>
            <p>{[plan.company, plan.unit, plan.floorLabel].filter(Boolean).join(" - ") || "Sem local definido"}</p>
            <dl>
              <div>
                <dt>Ativos</dt>
                <dd>{plan.assetCount || 0}</dd>
              </div>
              <div>
                <dt>Objetos</dt>
                <dd>{plan.objectCount || 0}</dd>
              </div>
              <div>
                <dt>Andares</dt>
                <dd>{plan.floorCount || 0}</dd>
              </div>
              <div>
                <dt>Atualizada</dt>
                <dd>{formatDate(plan.updatedAt)}</dd>
              </div>
            </dl>
            <footer>
              <button className="secondary-action compact-action" type="button" onClick={() => onOpen(plan.id)}>
                Abrir
              </button>
              {permissions.create && (
                <button className="icon-button" type="button" onClick={() => onDuplicate(plan.id)} title="Duplicar planta">
                  <Copy size={17} />
                </button>
              )}
              {permissions.delete && (
                <button className="icon-button danger-icon" type="button" onClick={() => onDelete(plan)} title="Excluir planta">
                  <Trash2 size={17} />
                </button>
              )}
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

function FloorPlanCatalog({ activeSection, onActiveSectionChange, onAddItem, onSelectRoomTemplate, placement, catalogRef }) {
  const catalogSections = [{ id: "rooms", label: "Comodos" }, ...FLOOR_PLAN_CATALOG];
  const section = FLOOR_PLAN_CATALOG.find((entry) => entry.id === activeSection) || FLOOR_PLAN_CATALOG[0];

  return (
    <section ref={catalogRef} className={`floor-plan-catalog${activeSection === "rooms" ? " room-catalog-active" : ""}`}>
      <nav aria-label="Catalogo da planta">
        {catalogSections.map((entry) => (
          <button className={activeSection === entry.id ? "active" : ""} key={entry.id} type="button" onClick={() => onActiveSectionChange(entry.id)}>
            {entry.label}
          </button>
        ))}
      </nav>
      {activeSection === "rooms" ? (
        <RoomCatalog onSelectTemplate={onSelectRoomTemplate} />
      ) : (
        <div className="floor-plan-catalog-items">
          {section.items.map((item) => {
            const Icon = item.icon || Info;
            const usesPlanGlyph = item.objectType === "door" || item.objectType === "tv";
            return (
              <button key={item.id} type="button" onClick={() => onAddItem(item)}>
                {usesPlanGlyph ? (
                  <svg
                    aria-hidden="true"
                    className="floor-plan-catalog-object-preview"
                    viewBox={`0 0 ${item.width} ${item.height}`}
                  >
                    <FloorPlanObjectGlyph object={item} width={item.width} height={item.height} />
                  </svg>
                ) : (
                  <Icon size={22} />
                )}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
      {placement ? (
        <div className="floor-plan-catalog-hint">
          {placement.kind === "room"
            ? "Clique e arraste na planta para definir o tamanho. Use R para girar e Esc para cancelar."
            : placement.kind === "wall"
              ? "Clique no inicio e no fim da parede. O angulo sera ajustado automaticamente."
              : "Clique sobre uma parede para encaixar a abertura. Use Esc para cancelar."}
        </div>
      ) : null}
    </section>
  );
}

function ObjectSelectionOverlay({ object, onResizeStart }) {
  if (!object) return null;
  if (isWallObject(object)) {
    const segment = getWallSegment(object);
    return (
      <g className="floor-plan-object-resize-overlay wall-endpoints">
        {[{ side: "wall-start", ...segment.start }, { side: "wall-end", ...segment.end }].map((handle) => (
          <g key={handle.side} className="floor-plan-object-resize-handle" onPointerDown={(event) => onResizeStart(event, object.id, handle.side)}>
            <circle cx={handle.x} cy={handle.y} r="10" />
          </g>
        ))}
      </g>
    );
  }
  const { width, height } = getObjectSize(object);
  const x = Number(object.x || 0);
  const y = Number(object.y || 0);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const handles = [
    { side: "north", x: centerX, y: y - 18, label: "Ajustar altura para cima", text: "↑" },
    { side: "east", x: x + width + 18, y: centerY, label: "Ajustar largura para direita", text: "→" },
    { side: "south", x: centerX, y: y + height + 18, label: "Ajustar altura para baixo", text: "↓" },
    { side: "west", x: x - 18, y: centerY, label: "Ajustar largura para esquerda", text: "←" }
  ];
  return (
    <g className="floor-plan-object-resize-overlay" transform={`rotate(${Number(object.rotation || 0)} ${centerX} ${centerY})`}>
      <rect x={x - 3} y={y - 3} width={width + 6} height={height + 6} rx="10" />
      {handles.map((handle) => (
        <g
          className={`floor-plan-object-resize-handle ${handle.side}`}
          key={handle.side}
          onPointerDown={(event) => onResizeStart(event, object.id, handle.side)}
          aria-label={handle.label}
        >
          <circle cx={handle.x} cy={handle.y} r="13" />
          <text x={handle.x} y={handle.y + 5} textAnchor="middle">{handle.text}</text>
        </g>
      ))}
    </g>
  );
}

function WallPlacementPreview({ placement }) {
  if (placement?.kind !== "wall" || !placement.start || !placement.end) return null;
  const snappedEnd = snapWallEndPoint(placement.start, placement.end, placement.gridSize || 5);
  return (
    <g className="floor-plan-wall-preview" pointerEvents="none">
      <line x1={placement.start.x} y1={placement.start.y} x2={snappedEnd.x} y2={snappedEnd.y} />
      <circle cx={placement.start.x} cy={placement.start.y} r="7" />
      <circle cx={snappedEnd.x} cy={snappedEnd.y} r="7" />
      <text x={(placement.start.x + snappedEnd.x) / 2} y={(placement.start.y + snappedEnd.y) / 2 - 12} textAnchor="middle">
        {Math.round(snappedEnd.length)} px / {snappedEnd.angle} graus
      </text>
    </g>
  );
}

function PaintToolPanel({ draft, groups, segments, groupAreas, onChange, onConfirm, onCancel }) {
  const [sizeControlOpen, setSizeControlOpen] = useState(false);
  if (!draft) return null;
  const isSegment = draft.areaType === "segment";
  const parentArea = groupAreas.find((area) => area.id === draft.parentAreaId) || null;
  const compatibleSegments = segments.filter((segment) => !parentArea?.groupId || !segment.groupId || segment.groupId === parentArea.groupId);

  return (
    <section className="floor-plan-paint-panel" aria-label={isSegment ? "Pincel de segmento" : "Pincel de grupo"}>
      <div className="floor-plan-paint-panel-title">
        <Paintbrush size={18} />
        <div>
          <strong>{isSegment ? "Demarcar segmento" : "Demarcar grupo"}</strong>
          <span>{draft.cells.length} bloco(s) na demarcacao temporaria</span>
        </div>
      </div>
      <div className="segmented-control compact floor-plan-paint-modes">
        <button className={draft.mode === "brush" ? "active" : ""} type="button" onClick={() => onChange({ mode: "brush" })} title="Pincel"><Paintbrush size={16} /></button>
        <button className={draft.mode === "bucket" ? "active" : ""} type="button" onClick={() => onChange({ mode: "bucket" })} title="Completar comodo"><PaintBucket size={16} /></button>
        <button className={draft.mode === "eraser" ? "active" : ""} type="button" onClick={() => onChange({ mode: "eraser" })} title="Borracha"><Eraser size={16} /></button>
      </div>
      <div className="floor-plan-brush-size-control">
        <button
          className={`icon-button ${sizeControlOpen ? "active" : ""}`}
          type="button"
          onClick={() => setSizeControlOpen((open) => !open)}
          title="Ajustar tamanho do pincel e da borracha"
          aria-label="Ajustar tamanho do pincel e da borracha"
          aria-expanded={sizeControlOpen}
        >
          <SlidersVertical size={17} />
        </button>
        {sizeControlOpen && (
          <div className="floor-plan-brush-size-popover">
            <span>Menor</span>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={draft.brushSize}
              onChange={(event) => onChange({ brushSize: Number(event.target.value) })}
              aria-label="Tamanho do pincel e da borracha"
              orient="vertical"
            />
            <span>Maior</span>
          </div>
        )}
      </div>
      {isSegment ? (
        <>
          <label>
            Area de grupo
            <select value={draft.parentAreaId || ""} onChange={(event) => onChange({ parentAreaId: event.target.value, cells: [] })}>
              {groupAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>
          </label>
          <label>
            Segmento
            <select value={draft.segmentId || ""} onChange={(event) => onChange({ segmentId: event.target.value })}>
              <option value="">Selecione</option>
              {compatibleSegments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
            </select>
          </label>
        </>
      ) : (
        <label>
          Grupo
          <select value={draft.groupId || ""} onChange={(event) => onChange({ groupId: event.target.value })}>
            <option value="">Selecione</option>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </label>
      )}
      <div className="floor-plan-paint-actions">
        <button className="icon-button primary-action" type="button" onClick={onConfirm} title="Confirmar area" aria-label="Confirmar area">
          <Check size={18} />
        </button>
        <button className="icon-button secondary-action" type="button" onClick={onCancel} title="Cancelar area" aria-label="Cancelar area">
          <X size={18} />
        </button>
      </div>
    </section>
  );
}

function paintCellsPath(cells, cellSize) {
  return cells.map((key) => {
    const { column, row } = parseCellKey(key);
    const x = column * cellSize;
    const y = row * cellSize;
    return `M${x} ${y}h${cellSize}v${cellSize}h-${cellSize}Z`;
  }).join(" ");
}

function PaintAreaShape({ zone, selected, onSelect }) {
  const cells = getPaintCells(zone);
  const cellSize = getPaintCellSize(zone);
  if (!cells.length) return null;
  const parsedCells = cells.map(parseCellKey);
  const minColumn = Math.min(...parsedCells.map((cell) => cell.column));
  const maxColumn = Math.max(...parsedCells.map((cell) => cell.column));
  const minRow = Math.min(...parsedCells.map((cell) => cell.row));
  const maxRow = Math.max(...parsedCells.map((cell) => cell.row));
  const labelX = ((minColumn + maxColumn + 1) * cellSize) / 2;
  const labelY = ((minRow + maxRow + 1) * cellSize) / 2;
  return (
    <g className={`floor-plan-paint-area ${zone.zoneType} ${selected ? "selected" : ""}`}>
      <path
        d={paintCellsPath(cells, cellSize)}
        fill={zone.color || (zone.zoneType === "segment" ? "#22c55e" : "#8b5cf6")}
        fillOpacity={zone.zoneType === "segment" ? 0.32 : 0.2}
        stroke={zone.color || "#8b5cf6"}
        strokeWidth={selected ? 3 : 1.5}
        strokeDasharray={zone.zoneType === "segment" ? "6 4" : undefined}
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.();
        }}
      />
      <text className="floor-plan-paint-area-label" x={labelX} y={labelY} textAnchor="middle">
        {zone.name}
      </text>
      <title>{zone.name}</title>
    </g>
  );
}

function FloorPlanCanvas({
  editor,
  activeFloorId,
  selected,
  selectedObjectIds = [],
  selectionBox,
  selectedTool,
  onSelect,
  onPointerDown,
  onCanvasPointerDown,
  onPointerMove,
  onPointerUp,
  onResizeStart,
  onObjectResizeStart,
  onDuplicateSelected,
  onDeleteSelected,
  onRotateSelected,
  placement,
  paintDraft,
  viewBox,
  onWheel,
  svgRef,
  showGrid = true
}) {
  const floor = getActiveFloor(editor, activeFloorId);
  const gridSize = editor?.plan?.gridSize || DEFAULT_PLAN_SIZE.gridSize;
  const zones = (editor?.zones || []).filter((zone) => zone.floorId === floor?.id);
  const objects = syncAnchoredOpenings(editor?.objects || []).filter((object) => object.floorId === floor?.id);
  const points = (editor?.connectionPoints || []).filter((point) => point.floorId === floor?.id);
  const routes = (editor?.cableRoutes || []).filter((route) => route.floorId === floor?.id);
  const width = floor?.width || editor?.plan?.width || DEFAULT_PLAN_SIZE.width;
  const height = floor?.height || editor?.plan?.height || DEFAULT_PLAN_SIZE.height;
  const viewBoxValue = viewBox || { x: 0, y: 0, width, height };
  const selectedObject = objects.find((object) => selected?.type === "object" && selected.id === object.id);
  const selectedIdSet = new Set(selectedObjectIds);
  const powerLinks = objects
    .filter(isPowerAccessoryObject)
    .map((accessory) => {
      const target = findNearestDesktop(accessory, objects);
      return target ? { accessory, target } : null;
    })
    .filter(Boolean);

  if (!floor) return <EditorEmptyState />;

  return (
    <div className={`floor-plan-canvas-wrap tool-${selectedTool} ${showGrid ? "" : "no-grid"}`}>
      <svg
        ref={svgRef}
        className="floor-plan-canvas"
        viewBox={`${viewBoxValue.x} ${viewBoxValue.y} ${viewBoxValue.width} ${viewBoxValue.height}`}
        role="img"
        aria-label="Editor 2D da planta"
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        <defs>
          <pattern id="floor-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#dbeafe" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={width} height={height} fill="#fbfdff" />
        {showGrid ? <rect x="0" y="0" width={width} height={height} fill="url(#floor-grid)" /> : null}

        {zones.map((zone) => {
          const geometry = zone.geometry || {};
          const zoneSelected = selected?.type === "zone" && selected.id === zone.id;
          if (isRoomZone(zone)) {
            return (
              <RoomRenderer
                key={zone.id}
                zone={zone}
                selected={zoneSelected}
                plan={editor.plan}
                onPointerDown={(event) => onPointerDown(event, "zone", zone.id)}
                onSelect={() => onSelect({ type: "zone", id: zone.id })}
              />
            );
          }
          if (isPaintAreaZone(zone)) {
            return (
              <PaintAreaShape
                key={zone.id}
                zone={zone}
                selected={zoneSelected}
                onSelect={() => onSelect({ type: "zone", id: zone.id })}
              />
            );
          }
          return (
            <g
              key={zone.id}
              className={`floor-plan-zone ${zoneSelected ? "selected" : ""}`}
              onPointerDown={(event) => onPointerDown(event, "zone", zone.id)}
              onClick={(event) => {
                event.stopPropagation();
                onSelect({ type: "zone", id: zone.id });
              }}
            >
              <rect
                x={geometry.x || 0}
                y={geometry.y || 0}
                width={geometry.width || 180}
                height={geometry.height || 120}
                rx="8"
                fill={zone.color}
                opacity={zone.zoneType === "room" ? 0.16 : 0.22}
                stroke={zone.color}
                strokeDasharray={zone.zoneType === "segment" ? "8 7" : "0"}
                strokeWidth={zoneSelected ? 4 : 2}
              />
              <text x={(geometry.x || 0) + 12} y={(geometry.y || 0) + 24}>{zone.name}</text>
            </g>
          );
        })}

        {paintDraft?.cells?.length ? (
          <path
            className="floor-plan-paint-draft"
            d={paintCellsPath(paintDraft.cells, paintDraft.cellSize)}
            fill={paintDraft.color}
            fillOpacity={paintDraft.areaType === "segment" ? 0.38 : 0.26}
            stroke={paintDraft.color}
            strokeDasharray="6 4"
            strokeWidth="2"
            pointerEvents="none"
          />
        ) : null}

        {routes.map((route) => {
          const path = route.path || [];
          if (path.length < 2) return null;
          const routeStyle = route.metadata?.routeStyle || "free";
          const routeWidth = routeStyle === "conduit" ? 10 : routeStyle === "channel" ? 8 : route.routeType === "power" ? 5 : 4;
          return (
            <polyline
              key={route.id}
              className={`floor-plan-route style-${routeStyle} ${selected?.type === "route" && selected.id === route.id ? "selected" : ""}`}
              points={path.map((point) => `${point.x},${point.y}`).join(" ")}
              fill="none"
              stroke={route.color}
              strokeWidth={routeWidth}
              strokeDasharray={routeStyle === "free" && route.routeType === "power" ? "12 8" : "0"}
              onClick={(event) => {
                event.stopPropagation();
                onSelect({ type: "route", id: route.id });
              }}
            />
          );
        })}

        {powerLinks.map(({ accessory, target }) => {
          const accessoryCenter = getObjectCenter(accessory);
          const targetCenter = getObjectCenter(target);
          return (
            <line
              className="floor-plan-power-link"
              key={`${accessory.id}-${target.id}`}
              x1={accessoryCenter.x}
              y1={accessoryCenter.y}
              x2={targetCenter.x}
              y2={targetCenter.y}
            />
          );
        })}

        {objects.map((object) => {
          const objectSelected = selectedIdSet.has(object.id) || (selected?.type === "object" && selected.id === object.id);
          const objectWidth = object.width || 80;
          const objectHeight = object.height || 56;
          const hideObjectLabel = isTableObject(object) || isWallObject(object) || isOpeningObject(object);
          const wallOpenings = isWallObject(object)
            ? objects.filter((candidate) => candidate.metadata?.parentObjectId === object.id && isOpeningObject(candidate))
            : [];
          return (
            <g
              key={object.id}
              className={`floor-plan-object ${objectSelected ? "selected" : ""}`}
              transform={`translate(${object.x || 0} ${object.y || 0})`}
              onPointerDown={(event) => onPointerDown(event, "object", object.id)}
              onClick={(event) => {
                event.stopPropagation();
                onSelect({ type: "object", id: object.id }, event);
              }}
            >
              <g transform={`rotate(${object.rotation || 0} ${objectWidth / 2} ${objectHeight / 2})`}>
                <rect
                  className="floor-plan-object-hit-target"
                  x="-3"
                  y="-3"
                  width={objectWidth + 6}
                  height={objectHeight + 6}
                  rx="5"
                />
                <FloorPlanObjectGlyph
                  object={object}
                  width={objectWidth}
                  height={objectHeight}
                  selected={objectSelected}
                  openings={wallOpenings}
                />
                {objectSelected ? <rect className="floor-plan-object-selection-outline" x="-3" y="-3" width={objectWidth + 6} height={objectHeight + 6} rx="5" /> : null}
              </g>
              {!hideObjectLabel ? <text className="floor-plan-object-label" x={objectWidth / 2} y={objectHeight + 15} textAnchor="middle">{object.label}</text> : null}
            </g>
          );
        })}

        {points.map((point) => {
          const pointSelected = selected?.type === "point" && selected.id === point.id;
          return (
            <g
              key={point.id}
              className={`floor-plan-point ${pointSelected ? "selected" : ""}`}
              onPointerDown={(event) => onPointerDown(event, "point", point.id)}
              onClick={(event) => {
                event.stopPropagation();
                onSelect({ type: "point", id: point.id });
              }}
            >
              <rect x={(point.x || 0) - 11} y={(point.y || 0) - 11} width="22" height="22" rx="5" fill="#ffffff" stroke={point.pointType === "power" ? "#d97706" : "#2563eb"} strokeWidth={pointSelected ? 4 : 2} />
              <text x={(point.x || 0) - 4} y={(point.y || 0) + 5}>{point.pointType === "power" ? "E" : "R"}</text>
            </g>
          );
        })}

        {zones.length + objects.length + points.length + routes.length === 0 && (
          <foreignObject x={width / 2 - 180} y={height / 2 - 55} width="360" height="110">
            <EditorEmptyState />
          </foreignObject>
        )}

        <RoomPlacementPreview preview={placement?.kind === "room" ? placement.preview : null} plan={editor.plan} />
        <WallPlacementPreview placement={placement} />
        <RoomSelectionOverlay
          zone={zones.find((zone) => selected?.type === "zone" && selected.id === zone.id && isRoomZone(zone))}
          plan={editor.plan}
          onResizeStart={onResizeStart}
          onDuplicate={onDuplicateSelected}
          onDelete={onDeleteSelected}
          onRotate={onRotateSelected}
        />
        <ObjectSelectionOverlay object={selectedObject} onResizeStart={onObjectResizeStart} />
        {selectionBox ? <rect className="floor-plan-marquee-selection" {...selectionBox} /> : null}
      </svg>
    </div>
  );
}

function FloorPlanInspector({ editor, selected, onChangeSelected, onClearSelected, devices, permissions, onLinkObject }) {
  const selectedEntity = useMemo(() => {
    if (!editor || !selected) return null;
    const collections = {
      object: editor.objects || [],
      zone: editor.zones || [],
      point: editor.connectionPoints || [],
      route: editor.cableRoutes || []
    };
    return collections[selected.type]?.find((item) => item.id === selected.id) || null;
  }, [editor, selected]);

  if (!selectedEntity) return null;

  const supportsInventoryLink = selected.type === "object"
    && !isWallObject(selectedEntity)
    && !isOpeningObject(selectedEntity);
  const linkedDevice = supportsInventoryLink
    ? devices.find((device) => device.id === selectedEntity.linkedAssetId)
    : null;
  const availableWalls = selected.type === "object"
    ? (editor.objects || []).filter((object) => object.floorId === selectedEntity.floorId && isWallObject(object))
    : [];
  const availablePoints = (editor.connectionPoints || []).filter((point) => point.floorId === selectedEntity.floorId);
  const networkPoints = availablePoints.filter((point) => point.pointType === "network");
  const powerPoints = availablePoints.filter((point) => point.pointType === "power");
  const linkedDeviceStatus = String(linkedDevice?.status || "").toLowerCase();
  const statusTone = linkedDeviceStatus.includes("online") || linkedDeviceStatus.includes("ativo")
    ? "online"
    : linkedDeviceStatus.includes("problem") || linkedDeviceStatus.includes("erro")
      ? "warning"
      : linkedDeviceStatus
        ? "offline"
        : "neutral";
  const tags = Array.isArray(linkedDevice?.tags)
    ? linkedDevice.tags
    : String(linkedDevice?.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
  const AssetIcon = getObjectIcon(selectedEntity.objectType) || Monitor;

  return (
    <aside className="floor-plan-inspector">
      <header>
        <span>{selected.type === "object" ? "Ativo/objeto" : selected.type === "zone" ? "Zona" : selected.type === "point" ? "Ponto" : "Rota"}</span>
        <button className="icon-button" type="button" onClick={onClearSelected} title="Fechar propriedades">
          <X size={17} />
        </button>
      </header>

      {supportsInventoryLink && (
        <>
          <div className="floor-plan-asset-summary">
            <span className="floor-plan-asset-icon"><AssetIcon size={27} /></span>
            <span>
              <strong>{linkedDevice ? deviceLabel(linkedDevice) : selectedEntity.label || "Ativo sem vinculo"}</strong>
              <small className={`floor-plan-asset-status ${statusTone}`}>
                <i />
                {linkedDevice?.status || "Sem status"}
              </small>
            </span>
          </div>
          <button
            className="floor-plan-correlate-action"
            type="button"
            onClick={() => document.getElementById("floor-plan-inventory-link")?.focus()}
          >
            <Link2 size={16} />
            Correlacionar maquina
          </button>
        </>
      )}

      <label>
        Nome do ativo
        <input value={selectedEntity.label || selectedEntity.name || ""} onChange={(event) => onChangeSelected({ label: event.target.value, name: event.target.value })} />
      </label>

      {supportsInventoryLink && (
        <>
          <label>
            Vinculo com inventario
            <select id="floor-plan-inventory-link" value={selectedEntity.linkedAssetId || ""} onChange={(event) => onLinkObject(selectedEntity.id, event.target.value)}>
              <option value="">Sem vinculo</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {deviceLabel(device)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hostname / IP
            <input readOnly value={linkedDevice?.ip || linkedDevice?.hostname || "Nao informado"} />
          </label>
          <label>
            Tomada de energia
            <select
              value={selectedEntity.metadata?.powerPointId || ""}
              onChange={(event) => onChangeSelected({ metadata: { ...(selectedEntity.metadata || {}), powerPointId: event.target.value || null } })}
            >
              <option value="">Sem tomada associada</option>
              {powerPoints.map((point) => <option key={point.id} value={point.id}>{point.label || "Tomada"}</option>)}
            </select>
          </label>
          <label>
            Ponto de rede
            <select
              value={selectedEntity.metadata?.networkPointId || ""}
              onChange={(event) => onChangeSelected({ metadata: { ...(selectedEntity.metadata || {}), networkPointId: event.target.value || null } })}
            >
              <option value="">Sem ponto associado</option>
              {networkPoints.map((point) => <option key={point.id} value={point.id}>{point.label || "Ponto RJ45"}</option>)}
            </select>
          </label>
          <div className="floor-plan-inspector-status-row">
            <span>Status</span>
            <strong className={`floor-plan-asset-status ${statusTone}`}><i />{linkedDevice?.status || "Nao informado"}</strong>
          </div>
          <div className="floor-plan-inspector-tags">
            <span>Tags</span>
            <div>
              {tags.length > 0 ? tags.map((tag) => <em key={tag}>{tag}</em>) : <small>Nenhuma tag cadastrada</small>}
            </div>
          </div>
          <button
            className="secondary-action compact-action floor-plan-open-inventory"
            type="button"
            disabled
            title="Navegacao direta pelo editor em desenvolvimento"
          >
            Ver no inventario
          </button>
        </>
      )}

      <label>
        Cor
        <input type="color" value={selectedEntity.color || "#1f7a61"} onChange={(event) => onChangeSelected({ color: event.target.value })} />
      </label>

      {selected.type === "object" && isWallObject(selectedEntity) && (
        <>
          <div className="floor-plan-inspector-grid">
            <label>
              Comprimento
              <input type="number" min="40" step="5" value={Math.round(selectedEntity.width || 0)} onChange={(event) => onChangeSelected({ width: Number(event.target.value) })} />
            </label>
            <label>
              Espessura
              <input type="number" min="4" step="1" value={Math.round(selectedEntity.height || 0)} onChange={(event) => onChangeSelected({ height: Number(event.target.value) })} />
            </label>
            <label>
              Angulo
              <select value={Number(selectedEntity.rotation || 0)} onChange={(event) => onChangeSelected({ rotation: Number(event.target.value) })}>
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => <option key={angle} value={angle}>{angle} graus</option>)}
              </select>
            </label>
            <label>
              Altura 3D
              <input type="number" min="24" step="2" value={Math.round(selectedEntity.height3d || 110)} onChange={(event) => onChangeSelected({ height3d: Number(event.target.value) })} />
            </label>
          </div>
          <label>
            Textura da parede
            <select
              value={selectedEntity.metadata?.texturePreset || "paint"}
              onChange={(event) => onChangeSelected({ metadata: { ...(selectedEntity.metadata || {}), texturePreset: event.target.value } })}
            >
              <option value="paint">Pintura lisa</option>
              <option value="concrete">Concreto</option>
              <option value="brick">Tijolo</option>
              <option value="wood">Madeira</option>
            </select>
          </label>
        </>
      )}

      {selected.type === "zone" && isRoomZone(selectedEntity) && (
        <label>
          Textura do piso
          <select
            value={selectedEntity.metadata?.floorTexture || "ceramic"}
            onChange={(event) => onChangeSelected({ metadata: { ...(selectedEntity.metadata || {}), floorTexture: event.target.value } })}
          >
            <option value="ceramic">Ceramica</option>
            <option value="wood">Madeira</option>
            <option value="carpet">Carpete</option>
            <option value="concrete">Concreto</option>
          </select>
        </label>
      )}

      {selected.type === "route" && (
        <label>
          Tipo de passagem
          <select
            value={selectedEntity.metadata?.routeStyle || "free"}
            onChange={(event) => onChangeSelected({ metadata: { ...(selectedEntity.metadata || {}), routeStyle: event.target.value } })}
          >
            <option value="free">Cabo aparente</option>
            <option value="conduit">Eletroduto</option>
            <option value="channel">Canaleta</option>
          </select>
        </label>
      )}

      {selected.type === "object" && selectedEntity.objectType === "rack" && (
        <section className="floor-plan-rack-config">
          <header>
            <strong>Switch no rack</strong>
            {!selectedEntity.metadata?.switchInstalled ? (
              <button
                type="button"
                className="icon-button"
                title="Adicionar switch"
                onClick={() => onChangeSelected({
                  metadata: {
                    ...(selectedEntity.metadata || {}),
                    switchInstalled: true,
                    switchTotalPorts: 24,
                    switchWorkingPorts: 24
                  }
                })}
              >
                <Plus size={17} />
              </button>
            ) : null}
          </header>
          {selectedEntity.metadata?.switchInstalled ? (
            <>
              <div className="floor-plan-inspector-grid">
                <label>
                  Portas totais
                  <input
                    type="number"
                    min="1"
                    max="96"
                    value={Number(selectedEntity.metadata?.switchTotalPorts || 24)}
                    onChange={(event) => onChangeSelected({ metadata: { ...(selectedEntity.metadata || {}), switchTotalPorts: Number(event.target.value) } })}
                  />
                </label>
                <label>
                  Funcionando
                  <input
                    type="number"
                    min="0"
                    max={Number(selectedEntity.metadata?.switchTotalPorts || 24)}
                    value={Number(selectedEntity.metadata?.switchWorkingPorts ?? selectedEntity.metadata?.switchTotalPorts ?? 24)}
                    onChange={(event) => onChangeSelected({ metadata: { ...(selectedEntity.metadata || {}), switchWorkingPorts: Number(event.target.value) } })}
                  />
                </label>
              </div>
              <button
                type="button"
                className="secondary-action compact-action"
                onClick={() => onChangeSelected({
                  metadata: {
                    ...(selectedEntity.metadata || {}),
                    switchInstalled: false,
                    switchTotalPorts: null,
                    switchWorkingPorts: null
                  }
                })}
              >
                Remover switch
              </button>
            </>
          ) : <small>Adicione um switch para controlar as portas do rack.</small>}
        </section>
      )}

      {selected.type === "object" && isOpeningObject(selectedEntity) && (
        <>
          <label>
            Parede vinculada
            <select
              value={selectedEntity.metadata?.parentObjectId || ""}
              onChange={(event) => onChangeSelected({
                metadata: {
                  ...(selectedEntity.metadata || {}),
                  anchorType: event.target.value ? "wall" : null,
                  parentObjectId: event.target.value || null,
                  anchorOffset: selectedEntity.metadata?.anchorOffset ?? 0.5
                }
              })}
            >
              <option value="">Sem parede</option>
              {availableWalls.map((wall) => <option key={wall.id} value={wall.id}>{wall.label || "Parede"}</option>)}
            </select>
          </label>
          {isAnchoredOpening(selectedEntity) ? (
            <label>
              Posicao na parede ({Math.round(Number(selectedEntity.metadata?.anchorOffset || 0) * 100)}%)
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={Number(selectedEntity.metadata?.anchorOffset ?? 0.5)}
                onChange={(event) => onChangeSelected({ metadata: { ...(selectedEntity.metadata || {}), anchorOffset: Number(event.target.value) } })}
              />
            </label>
          ) : null}
          {selectedEntity.objectType === "door" ? (
            <>
              <label>
                Tipo da porta
                <select
                  value={selectedEntity.metadata?.doorType || "single"}
                  onChange={(event) => {
                    const doorType = event.target.value;
                    onChangeSelected({
                      metadata: {
                        ...(selectedEntity.metadata || {}),
                        doorType,
                        ...(doorType === "single" || doorType === "double"
                          ? { swing: selectedEntity.metadata?.swing || "inward" }
                          : { slideDirection: selectedEntity.metadata?.slideDirection || "right" })
                      }
                    });
                  }}
                >
                  <option value="single">Porta simples</option>
                  <option value="double">Porta dupla</option>
                  <option value="sliding">Porta de correr</option>
                  <option value="pocket">Porta embutida</option>
                </select>
              </label>
              {["sliding", "pocket"].includes(selectedEntity.metadata?.doorType) ? (
                <label>
                  Direcao de correr
                  <select
                    value={selectedEntity.metadata?.slideDirection || "right"}
                    onChange={(event) => onChangeSelected({ metadata: { ...(selectedEntity.metadata || {}), slideDirection: event.target.value } })}
                  >
                    <option value="right">Para a direita</option>
                    <option value="left">Para a esquerda</option>
                  </select>
                </label>
              ) : (
                <label>
                  Abertura da porta
                  <select
                    value={selectedEntity.metadata?.swing || "inward"}
                    onChange={(event) => onChangeSelected({ metadata: { ...(selectedEntity.metadata || {}), swing: event.target.value } })}
                  >
                    <option value="inward">Para dentro</option>
                    <option value="outward">Para fora</option>
                  </select>
                </label>
              )}
            </>
          ) : null}
        </>
      )}

      {selected.type === "object" && !isWallObject(selectedEntity) && (
        <div className="floor-plan-inspector-grid">
          {!isAnchoredOpening(selectedEntity) ? <label>X<input type="number" value={Math.round(selectedEntity.x || 0)} onChange={(event) => onChangeSelected({ x: Number(event.target.value) })} /></label> : null}
          {!isAnchoredOpening(selectedEntity) ? <label>Y<input type="number" value={Math.round(selectedEntity.y || 0)} onChange={(event) => onChangeSelected({ y: Number(event.target.value) })} /></label> : null}
          <label>
            Largura
            <input type="number" value={Math.round(selectedEntity.width || 0)} onChange={(event) => onChangeSelected({ width: Number(event.target.value) })} />
          </label>
          <label>
            Altura
            <input type="number" value={Math.round(selectedEntity.height || 0)} onChange={(event) => onChangeSelected({ height: Number(event.target.value) })} />
          </label>
        </div>
      )}

      {!permissions.linkInventory && supportsInventoryLink && (
        <div className="floor-plan-inspector-note">
          <Link2 size={16} />
          Seu usuario nao pode alterar vinculos com inventario.
        </div>
      )}
      <button className="danger-action compact-action floor-plan-remove-selection" type="button" onClick={() => onChangeSelected({ remove: true })}>
        <Trash2 size={16} />
        Remover do mapa
      </button>
    </aside>
  );
}

export default function FloorPlansModule({ token, devices = [], segments = [], groups = [], activeTab, notify, permissions = {} }) {
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [listQuery, setListQuery] = useState("");
  const [view, setView] = useState("list");
  const [isEditing, setIsEditing] = useState(false);
  const [editor, setEditor] = useState(null);
  const [activeFloorId, setActiveFloorId] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedObjectIds, setSelectedObjectIds] = useState([]);
  const [selectionBox, setSelectionBox] = useState(null);
  const [selectedTool, setSelectedTool] = useState("select");
  const [activeCatalog, setActiveCatalog] = useState("rooms");
  const [placement, setPlacement] = useState(null);
  const [mode, setMode] = useState("2d");
  const [showGrid, setShowGrid] = useState(true);
  const [saveState, setSaveState] = useState("saved");
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [error, setError] = useState("");
  const [canvasViewBox, setCanvasViewBox] = useState(null);
  const [paintDraft, setPaintDraft] = useState(null);
  const dragRef = useRef(null);
  const paintPointerRef = useRef(false);
  const svgRef = useRef(null);
  const stageRef = useRef(null);
  const catalogRef = useRef(null);
  const autosaveRef = useRef(null);

  const savedGroupAreas = useMemo(() => (editor?.zones || []).filter((zone) => (
    zone.floorId === activeFloorId && zone.zoneType === "group" && isPaintAreaZone(zone)
  )), [activeFloorId, editor?.zones]);

  const handleToolChange = useCallback((tool) => {
    setPlacement(null);
    setSelectionBox(null);
    setSelectedObjectIds([]);
    if (tool === "group-brush" || tool === "segment-brush") setSelected(null);
    if (tool === "group-brush") {
      const group = groups[0] || null;
      setMode("2d");
      setPaintDraft({
        areaType: "group",
        mode: "brush",
        brushSize: 1,
        cellSize: 20,
        cells: [],
        groupId: group?.id || "",
        segmentId: "",
        parentAreaId: null,
        color: group?.color || "#8b5cf6"
      });
    } else if (tool === "segment-brush") {
      const parentArea = savedGroupAreas[0] || null;
      if (!parentArea) {
        notify?.("Crie uma area de grupo antes de demarcar segmentos.", "warning");
        setSelectedTool("select");
        setPaintDraft(null);
        return;
      }
      const compatibleSegment = segments.find((segment) => (
        !parentArea.groupId || !segment.groupId || segment.groupId === parentArea.groupId
      )) || null;
      setMode("2d");
      setPaintDraft({
        areaType: "segment",
        mode: "brush",
        brushSize: 1,
        cellSize: getPaintCellSize(parentArea),
        cells: [],
        groupId: parentArea.groupId || "",
        segmentId: compatibleSegment?.id || "",
        parentAreaId: parentArea.id,
        color: compatibleSegment?.color || "#22c55e"
      });
    } else {
      setPaintDraft(null);
      paintPointerRef.current = false;
    }
    setSelectedTool(tool);
    if (tool === "group-brush" || tool === "segment-brush") {
      setActiveCatalog("brushes");
    }
  }, [groups, notify, savedGroupAreas, segments]);

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setError("");
    try {
      const payload = await fetchFloorPlans(token, activeTab?.id || "");
      let nextPlans = payload.plans || [];

      if (!nextPlans.length && activeTab?.id && permissions.update) {
        const legacyPayload = await fetchFloorPlans(token);
        const legacyPlan = (legacyPayload.plans || []).find((plan) => !plan.inventoryTabId);
        if (legacyPlan) {
          const claimedPayload = await updateFloorPlan(token, legacyPlan.id, {
            inventoryTabId: activeTab.id,
            name: `Planta ${activeTab.name || "principal"}`
          });
          const claimedEditor = normalizeResponsePlan(claimedPayload);
          nextPlans = claimedEditor?.plan?.id ? [claimedEditor.plan] : [];
        }
      }

      setPlans(nextPlans);
    } catch (requestError) {
      setError(requestError.message);
      notify?.(requestError.message, "danger");
    } finally {
      setPlansLoading(false);
    }
  }, [activeTab?.id, activeTab?.name, notify, permissions.update, token]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    setPlans([]);
    setView("list");
    setIsEditing(false);
    setEditor(null);
    setSelected(null);
  }, [activeTab?.id]);

  useEffect(() => {
    if (view === "list") {
      if (!editor && /^\/plantas\/[^/]+(?:\/editor)?$/.test(window.location.pathname)) return;
      window.history.replaceState(null, "", "/plantas");
    } else if (editor?.plan?.id) {
      window.history.replaceState(null, "", isEditing ? `/plantas/${editor.plan.id}/editor` : `/plantas/${editor.plan.id}`);
    }
  }, [editor, isEditing, view]);

  useEffect(() => {
    setCanvasViewBox(null);
  }, [activeFloorId, editor?.plan?.id]);

  useEffect(() => {
    if (!isEditing || !selected) return undefined;
    const stage = stageRef.current;
    const catalog = catalogRef.current;
    if (!stage || !catalog) return undefined;

    let frame = 0;
    const updateInspectorHeight = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const stageBox = stage.getBoundingClientRect();
        const catalogBox = catalog.getBoundingClientRect();
        const availableHeight = Math.max(180, Math.min(
          stageBox.height - 20,
          catalogBox.top - stageBox.top - 20
        ));
        stage.style.setProperty("--floor-plan-inspector-max-height", `${availableHeight}px`);
      });
    };

    updateInspectorHeight();
    const resizeObserver = new ResizeObserver(updateInspectorHeight);
    resizeObserver.observe(stage);
    resizeObserver.observe(catalog);
    window.addEventListener("resize", updateInspectorHeight);
    window.addEventListener("scroll", updateInspectorHeight, true);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateInspectorHeight);
      window.removeEventListener("scroll", updateInspectorHeight, true);
      stage.style.removeProperty("--floor-plan-inspector-max-height");
    };
  }, [activeCatalog, isEditing, selected]);

  const markDirty = useCallback(() => {
    setSaveState((current) => (current === "saving" ? "saving" : "dirty"));
  }, []);

  const commitEditor = useCallback((updater, { track = true } = {}) => {
    setEditor((current) => {
      if (!current) return current;
      const before = cloneEditor(current);
      const next = typeof updater === "function" ? updater(cloneEditor(current)) : updater;
      if (next) {
        next.objects = syncAnchoredOpenings(ensureRoomWallObjects(next.objects || [], next.zones || []));
      }
      if (track) {
        setPast((items) => [...items.slice(-29), before]);
        setFuture([]);
      }
      return next;
    });
    markDirty();
  }, [markDirty]);

  const persistEditor = useCallback(async () => {
    if (!editor?.plan?.id || !permissions.update) return;
    setSaveState("saving");
    try {
      const payload = await saveFloorPlanEditorData(token, editor.plan.id, buildEditorPayload(editor));
      const updated = normalizeResponsePlan(payload);
      setEditor(updated);
      setActiveFloorId((current) => current || updated?.plan?.activeFloorId || updated?.floors?.[0]?.id || "");
      setPlans((current) => current.map((plan) => (plan.id === updated.plan.id ? { ...plan, ...updated.plan } : plan)));
      setSaveState("saved");
    } catch (requestError) {
      setSaveState("error");
      setError(requestError.message);
      notify?.(requestError.message, "danger");
    }
  }, [editor, notify, permissions.update, token]);

  useEffect(() => {
    if (saveState !== "dirty" || !editor?.plan?.id) return undefined;
    window.clearTimeout(autosaveRef.current);
    autosaveRef.current = window.setTimeout(() => {
      persistEditor();
    }, 900);
    return () => window.clearTimeout(autosaveRef.current);
  }, [editor, persistEditor, saveState]);

  const openPlan = useCallback(async (id, editing = false) => {
    setPlansLoading(true);
    setError("");
    try {
      const payload = await fetchFloorPlan(token, id);
      const loaded = normalizeResponsePlan(payload);
      setEditor(loaded);
      setActiveFloorId(loaded?.plan?.activeFloorId || loaded?.floors?.[0]?.id || "");
      setSelected(null);
      setPast([]);
      setFuture([]);
      setSaveState("saved");
      setIsEditing(editing);
      setView("editor");
    } catch (requestError) {
      setError(requestError.message);
      notify?.(requestError.message, "danger");
    } finally {
      setPlansLoading(false);
    }
  }, [notify, token]);

  useEffect(() => {
    if (!plansLoading && view === "list" && plans.length > 0) {
      const routeMatch = window.location.pathname.match(/^\/plantas\/([^/]+)(\/editor)?$/);
      const routePlan = routeMatch && plans.find((plan) => plan.id === routeMatch[1]);
      openPlan(routePlan?.id || plans[0].id, Boolean(routePlan && routeMatch?.[2]));
    }
  }, [openPlan, plans, plansLoading, view]);

  const createNewPlan = useCallback(async () => {
    if (!permissions.create) return;
    setPlansLoading(true);
    try {
      const payload = await createFloorPlan(token, {
        name: `Planta ${activeTab?.name || "principal"}`,
        inventoryTabId: activeTab?.id || null,
        company: "IT Guardian",
        unit: "Unidade principal",
        floorLabel: "Planta 1",
        status: "draft",
        ...DEFAULT_PLAN_SIZE
      });
      const created = normalizeResponsePlan(payload);
      setPlans((current) => [created.plan, ...current]);
      setEditor(created);
      setActiveFloorId(created?.plan?.activeFloorId || created?.floors?.[0]?.id || "");
      setIsEditing(true);
      setView("editor");
      notify?.("Planta criada.", "ok");
    } catch (requestError) {
      notify?.(requestError.message, "danger");
    } finally {
      setPlansLoading(false);
    }
  }, [activeTab?.id, activeTab?.name, notify, permissions.create, token]);

  const duplicatePlan = useCallback(async (id) => {
    try {
      const payload = await duplicateFloorPlan(token, id);
      const duplicated = normalizeResponsePlan(payload);
      setPlans((current) => [duplicated.plan, ...current]);
      notify?.("Planta duplicada.", "ok");
    } catch (requestError) {
      notify?.(requestError.message, "danger");
    }
  }, [notify, token]);

  const removePlan = useCallback(async (plan) => {
    if (!window.confirm(`Excluir a planta "${plan.name}"? Esta acao nao pode ser desfeita.`)) return;
    try {
      await deleteFloorPlan(token, plan.id);
      setPlans((current) => current.filter((entry) => entry.id !== plan.id));
      notify?.("Planta removida.", "ok");
    } catch (requestError) {
      notify?.(requestError.message, "danger");
    }
  }, [notify, token]);

  const removeEntity = useCallback((target) => {
    if (!target) return;
    commitEditor((draft) => {
      const collectionKey = target.type === "object"
        ? "objects"
        : target.type === "zone"
          ? "zones"
          : target.type === "point"
            ? "connectionPoints"
            : "cableRoutes";
      if (target.type === "zone") {
        const cascade = removeRoomCascade(draft.objects || [], draft.zones || [], target.id);
        draft.objects = cascade.objects;
        draft.zones = cascade.zones;
        draft.connectionPoints = (draft.connectionPoints || []).filter((point) => point.metadata?.parentRoomId !== target.id);
      } else {
        draft[collectionKey] = target.type === "object"
          ? removeObjectCascade(draft[collectionKey] || [], target.id)
          : (draft[collectionKey] || []).filter((entry) => entry.id !== target.id);
      }
      return draft;
    });
    setSelected((current) => current?.type === target.type && current?.id === target.id ? null : current);
    if (target.type === "object") {
      setSelectedObjectIds((current) => current.filter((id) => id !== target.id));
    }
  }, [commitEditor]);

  const updateSelectedEntity = useCallback((patch) => {
    if (!selected) return;
    if (patch.remove) {
      removeEntity(selected);
      return;
    }
    commitEditor((draft) => {
      const collectionKey = selected.type === "object"
        ? "objects"
        : selected.type === "zone"
          ? "zones"
          : selected.type === "point"
            ? "connectionPoints"
            : "cableRoutes";
      draft[collectionKey] = draft[collectionKey].map((entry) => {
        if (entry.id !== selected.id) return entry;
        if (selected.type === "zone" && isRoomZone(entry) && (patch.x !== undefined || patch.y !== undefined || patch.width !== undefined || patch.height !== undefined)) {
          return normalizeRoomZone({ ...entry, geometry: { ...entry.geometry, ...patch } }, draft.plan);
        }
        if (selected.type === "object") {
          const floor = getActiveFloor(draft, activeFloorId);
          const updated = { ...entry, ...patch };
          if (isAnchoredOpening(updated)) {
            const parentWall = (draft.objects || []).find((object) => object.id === updated.metadata?.parentObjectId);
            return parentWall ? resolveAnchoredOpening(updated, parentWall) : updated;
          }
          return constrainObjectToBounds(updated, draft, floor);
        }
        return { ...entry, ...patch };
      });
      if (selected.type === "object") draft.objects = syncAnchoredOpenings(draft.objects || []);
      return draft;
    });
  }, [activeFloorId, commitEditor, removeEntity, selected]);

  const handleEntitySelect = useCallback((target, event) => {
    if (paintDraft) return;
    if (!target) {
      if (selectedTool !== "delete") {
        setSelected(null);
        setSelectedObjectIds([]);
      }
      return;
    }
    if (selectedTool === "delete") {
      removeEntity(target);
      return;
    }
    if (target.type === "object") {
      if (event?.shiftKey || event?.ctrlKey || event?.metaKey) {
        setSelectedObjectIds((current) => {
          const next = current.includes(target.id)
            ? current.filter((id) => id !== target.id)
            : [...current, target.id];
          setSelected(next.length ? { type: "object", id: next[next.length - 1] } : null);
          return next;
        });
        return;
      }
      setSelectedObjectIds((current) => current.includes(target.id) ? current : [target.id]);
    } else {
      setSelectedObjectIds([]);
    }
    setSelected(target);
  }, [paintDraft, removeEntity, selectedTool]);

  const addCatalogItem = useCallback((item) => {
    const floor = getActiveFloor(editor, activeFloorId);
    if (!floor) return;
    if (item.category === "zone") {
      handleToolChange(item.zoneType === "segment" ? "segment-brush" : "group-brush");
      return;
    }
    if (isWallObject(item)) {
      setMode("2d");
      setSelectedTool("select");
      setSelected(null);
      setPlacement({ kind: "wall", item, start: null, end: null, gridSize: getFineSnapSize(editor) });
      return;
    }
    if (isOpeningObject(item)) {
      const hasWall = (editor.objects || []).some((object) => object.floorId === floor.id && isWallObject(object));
      if (!hasWall) {
        notify?.("Crie uma parede antes de posicionar portas ou janelas.", "warning");
        return;
      }
      setMode("2d");
      setSelectedTool("select");
      setSelected(null);
      setPlacement({ kind: "opening", item });
      return;
    }
    const centerX = Math.round((floor.width || DEFAULT_PLAN_SIZE.width) / 2);
    const centerY = Math.round((floor.height || DEFAULT_PLAN_SIZE.height) / 2);

    commitEditor((draft) => {
      const fineSnapSize = getFineSnapSize(draft);
      const { bounds: placementBounds, parentRoomId } = getDefaultPlacementBounds(draft, floor);
      const placementCenterX = placementBounds.x + placementBounds.width / 2;
      const placementCenterY = placementBounds.y + placementBounds.height / 2;
      if (item.category === "point") {
        const point = {
          id: createId("point"),
          planId: draft.plan.id,
          floorId: floor.id,
          pointType: item.pointType,
          label: item.label,
          linkedObjectId: null,
          x: snap(placementCenterX, fineSnapSize),
          y: snap(placementCenterY, fineSnapSize),
          metadata: { parentRoomId }
        };
        draft.connectionPoints = [...(draft.connectionPoints || []), point];
        setSelected({ type: "point", id: point.id });
        return draft;
      }
      if (item.category === "route") {
        const route = {
          id: createId("route"),
          planId: draft.plan.id,
          floorId: floor.id,
          routeType: item.routeType,
          label: item.label,
          sourcePointId: null,
          targetPointId: null,
          path: [
            { x: centerX - 90, y: centerY },
            { x: centerX + 90, y: centerY }
          ],
          color: item.color,
          metadata: { ...(item.metadata || {}) }
        };
        draft.cableRoutes = [...(draft.cableRoutes || []), route];
        setSelected({ type: "route", id: route.id });
        return draft;
      }
      const object = {
        id: createId("object"),
        planId: draft.plan.id,
        floorId: floor.id,
        objectType: item.objectType || item.id,
        category: item.category || "asset",
        label: item.label,
        linkedAssetId: null,
        groupId: null,
        segmentId: null,
        x: snap(placementCenterX - (item.width || 80) / 2, fineSnapSize),
        y: snap(placementCenterY - (item.height || 56) / 2, fineSnapSize),
        width: item.width || 80,
        height: item.height || 56,
        rotation: 0,
        z: 0,
        height3d: {
          desk: 46,
          meeting_table: 46,
          chair: 78,
          cabinet: 96,
          shelf: 92,
          pc: 68,
          notebook: 42,
          printer: 46,
          switch: 16,
          rack: 112,
          access_point: 12,
          server: 104,
          router: 20,
          tv: 52,
          camera: 34,
          stabilizer_600: 36,
          stabilizer_1000: 44,
          extension_cord: 10,
          power_strip: 10
        }[item.objectType] || (item.category === "asset" ? 56 : item.category === "structure" ? 92 : 42),
        color: item.color || "#1f7a61",
        metadata: { ...(item.metadata || {}), parentRoomId }
      };
      const constrainedObject = constrainObjectToBounds(object, draft, floor);
      const anchoredObject = isDesktopObject(constrainedObject)
        ? centerAssetOnTable(constrainedObject, findNearestTable(constrainedObject, draft.objects || []))
        : constrainedObject;
      draft.objects = [...(draft.objects || []), anchoredObject];
      setSelected({ type: "object", id: anchoredObject.id });
      return draft;
    });
  }, [activeFloorId, commitEditor, editor, handleToolChange, notify]);

  const getSvgPoint = useCallback((event) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    return {
      x: ((event.clientX - rect.left) / rect.width) * viewBox.width + viewBox.x,
      y: ((event.clientY - rect.top) / rect.height) * viewBox.height + viewBox.y
    };
  }, []);

  const updatePaintDraft = useCallback((patch) => {
    setPaintDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      if (patch.groupId !== undefined && current.areaType === "group") {
        next.color = groups.find((group) => group.id === patch.groupId)?.color || next.color;
      }
      if (patch.parentAreaId !== undefined && current.areaType === "segment") {
        const parentArea = savedGroupAreas.find((area) => area.id === patch.parentAreaId);
        next.groupId = parentArea?.groupId || "";
        const compatible = segments.find((segment) => (
          !parentArea?.groupId || !segment.groupId || segment.groupId === parentArea.groupId
        ));
        next.segmentId = compatible?.id || "";
        next.color = compatible?.color || "#22c55e";
        next.cellSize = parentArea ? getPaintCellSize(parentArea) : next.cellSize;
      }
      if (patch.segmentId !== undefined && current.areaType === "segment") {
        next.color = segments.find((segment) => segment.id === patch.segmentId)?.color || next.color;
      }
      return next;
    });
  }, [groups, savedGroupAreas, segments]);

  const applyPaintAtPoint = useCallback((point) => {
    setPaintDraft((current) => {
      if (!current) return current;
      const parentArea = current.areaType === "segment"
        ? savedGroupAreas.find((area) => area.id === current.parentAreaId)
        : null;
      const allowedCells = parentArea ? getPaintCells(parentArea) : null;
      if (current.mode === "bucket") {
        const room = (editor?.zones || []).find((zone) => {
          if (zone.floorId !== activeFloorId || !isRoomZone(zone)) return false;
          const geometry = getRoomGeometry(zone);
          return point.x >= geometry.x && point.x <= geometry.x + geometry.width
            && point.y >= geometry.y && point.y <= geometry.y + geometry.height;
        });
        if (!room) {
          notify?.("Nao foi possivel completar a area. Verifique se o espaco esta fechado por paredes.", "warning");
          return current;
        }
        return {
          ...current,
          cells: paintCells(current.cells, fillRoomCells(room, current.cellSize, allowedCells), allowedCells)
        };
      }
      const brushCells = getBrushCells(point, current.brushSize, current.cellSize);
      return {
        ...current,
        cells: current.mode === "eraser"
          ? eraseCells(current.cells, brushCells)
          : paintCells(current.cells, brushCells, allowedCells)
      };
    });
  }, [activeFloorId, editor?.zones, notify, savedGroupAreas]);

  const confirmPaintArea = useCallback(() => {
    if (!paintDraft?.cells?.length) {
      notify?.("Nenhuma area foi demarcada.", "warning");
      return;
    }
    const group = groups.find((entry) => entry.id === paintDraft.groupId) || null;
    const segment = segments.find((entry) => entry.id === paintDraft.segmentId) || null;
    if (paintDraft.areaType === "group" && !group) {
      notify?.("Selecione o grupo da area demarcada.", "warning");
      return;
    }
    const parentArea = paintDraft.areaType === "segment"
      ? savedGroupAreas.find((area) => area.id === paintDraft.parentAreaId)
      : null;
    if (paintDraft.areaType === "segment" && (!parentArea || !segment)) {
      notify?.("Selecione a area de grupo e o segmento antes de confirmar.", "warning");
      return;
    }
    if (parentArea?.groupId && segment?.groupId && parentArea.groupId !== segment.groupId) {
      notify?.("O segmento selecionado nao pertence ao grupo desta area.", "warning");
      return;
    }
    let createdAreaId = null;
    commitEditor((draft) => {
      const area = createPaintAreaZone({
        id: createId("zone"),
        planId: draft.plan.id,
        floorId: activeFloorId,
        areaType: paintDraft.areaType,
        name: segment?.name || group?.name || "Area demarcada",
        color: segment?.color || group?.color || paintDraft.color,
        cells: paintDraft.cells,
        cellSize: paintDraft.cellSize,
        groupId: parentArea?.groupId || group?.id || null,
        segmentId: segment?.id || null,
        parentAreaId: parentArea?.id || null
      });
      area.orderIndex = (draft.zones || []).length;
      createdAreaId = area.id;
      draft.zones = [...(draft.zones || []), area];
      return draft;
    });
    setPaintDraft(null);
    setSelectedTool("select");
    if (createdAreaId) setSelected({ type: "zone", id: createdAreaId });
    notify?.("Area demarcada e vinculada com sucesso.", "ok");
  }, [activeFloorId, commitEditor, groups, notify, paintDraft, savedGroupAreas, segments]);

  const cancelPaintArea = useCallback(() => {
    if (paintDraft?.cells?.length && !window.confirm("Cancelar demarcacao atual?")) return;
    setPaintDraft(null);
    paintPointerRef.current = false;
    setSelectedTool("select");
  }, [paintDraft?.cells?.length]);

  const handleCanvasWheel = useCallback((event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const floor = getActiveFloor(editor, activeFloorId);
    if (!floor) return;
    const floorWidth = Number(floor.width || editor?.plan?.width || DEFAULT_PLAN_SIZE.width);
    const floorHeight = Number(floor.height || editor?.plan?.height || DEFAULT_PLAN_SIZE.height);
    const current = canvasViewBox || { x: 0, y: 0, width: floorWidth, height: floorHeight };
    const pointer = getSvgPoint(event);
    const factor = event.deltaY < 0 ? 0.86 : 1.14;
    const nextWidth = clamp(current.width * factor, floorWidth * 0.25, floorWidth);
    const nextHeight = clamp(current.height * factor, floorHeight * 0.25, floorHeight);
    const widthRatio = nextWidth / current.width;
    const heightRatio = nextHeight / current.height;
    setCanvasViewBox({
      x: clamp(pointer.x - (pointer.x - current.x) * widthRatio, 0, Math.max(0, floorWidth - nextWidth)),
      y: clamp(pointer.y - (pointer.y - current.y) * heightRatio, 0, Math.max(0, floorHeight - nextHeight)),
      width: nextWidth,
      height: nextHeight
    });
  }, [activeFloorId, canvasViewBox, editor, getSvgPoint]);

  const buildRoomPlacementPreview = useCallback((template, point, rotation = 0) => {
    const floor = getActiveFloor(editor, activeFloorId);
    if (!floor || !template) return null;
    const snapSize = editor?.plan?.snapSize || DEFAULT_PLAN_SIZE.snapSize;
    const size = rotateRoomSize(template.width, template.height, rotation);
    const geometry = clampRoomGeometry({
      x: snapToGrid(point.x - size.width / 2, snapSize),
      y: snapToGrid(point.y - size.height / 2, snapSize),
      width: size.width,
      height: size.height
    }, floor, snapSize);
    const zone = normalizeRoomZone({
      id: "placement-preview",
      planId: editor.plan.id,
      floorId: floor.id,
      zoneType: "room",
      name: template.label,
      color: template.color,
      geometry,
      metadata: {
        room: {
          templateId: template.id,
          shape: "rect",
          rotation,
          wallThickness: 10,
          wallHeight: 110,
          metersPerGridCell: editor.plan.metersPerGridCell || 0.5
        }
      }
    }, editor.plan);

    return {
      zone,
      geometry,
      valid: isRoomPlacementValid(geometry, floor, editor.zones || []),
      rotation
    };
  }, [activeFloorId, editor]);

  const buildDraggedRoomPreview = useCallback((template, start, end, rotation = 0) => {
    const floor = getActiveFloor(editor, activeFloorId);
    if (!floor || !template || !start || !end) return null;
    const snapSize = editor?.plan?.snapSize || DEFAULT_PLAN_SIZE.snapSize;
    const defaultSize = rotateRoomSize(template.width, template.height, rotation);
    const snappedStart = {
      x: snapToGrid(start.x, snapSize),
      y: snapToGrid(start.y, snapSize)
    };
    const snappedEnd = {
      x: snapToGrid(end.x, snapSize),
      y: snapToGrid(end.y, snapSize)
    };
    const draggedWidth = Math.abs(snappedEnd.x - snappedStart.x);
    const draggedHeight = Math.abs(snappedEnd.y - snappedStart.y);

    if (draggedWidth < snapSize * 2 && draggedHeight < snapSize * 2) {
      return buildRoomPlacementPreview(template, start, rotation);
    }

    const geometry = clampRoomGeometry({
      x: Math.min(snappedStart.x, snappedEnd.x),
      y: Math.min(snappedStart.y, snappedEnd.y),
      width: Math.max(defaultSize.width, draggedWidth),
      height: Math.max(defaultSize.height, draggedHeight)
    }, floor, snapSize);
    const zone = normalizeRoomZone({
      id: "placement-preview",
      planId: editor.plan.id,
      floorId: floor.id,
      zoneType: "room",
      name: template.label,
      color: template.color,
      geometry,
      metadata: {
        room: {
          templateId: template.id,
          shape: "rect",
          rotation,
          wallThickness: 10,
          wallHeight: 110,
          metersPerGridCell: editor.plan.metersPerGridCell || 0.5
        }
      }
    }, editor.plan);

    return {
      zone,
      geometry,
      valid: isRoomPlacementValid(geometry, floor, editor.zones || []),
      rotation
    };
  }, [activeFloorId, buildRoomPlacementPreview, editor]);

  const beginRoomPlacement = useCallback((template) => {
    if (!editor) return;
    setMode("2d");
    setSelectedTool("select");
    setActiveCatalog("rooms");
    setSelected(null);
    setPlacement({ kind: "room", template, rotation: 0, preview: null });
  }, [editor]);

  const updateRoomPlacementPreview = useCallback((event) => {
    if (placement?.kind !== "room") return;
    const point = getSvgPoint(event);
    const preview = placement.start
      ? buildDraggedRoomPreview(placement.template, placement.start, point, placement.rotation)
      : buildRoomPlacementPreview(placement.template, point, placement.rotation);
    setPlacement((current) => (current ? { ...current, preview } : current));
  }, [buildDraggedRoomPreview, buildRoomPlacementPreview, getSvgPoint, placement]);

  const commitRoomPlacement = useCallback((placementState, preview) => {
    if (!placementState?.template || !preview?.valid) {
      notify?.("Escolha uma area livre da planta para posicionar o comodo.", "warning");
      return false;
    }
    const floor = getActiveFloor(editor, activeFloorId);
    if (!floor) return false;
    let createdRoomId = null;
    const template = {
      ...placementState.template,
      width: preview.geometry.width,
      height: preview.geometry.height
    };

    commitEditor((draft) => {
      const { zone, objects } = createRoomEntitiesFromTemplate({
        template,
        floor,
        planId: draft.plan.id,
        createId,
        x: preview.geometry.x,
        y: preview.geometry.y,
        rotation: placementState.rotation
      });
      zone.orderIndex = (draft.zones || []).length;
      createdRoomId = zone.id;
      draft.zones = [...(draft.zones || []), normalizeRoomZone(zone, draft.plan)];
      draft.objects = syncAnchoredOpenings([
        ...(draft.objects || []),
        ...centerDesktopsOnTables(objects)
      ]);
      return draft;
    });

    if (createdRoomId) setSelected({ type: "zone", id: createdRoomId });
    setPlacement(null);
    return Boolean(createdRoomId);
  }, [activeFloorId, commitEditor, editor, notify]);

  const confirmRoomPlacement = useCallback((event) => {
    if (!placement) return;
    event.preventDefault();
    event.stopPropagation();
    const floor = getActiveFloor(editor, activeFloorId);
    if (!floor) return;
    const point = getSvgPoint(event);
    if (placement.kind === "wall") {
      if (!placement.start) {
        const snappedPoint = { x: snap(point.x, placement.gridSize || 5), y: snap(point.y, placement.gridSize || 5) };
        const start = snapPointToWallEndpoints(snappedPoint, editor.objects || [], floor.id);
        setPlacement((current) => current ? { ...current, start, end: start } : current);
        return;
      }
      let createdWallId = null;
      commitEditor((draft) => {
        const snappedEnd = {
          x: snap(point.x, placement.gridSize || 5),
          y: snap(point.y, placement.gridSize || 5)
        };
        const end = snapPointToWallEndpoints(snappedEnd, draft.objects || [], floor.id);
        const wall = createWallObjectFromPoints({
          id: createId("object"),
          planId: draft.plan.id,
          floorId: floor.id,
          item: placement.item,
          start: placement.start,
          end,
          gridSize: placement.gridSize || 5
        });
        createdWallId = wall.id;
        draft.objects = [...(draft.objects || []), wall];
        return draft;
      });
      if (createdWallId) setSelected({ type: "object", id: createdWallId });
      setPlacement((current) => current ? { ...current, start: null, end: null } : current);
      return;
    }
    if (placement.kind === "opening") {
      const nearest = findNearestWall(point, editor.objects || [], floor.id);
      if (!nearest) {
        notify?.("Clique sobre uma parede para encaixar a abertura.", "warning");
        return;
      }
      let createdOpeningId = null;
      commitEditor((draft) => {
        const opening = attachOpeningToWall({
          id: createId("object"),
          planId: draft.plan.id,
          floorId: floor.id,
          objectType: placement.item.objectType,
          category: "structure",
          label: placement.item.label,
          linkedAssetId: null,
          groupId: null,
          segmentId: null,
          x: point.x - Number(placement.item.width || 72) / 2,
          y: point.y - Number(placement.item.height || 16) / 2,
          width: placement.item.width || 72,
          height: placement.item.height || 16,
          rotation: 0,
          z: 0,
          height3d: placement.item.objectType === "window" ? 48 : 96,
          color: placement.item.color || "#64748b",
          metadata: { ...(placement.item.metadata || {}), parentRoomId: nearest.wall.metadata?.parentRoomId || null }
        }, nearest.wall, point);
        createdOpeningId = opening.id;
        draft.objects = [...(draft.objects || []), opening];
        return draft;
      });
      if (createdOpeningId) setSelected({ type: "object", id: createdOpeningId });
      return;
    }
    if (placement.kind !== "room") return;
    const preview = placement.preview || buildRoomPlacementPreview(placement.template, point, placement.rotation);
    setPlacement((current) => current ? { ...current, start: point, preview } : current);
  }, [activeFloorId, buildRoomPlacementPreview, commitEditor, editor, getSvgPoint, notify, placement]);

  const handleCanvasPointerDown = useCallback((event) => {
    if (paintDraft) {
      event.preventDefault();
      event.stopPropagation();
      const point = getSvgPoint(event);
      applyPaintAtPoint(point);
      paintPointerRef.current = paintDraft.mode !== "bucket";
      return;
    }
    if (placement) {
      confirmRoomPlacement(event);
      return;
    }
    if (selectedTool !== "select") return;
    event.preventDefault();
    event.stopPropagation();
    const point = getSvgPoint(event);
    const additive = Boolean(event.ctrlKey || event.metaKey);
    dragRef.current = { type: "marquee", startX: point.x, startY: point.y, additive };
    setSelectionBox({ x: point.x, y: point.y, width: 0, height: 0 });
    if (!additive) {
      setSelected(null);
      setSelectedObjectIds([]);
    }
  }, [applyPaintAtPoint, confirmRoomPlacement, getSvgPoint, paintDraft, placement, selectedTool]);

  const beginDrag = useCallback((event, type, id) => {
    if (selectedTool !== "select" || placement || paintDraft) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getSvgPoint(event);
    const entity = type === "object"
      ? editor.objects.find((entry) => entry.id === id)
      : type === "zone"
        ? editor.zones.find((entry) => entry.id === id)
        : editor.connectionPoints.find((entry) => entry.id === id);
    if (!entity) return;
    if (type === "object" && (event.shiftKey || event.ctrlKey || event.metaKey)) {
      handleEntitySelect({ type, id }, event);
      return;
    }
    const origin = type === "zone" ? entity.geometry || {} : entity;
    const objectIds = type === "object" && selectedObjectIds.includes(id)
      ? selectedObjectIds
      : type === "object"
        ? [id]
        : [];
    dragRef.current = {
      id,
      type,
      startX: point.x,
      startY: point.y,
      originX: origin.x || 0,
      originY: origin.y || 0,
      originObject: type === "object" ? { ...entity } : null,
      selectedObjectOrigins: type === "object"
        ? (editor.objects || []).filter((object) => objectIds.includes(object.id)).map((object) => ({ ...object }))
        : [],
      originGeometry: type === "zone" ? getRoomGeometry(entity) : null,
      childObjects: type === "zone" && isRoomZone(entity)
        ? (editor.objects || []).filter((object) => object.metadata?.parentRoomId === id).map((object) => ({ ...object }))
        : [],
      childPoints: type === "zone" && isRoomZone(entity)
        ? (editor.connectionPoints || []).filter((pointEntry) => pointEntry.metadata?.parentRoomId === id).map((pointEntry) => ({ ...pointEntry }))
        : []
    };
    setPast((items) => [...items.slice(-29), cloneEditor(editor)]);
    setFuture([]);
    setSelected({ type, id });
    setSelectedObjectIds(objectIds);
  }, [editor, getSvgPoint, handleEntitySelect, paintDraft, placement, selectedObjectIds, selectedTool]);

  const moveDrag = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = getSvgPoint(event);
    if (drag.type === "marquee") {
      setSelectionBox(normalizeSelectionRect({ x: drag.startX, y: drag.startY }, point));
      return;
    }
    const floor = getActiveFloor(editor, activeFloorId);
    const snapSize = drag.type === "object" || drag.type === "object-resize" || drag.type === "point"
      ? getFineSnapSize(editor)
      : editor?.plan?.snapSize || 25;
    const nextX = snap(drag.originX + point.x - drag.startX, snapSize);
    const nextY = snap(drag.originY + point.y - drag.startY, snapSize);
    const deltaX = nextX - drag.originX;
    const deltaY = nextY - drag.originY;
    commitEditor((draft) => {
      if (drag.type === "object") {
        const draftFloor = getActiveFloor(draft, activeFloorId) || floor;
        const origins = drag.selectedObjectOrigins?.length
          ? drag.selectedObjectOrigins
          : [drag.originObject].filter(Boolean);
        const selectedIds = new Set(origins.map((object) => object.id));
        const movedTables = [];
        draft.objects = (draft.objects || []).map((object) => {
          if (!selectedIds.has(object.id)) return object;
          const objectOrigin = origins.find((entry) => entry.id === object.id) || object;
          const proposedX = Number(objectOrigin.x || 0) + deltaX;
          const proposedY = Number(objectOrigin.y || 0) + deltaY;
          if (isAnchoredOpening(object)) {
            const parentWall = (draft.objects || []).find((entry) => entry.id === object.metadata.parentObjectId);
            if (parentWall) {
              return attachOpeningToWall(object, parentWall, {
                x: proposedX + Number(object.width || 0) / 2,
                y: proposedY + Number(object.height || 0) / 2
              });
            }
          }
          const movedObject = constrainObjectToBounds(object, draft, draftFloor, { x: proposedX, y: proposedY });
          if (isTableObject(movedObject)) movedTables.push(movedObject);
          return movedObject;
        });
        for (const movedTable of movedTables) {
          draft.objects = centerLinkedAssetsOnTable(draft.objects, movedTable);
        }
        draft.objects = syncAnchoredOpenings(draft.objects);
      } else if (drag.type === "zone") {
        let movedRoom = false;
        draft.zones = draft.zones.map((zone) => {
          if (zone.id !== drag.id) return zone;
          const geometry = {
            ...zone.geometry,
            x: clamp(nextX, 0, (floor?.width || DEFAULT_PLAN_SIZE.width) - (zone.geometry?.width || 180)),
            y: clamp(nextY, 0, (floor?.height || DEFAULT_PLAN_SIZE.height) - (zone.geometry?.height || 120))
          };
          movedRoom = isRoomZone(zone);
          return normalizeRoomZone({ ...zone, geometry }, draft.plan);
        });
        if (movedRoom) {
          draft.objects = (draft.objects || []).map((object) => {
            const origin = drag.childObjects.find((entry) => entry.id === object.id);
            return origin ? { ...object, x: origin.x + deltaX, y: origin.y + deltaY } : object;
          });
          draft.objects = syncAnchoredOpenings(draft.objects);
          draft.connectionPoints = (draft.connectionPoints || []).map((pointEntry) => {
            const origin = drag.childPoints.find((entry) => entry.id === pointEntry.id);
            return origin ? { ...pointEntry, x: origin.x + deltaX, y: origin.y + deltaY } : pointEntry;
          });
        }
      } else if (drag.type === "room-resize") {
        const pointerDeltaX = point.x - drag.startX;
        const pointerDeltaY = point.y - drag.startY;
        const resized = resizeRoomGeometry({
          geometry: drag.originGeometry,
          side: drag.side,
          deltaX: pointerDeltaX,
          deltaY: pointerDeltaY,
          floor,
          snapSize
        });
        const roomDeltaX = resized.x - drag.originGeometry.x;
        const roomDeltaY = resized.y - drag.originGeometry.y;
        draft.zones = draft.zones.map((zone) => (
          zone.id === drag.id ? normalizeRoomZone({ ...zone, geometry: resized }, draft.plan) : zone
        ));
        draft.objects = (draft.objects || []).map((object) => {
          const origin = drag.childObjects.find((entry) => entry.id === object.id);
          return origin ? { ...object, x: origin.x + roomDeltaX, y: origin.y + roomDeltaY } : object;
        });
        draft.objects = syncAnchoredOpenings(draft.objects);
        draft.connectionPoints = (draft.connectionPoints || []).map((pointEntry) => {
          const origin = drag.childPoints.find((entry) => entry.id === pointEntry.id);
          return origin ? { ...pointEntry, x: origin.x + roomDeltaX, y: origin.y + roomDeltaY } : pointEntry;
        });
      } else if (drag.type === "object-resize") {
        const draftFloor = getActiveFloor(draft, activeFloorId) || floor;
        const pointerDeltaX = point.x - drag.startX;
        const pointerDeltaY = point.y - drag.startY;
        let resizedObject = null;
        draft.objects = (draft.objects || []).map((object) => {
          if (object.id !== drag.id) return object;
          resizedObject = isWallObject(drag.originObject || object)
            ? resizeWallEndpoint(drag.originObject || object, drag.side, point, draft.objects || [], snapSize)
            : resizeObjectGeometry({
              object: drag.originObject || object,
              side: drag.side,
              deltaX: pointerDeltaX,
              deltaY: pointerDeltaY,
              editor: draft,
              floor: draftFloor,
              snapSize
            });
          return resizedObject;
        });
        if (resizedObject && isTableObject(resizedObject)) {
          draft.objects = centerLinkedAssetsOnTable(draft.objects, resizedObject);
        }
        draft.objects = syncAnchoredOpenings(draft.objects);
      } else if (drag.type === "point") {
        draft.connectionPoints = draft.connectionPoints.map((pointEntry) => (
          pointEntry.id === drag.id
            ? {
              ...pointEntry,
              x: clamp(nextX, 0, floor?.width || DEFAULT_PLAN_SIZE.width),
              y: clamp(nextY, 0, floor?.height || DEFAULT_PLAN_SIZE.height)
            }
            : pointEntry
        ));
      }
      return draft;
    }, { track: false });
  }, [activeFloorId, commitEditor, editor, getSvgPoint]);

  const endDrag = useCallback((event) => {
    paintPointerRef.current = false;
    if (dragRef.current?.type === "marquee") {
      const point = event ? getSvgPoint(event) : {
        x: dragRef.current.startX,
        y: dragRef.current.startY
      };
      const rectangle = normalizeSelectionRect(
        { x: dragRef.current.startX, y: dragRef.current.startY },
        point
      );
      const selectedObjects = findObjectsInSelectionRect(editor?.objects || [], rectangle, activeFloorId);
      const ids = selectedObjects.map((object) => object.id);
      const additive = Boolean(dragRef.current.additive);
      setSelectedObjectIds((current) => {
        const nextIds = additive ? [...new Set([...current, ...ids])] : ids;
        setSelected(nextIds.length ? { type: "object", id: nextIds[nextIds.length - 1] } : null);
        return nextIds;
      });
      setSelectionBox(null);
      dragRef.current = null;
      return;
    }
    if (paintDraft) {
      dragRef.current = null;
      return;
    }
    if (placement?.kind === "room" && placement.start) {
      const point = event ? getSvgPoint(event) : placement.start;
      const preview = buildDraggedRoomPreview(
        placement.template,
        placement.start,
        point,
        placement.rotation
      ) || placement.preview;
      commitRoomPlacement(placement, preview);
    }
    dragRef.current = null;
  }, [activeFloorId, buildDraggedRoomPreview, commitRoomPlacement, editor?.objects, getSvgPoint, paintDraft, placement]);

  const beginRoomResize = useCallback((event, zoneId, side) => {
    if (!editor) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getSvgPoint(event);
    const zone = (editor.zones || []).find((entry) => entry.id === zoneId);
    if (!zone || !isRoomZone(zone)) return;
    dragRef.current = {
      id: zoneId,
      type: "room-resize",
      side,
      startX: point.x,
      startY: point.y,
      originX: zone.geometry?.x || 0,
      originY: zone.geometry?.y || 0,
      originGeometry: getRoomGeometry(zone),
      childObjects: (editor.objects || []).filter((object) => object.metadata?.parentRoomId === zoneId).map((object) => ({ ...object })),
      childPoints: (editor.connectionPoints || []).filter((pointEntry) => pointEntry.metadata?.parentRoomId === zoneId).map((pointEntry) => ({ ...pointEntry }))
    };
    setPast((items) => [...items.slice(-29), cloneEditor(editor)]);
    setFuture([]);
    setSelected({ type: "zone", id: zoneId });
    setSelectedObjectIds([]);
  }, [editor, getSvgPoint]);

  const beginObjectResize = useCallback((event, objectId, side) => {
    if (!editor) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getSvgPoint(event);
    const object = (editor.objects || []).find((entry) => entry.id === objectId);
    if (!object) return;
    dragRef.current = {
      id: objectId,
      type: "object-resize",
      side,
      startX: point.x,
      startY: point.y,
      originX: object.x || 0,
      originY: object.y || 0,
      originObject: { ...object }
    };
    setPast((items) => [...items.slice(-29), cloneEditor(editor)]);
    setFuture([]);
    setSelected({ type: "object", id: objectId });
    setSelectedObjectIds([objectId]);
  }, [editor, getSvgPoint]);

  const deleteSelectedEntity = useCallback(() => {
    if (selectedObjectIds.length > 1) {
      commitEditor((draft) => {
        let objects = draft.objects || [];
        for (const objectId of selectedObjectIds) objects = removeObjectCascade(objects, objectId);
        draft.objects = objects;
        return draft;
      });
      setSelected(null);
      setSelectedObjectIds([]);
      return;
    }
    if (!selected) return;
    updateSelectedEntity({ remove: true });
  }, [commitEditor, selected, selectedObjectIds, updateSelectedEntity]);

  const moveObjectFrom3D = useCallback((objectId, position) => {
    commitEditor((draft) => {
      const draftFloor = getActiveFloor(draft, activeFloorId);
      let movedTable = null;
      draft.objects = (draft.objects || []).map((object) => {
        if (object.id !== objectId) return object;
        if (isAnchoredOpening(object)) {
          const parentWall = (draft.objects || []).find((entry) => entry.id === object.metadata.parentObjectId);
          if (parentWall) {
            return attachOpeningToWall(object, parentWall, {
              x: Number(position.x || 0) + Number(object.width || 0) / 2,
              y: Number(position.y || 0) + Number(object.height || 0) / 2
            });
          }
        }
        const moved = constrainObjectToBounds(object, draft, draftFloor, position);
        if (isTableObject(moved)) movedTable = moved;
        return moved;
      });
      if (movedTable) draft.objects = centerLinkedAssetsOnTable(draft.objects, movedTable);
      draft.objects = syncAnchoredOpenings(draft.objects);
      return draft;
    });
  }, [activeFloorId, commitEditor]);

  const duplicateSelectedRoom = useCallback(() => {
    if (selected?.type !== "zone") return;
    const zone = (editor?.zones || []).find((entry) => entry.id === selected.id);
    if (!zone || !isRoomZone(zone)) return;
    const floor = getActiveFloor(editor, activeFloorId);
    if (!floor) return;
    const snapSize = editor?.plan?.snapSize || DEFAULT_PLAN_SIZE.snapSize;
    const baseGeometry = getRoomGeometry(zone);
    const offsets = [
      { x: snapSize * 4, y: snapSize * 4 },
      { x: baseGeometry.width + snapSize * 2, y: 0 },
      { x: 0, y: baseGeometry.height + snapSize * 2 },
      { x: -(baseGeometry.width + snapSize * 2), y: 0 },
      { x: 0, y: -(baseGeometry.height + snapSize * 2) }
    ];
    const geometry = offsets
      .map((offset) => clampRoomGeometry({
        ...baseGeometry,
        x: snapToGrid(baseGeometry.x + offset.x, snapSize),
        y: snapToGrid(baseGeometry.y + offset.y, snapSize)
      }, floor, snapSize))
      .find((candidate) => isRoomPlacementValid(candidate, floor, editor.zones || []));
    if (!geometry) {
      notify?.("Nao ha espaco livre ao lado para duplicar este comodo.", "warning");
      return;
    }
    let nextRoomId = null;
    commitEditor((draft) => {
      const deltaX = geometry.x - baseGeometry.x;
      const deltaY = geometry.y - baseGeometry.y;
      const duplicatedZone = normalizeRoomZone({
        ...zone,
        id: createId("zone"),
        name: `${zone.name} copia`,
        geometry,
        orderIndex: (draft.zones || []).length
      }, draft.plan);
      nextRoomId = duplicatedZone.id;
      const sourceWalls = new Map((draft.objects || [])
        .filter((object) => object.metadata?.parentRoomId === zone.id && object.metadata?.generatedFromRoom)
        .map((object) => [object.id, object]));
      const duplicatedObjects = (draft.objects || [])
        .filter((object) => object.metadata?.parentRoomId === zone.id && !object.metadata?.generatedFromRoom)
        .map((object) => {
          const parentWall = sourceWalls.get(object.metadata?.parentObjectId);
          return {
            ...object,
            id: createId("object"),
            x: (object.x || 0) + deltaX,
            y: (object.y || 0) + deltaY,
            metadata: {
              ...(object.metadata || {}),
              parentRoomId: duplicatedZone.id,
              ...(parentWall?.metadata?.roomWallSide
                ? { parentObjectId: getRoomWallId(duplicatedZone.id, parentWall.metadata.roomWallSide) }
                : {})
            }
          };
        });
      const duplicatedPoints = (draft.connectionPoints || [])
        .filter((pointEntry) => pointEntry.metadata?.parentRoomId === zone.id)
        .map((pointEntry) => ({
          ...pointEntry,
          id: createId("point"),
          x: (pointEntry.x || 0) + deltaX,
          y: (pointEntry.y || 0) + deltaY,
          metadata: { ...(pointEntry.metadata || {}), parentRoomId: duplicatedZone.id }
        }));
      draft.zones = [...(draft.zones || []), duplicatedZone];
      draft.objects = [...(draft.objects || []), ...duplicatedObjects];
      draft.connectionPoints = [...(draft.connectionPoints || []), ...duplicatedPoints];
      return draft;
    });
    if (nextRoomId) setSelected({ type: "zone", id: nextRoomId });
  }, [activeFloorId, commitEditor, editor, notify, selected]);

  const rotateSelectedRoom = useCallback(() => {
    if (selected?.type === "object") {
      commitEditor((draft) => {
        const draftFloor = getActiveFloor(draft, activeFloorId);
        let rotatedTable = null;
        draft.objects = (draft.objects || []).map((object) => {
          if (object.id !== selected.id) return object;
          const isDoor = object.objectType === "door";
          const isSlidingDoor = isDoor && ["sliding", "pocket"].includes(object.metadata?.doorType);
          const toggledDoorMetadata = isSlidingDoor
            ? { slideDirection: object.metadata?.slideDirection === "left" ? "right" : "left" }
            : { swing: object.metadata?.swing === "outward" ? "inward" : "outward" };
          if (isAnchoredOpening(object)) {
            return isDoor
              ? {
                ...object,
                metadata: {
                  ...(object.metadata || {}),
                  ...toggledDoorMetadata
                }
              }
              : object;
          }
          const rotatedObject = constrainObjectToBounds({
            ...object,
            rotation: (Number(object.rotation || 0) + 90) % 360,
            metadata: {
              ...(object.metadata || {}),
              ...(isDoor ? toggledDoorMetadata : {})
            }
          }, draft, draftFloor);
          if (isTableObject(rotatedObject)) rotatedTable = rotatedObject;
          return rotatedObject;
        });
        if (rotatedTable) {
          draft.objects = centerLinkedAssetsOnTable(draft.objects, rotatedTable);
        }
        draft.objects = syncAnchoredOpenings(draft.objects);
        return draft;
      });
      return;
    }
    if (selected?.type !== "zone") {
      if (placement) {
        setPlacement((current) => current ? { ...current, rotation: (current.rotation + 90) % 180, preview: null } : current);
      }
      return;
    }
    const zone = (editor?.zones || []).find((entry) => entry.id === selected.id);
    if (!zone || !isRoomZone(zone)) return;
    const floor = getActiveFloor(editor, activeFloorId);
    if (!floor) return;
    const geometry = getRoomGeometry(zone);
    const centerX = geometry.x + geometry.width / 2;
    const centerY = geometry.y + geometry.height / 2;
    const nextSize = rotateRoomSize(geometry.width, geometry.height, 90);
    const snapSize = editor?.plan?.snapSize || DEFAULT_PLAN_SIZE.snapSize;
    const nextGeometry = clampRoomGeometry({
      x: snapToGrid(centerX - nextSize.width / 2, snapSize),
      y: snapToGrid(centerY - nextSize.height / 2, snapSize),
      width: nextSize.width,
      height: nextSize.height
    }, floor, snapSize);
    if (!isRoomPlacementValid(nextGeometry, floor, editor.zones || [], zone.id)) {
      notify?.("Nao foi possivel girar: o comodo ocuparia uma area ja usada.", "warning");
      return;
    }
    commitEditor((draft) => {
      const deltaX = nextGeometry.x - geometry.x;
      const deltaY = nextGeometry.y - geometry.y;
      draft.zones = (draft.zones || []).map((entry) => {
        if (entry.id !== zone.id) return entry;
        return normalizeRoomZone({
          ...entry,
          geometry: nextGeometry,
          metadata: {
            ...(entry.metadata || {}),
            room: {
              ...(entry.metadata?.room || {}),
              rotation: ((entry.metadata?.room?.rotation || 0) + 90) % 180
            }
          }
        }, draft.plan);
      });
      draft.objects = (draft.objects || []).map((object) => (
        object.metadata?.parentRoomId === zone.id ? { ...object, x: (object.x || 0) + deltaX, y: (object.y || 0) + deltaY } : object
      ));
      draft.connectionPoints = (draft.connectionPoints || []).map((pointEntry) => (
        pointEntry.metadata?.parentRoomId === zone.id ? { ...pointEntry, x: (pointEntry.x || 0) + deltaX, y: (pointEntry.y || 0) + deltaY } : pointEntry
      ));
      return draft;
    });
  }, [activeFloorId, commitEditor, editor, notify, placement, selected]);

  const handleCanvasPointerMove = useCallback((event) => {
    if (paintDraft && paintPointerRef.current) {
      applyPaintAtPoint(getSvgPoint(event));
      return;
    }
    if (placement?.kind === "room") {
      updateRoomPlacementPreview(event);
      return;
    }
    if (placement?.kind === "wall" && placement.start) {
      const point = getSvgPoint(event);
      const gridPoint = {
        x: snapToGrid(point.x, editor?.plan?.snapSize || DEFAULT_PLAN_SIZE.snapSize),
        y: snapToGrid(point.y, editor?.plan?.snapSize || DEFAULT_PLAN_SIZE.snapSize)
      };
      const endpoint = snapPointToWallEndpoints(
        gridPoint,
        editor?.objects || [],
        activeFloorId,
        null,
        Math.max(18, editor?.plan?.snapSize || DEFAULT_PLAN_SIZE.snapSize)
      );
      setPlacement((current) => current ? { ...current, end: endpoint } : current);
      return;
    }
    moveDrag(event);
  }, [activeFloorId, applyPaintAtPoint, editor, getSvgPoint, moveDrag, paintDraft, placement, updateRoomPlacementPreview]);

  const expandCanvas = useCallback((axis) => {
    commitEditor((draft) => {
      const activeFloor = getActiveFloor(draft, activeFloorId);
      if (!activeFloor) return draft;
      const widthIncrement = axis === "width" ? 320 : 0;
      const heightIncrement = axis === "height" ? 205 : 0;
      draft.floors = (draft.floors || []).map((floorEntry) => (
        floorEntry.id === activeFloor.id
          ? {
            ...floorEntry,
            width: Number(floorEntry.width || draft.plan?.width || DEFAULT_PLAN_SIZE.width) + widthIncrement,
            height: Number(floorEntry.height || draft.plan?.height || DEFAULT_PLAN_SIZE.height) + heightIncrement
          }
          : floorEntry
      ));
      draft.plan = {
        ...draft.plan,
        width: Math.max(...draft.floors.map((floorEntry) => Number(floorEntry.width || DEFAULT_PLAN_SIZE.width))),
        height: Math.max(...draft.floors.map((floorEntry) => Number(floorEntry.height || DEFAULT_PLAN_SIZE.height)))
      };
      return draft;
    });
    setCanvasViewBox(null);
  }, [activeFloorId, commitEditor]);

  const undo = useCallback(() => {
    setPast((items) => {
      if (items.length === 0) return items;
      const previous = items[items.length - 1];
      setFuture((futureItems) => [cloneEditor(editor), ...futureItems.slice(0, 29)]);
      setEditor(previous);
      markDirty();
      return items.slice(0, -1);
    });
  }, [editor, markDirty]);

  const redo = useCallback(() => {
    setFuture((items) => {
      if (items.length === 0) return items;
      const next = items[0];
      setPast((pastItems) => [...pastItems.slice(-29), cloneEditor(editor)]);
      setEditor(next);
      markDirty();
      return items.slice(1);
    });
  }, [editor, markDirty]);

  useEffect(() => {
    if (view !== "editor") return undefined;
    const handleKeyDown = (event) => {
      const tagName = event.target?.tagName?.toLowerCase();
      if (["input", "textarea", "select"].includes(tagName) || event.target?.isContentEditable) return;
      if (event.key === "Escape") {
        if (paintDraft) {
          event.preventDefault();
          setPaintDraft(null);
          paintPointerRef.current = false;
          setSelectedTool("select");
          return;
        }
        if (placement) {
          event.preventDefault();
          setPlacement(null);
          return;
        }
        setSelected(null);
        setSelectedObjectIds([]);
        setSelectionBox(null);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        rotateSelectedRoom();
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelectedEntity();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelectedRoom();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelectedEntity, duplicateSelectedRoom, paintDraft, placement, redo, rotateSelectedRoom, undo, view]);

  const linkObject = useCallback(async (objectId, assetId) => {
    const device = devices.find((entry) => entry.id === assetId);
    updateSelectedEntity({
      linkedAssetId: assetId || null,
      label: device ? deviceLabel(device) : undefined,
      groupId: device?.groupId || null,
      segmentId: device?.segmentId || null
    });
    if (!permissions.linkInventory || !objectId) return;
    try {
      await linkFloorPlanObjectToAsset(token, objectId, {
        assetId: assetId || null,
        label: device ? deviceLabel(device) : undefined,
        groupId: device?.groupId || null,
        segmentId: device?.segmentId || null
      });
      notify?.("Vinculo atualizado.", "ok");
    } catch (requestError) {
      notify?.(requestError.message, "danger");
    }
  }, [devices, notify, permissions.linkInventory, token, updateSelectedEntity]);

  if (view === "list") {
    return (
      <>
        {error && <div className="form-error floor-plan-error">{error}</div>}
        <FloorPlansList
          plans={plans}
          loading={plansLoading}
          query={listQuery}
          onQueryChange={setListQuery}
          onCreate={createNewPlan}
          onOpen={openPlan}
          onDuplicate={duplicatePlan}
          onDelete={removePlan}
          permissions={permissions}
        />
      </>
    );
  }

  const floor = getActiveFloor(editor, activeFloorId);

  return (
    <section className="floor-plan-editor-shell">
      <FloorPlanTopbar
        title={`Planta ${activeTab?.name || editor?.plan?.name || "principal"}`}
        onSave={persistEditor}
        mode={mode}
        onModeChange={setMode}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onUndo={undo}
        onRedo={redo}
        selectedTool={selectedTool}
        onToolChange={handleToolChange}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((current) => !current)}
        isEditing={isEditing}
        onEdit={() => setIsEditing(true)}
        canEdit={permissions.update}
      />

      <div className={`floor-plan-editor-layout ${isEditing ? "editing" : "view-only"}`}>
        <main className="floor-plan-canvas-panel">
          {isEditing && <PaintToolPanel
            draft={paintDraft}
            groups={groups}
            segments={segments}
            groupAreas={savedGroupAreas}
            onChange={updatePaintDraft}
            onConfirm={confirmPaintArea}
            onCancel={cancelPaintArea}
          />}

          <div className="floor-plan-stage" ref={stageRef}>
            <span className="floor-plan-dimensions-badge">
              <span>{Math.round(floor?.width || DEFAULT_PLAN_SIZE.width)} x {Math.round(floor?.height || DEFAULT_PLAN_SIZE.height)}</span>
              {isEditing ? (
                <span className="floor-plan-canvas-expand-actions">
                  <button
                    type="button"
                    title="Aumentar largura da area"
                    aria-label="Aumentar largura da area"
                    onClick={() => expandCanvas("width")}
                  >
                    <Plus size={13} aria-hidden="true" />
                    <span>L</span>
                  </button>
                  <button
                    type="button"
                    title="Aumentar altura da area"
                    aria-label="Aumentar altura da area"
                    onClick={() => expandCanvas("height")}
                  >
                    <Plus size={13} aria-hidden="true" />
                    <span>A</span>
                  </button>
                </span>
              ) : null}
            </span>
            {mode === "2d" ? (
              <FloorPlanCanvas
                data={editor}
                editor={editor}
                activeFloorId={activeFloorId}
                selected={isEditing ? selected : null}
                selectedObjectIds={isEditing ? selectedObjectIds : []}
                selectionBox={isEditing ? selectionBox : null}
                selectedTool={selectedTool}
                onSelect={isEditing ? handleEntitySelect : () => {}}
                onPointerDown={isEditing ? beginDrag : () => {}}
                onCanvasPointerDown={isEditing ? handleCanvasPointerDown : () => {}}
                onPointerMove={isEditing ? handleCanvasPointerMove : () => {}}
                onPointerUp={isEditing ? endDrag : () => {}}
                onResizeStart={isEditing ? beginRoomResize : () => {}}
                onObjectResizeStart={isEditing ? beginObjectResize : () => {}}
                onDuplicateSelected={duplicateSelectedRoom}
                onDeleteSelected={deleteSelectedEntity}
                onRotateSelected={rotateSelectedRoom}
                placement={placement}
                paintDraft={paintDraft}
                viewBox={canvasViewBox}
                onWheel={handleCanvasWheel}
                svgRef={svgRef}
                showGrid={showGrid}
              />
            ) : (
              <Suspense fallback={<div className="floor-plan-loading">Carregando 3D...</div>}>
                <FloorPlanScene3D
                  data={editor}
                  activeFloorId={activeFloorId}
                  selected={isEditing ? selected : null}
                  onSelect={isEditing ? handleEntitySelect : () => {}}
                  onMoveObject={isEditing && selectedTool !== "delete" ? moveObjectFrom3D : () => {}}
                  onRotateSelected={rotateSelectedRoom}
                />
              </Suspense>
            )}

            {isEditing && <FloorPlanQuickActions activeSection={activeCatalog} onSectionChange={setActiveCatalog} />}

            {isEditing && selected && !paintDraft && <FloorPlanInspector
              editor={editor}
              selected={selected}
              onChangeSelected={updateSelectedEntity}
              onClearSelected={() => {
                setSelected(null);
                setSelectedObjectIds([]);
              }}
              devices={devices}
              permissions={permissions}
              onLinkObject={linkObject}
            />}
          </div>

          {isEditing && <FloorPlanCatalog
            activeSection={activeCatalog}
            onActiveSectionChange={setActiveCatalog}
            onAddItem={addCatalogItem}
            onSelectRoomTemplate={beginRoomPlacement}
            placement={placement}
            catalogRef={catalogRef}
          />}
        </main>

      </div>
    </section>
  );
}
