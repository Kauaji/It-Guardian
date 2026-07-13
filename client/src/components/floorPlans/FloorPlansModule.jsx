import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Grid3X3,
  Info,
  Layers3,
  Link2,
  Loader2,
  Plus,
  Redo2,
  Save,
  Search,
  Settings,
  Trash2,
  Undo2
} from "lucide-react";
import {
  createFloorPlan,
  deleteFloorPlan,
  duplicateFloorPlan,
  fetchFloorPlan,
  fetchFloorPlans,
  linkFloorPlanObjectToAsset,
  saveFloorPlanEditorData
} from "../../api.js";
import { FLOOR_PLAN_CATALOG, FLOOR_PLAN_TOOLS, getCatalogItem } from "./floorPlanCatalog.js";
import RoomCatalog from "./rooms/RoomCatalog.jsx";
import RoomPlacementPreview from "./rooms/RoomPlacementPreview.jsx";
import RoomRenderer from "./rooms/RoomRenderer.jsx";
import RoomSelectionOverlay from "./rooms/RoomSelectionOverlay.jsx";
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
  findNearestTable,
  getActiveFloor,
  getDefaultPlacementBounds,
  getFineSnapSize,
  getObjectCenter,
  getObjectSize,
  isDesktopObject,
  isPowerAccessoryObject,
  isTableObject,
  normalizeResponsePlan,
  resizeObjectGeometry,
  snap
} from "./utils/editorGeometry.js";

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

function FloorPlanTopbar({
  editor,
  activeFloorId,
  onBack,
  onSave,
  saveState,
  mode,
  onModeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  selectedTool,
  onToolChange
}) {
  const floors = editor?.floors || [];

  return (
    <header className="floor-plan-editor-topbar">
      <div className="floor-plan-editor-identity">
        <button className="icon-button" type="button" onClick={onBack} title="Voltar para plantas">
          <ArrowLeft size={18} />
        </button>
        <div>
          <strong>{editor?.plan?.name || "Planta"}</strong>
          <span>{floors.find((floor) => floor.id === activeFloorId)?.name || "Planta 1"}</span>
        </div>
      </div>

      <div className="floor-plan-editor-center-actions">
        <button className="icon-button" type="button" onClick={onUndo} disabled={!canUndo} title="Desfazer">
          <Undo2 size={17} />
        </button>
        <button className="icon-button" type="button" onClick={onRedo} disabled={!canRedo} title="Refazer">
          <Redo2 size={17} />
        </button>
        <span className={`floor-plan-save-state ${saveState}`}>
          {saveState === "saving" ? <Loader2 size={15} /> : <Check size={15} />}
          {saveState === "dirty" ? "Alteracoes pendentes" : saveState === "saving" ? "Salvando" : saveState === "error" ? "Erro ao salvar" : "Salvo"}
        </span>
      </div>

      <div className="floor-plan-editor-actions">
        <div className="segmented-control compact">
          <button className={mode === "2d" ? "active" : ""} type="button" onClick={() => onModeChange("2d")}>
            2D
          </button>
          <button className={mode === "3d" ? "active" : ""} type="button" onClick={() => onModeChange("3d")}>
            3D
          </button>
        </div>
        <button className="icon-button" type="button" onClick={() => onToolChange(selectedTool === "pan" ? "select" : "pan")} title="Mover tela">
          <Grid3X3 size={17} />
        </button>
        <button className="secondary-action compact-action" type="button" onClick={onSave}>
          <Save size={16} />
          Salvar
        </button>
      </div>
    </header>
  );
}

function FloorPlanToolRail({ selectedTool, onToolChange }) {
  return (
    <aside className="floor-plan-toolrail">
      {FLOOR_PLAN_TOOLS.map((tool) => {
        const Icon = tool.icon;
        return (
          <button
            className={selectedTool === tool.id ? "active" : ""}
            key={tool.id}
            type="button"
            onClick={() => onToolChange(tool.id)}
            title={tool.label}
          >
            <Icon size={18} />
            <span>{tool.label}</span>
          </button>
        );
      })}
    </aside>
  );
}

function FloorPlanCatalog({ activeSection, onActiveSectionChange, onAddItem, onSelectRoomTemplate, placement }) {
  const catalogSections = [{ id: "rooms", label: "Comodos" }, ...FLOOR_PLAN_CATALOG];
  const section = FLOOR_PLAN_CATALOG.find((entry) => entry.id === activeSection) || FLOOR_PLAN_CATALOG[0];

  return (
    <section className="floor-plan-catalog">
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
            return (
              <button key={item.id} type="button" onClick={() => onAddItem(item)}>
                <Icon size={22} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
      {placement ? (
        <div className="floor-plan-catalog-hint">
          Clique na planta para posicionar. Use R para girar e Esc para cancelar.
        </div>
      ) : null}
    </section>
  );
}

function ObjectSelectionOverlay({ object, onResizeStart }) {
  if (!object) return null;
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
    <g className="floor-plan-object-resize-overlay">
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

function FloorPlanCanvas({
  editor,
  activeFloorId,
  selected,
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
  viewBox,
  onWheel,
  svgRef
}) {
  const floor = getActiveFloor(editor, activeFloorId);
  const gridSize = editor?.plan?.gridSize || DEFAULT_PLAN_SIZE.gridSize;
  const zones = (editor?.zones || []).filter((zone) => zone.floorId === floor?.id);
  const objects = (editor?.objects || []).filter((object) => object.floorId === floor?.id);
  const points = (editor?.connectionPoints || []).filter((point) => point.floorId === floor?.id);
  const routes = (editor?.cableRoutes || []).filter((route) => route.floorId === floor?.id);
  const width = floor?.width || editor?.plan?.width || DEFAULT_PLAN_SIZE.width;
  const height = floor?.height || editor?.plan?.height || DEFAULT_PLAN_SIZE.height;
  const viewBoxValue = viewBox || { x: 0, y: 0, width, height };
  const selectedObject = objects.find((object) => selected?.type === "object" && selected.id === object.id);
  const powerLinks = objects
    .filter(isPowerAccessoryObject)
    .map((accessory) => {
      const target = findNearestDesktop(accessory, objects);
      return target ? { accessory, target } : null;
    })
    .filter(Boolean);

  if (!floor) return <EditorEmptyState />;

  return (
    <div className={`floor-plan-canvas-wrap tool-${selectedTool}`}>
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
        <rect x="0" y="0" width={width} height={height} fill="url(#floor-grid)" />

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

        {routes.map((route) => {
          const path = route.path || [];
          if (path.length < 2) return null;
          return (
            <polyline
              key={route.id}
              className={`floor-plan-route ${selected?.type === "route" && selected.id === route.id ? "selected" : ""}`}
              points={path.map((point) => `${point.x},${point.y}`).join(" ")}
              fill="none"
              stroke={route.color}
              strokeWidth={route.routeType === "power" ? 5 : 4}
              strokeDasharray={route.routeType === "power" ? "12 8" : "0"}
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
          const Icon = getObjectIcon(object.objectType);
          const objectSelected = selected?.type === "object" && selected.id === object.id;
          const objectWidth = object.width || 80;
          const objectHeight = object.height || 56;
          const hideObjectLabel = isTableObject(object);
          const iconSize = hideObjectLabel ? 30 : 24;
          const iconX = hideObjectLabel ? objectWidth / 2 - iconSize / 2 : 10;
          const iconY = hideObjectLabel ? objectHeight / 2 - iconSize / 2 : 10;
          return (
            <g
              key={object.id}
              className={`floor-plan-object ${objectSelected ? "selected" : ""}`}
              transform={`translate(${object.x || 0} ${object.y || 0}) rotate(${object.rotation || 0} ${objectWidth / 2} ${objectHeight / 2})`}
              onPointerDown={(event) => onPointerDown(event, "object", object.id)}
              onClick={(event) => {
                event.stopPropagation();
                onSelect({ type: "object", id: object.id });
              }}
            >
              <rect width={objectWidth} height={objectHeight} rx="8" fill="#ffffff" stroke={object.color} strokeWidth={objectSelected ? 4 : 2} />
              <rect x="6" y="6" width={objectWidth - 12} height={objectHeight - 12} rx="6" fill={object.color} opacity="0.16" />
              {object.objectType === "door" ? (
                <path
                  className="floor-plan-door-swing"
                  d={object.metadata?.swing === "outward"
                    ? `M 10 8 A ${Math.max(24, objectWidth - 20)} ${Math.max(24, objectWidth - 20)} 0 0 0 ${objectWidth - 10} ${objectHeight - 8}`
                    : `M 10 ${objectHeight - 8} A ${Math.max(24, objectWidth - 20)} ${Math.max(24, objectWidth - 20)} 0 0 1 ${objectWidth - 10} 8`}
                />
              ) : null}
              {Icon ? (
                <foreignObject x={iconX} y={iconY} width={iconSize + 6} height={iconSize + 6}>
                  <Icon size={iconSize} color={object.color} />
                </foreignObject>
              ) : null}
              {!hideObjectLabel ? <text x="44" y="28">{object.label}</text> : null}
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

        <RoomPlacementPreview preview={placement?.preview} plan={editor.plan} />
        <RoomSelectionOverlay
          zone={zones.find((zone) => selected?.type === "zone" && selected.id === zone.id && isRoomZone(zone))}
          plan={editor.plan}
          onResizeStart={onResizeStart}
          onDuplicate={onDuplicateSelected}
          onDelete={onDeleteSelected}
          onRotate={onRotateSelected}
        />
        <ObjectSelectionOverlay object={selectedObject} onResizeStart={onObjectResizeStart} />
      </svg>
    </div>
  );
}

function FloorPlanInspector({ editor, selected, onChangePlan, onChangeSelected, devices, groups, segments, permissions, onLinkObject }) {
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

  if (!selectedEntity) {
    return (
      <aside className="floor-plan-inspector">
        <header>
          <span>Propriedades</span>
          <Settings size={18} />
        </header>
        <label>
          Nome da planta
          <input value={editor?.plan?.name || ""} onChange={(event) => onChangePlan({ name: event.target.value })} />
        </label>
        <label>
          Empresa
          <input value={editor?.plan?.company || ""} onChange={(event) => onChangePlan({ company: event.target.value })} />
        </label>
        <label>
          Unidade / andar
          <input value={editor?.plan?.floorLabel || ""} onChange={(event) => onChangePlan({ floorLabel: event.target.value })} />
        </label>
        <label>
          Status
          <select value={editor?.plan?.status || "draft"} onChange={(event) => onChangePlan({ status: event.target.value })}>
            <option value="draft">Rascunho</option>
            <option value="active">Ativa</option>
            <option value="archived">Arquivada</option>
          </select>
        </label>
        <div className="floor-plan-inspector-note">
          <Info size={16} />
          Selecione um objeto da planta para editar vinculo, grupo, segmento e posicao.
        </div>
      </aside>
    );
  }

  const linkedDevice = selected.type === "object" ? devices.find((device) => device.id === selectedEntity.linkedAssetId) : null;

  return (
    <aside className="floor-plan-inspector">
      <header>
        <span>{selected.type === "object" ? "Ativo/objeto" : selected.type === "zone" ? "Zona" : selected.type === "point" ? "Ponto" : "Rota"}</span>
        <button className="icon-button" type="button" onClick={() => onChangeSelected({ remove: true })} title="Remover selecionado">
          <Trash2 size={17} />
        </button>
      </header>

      <label>
        Nome
        <input value={selectedEntity.label || selectedEntity.name || ""} onChange={(event) => onChangeSelected({ label: event.target.value, name: event.target.value })} />
      </label>

      {selected.type === "object" && (
        <>
          <label>
            Vinculo com inventario
            <select value={selectedEntity.linkedAssetId || ""} onChange={(event) => onLinkObject(selectedEntity.id, event.target.value)}>
              <option value="">Sem vinculo</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {deviceLabel(device)}
                </option>
              ))}
            </select>
          </label>
          {linkedDevice && (
            <div className="floor-plan-linked-asset">
              <strong>{deviceLabel(linkedDevice)}</strong>
              <span>{linkedDevice.ip || linkedDevice.hostname || "Sem IP informado"}</span>
              <span>{linkedDevice.status || "status nao informado"}</span>
            </div>
          )}
          <label>
            Grupo
            <select value={selectedEntity.groupId || ""} onChange={(event) => onChangeSelected({ groupId: event.target.value || null })}>
              <option value="">Sem grupo</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </label>
          <label>
            Segmento
            <select value={selectedEntity.segmentId || ""} onChange={(event) => onChangeSelected({ segmentId: event.target.value || null })}>
              <option value="">Sem segmento</option>
              {segments.map((segment) => (
                <option key={segment.id} value={segment.id}>{segment.name}</option>
              ))}
            </select>
          </label>
        </>
      )}

      {selected.type === "zone" && (
        <>
          <label>
            Grupo
            <select value={selectedEntity.groupId || ""} onChange={(event) => onChangeSelected({ groupId: event.target.value || null })}>
              <option value="">Sem grupo</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </label>
          <label>
            Segmento
            <select value={selectedEntity.segmentId || ""} onChange={(event) => onChangeSelected({ segmentId: event.target.value || null })}>
              <option value="">Sem segmento</option>
              {segments.map((segment) => (
                <option key={segment.id} value={segment.id}>{segment.name}</option>
              ))}
            </select>
          </label>
        </>
      )}

      <label>
        Cor
        <input type="color" value={selectedEntity.color || "#1f7a61"} onChange={(event) => onChangeSelected({ color: event.target.value })} />
      </label>

      {selected.type === "object" && (
        <div className="floor-plan-inspector-grid">
          <label>
            X
            <input type="number" value={Math.round(selectedEntity.x || 0)} onChange={(event) => onChangeSelected({ x: Number(event.target.value) })} />
          </label>
          <label>
            Y
            <input type="number" value={Math.round(selectedEntity.y || 0)} onChange={(event) => onChangeSelected({ y: Number(event.target.value) })} />
          </label>
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

      {!permissions.linkInventory && selected.type === "object" && (
        <div className="floor-plan-inspector-note">
          <Link2 size={16} />
          Seu usuario nao pode alterar vinculos com inventario.
        </div>
      )}
    </aside>
  );
}

export default function FloorPlansModule({ token, devices = [], segments = [], groups = [], notify, permissions = {} }) {
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [listQuery, setListQuery] = useState("");
  const [view, setView] = useState("list");
  const [editor, setEditor] = useState(null);
  const [activeFloorId, setActiveFloorId] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedTool, setSelectedTool] = useState("select");
  const [activeCatalog, setActiveCatalog] = useState("rooms");
  const [placement, setPlacement] = useState(null);
  const [mode, setMode] = useState("2d");
  const [saveState, setSaveState] = useState("saved");
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [error, setError] = useState("");
  const [canvasViewBox, setCanvasViewBox] = useState(null);
  const dragRef = useRef(null);
  const svgRef = useRef(null);
  const autosaveRef = useRef(null);

  const handleToolChange = useCallback((tool) => {
    setSelectedTool(tool);
    if (tool === "group-brush" || tool === "segment-brush") {
      setActiveCatalog("brushes");
    }
  }, []);

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setError("");
    try {
      const payload = await fetchFloorPlans(token);
      setPlans(payload.plans || []);
    } catch (requestError) {
      setError(requestError.message);
      notify?.(requestError.message, "danger");
    } finally {
      setPlansLoading(false);
    }
  }, [notify, token]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (view === "list") {
      window.history.replaceState(null, "", "/plantas");
    } else if (editor?.plan?.id) {
      window.history.replaceState(null, "", `/plantas/${editor.plan.id}/editor`);
    }
  }, [editor?.plan?.id, view]);

  useEffect(() => {
    setCanvasViewBox(null);
  }, [activeFloorId, editor?.plan?.id]);

  const markDirty = useCallback(() => {
    setSaveState((current) => (current === "saving" ? "saving" : "dirty"));
  }, []);

  const commitEditor = useCallback((updater, { track = true } = {}) => {
    setEditor((current) => {
      if (!current) return current;
      const before = cloneEditor(current);
      const next = typeof updater === "function" ? updater(cloneEditor(current)) : updater;
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

  const openPlan = useCallback(async (id) => {
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
      setView("editor");
    } catch (requestError) {
      setError(requestError.message);
      notify?.(requestError.message, "danger");
    } finally {
      setPlansLoading(false);
    }
  }, [notify, token]);

  const createNewPlan = useCallback(async () => {
    if (!permissions.create) return;
    setPlansLoading(true);
    try {
      const payload = await createFloorPlan(token, {
        name: "Nova planta",
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
      setView("editor");
      notify?.("Planta criada.", "ok");
    } catch (requestError) {
      notify?.(requestError.message, "danger");
    } finally {
      setPlansLoading(false);
    }
  }, [notify, permissions.create, token]);

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

  const updatePlanFields = useCallback((patch) => {
    commitEditor((draft) => ({
      ...draft,
      plan: { ...draft.plan, ...patch }
    }));
  }, [commitEditor]);

  const updateSelectedEntity = useCallback((patch) => {
    if (!selected) return;
    commitEditor((draft) => {
      const collectionKey = selected.type === "object"
        ? "objects"
        : selected.type === "zone"
          ? "zones"
          : selected.type === "point"
            ? "connectionPoints"
            : "cableRoutes";
      if (patch.remove) {
        draft[collectionKey] = draft[collectionKey].filter((entry) => entry.id !== selected.id);
        if (selected.type === "zone") {
          draft.objects = (draft.objects || []).filter((object) => object.metadata?.parentRoomId !== selected.id);
          draft.connectionPoints = (draft.connectionPoints || []).filter((point) => point.metadata?.parentRoomId !== selected.id);
        }
        setSelected(null);
        return draft;
      }
      draft[collectionKey] = draft[collectionKey].map((entry) => {
        if (entry.id !== selected.id) return entry;
        if (selected.type === "zone" && (patch.x !== undefined || patch.y !== undefined || patch.width !== undefined || patch.height !== undefined)) {
          return normalizeRoomZone({ ...entry, geometry: { ...entry.geometry, ...patch } }, draft.plan);
        }
        if (selected.type === "object") {
          const floor = getActiveFloor(draft, activeFloorId);
          return constrainObjectToBounds({ ...entry, ...patch }, draft, floor);
        }
        return { ...entry, ...patch };
      });
      return draft;
    });
  }, [activeFloorId, commitEditor, selected]);

  const addCatalogItem = useCallback((item) => {
    const floor = getActiveFloor(editor, activeFloorId);
    if (!floor) return;
    const centerX = Math.round((floor.width || DEFAULT_PLAN_SIZE.width) / 2);
    const centerY = Math.round((floor.height || DEFAULT_PLAN_SIZE.height) / 2);

    commitEditor((draft) => {
      const fineSnapSize = getFineSnapSize(draft);
      const { bounds: placementBounds, parentRoomId } = getDefaultPlacementBounds(draft, floor);
      const placementCenterX = placementBounds.x + placementBounds.width / 2;
      const placementCenterY = placementBounds.y + placementBounds.height / 2;
      if (item.category === "zone") {
        const group = item.zoneType === "group" ? groups[0] : groups.find((entry) => entry.id === segments[0]?.groupId) || groups[0];
        const segment = item.zoneType === "segment" ? segments[0] : null;
        const zone = {
          id: createId("zone"),
          planId: draft.plan.id,
          floorId: floor.id,
          zoneType: item.zoneType || "room",
          groupId: group?.id || null,
          segmentId: segment?.id || null,
          name: segment?.name || group?.name || item.label,
          color: segment?.color || group?.color || item.color,
          geometry: {
            x: centerX - (item.width || 200) / 2,
            y: centerY - (item.height || 140) / 2,
            width: item.width || 200,
            height: item.height || 140
          },
          orderIndex: (draft.zones || []).length,
          metadata: {}
        };
        draft.zones = [...(draft.zones || []), zone];
        setSelected({ type: "zone", id: zone.id });
        return draft;
      }
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
          metadata: {}
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
        height3d: item.category === "asset" ? 48 : item.category === "structure" ? 92 : 28,
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
  }, [activeFloorId, commitEditor, editor, groups, segments]);

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

  const beginRoomPlacement = useCallback((template) => {
    if (!editor) return;
    setMode("2d");
    setSelectedTool("select");
    setActiveCatalog("rooms");
    setSelected(null);
    setPlacement({ template, rotation: 0, preview: null });
  }, [editor]);

  const updateRoomPlacementPreview = useCallback((event) => {
    if (!placement) return;
    const point = getSvgPoint(event);
    const preview = buildRoomPlacementPreview(placement.template, point, placement.rotation);
    setPlacement((current) => (current ? { ...current, preview } : current));
  }, [buildRoomPlacementPreview, getSvgPoint, placement]);

  const confirmRoomPlacement = useCallback((event) => {
    if (!placement) return;
    event.preventDefault();
    event.stopPropagation();
    const floor = getActiveFloor(editor, activeFloorId);
    if (!floor) return;
    const point = getSvgPoint(event);
    const preview = placement.preview || buildRoomPlacementPreview(placement.template, point, placement.rotation);
    if (!preview?.valid) {
      notify?.("Escolha uma area livre da planta para posicionar o comodo.", "warning");
      return;
    }

    let createdRoomId = null;
    const template = {
      ...placement.template,
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
        rotation: placement.rotation
      });
      zone.orderIndex = (draft.zones || []).length;
      createdRoomId = zone.id;
      draft.zones = [...(draft.zones || []), normalizeRoomZone(zone, draft.plan)];
      draft.objects = [...(draft.objects || []), ...centerDesktopsOnTables(objects)];
      return draft;
    });

    if (createdRoomId) setSelected({ type: "zone", id: createdRoomId });
    setPlacement(null);
  }, [activeFloorId, buildRoomPlacementPreview, commitEditor, editor, getSvgPoint, notify, placement]);

  const beginDrag = useCallback((event, type, id) => {
    if (selectedTool !== "select" || placement) return;
    event.stopPropagation();
    const point = getSvgPoint(event);
    const entity = type === "object"
      ? editor.objects.find((entry) => entry.id === id)
      : type === "zone"
        ? editor.zones.find((entry) => entry.id === id)
        : editor.connectionPoints.find((entry) => entry.id === id);
    if (!entity) return;
    const origin = type === "zone" ? entity.geometry || {} : entity;
    dragRef.current = {
      id,
      type,
      startX: point.x,
      startY: point.y,
      originX: origin.x || 0,
      originY: origin.y || 0,
      originObject: type === "object" ? { ...entity } : null,
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
  }, [editor, getSvgPoint, placement, selectedTool]);

  const moveDrag = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = getSvgPoint(event);
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
        let movedTable = null;
        draft.objects = (draft.objects || []).map((object) => {
          if (object.id !== drag.id) return object;
          const movedObject = constrainObjectToBounds(object, draft, draftFloor, { x: nextX, y: nextY });
          if (isTableObject(movedObject)) movedTable = movedObject;
          return movedObject;
        });
        if (movedTable) {
          draft.objects = centerLinkedAssetsOnTable(draft.objects, movedTable);
        }
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
          resizedObject = resizeObjectGeometry({
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

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

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
  }, [editor, getSvgPoint]);

  const deleteSelectedEntity = useCallback(() => {
    if (!selected) return;
    updateSelectedEntity({ remove: true });
  }, [selected, updateSelectedEntity]);

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
      const duplicatedObjects = (draft.objects || [])
        .filter((object) => object.metadata?.parentRoomId === zone.id)
        .map((object) => ({
          ...object,
          id: createId("object"),
          x: (object.x || 0) + deltaX,
          y: (object.y || 0) + deltaY,
          metadata: { ...(object.metadata || {}), parentRoomId: duplicatedZone.id }
        }));
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
          const rotatedObject = constrainObjectToBounds({
            ...object,
            rotation: (Number(object.rotation || 0) + 90) % 360,
            metadata: {
              ...(object.metadata || {}),
              ...(isDoor ? { swing: object.metadata?.swing === "outward" ? "inward" : "outward" } : {})
            }
          }, draft, draftFloor);
          if (isTableObject(rotatedObject)) rotatedTable = rotatedObject;
          return rotatedObject;
        });
        if (rotatedTable) {
          draft.objects = centerLinkedAssetsOnTable(draft.objects, rotatedTable);
        }
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
    if (placement) {
      updateRoomPlacementPreview(event);
      return;
    }
    moveDrag(event);
  }, [moveDrag, placement, updateRoomPlacementPreview]);

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
        if (placement) {
          event.preventDefault();
          setPlacement(null);
          return;
        }
        setSelected(null);
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
  }, [deleteSelectedEntity, duplicateSelectedRoom, placement, redo, rotateSelectedRoom, undo, view]);

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

  const goBack = useCallback(async () => {
    if (saveState === "dirty") await persistEditor();
    setView("list");
    setEditor(null);
    setSelected(null);
    await loadPlans();
  }, [loadPlans, persistEditor, saveState]);

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
        editor={editor}
        activeFloorId={activeFloorId}
        onBack={goBack}
        onSave={persistEditor}
        saveState={saveState}
        mode={mode}
        onModeChange={setMode}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onUndo={undo}
        onRedo={redo}
        selectedTool={selectedTool}
        onToolChange={handleToolChange}
      />

      <div className="floor-plan-editor-layout">
        <FloorPlanToolRail selectedTool={selectedTool} onToolChange={handleToolChange} />

        <main className="floor-plan-canvas-panel">
          <div className="floor-plan-floorbar">
            <label>
              Andar
              <select value={activeFloorId} onChange={(event) => setActiveFloorId(event.target.value)}>
                {(editor?.floors || []).map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </label>
            <span>{Math.round(floor?.width || DEFAULT_PLAN_SIZE.width)} x {Math.round(floor?.height || DEFAULT_PLAN_SIZE.height)}</span>
          </div>

          {mode === "2d" ? (
            <FloorPlanCanvas
              editor={editor}
              activeFloorId={activeFloorId}
              selected={selected}
              selectedTool={selectedTool}
              onSelect={setSelected}
              onPointerDown={beginDrag}
              onCanvasPointerDown={confirmRoomPlacement}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={endDrag}
              onResizeStart={beginRoomResize}
              onObjectResizeStart={beginObjectResize}
              onDuplicateSelected={duplicateSelectedRoom}
              onDeleteSelected={deleteSelectedEntity}
              onRotateSelected={rotateSelectedRoom}
              placement={placement}
              viewBox={canvasViewBox}
              onWheel={handleCanvasWheel}
              svgRef={svgRef}
            />
          ) : (
            <Suspense fallback={<div className="floor-plan-loading">Carregando 3D...</div>}>
              <FloorPlanScene3D data={editor} activeFloorId={activeFloorId} />
            </Suspense>
          )}

          <FloorPlanCatalog
            activeSection={activeCatalog}
            onActiveSectionChange={setActiveCatalog}
            onAddItem={addCatalogItem}
            onSelectRoomTemplate={beginRoomPlacement}
            placement={placement}
          />
        </main>

        <FloorPlanInspector
          editor={editor}
          selected={selected}
          onChangePlan={updatePlanFields}
          onChangeSelected={updateSelectedEntity}
          devices={devices}
          groups={groups}
          segments={segments}
          permissions={permissions}
          onLinkObject={linkObject}
        />
      </div>
    </section>
  );
}
