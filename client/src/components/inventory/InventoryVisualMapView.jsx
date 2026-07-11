import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Building2,
  Eye,
  EyeOff,
  Grid2X2,
  Layers3,
  Map,
  MousePointer2,
  Move3D,
  Pencil,
  Plus,
  RefreshCw,
  RotateCw,
  Save,
  Trash2
} from "lucide-react";
import {
  createInventoryVisualMap,
  createInventoryVisualMapObject,
  deleteInventoryVisualMap,
  deleteInventoryVisualMapObject,
  fetchInventoryVisualMap,
  fetchInventoryVisualMaps,
  updateInventoryVisualMap,
  updateInventoryVisualMapObject
} from "../../api.js";
import InventoryVisualMapScene from "./InventoryVisualMapScene.jsx";

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
    notes: object.notes || ""
  };
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
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [objectDraft, setObjectDraft] = useState(null);
  const [assetToAdd, setAssetToAdd] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("view");
  const [showGrid, setShowGrid] = useState(true);
  const [layers, setLayers] = useState({ structure: true, assets: true });

  const selectedObject = useMemo(
    () => objects.find((object) => object.id === selectedObjectId) || null,
    [objects, selectedObjectId]
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
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetchInventoryVisualMap(token, activeMapId);
      setActiveMap(response.map);
      setMapDraft(mapToDraft(response.map));
      setObjects(response.objects || []);
      setSelectedObjectId((current) => {
        if (current && (response.objects || []).some((object) => object.id === current)) return current;
        return (response.objects || [])[0]?.id || null;
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
    setObjectDraft(objectToDraft(selectedObject));
  }, [selectedObject]);

  async function handleCreateMap() {
    if (!canManage) return;
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
    const preset = [...STRUCTURE_PRESETS, ...ASSET_PRESETS].find((item) => item.type === presetType);
    setSaving(true);
    setError("");
    try {
      const response = await createInventoryVisualMapObject(token, activeMapId, {
        presetType,
        layer,
        label: preset?.label || "Objeto",
        positionX: Math.round((objects.length % 5) * 1.8 - 3.6),
        positionZ: Math.floor(objects.length / 5) * 1.6 - 2.4
      });
      setObjects((current) => [...current, response.object]);
      setSelectedObjectId(response.object.id);
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
        positionX: Math.round((objects.length % 5) * 1.8 - 3.6),
        positionZ: Math.floor(objects.length / 5) * 1.6 - 1.2
      });
      setObjects((current) => [...current, response.object]);
      setSelectedObjectId(response.object.id);
      setAssetToAdd("");
      notify?.("Ativo vinculado ao mapa.", "success");
    } catch (createError) {
      setError(createError.message || "Nao foi possivel vincular o ativo ao mapa.");
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

  function updateMapDraft(key, value) {
    setMapDraft((current) => ({ ...current, [key]: value }));
  }

  function updateObjectDraft(key, value) {
    setObjectDraft((current) => ({ ...(current || {}), [key]: value }));
  }

  return (
    <section className="inventory-visual-map-view" aria-label="Mapa visual 3D do inventario">
      <header className="inventory-visual-map-header">
        <div>
          <span>Mapa visual 3D</span>
          <strong>{activeMap?.name || activeMapOption?.name || "Sem mapa selecionado"}</strong>
        </div>
        <div className="inventory-visual-map-actions">
          <button type="button" className="icon-button" onClick={loadMaps} disabled={loading} title="Atualizar mapas">
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
              <select value={activeMapId} onChange={(event) => setActiveMapId(event.target.value)}>
                {maps.map((map) => (
                  <option key={map.id} value={map.id}>
                    {map.name} ({map.objectCount || 0})
                  </option>
                ))}
              </select>
            </label>

            <div className="inventory-visual-mode-toggle" role="group" aria-label="Modo do mapa">
              <button type="button" className={mode === "view" ? "active" : ""} onClick={() => setMode("view")}>
                <MousePointer2 size={16} />
                Visualizar
              </button>
              <button type="button" className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")} disabled={!canManage}>
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
                <input value={mapDraft.name} onChange={(event) => updateMapDraft("name", event.target.value)} disabled={!canManage} />
              </label>
              <div className="inventory-visual-form-grid">
                <label>
                  Aba
                  <select value={mapDraft.environmentId || ""} onChange={(event) => updateMapDraft("environmentId", event.target.value)} disabled={!canManage}>
                    <option value="">Nao vinculado</option>
                    {tabs.map((tab) => (
                      <option key={tab.id} value={tab.id}>{tab.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Grupo
                  <select value={mapDraft.groupId || ""} onChange={(event) => updateMapDraft("groupId", event.target.value)} disabled={!canManage}>
                    <option value="">Nao vinculado</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Segmento
                  <select value={mapDraft.segmentId || ""} onChange={(event) => updateMapDraft("segmentId", event.target.value)} disabled={!canManage}>
                    <option value="">Nao vinculado</option>
                    {segments.map((segment) => (
                      <option key={segment.id} value={segment.id}>{segment.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Andar
                  <input value={mapDraft.floorLabel || ""} onChange={(event) => updateMapDraft("floorLabel", event.target.value)} disabled={!canManage} placeholder="Ex: 2o andar" />
                </label>
                <label>
                  Largura
                  <input type="number" min="5" max="200" value={mapDraft.width} onChange={(event) => updateMapDraft("width", event.target.value)} disabled={!canManage} />
                </label>
                <label>
                  Profundidade
                  <input type="number" min="5" max="200" value={mapDraft.depth} onChange={(event) => updateMapDraft("depth", event.target.value)} disabled={!canManage} />
                </label>
              </div>
              <label>
                Observacoes
                <textarea value={mapDraft.notes || ""} onChange={(event) => updateMapDraft("notes", event.target.value)} disabled={!canManage} rows={3} />
              </label>
              <div className="inventory-visual-card-actions">
                <button type="button" className="secondary-action compact-action" onClick={() => setShowGrid((current) => !current)}>
                  <Grid2X2 size={15} />
                  Grade
                </button>
                {canManage && (
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
              {[
                ["structure", "Estrutura"],
                ["assets", "Ativos"]
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`inventory-visual-layer-toggle ${layers[key] ? "active" : ""}`}
                  onClick={() => setLayers((current) => ({ ...current, [key]: !current[key] }))}
                >
                  {layers[key] ? <Eye size={16} /> : <EyeOff size={16} />}
                  {label}
                </button>
              ))}
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
                <label>
                  Vincular ativo real
                  <select value={assetToAdd} onChange={(event) => setAssetToAdd(event.target.value)}>
                    <option value="">Selecionar ativo</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {getDeviceName(device)}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="secondary-action compact-action" onClick={handleAddAssetObject} disabled={!assetToAdd || saving}>
                  <Boxes size={15} />
                  Adicionar ativo
                </button>
              </section>
            )}
          </aside>

          <main className="inventory-visual-map-main">
            <InventoryVisualMapScene
              map={activeMap}
              objects={objects}
              selectedObjectId={selectedObjectId}
              layers={layers}
              showGrid={showGrid}
              onSelectObject={setSelectedObjectId}
            />
            <section className="inventory-visual-object-panel">
              {selectedObject && objectDraft ? (
                <>
                  <header>
                    <div>
                      <span>{selectedObject.layer === "structure" ? "Estrutura" : "Ativo"}</span>
                      <strong>{selectedObject.label}</strong>
                    </div>
                    <button type="button" className="icon-button" onClick={() => setSelectedObjectId(null)} title="Limpar selecao">
                      <MousePointer2 size={16} />
                    </button>
                  </header>
                  <div className="inventory-visual-form-grid compact">
                    <label>
                      Nome
                      <input value={objectDraft.label} onChange={(event) => updateObjectDraft("label", event.target.value)} disabled={!canManage} />
                    </label>
                    <label>
                      Cor
                      <input type="color" value={objectDraft.color} onChange={(event) => updateObjectDraft("color", event.target.value)} disabled={!canManage} />
                    </label>
                    <label>
                      Ativo vinculado
                      <select value={objectDraft.linkedAssetId || ""} onChange={(event) => updateObjectDraft("linkedAssetId", event.target.value)} disabled={!canManage}>
                        <option value="">Nao vinculado</option>
                        {devices.map((device) => (
                          <option key={device.id} value={device.id}>{getDeviceName(device)}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      X
                      <input type="number" step="0.1" value={objectDraft.positionX} onChange={(event) => updateObjectDraft("positionX", event.target.value)} disabled={!canManage} />
                    </label>
                    <label>
                      Z
                      <input type="number" step="0.1" value={objectDraft.positionZ} onChange={(event) => updateObjectDraft("positionZ", event.target.value)} disabled={!canManage} />
                    </label>
                    <label>
                      Rotacao
                      <input type="number" step="5" value={objectDraft.rotationY} onChange={(event) => updateObjectDraft("rotationY", event.target.value)} disabled={!canManage} />
                    </label>
                    <label>
                      Largura
                      <input type="number" step="0.1" min="0.1" value={objectDraft.width} onChange={(event) => updateObjectDraft("width", event.target.value)} disabled={!canManage} />
                    </label>
                    <label>
                      Profundidade
                      <input type="number" step="0.1" min="0.1" value={objectDraft.depth} onChange={(event) => updateObjectDraft("depth", event.target.value)} disabled={!canManage} />
                    </label>
                    <label>
                      Altura
                      <input type="number" step="0.1" min="0.05" value={objectDraft.height} onChange={(event) => updateObjectDraft("height", event.target.value)} disabled={!canManage} />
                    </label>
                  </div>
                  <div className="inventory-visual-nudge-row">
                    <button type="button" onClick={() => updateObjectDraft("positionX", numberInputValue(objectDraft.positionX) - 0.5)} disabled={!canManage}>
                      <Move3D size={14} />
                      X-
                    </button>
                    <button type="button" onClick={() => updateObjectDraft("positionX", numberInputValue(objectDraft.positionX) + 0.5)} disabled={!canManage}>
                      <Move3D size={14} />
                      X+
                    </button>
                    <button type="button" onClick={() => updateObjectDraft("positionZ", numberInputValue(objectDraft.positionZ) - 0.5)} disabled={!canManage}>
                      <Move3D size={14} />
                      Z-
                    </button>
                    <button type="button" onClick={() => updateObjectDraft("rotationY", numberInputValue(objectDraft.rotationY) + 15)} disabled={!canManage}>
                      <RotateCw size={14} />
                      Girar
                    </button>
                  </div>
                  <label>
                    Notas
                    <textarea value={objectDraft.notes || ""} onChange={(event) => updateObjectDraft("notes", event.target.value)} disabled={!canManage} rows={2} />
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
                  {canManage && (
                    <footer>
                      <button type="button" className="primary-action compact-action" onClick={handleSaveObject} disabled={saving}>
                        <Save size={15} />
                        Salvar objeto
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
                  <strong>Selecione um objeto no mapa.</strong>
                  <span>No modo editar, use o painel lateral para inserir estrutura ou ativos.</span>
                </div>
              )}
            </section>
          </main>
        </div>
      )}
    </section>
  );
}
