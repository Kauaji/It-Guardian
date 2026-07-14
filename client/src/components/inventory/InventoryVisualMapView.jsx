import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Building2,
  Cable,
  Copy,
  Focus,
  Grid2X2,
  Layers3,
  Map,
  MousePointer2,
  Move3D,
  Pencil,
  PlugZap,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  Trash2
} from "lucide-react";
import {
  createInventoryVisualMap,
  createInventoryVisualMapConnection,
  createInventoryVisualMapObject,
  deleteInventoryVisualMap,
  deleteInventoryVisualMapConnection,
  deleteInventoryVisualMapObject,
  fetchInventoryVisualMap,
  fetchInventoryVisualMaps,
  updateInventoryVisualMap,
  updateInventoryVisualMapConnection,
  updateInventoryVisualMapObject
} from "../../api.js";
import InventoryVisualMapConnectionEditor from "./InventoryVisualMapConnectionEditor.jsx";
import InventoryVisualMapConnectionPanel from "./InventoryVisualMapConnectionPanel.jsx";
import InventoryVisualMapLayerPresetBar from "./InventoryVisualMapLayerPresetBar.jsx";
import InventoryVisualMapScene from "./InventoryVisualMapScene.jsx";
import {
  ELECTRICAL_PRESETS,
  INFRASTRUCTURE_PRESETS,
  VISUAL_MAP_LAYER_OPTIONS,
  buildDefaultConnectionDraft,
  getQuickLayerState
} from "./inventoryVisualMapConnectionUtils.js";

const STRUCTURE_PRESETS = [
  { type: "wall", label: "Parede" },
  { type: "partition", label: "Divisoria" },
  { type: "room", label: "Sala" },
  { type: "corridor", label: "Corredor" },
  { type: "desk", label: "Mesa" },
  { type: "rack", label: "Rack" }
];

const ASSET_PRESETS = [
  { type: "desktop", label: "Desktop" },
  { type: "notebook", label: "Notebook" },
  { type: "server", label: "Servidor" },
  { type: "switch", label: "Switch" },
  { type: "router", label: "Roteador" },
  { type: "access_point", label: "Access point" },
  { type: "printer", label: "Impressora" },
  { type: "ups", label: "Nobreak" },
  { type: "network_point", label: "Ponto de rede" },
  { type: "power_point", label: "Ponto eletrico" }
];

const LAYER_LABELS = VISUAL_MAP_LAYER_OPTIONS.reduce((labels, option) => {
  labels[option.key] = option.label;
  return labels;
}, {});

const ALL_OBJECT_PRESETS = [
  ...STRUCTURE_PRESETS,
  ...ASSET_PRESETS,
  ...INFRASTRUCTURE_PRESETS,
  ...ELECTRICAL_PRESETS
];

const METADATA_FIELDS = [
  { key: "circuit", label: "Circuito" },
  { key: "voltage", label: "Tensao" },
  { key: "panel", label: "Quadro" },
  { key: "breaker", label: "Disjuntor" },
  { key: "criticality", label: "Criticidade" },
  { key: "note", label: "Nota" }
];

const ASSET_TYPE_TO_PRESET = {
  desktop: "desktop",
  computador: "desktop",
  computer: "desktop",
  notebook: "notebook",
  laptop: "notebook",
  servidor: "server",
  server: "server",
  impressora: "printer",
  printer: "printer",
  switch: "switch",
  roteador: "router",
  router: "router",
  access_point: "access_point",
  ap: "access_point",
  nobreak: "ups",
  ups: "ups"
};

const EMPTY_MAP_DRAFT = {
  name: "",
  environmentId: "",
  groupId: "",
  segmentId: "",
  floorLabel: "",
  width: 30,
  depth: 20,
  scale: 1,
  notes: ""
};

function numberInputValue(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function draftsMatch(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function getNextObjectPosition(objects, map) {
  const step = 1.5;
  const columns = Math.max(1, Math.floor(Math.min(Number(map?.width) || 30, 18) / step));
  const index = objects.length;
  const column = index % columns;
  const row = Math.floor(index / columns);
  const startX = -((columns - 1) * step) / 2;
  const maxZ = Math.max(0, (Number(map?.depth) || 20) / 2 - 1);

  return {
    positionX: Number((startX + column * step).toFixed(1)),
    positionZ: Number(Math.min(maxZ, -maxZ + row * step).toFixed(1))
  };
}

function mapToDraft(map) {
  if (!map) return EMPTY_MAP_DRAFT;
  return {
    name: map.name || "",
    environmentId: map.environmentId || "",
    groupId: map.groupId || "",
    segmentId: map.segmentId || "",
    floorLabel: map.floorLabel || "",
    width: map.width || 30,
    depth: map.depth || 20,
    scale: map.scale || 1,
    notes: map.notes || ""
  };
}

function objectToDraft(object) {
  if (!object) return null;
  return {
    label: object.label || "",
    linkedAssetId: object.linkedAssetId || "",
    positionX: object.positionX ?? 0,
    positionY: object.positionY ?? 0,
    positionZ: object.positionZ ?? 0,
    rotationX: object.rotationX ?? 0,
    rotationY: object.rotationY ?? 0,
    rotationZ: object.rotationZ ?? 0,
    width: object.width ?? 1,
    depth: object.depth ?? 1,
    height: object.height ?? 1,
    color: object.color || "#2563eb",
    notes: object.notes || "",
    metadata: object.metadata || {}
  };
}

function connectionToDraft(connection) {
  if (!connection) return null;
  return {
    layer: connection.layer || "infrastructure",
    connectionType: connection.connectionType || "network_cable",
    label: connection.label || "",
    sourceObjectId: connection.sourceObjectId || "",
    targetObjectId: connection.targetObjectId || "",
    sourceAssetId: connection.sourceAssetId || "",
    targetAssetId: connection.targetAssetId || "",
    points: Array.isArray(connection.points) ? connection.points : buildDefaultConnectionDraft(connection.layer).points,
    color: connection.color || "#0ea5e9",
    thickness: connection.thickness || 2,
    dashed: !!connection.dashed,
    notes: connection.notes || "",
    metadata: connection.metadata || {}
  };
}

function layerLabel(layer) {
  return LAYER_LABELS[layer] || "Mapa";
}

function getDeviceName(device) {
  return device?.name || device?.hostname || device?.label || device?.id || "Ativo";
}

function getDevicePreset(device) {
  const rawType = String(device?.assetType || device?.type || device?.deviceType || "").toLowerCase();
  return ASSET_TYPE_TO_PRESET[rawType] || "desktop";
}

function getDeviceMeta(device, fallback = "Nao informado") {
  return {
    status: device?.status || fallback,
    ip: device?.ip || device?.address || fallback,
    os: device?.os || device?.operatingSystem || fallback,
    segment: device?.segmentName || device?.segment || fallback,
    group: device?.groupName || device?.group || fallback,
    environment: device?.tabName || device?.environmentName || fallback
  };
}

export default function InventoryVisualMapView({
  token,
  notify,
  devices = [],
  segments = [],
  groups = [],
  tabs = [],
  activeTab,
  canManage
}) {
  const [maps, setMaps] = useState([]);
  const [activeMapId, setActiveMapId] = useState("");
  const [activeMap, setActiveMap] = useState(null);
  const [mapDraft, setMapDraft] = useState(EMPTY_MAP_DRAFT);
  const [objects, setObjects] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [objectDraft, setObjectDraft] = useState(null);
  const [connectionDraft, setConnectionDraft] = useState(null);
  const [assetToAdd, setAssetToAdd] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("view");
  const [showGrid, setShowGrid] = useState(true);
  const [layers, setLayers] = useState(getQuickLayerState("all"));
  const [cameraAction, setCameraAction] = useState({ type: "fit", revision: 0 });

  const selectedObject = useMemo(
    () => objects.find((object) => object.id === selectedObjectId) || null,
    [objects, selectedObjectId]
  );
  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.id === selectedConnectionId) || null,
    [connections, selectedConnectionId]
  );
  const linkedDevice = useMemo(
    () => devices.find((device) => device.id === selectedObject?.linkedAssetId) || null,
    [devices, selectedObject]
  );
  const linkedDeviceMeta = useMemo(() => getDeviceMeta(linkedDevice), [linkedDevice]);

  const activeMapOption = useMemo(
    () => maps.find((map) => map.id === activeMapId) || null,
    [activeMapId, maps]
  );
  const mapDirty = useMemo(
    () => Boolean(activeMap && !draftsMatch(mapDraft, mapToDraft(activeMap))),
    [activeMap, mapDraft]
  );
  const objectDirty = useMemo(
    () => Boolean(selectedObject && objectDraft && !draftsMatch(objectDraft, objectToDraft(selectedObject))),
    [objectDraft, selectedObject]
  );
  const connectionDirty = useMemo(
    () => Boolean(selectedConnection && connectionDraft && !draftsMatch(connectionDraft, connectionToDraft(selectedConnection))),
    [connectionDraft, selectedConnection]
  );
  const hasUnsavedChanges = mapDirty || objectDirty || connectionDirty;
  const isEditing = Boolean(canManage && mode === "edit");
  const usedAssetIds = useMemo(
    () => new Set(objects.map((object) => object.linkedAssetId).filter(Boolean)),
    [objects]
  );

  const confirmDiscardChanges = useCallback((message = "Descartar as alteracoes nao salvas?") => {
    if (!hasUnsavedChanges) return true;
    return window.confirm(message);
  }, [hasUnsavedChanges]);

  const loadMaps = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchInventoryVisualMaps(token);
      const nextMaps = response.maps || [];
      setMaps(nextMaps);
      setActiveMapId((current) => {
        if (current && nextMaps.some((map) => map.id === current)) return current;
        return nextMaps[0]?.id || "";
      });
    } catch (loadError) {
      setError(loadError.message || "Nao foi possivel carregar os mapas visuais.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadActiveMap = useCallback(async () => {
    if (!activeMapId) {
      setActiveMap(null);
      setMapDraft(EMPTY_MAP_DRAFT);
      setObjects([]);
      setConnections([]);
      setSelectedObjectId(null);
      setSelectedConnectionId(null);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetchInventoryVisualMap(token, activeMapId);
      setActiveMap(response.map);
      setMapDraft(mapToDraft(response.map));
      setObjects(response.objects || []);
      setConnections(response.connections || []);
      setSelectedObjectId((current) => {
        if (current && (response.objects || []).some((object) => object.id === current)) return current;
        return (response.objects || [])[0]?.id || null;
      });
      setSelectedConnectionId((current) => {
        if (current && (response.connections || []).some((connection) => connection.id === current)) return current;
        return null;
      });
    } catch (loadError) {
      setError(loadError.message || "Nao foi possivel abrir o mapa visual.");
    } finally {
      setLoading(false);
    }
  }, [activeMapId, token]);

  useEffect(() => {
    loadMaps();
  }, [loadMaps]);

  useEffect(() => {
    loadActiveMap();
  }, [loadActiveMap]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    setObjectDraft(objectToDraft(selectedObject));
  }, [selectedObject]);

  useEffect(() => {
    setConnectionDraft(connectionToDraft(selectedConnection));
  }, [selectedConnection]);

  useEffect(() => {
    if (selectedObject && layers?.[selectedObject.layer] === false) {
      setSelectedObjectId(null);
    }
    if (selectedConnection && layers?.[selectedConnection.layer] === false) {
      setSelectedConnectionId(null);
    }
  }, [layers, selectedConnection, selectedObject]);

  async function handleCreateMap() {
    if (!canManage) return;
    if (!confirmDiscardChanges("Criar outro mapa e descartar as alteracoes nao salvas?")) return;
    setSaving(true);
    setError("");
    try {
      const response = await createInventoryVisualMap(token, {
        name: `Mapa ${maps.length + 1}`,
        environmentId: activeTab?.id || tabs[0]?.id || "",
        width: 30,
        depth: 20,
        scale: 1
      });
      notify?.("Mapa visual criado.", "success");
      await loadMaps();
      setActiveMapId(response.map.id);
    } catch (createError) {
      setError(createError.message || "Nao foi possivel criar o mapa visual.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMap() {
    if (!canManage || !activeMapId) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...mapDraft,
        width: numberInputValue(mapDraft.width, 30),
        depth: numberInputValue(mapDraft.depth, 20),
        scale: numberInputValue(mapDraft.scale, 1)
      };
      const response = await updateInventoryVisualMap(token, activeMapId, payload);
      setActiveMap(response.map);
      setMapDraft(mapToDraft(response.map));
      await loadMaps();
      notify?.("Mapa visual salvo.", "success");
    } catch (saveError) {
      setError(saveError.message || "Nao foi possivel salvar o mapa visual.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMap() {
    if (!canManage || !activeMapId) return;
    const confirmed = window.confirm("Excluir este mapa visual e todos os objetos vinculados?");
    if (!confirmed) return;

    setSaving(true);
    setError("");
    try {
      await deleteInventoryVisualMap(token, activeMapId);
      notify?.("Mapa visual excluido.", "success");
      setActiveMapId("");
      await loadMaps();
    } catch (deleteError) {
      setError(deleteError.message || "Nao foi possivel excluir o mapa visual.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddObject(presetType, layer) {
    if (!canManage || !activeMapId) return;
    const preset = ALL_OBJECT_PRESETS.find((item) => item.type === presetType);
    setSaving(true);
    setError("");
    try {
      const response = await createInventoryVisualMapObject(token, activeMapId, {
        presetType,
        layer,
        label: preset?.label || "Objeto",
        ...getNextObjectPosition(objects, activeMap)
      });
      setObjects((current) => [...current, response.object]);
      setSelectedObjectId(response.object.id);
      setSelectedConnectionId(null);
      notify?.("Objeto adicionado ao mapa.", "success");
    } catch (createError) {
      setError(createError.message || "Nao foi possivel adicionar o objeto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddAssetObject() {
    if (!canManage || !activeMapId || !assetToAdd) return;
    const device = devices.find((item) => item.id === assetToAdd);
    if (!device) return;

    setSaving(true);
    setError("");
    try {
      const response = await createInventoryVisualMapObject(token, activeMapId, {
        presetType: getDevicePreset(device),
        layer: "assets",
        label: getDeviceName(device),
        linkedAssetId: device.id,
        ...getNextObjectPosition(objects, activeMap)
      });
      setObjects((current) => [...current, response.object]);
      setSelectedObjectId(response.object.id);
      setSelectedConnectionId(null);
      setAssetToAdd("");
      notify?.("Ativo vinculado ao mapa.", "success");
    } catch (createError) {
      setError(createError.message || "Nao foi possivel vincular o ativo ao mapa.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddConnection(layer = "infrastructure") {
    if (!canManage || !activeMapId) return;
    const draft = buildDefaultConnectionDraft(layer);
    setSaving(true);
    setError("");
    try {
      const response = await createInventoryVisualMapConnection(token, activeMapId, {
        ...draft,
        label: layer === "electrical" ? "Linha eletrica" : "Cabo de rede"
      });
      setConnections((current) => [...current, response.connection]);
      setSelectedConnectionId(response.connection.id);
      setSelectedObjectId(null);
      notify?.("Conexao adicionada ao mapa.", "success");
    } catch (createError) {
      setError(createError.message || "Nao foi possivel adicionar a conexao.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveObject() {
    if (!canManage || !selectedObject || !objectDraft) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...objectDraft,
        linkedAssetId: objectDraft.linkedAssetId || null,
        positionX: numberInputValue(objectDraft.positionX),
        positionY: numberInputValue(objectDraft.positionY),
        positionZ: numberInputValue(objectDraft.positionZ),
        rotationX: numberInputValue(objectDraft.rotationX),
        rotationY: numberInputValue(objectDraft.rotationY),
        rotationZ: numberInputValue(objectDraft.rotationZ),
        width: numberInputValue(objectDraft.width, 1),
        depth: numberInputValue(objectDraft.depth, 1),
        height: numberInputValue(objectDraft.height, 1)
      };
      const response = await updateInventoryVisualMapObject(token, selectedObject.id, payload);
      setObjects((current) => current.map((object) => (object.id === response.object.id ? response.object : object)));
      setSelectedObjectId(response.object.id);
      notify?.("Objeto salvo.", "success");
    } catch (saveError) {
      setError(saveError.message || "Nao foi possivel salvar o objeto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteObject() {
    if (!canManage || !selectedObject) return;
    if (!window.confirm(`Remover "${selectedObject.label}" deste mapa visual?`)) return;
    setSaving(true);
    setError("");
    try {
      await deleteInventoryVisualMapObject(token, selectedObject.id);
      setObjects((current) => current.filter((object) => object.id !== selectedObject.id));
      setSelectedObjectId(null);
      notify?.("Objeto removido do mapa.", "success");
    } catch (deleteError) {
      setError(deleteError.message || "Nao foi possivel remover o objeto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicateObject() {
    if (!isEditing || !selectedObject || !objectDraft) return;
    setSaving(true);
    setError("");
    try {
      const response = await createInventoryVisualMapObject(token, activeMapId, {
        ...objectDraft,
        label: `${objectDraft.label || selectedObject.label} (copia)`,
        linkedAssetId: null,
        positionX: numberInputValue(objectDraft.positionX) + 0.5,
        positionZ: numberInputValue(objectDraft.positionZ) + 0.5
      });
      setObjects((current) => [...current, response.object]);
      setSelectedObjectId(response.object.id);
      notify?.("Objeto duplicado.", "success");
    } catch (duplicateError) {
      setError(duplicateError.message || "Nao foi possivel duplicar o objeto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveConnection() {
    if (!canManage || !selectedConnection || !connectionDraft) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...connectionDraft,
        sourceObjectId: connectionDraft.sourceObjectId || null,
        targetObjectId: connectionDraft.targetObjectId || null,
        sourceAssetId: connectionDraft.sourceAssetId || null,
        targetAssetId: connectionDraft.targetAssetId || null,
        points: (connectionDraft.points || []).map((point) => ({
          x: numberInputValue(point.x),
          y: numberInputValue(point.y, 0.08),
          z: numberInputValue(point.z)
        })),
        thickness: numberInputValue(connectionDraft.thickness, 2)
      };
      const response = await updateInventoryVisualMapConnection(token, selectedConnection.id, payload);
      setConnections((current) => current.map((connection) => (
        connection.id === response.connection.id ? response.connection : connection
      )));
      setSelectedConnectionId(response.connection.id);
      notify?.("Conexao salva.", "success");
    } catch (saveError) {
      setError(saveError.message || "Nao foi possivel salvar a conexao.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConnection() {
    if (!canManage || !selectedConnection) return;
    if (!window.confirm(`Remover a conexao "${selectedConnection.label || "sem identificacao"}"?`)) return;
    setSaving(true);
    setError("");
    try {
      await deleteInventoryVisualMapConnection(token, selectedConnection.id);
      setConnections((current) => current.filter((connection) => connection.id !== selectedConnection.id));
      setSelectedConnectionId(null);
      notify?.("Conexao removida do mapa.", "success");
    } catch (deleteError) {
      setError(deleteError.message || "Nao foi possivel remover a conexao.");
    } finally {
      setSaving(false);
    }
  }

  function updateMapDraft(key, value) {
    setMapDraft((current) => ({ ...current, [key]: value }));
  }

  function updateObjectDraft(key, value) {
    setObjectDraft((current) => ({ ...(current || {}), [key]: value }));
  }

  function updateObjectMetadata(key, value) {
    setObjectDraft((current) => ({
      ...(current || {}),
      metadata: {
        ...(current?.metadata || {}),
        [key]: value
      }
    }));
  }

  function updateConnectionDraft(key, value) {
    setConnectionDraft((current) => {
      const base = current || buildDefaultConnectionDraft();
      if (key === "layer") {
        const defaults = buildDefaultConnectionDraft(value);
        return {
          ...base,
          layer: value,
          connectionType: defaults.connectionType,
          color: defaults.color
        };
      }
      return { ...base, [key]: value };
    });
  }

  function updateConnectionPoint(index, key, value) {
    setConnectionDraft((current) => {
      const points = [...(current?.points || [])];
      points[index] = {
        ...(points[index] || { x: 0, y: 0.08, z: 0 }),
        [key]: value
      };
      return { ...(current || buildDefaultConnectionDraft()), points };
    });
  }

  function addConnectionPoint() {
    setConnectionDraft((current) => {
      const base = current || buildDefaultConnectionDraft();
      const points = [...(base.points || [])];
      const lastPoint = points[points.length - 1] || { x: 0, y: 0.08, z: 0 };
      return {
        ...base,
        points: [
          ...points,
          {
            x: numberInputValue(lastPoint.x) + 1,
            y: numberInputValue(lastPoint.y, 0.08),
            z: numberInputValue(lastPoint.z) + 1
          }
        ]
      };
    });
  }

  function removeConnectionPoint(index) {
    setConnectionDraft((current) => {
      const base = current || buildDefaultConnectionDraft();
      const points = (base.points || []).filter((_, pointIndex) => pointIndex !== index);
      return { ...base, points: points.length >= 2 ? points : base.points };
    });
  }

  function updateConnectionMetadata(key, value) {
    setConnectionDraft((current) => ({
      ...(current || buildDefaultConnectionDraft()),
      metadata: {
        ...(current?.metadata || {}),
        [key]: value
      }
    }));
  }

  function handleSelectObject(objectId) {
    if (objectId !== selectedObjectId && objectDirty && !window.confirm("Descartar as alteracoes deste objeto?")) return;
    setSelectedObjectId(objectId);
    if (objectId) setSelectedConnectionId(null);
  }

  function handleSelectConnection(connectionId) {
    if (connectionId !== selectedConnectionId && connectionDirty && !window.confirm("Descartar as alteracoes desta conexao?")) return;
    setSelectedConnectionId(connectionId);
    if (connectionId) setSelectedObjectId(null);
  }

  function handleMapChange(nextMapId) {
    if (nextMapId === activeMapId) return;
    if (!confirmDiscardChanges("Trocar de mapa e descartar as alteracoes nao salvas?")) return;
    setActiveMapId(nextMapId);
  }

  function handleModeChange(nextMode) {
    if (nextMode === mode) return;
    if (nextMode === "view" && !confirmDiscardChanges("Sair do modo de edicao e descartar as alteracoes nao salvas?")) return;
    if (nextMode === "view") {
      setMapDraft(mapToDraft(activeMap));
      setObjectDraft(objectToDraft(selectedObject));
      setConnectionDraft(connectionToDraft(selectedConnection));
    }
    setMode(nextMode);
  }

  async function handleRefresh() {
    if (!confirmDiscardChanges("Atualizar o mapa e descartar as alteracoes nao salvas?")) return;
    await loadMaps();
    await loadActiveMap();
  }

  function runCameraAction(type) {
    setCameraAction((current) => ({ type, revision: current.revision + 1 }));
  }

  return (
    <section className="inventory-visual-map-view" aria-label="Mapa visual 3D do inventario">
      <header className="inventory-visual-map-header">
        <div>
          <span>Mapa visual 3D</span>
          <strong>{activeMap?.name || activeMapOption?.name || "Sem mapa selecionado"}</strong>
          {hasUnsavedChanges && <em className="inventory-visual-unsaved-badge">Alteracoes nao salvas</em>}
        </div>
        <div className="inventory-visual-map-actions">
          <button type="button" className="icon-button" onClick={handleRefresh} disabled={loading} title="Atualizar mapas">
            <RefreshCw size={18} />
          </button>
          {canManage && (
            <button type="button" className="primary-action compact-action" onClick={handleCreateMap} disabled={saving}>
              <Plus size={16} />
              Novo mapa
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="inventory-visual-map-error">
          <strong>Falha no mapa visual</strong>
          <span>{error}</span>
        </div>
      )}

      {loading && !activeMap && <div className="inventory-visual-map-loading">Carregando mapa visual...</div>}

      {!loading && !maps.length && (
        <div className="inventory-visual-map-empty">
          <Map size={28} />
          <strong>Nenhum mapa visual cadastrado.</strong>
          <span>Crie um mapa para posicionar salas, racks, mesas e ativos reais do inventario.</span>
          {canManage && (
            <button type="button" className="primary-action compact-action" onClick={handleCreateMap} disabled={saving}>
              <Plus size={16} />
              Criar primeiro mapa
            </button>
          )}
        </div>
      )}

      {!!maps.length && (
        <div className="inventory-visual-map-shell">
          <aside className="inventory-visual-map-sidebar">
            <label>
              Mapa
              <select value={activeMapId} onChange={(event) => handleMapChange(event.target.value)}>
                {maps.map((map) => (
                  <option key={map.id} value={map.id}>
                    {map.name} ({map.objectCount || 0})
                  </option>
                ))}
              </select>
            </label>

            <div className="inventory-visual-mode-toggle" role="group" aria-label="Modo do mapa">
              <button type="button" className={mode === "view" ? "active" : ""} onClick={() => handleModeChange("view")}>
                <MousePointer2 size={16} />
                Visualizar
              </button>
              <button type="button" className={mode === "edit" ? "active" : ""} onClick={() => handleModeChange("edit")} disabled={!canManage}>
                <Pencil size={16} />
                Editar
              </button>
            </div>

            <section className="inventory-visual-map-card">
              <div className="inventory-visual-section-title">
                <Building2 size={16} />
                Dados do mapa
              </div>
              <label>
                Nome
                <input value={mapDraft.name} onChange={(event) => updateMapDraft("name", event.target.value)} disabled={!isEditing} />
              </label>
              <div className="inventory-visual-form-grid">
                <label>
                  Aba
                  <select value={mapDraft.environmentId || ""} onChange={(event) => updateMapDraft("environmentId", event.target.value)} disabled={!isEditing}>
                    <option value="">Nao vinculado</option>
                    {tabs.map((tab) => (
                      <option key={tab.id} value={tab.id}>{tab.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Grupo
                  <select value={mapDraft.groupId || ""} onChange={(event) => updateMapDraft("groupId", event.target.value)} disabled={!isEditing}>
                    <option value="">Nao vinculado</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Segmento
                  <select value={mapDraft.segmentId || ""} onChange={(event) => updateMapDraft("segmentId", event.target.value)} disabled={!isEditing}>
                    <option value="">Nao vinculado</option>
                    {segments.map((segment) => (
                      <option key={segment.id} value={segment.id}>{segment.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Andar
                  <input value={mapDraft.floorLabel || ""} onChange={(event) => updateMapDraft("floorLabel", event.target.value)} disabled={!isEditing} placeholder="Ex: 2o andar" />
                </label>
                <label>
                  Largura
                  <input type="number" min="5" max="200" value={mapDraft.width} onChange={(event) => updateMapDraft("width", event.target.value)} disabled={!isEditing} />
                </label>
                <label>
                  Profundidade
                  <input type="number" min="5" max="200" value={mapDraft.depth} onChange={(event) => updateMapDraft("depth", event.target.value)} disabled={!isEditing} />
                </label>
                <label>
                  Escala da grade
                  <input type="number" min="0.1" max="10" step="0.1" value={mapDraft.scale} onChange={(event) => updateMapDraft("scale", event.target.value)} disabled={!isEditing} />
                </label>
              </div>
              <label>
                Observacoes
                <textarea value={mapDraft.notes || ""} onChange={(event) => updateMapDraft("notes", event.target.value)} disabled={!isEditing} rows={3} />
              </label>
              <div className="inventory-visual-card-actions">
                <button type="button" className="secondary-action compact-action" onClick={() => setShowGrid((current) => !current)}>
                  <Grid2X2 size={15} />
                  Grade
                </button>
                {isEditing && (
                  <>
                    <button type="button" className="primary-action compact-action" onClick={handleSaveMap} disabled={saving}>
                      <Save size={15} />
                      Salvar
                    </button>
                    <button type="button" className="danger-action compact-action" onClick={handleDeleteMap} disabled={saving}>
                      <Trash2 size={15} />
                      Excluir
                    </button>
                  </>
                )}
              </div>
            </section>

            <section className="inventory-visual-map-card">
              <div className="inventory-visual-section-title">
                <Layers3 size={16} />
                Camadas
              </div>
              <InventoryVisualMapLayerPresetBar
                layers={layers}
                onLayersChange={setLayers}
                onToggleLayer={(key) => setLayers((current) => ({ ...current, [key]: !current[key] }))}
              />
            </section>

            {canManage && mode === "edit" && (
              <section className="inventory-visual-map-card">
                <div className="inventory-visual-section-title">
                  <Plus size={16} />
                  Adicionar
                </div>
                <strong className="inventory-visual-preset-heading">Estrutura</strong>
                <div className="inventory-visual-preset-grid">
                  {STRUCTURE_PRESETS.map((preset) => (
                    <button key={preset.type} type="button" onClick={() => handleAddObject(preset.type, "structure")} disabled={saving}>
                      {preset.label}
                    </button>
                  ))}
                </div>
                <strong className="inventory-visual-preset-heading">Ativos</strong>
                <div className="inventory-visual-preset-grid">
                  {ASSET_PRESETS.map((preset) => (
                    <button key={preset.type} type="button" onClick={() => handleAddObject(preset.type, "assets")} disabled={saving}>
                      {preset.label}
                    </button>
                  ))}
                </div>
                <strong className="inventory-visual-preset-heading">Infraestrutura</strong>
                <div className="inventory-visual-preset-grid">
                  {INFRASTRUCTURE_PRESETS.map((preset) => (
                    <button key={preset.type} type="button" onClick={() => handleAddObject(preset.type, "infrastructure")} disabled={saving}>
                      {preset.label}
                    </button>
                  ))}
                </div>
                <strong className="inventory-visual-preset-heading">Eletrica</strong>
                <div className="inventory-visual-preset-grid">
                  {ELECTRICAL_PRESETS.map((preset) => (
                    <button key={preset.type} type="button" onClick={() => handleAddObject(preset.type, "electrical")} disabled={saving}>
                      {preset.label}
                    </button>
                  ))}
                </div>
                <label>
                  Vincular ativo real
                  <select value={assetToAdd} onChange={(event) => setAssetToAdd(event.target.value)}>
                    <option value="">Selecionar ativo</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id} disabled={usedAssetIds.has(device.id)}>
                        {getDeviceName(device)}
                        {usedAssetIds.has(device.id) ? " (ja posicionado)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="secondary-action compact-action" onClick={handleAddAssetObject} disabled={!assetToAdd || saving}>
                  <Boxes size={15} />
                  Adicionar ativo
                </button>
                <div className="inventory-visual-connection-actions">
                  <button type="button" className="secondary-action compact-action" onClick={() => handleAddConnection("infrastructure")} disabled={saving}>
                    <Cable size={15} />
                    Cabo/infra
                  </button>
                  <button type="button" className="secondary-action compact-action" onClick={() => handleAddConnection("electrical")} disabled={saving}>
                    <PlugZap size={15} />
                    Energia
                  </button>
                </div>
              </section>
            )}
          </aside>

          <main className="inventory-visual-map-main">
            <div className="inventory-visual-camera-actions" role="group" aria-label="Controles da camera">
              <button type="button" className="icon-button" onClick={() => runCameraAction("fit")} title="Enquadrar mapa"><Focus size={16} /></button>
              <button type="button" className="icon-button" onClick={() => runCameraAction("selection")} disabled={!selectedObjectId} title="Centralizar objeto"><MousePointer2 size={16} /></button>
              <button type="button" className="icon-button" onClick={() => runCameraAction("reset")} title="Redefinir camera"><RotateCcw size={16} /></button>
            </div>
            <InventoryVisualMapScene
              map={activeMap}
              objects={objects}
              connections={connections}
              selectedObjectId={selectedObjectId}
              selectedConnectionId={selectedConnectionId}
              layers={layers}
              showGrid={showGrid}
              cameraAction={cameraAction}
              onSelectObject={handleSelectObject}
              onSelectConnection={handleSelectConnection}
            />
            <section className="inventory-visual-object-panel">
              {selectedConnection && connectionDraft ? (
                <>
                  <header>
                    <div>
                      <span>{layerLabel(selectedConnection.layer)}</span>
                      <strong>{selectedConnection.label || "Conexao sem identificacao"}</strong>
                    </div>
                    <button type="button" className="icon-button" onClick={() => setSelectedConnectionId(null)} title="Limpar selecao">
                      <MousePointer2 size={16} />
                    </button>
                  </header>
                  <InventoryVisualMapConnectionPanel connection={selectedConnection} />
                  {mode === "edit" && (
                    <InventoryVisualMapConnectionEditor
                      draft={connectionDraft}
                      canManage={isEditing}
                      saving={saving}
                      onChange={updateConnectionDraft}
                      onPointChange={updateConnectionPoint}
                      onAddPoint={addConnectionPoint}
                      onRemovePoint={removeConnectionPoint}
                      onMetadataChange={updateConnectionMetadata}
                      onSave={handleSaveConnection}
                      onDelete={handleDeleteConnection}
                      onCancel={() => setConnectionDraft(connectionToDraft(selectedConnection))}
                    />
                  )}
                </>
              ) : selectedObject && objectDraft ? (
                <>
                  <header>
                    <div>
                      <span>{layerLabel(selectedObject.layer)}</span>
                      <strong>{selectedObject.label}</strong>
                    </div>
                    <button type="button" className="icon-button" onClick={() => setSelectedObjectId(null)} title="Limpar selecao">
                      <MousePointer2 size={16} />
                    </button>
                  </header>
                  <div className="inventory-visual-form-grid compact">
                    <label>
                      Nome
                      <input value={objectDraft.label} onChange={(event) => updateObjectDraft("label", event.target.value)} disabled={!isEditing} />
                    </label>
                    <label>
                      Cor
                      <input type="color" value={objectDraft.color} onChange={(event) => updateObjectDraft("color", event.target.value)} disabled={!isEditing} />
                    </label>
                    <label>
                      Ativo vinculado
                      <select value={objectDraft.linkedAssetId || ""} onChange={(event) => updateObjectDraft("linkedAssetId", event.target.value)} disabled={!isEditing}>
                        <option value="">Nao vinculado</option>
                        {devices.map((device) => (
                          <option key={device.id} value={device.id} disabled={usedAssetIds.has(device.id) && device.id !== selectedObject.linkedAssetId}>
                            {getDeviceName(device)}{usedAssetIds.has(device.id) && device.id !== selectedObject.linkedAssetId ? " (ja posicionado)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      X
                      <input type="number" step="0.1" value={objectDraft.positionX} onChange={(event) => updateObjectDraft("positionX", event.target.value)} disabled={!isEditing} />
                    </label>
                    <label>
                      Y
                      <input type="number" step="0.1" value={objectDraft.positionY} onChange={(event) => updateObjectDraft("positionY", event.target.value)} disabled={!isEditing} />
                    </label>
                    <label>
                      Z
                      <input type="number" step="0.1" value={objectDraft.positionZ} onChange={(event) => updateObjectDraft("positionZ", event.target.value)} disabled={!isEditing} />
                    </label>
                    <label>
                      Rotacao X
                      <input type="number" step="5" value={objectDraft.rotationX} onChange={(event) => updateObjectDraft("rotationX", event.target.value)} disabled={!isEditing} />
                    </label>
                    <label>
                      Rotacao Y
                      <input type="number" step="5" value={objectDraft.rotationY} onChange={(event) => updateObjectDraft("rotationY", event.target.value)} disabled={!isEditing} />
                    </label>
                    <label>
                      Rotacao Z
                      <input type="number" step="5" value={objectDraft.rotationZ} onChange={(event) => updateObjectDraft("rotationZ", event.target.value)} disabled={!isEditing} />
                    </label>
                    <label>
                      Largura
                      <input type="number" step="0.1" min="0.1" value={objectDraft.width} onChange={(event) => updateObjectDraft("width", event.target.value)} disabled={!isEditing} />
                    </label>
                    <label>
                      Profundidade
                      <input type="number" step="0.1" min="0.1" value={objectDraft.depth} onChange={(event) => updateObjectDraft("depth", event.target.value)} disabled={!isEditing} />
                    </label>
                    <label>
                      Altura
                      <input type="number" step="0.1" min="0.05" value={objectDraft.height} onChange={(event) => updateObjectDraft("height", event.target.value)} disabled={!isEditing} />
                    </label>
                  </div>
                  <div className="inventory-visual-nudge-row">
                    <button type="button" onClick={() => updateObjectDraft("positionX", numberInputValue(objectDraft.positionX) - 0.5)} disabled={!isEditing}>
                      <Move3D size={14} />
                      X-
                    </button>
                    <button type="button" onClick={() => updateObjectDraft("positionX", numberInputValue(objectDraft.positionX) + 0.5)} disabled={!isEditing}>
                      <Move3D size={14} />
                      X+
                    </button>
                    <button type="button" onClick={() => updateObjectDraft("positionZ", numberInputValue(objectDraft.positionZ) - 0.5)} disabled={!isEditing}>
                      <Move3D size={14} />
                      Z-
                    </button>
                    <button type="button" onClick={() => updateObjectDraft("rotationY", numberInputValue(objectDraft.rotationY) + 15)} disabled={!isEditing}>
                      <RotateCw size={14} />
                      Girar
                    </button>
                  </div>
                  <label>
                    Notas
                    <textarea value={objectDraft.notes || ""} onChange={(event) => updateObjectDraft("notes", event.target.value)} disabled={!isEditing} rows={2} />
                  </label>
                  {linkedDevice && (
                    <div className="inventory-visual-asset-info">
                      <strong>{getDeviceName(linkedDevice)}</strong>
                      <span>Status: {linkedDeviceMeta.status}</span>
                      <span>IP: {linkedDeviceMeta.ip}</span>
                      <span>Sistema: {linkedDeviceMeta.os}</span>
                      <span>Aba: {linkedDeviceMeta.environment}</span>
                      <span>Grupo: {linkedDeviceMeta.group}</span>
                      <span>Segmento: {linkedDeviceMeta.segment}</span>
                    </div>
                  )}
                  {["infrastructure", "electrical"].includes(selectedObject.layer) && (
                    <div className="inventory-visual-metadata-grid">
                      {METADATA_FIELDS.map((field) => (
                        <label key={field.key}>
                          {field.label}
                          <input
                            value={objectDraft.metadata?.[field.key] || ""}
                            onChange={(event) => updateObjectMetadata(field.key, event.target.value)}
                            disabled={!isEditing}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  {isEditing && (
                    <footer>
                      <button type="button" className="primary-action compact-action" onClick={handleSaveObject} disabled={saving}>
                        <Save size={15} />
                        Salvar objeto
                      </button>
                      <button type="button" className="secondary-action compact-action" onClick={handleDuplicateObject} disabled={saving}>
                        <Copy size={15} />
                        Duplicar
                      </button>
                      <button type="button" className="secondary-action compact-action" onClick={() => setObjectDraft(objectToDraft(selectedObject))} disabled={!objectDirty || saving}>
                        Cancelar
                      </button>
                      <button type="button" className="danger-action compact-action" onClick={handleDeleteObject} disabled={saving}>
                        <Trash2 size={15} />
                        Remover
                      </button>
                    </footer>
                  )}
                </>
              ) : (
                <div className="inventory-visual-object-empty">
                  <MousePointer2 size={22} />
                  <strong>Selecione um objeto ou conexao no mapa.</strong>
                  <span>No modo editar, use o painel lateral para inserir estrutura, ativos, infraestrutura ou eletrica.</span>
                </div>
              )}
            </section>
          </main>
        </div>
      )}
    </section>
  );
}
