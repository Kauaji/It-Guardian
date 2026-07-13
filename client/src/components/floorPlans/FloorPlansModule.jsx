import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Grid3X3,
  Info,
  Layers3,
  Link2,
  Loader2,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Settings,
  Trash2,
  Undo2,
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
import { FLOOR_PLAN_CATALOG, FLOOR_PLAN_TOOLS, getCatalogItem } from "./floorPlanCatalog.js";

const FloorPlanScene3D = lazy(() => import("./FloorPlanScene3D.jsx"));

const DEFAULT_PLAN_SIZE = { width: 1280, height: 820, gridSize: 25, snapSize: 25 };

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneEditor(editor) {
  return editor ? JSON.parse(JSON.stringify(editor)) : editor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function snap(value, size = 25) {
  const numeric = Number(value);
  const snapSize = Number(size) || 1;
  return Math.round(numeric / snapSize) * snapSize;
}

function normalizeResponsePlan(payload) {
  return payload?.plan || payload || null;
}

function getActiveFloor(editor, activeFloorId) {
  return editor?.floors?.find((floor) => floor.id === activeFloorId) || editor?.floors?.[0] || null;
}

function buildEditorPayload(editor) {
  return {
    plan: editor.plan,
    floors: editor.floors || [],
    zones: editor.zones || [],
    objects: editor.objects || [],
    connectionPoints: editor.connectionPoints || [],
    cableRoutes: editor.cableRoutes || []
  };
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

function getSegmentName(segments, id) {
  return segments.find((segment) => segment.id === id)?.name || "Sem segmento";
}

function getGroupName(groups, id) {
  return groups.find((group) => group.id === id)?.name || "Sem grupo";
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

function FloorPlanCatalog({ activeSection, onActiveSectionChange, onAddItem }) {
  const section = FLOOR_PLAN_CATALOG.find((entry) => entry.id === activeSection) || FLOOR_PLAN_CATALOG[0];

  return (
    <section className="floor-plan-catalog">
      <nav aria-label="Catalogo da planta">
        {FLOOR_PLAN_CATALOG.map((entry) => (
          <button className={activeSection === entry.id ? "active" : ""} key={entry.id} type="button" onClick={() => onActiveSectionChange(entry.id)}>
            {entry.label}
          </button>
        ))}
      </nav>
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
    </section>
  );
}

function FloorPlanCanvas({
  editor,
  activeFloorId,
  selected,
  selectedTool,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
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

  if (!floor) return <EditorEmptyState />;

  return (
    <div className={`floor-plan-canvas-wrap tool-${selectedTool}`}>
      <svg
        ref={svgRef}
        className="floor-plan-canvas"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Editor 2D da planta"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
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

        {objects.map((object) => {
          const Icon = getObjectIcon(object.objectType);
          const objectSelected = selected?.type === "object" && selected.id === object.id;
          return (
            <g
              key={object.id}
              className={`floor-plan-object ${objectSelected ? "selected" : ""}`}
              transform={`translate(${object.x || 0} ${object.y || 0}) rotate(${object.rotation || 0} ${(object.width || 80) / 2} ${(object.height || 56) / 2})`}
              onPointerDown={(event) => onPointerDown(event, "object", object.id)}
              onClick={(event) => {
                event.stopPropagation();
                onSelect({ type: "object", id: object.id });
              }}
            >
              <rect width={object.width || 80} height={object.height || 56} rx="8" fill="#ffffff" stroke={object.color} strokeWidth={objectSelected ? 4 : 2} />
              <rect x="6" y="6" width={(object.width || 80) - 12} height={(object.height || 56) - 12} rx="6" fill={object.color} opacity="0.16" />
              {Icon ? (
                <foreignObject x="10" y="10" width="30" height="30">
                  <Icon size={24} color={object.color} />
                </foreignObject>
              ) : null}
              <text x="44" y="28">{object.label}</text>
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
  const [activeCatalog, setActiveCatalog] = useState("assets");
  const [mode, setMode] = useState("2d");
  const [saveState, setSaveState] = useState("saved");
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [error, setError] = useState("");
  const dragRef = useRef(null);
  const svgRef = useRef(null);
  const autosaveRef = useRef(null);

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
        setSelected(null);
        return draft;
      }
      draft[collectionKey] = draft[collectionKey].map((entry) => {
        if (entry.id !== selected.id) return entry;
        if (selected.type === "zone" && (patch.x !== undefined || patch.y !== undefined || patch.width !== undefined || patch.height !== undefined)) {
          return { ...entry, geometry: { ...entry.geometry, ...patch } };
        }
        return { ...entry, ...patch };
      });
      return draft;
    });
  }, [commitEditor, selected]);

  const addCatalogItem = useCallback((item) => {
    const floor = getActiveFloor(editor, activeFloorId);
    if (!floor) return;
    const centerX = Math.round((floor.width || DEFAULT_PLAN_SIZE.width) / 2);
    const centerY = Math.round((floor.height || DEFAULT_PLAN_SIZE.height) / 2);

    commitEditor((draft) => {
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
          x: centerX,
          y: centerY,
          metadata: {}
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
        x: centerX - (item.width || 80) / 2,
        y: centerY - (item.height || 56) / 2,
        width: item.width || 80,
        height: item.height || 56,
        rotation: 0,
        z: 0,
        height3d: item.category === "asset" ? 48 : 28,
        color: item.color || "#1f7a61",
        metadata: {}
      };
      draft.objects = [...(draft.objects || []), object];
      setSelected({ type: "object", id: object.id });
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

  const beginDrag = useCallback((event, type, id) => {
    if (selectedTool !== "select") return;
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
      originY: origin.y || 0
    };
    setPast((items) => [...items.slice(-29), cloneEditor(editor)]);
    setFuture([]);
    setSelected({ type, id });
  }, [editor, getSvgPoint, selectedTool]);

  const moveDrag = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = getSvgPoint(event);
    const floor = getActiveFloor(editor, activeFloorId);
    const snapSize = editor?.plan?.snapSize || 25;
    const nextX = snap(drag.originX + point.x - drag.startX, snapSize);
    const nextY = snap(drag.originY + point.y - drag.startY, snapSize);
    commitEditor((draft) => {
      if (drag.type === "object") {
        draft.objects = draft.objects.map((object) => (
          object.id === drag.id
            ? {
              ...object,
              x: clamp(nextX, 0, (floor?.width || DEFAULT_PLAN_SIZE.width) - (object.width || 80)),
              y: clamp(nextY, 0, (floor?.height || DEFAULT_PLAN_SIZE.height) - (object.height || 56))
            }
            : object
        ));
      } else if (drag.type === "zone") {
        draft.zones = draft.zones.map((zone) => (
          zone.id === drag.id
            ? {
              ...zone,
              geometry: {
                ...zone.geometry,
                x: clamp(nextX, 0, (floor?.width || DEFAULT_PLAN_SIZE.width) - (zone.geometry?.width || 180)),
                y: clamp(nextY, 0, (floor?.height || DEFAULT_PLAN_SIZE.height) - (zone.geometry?.height || 120))
              }
            }
            : zone
        ));
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
        onToolChange={setSelectedTool}
      />

      <div className="floor-plan-editor-layout">
        <FloorPlanToolRail selectedTool={selectedTool} onToolChange={setSelectedTool} />

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
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              svgRef={svgRef}
            />
          ) : (
            <Suspense fallback={<div className="floor-plan-loading">Carregando 3D...</div>}>
              <FloorPlanScene3D data={editor} activeFloorId={activeFloorId} />
            </Suspense>
          )}

          <FloorPlanCatalog activeSection={activeCatalog} onActiveSectionChange={setActiveCatalog} onAddItem={addCatalogItem} />
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
