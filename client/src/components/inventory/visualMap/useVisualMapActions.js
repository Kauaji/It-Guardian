import {
  createInventoryVisualMap,
  createInventoryVisualMapConnection,
  createInventoryVisualMapObject,
  deleteInventoryVisualMap,
  deleteInventoryVisualMapConnection,
  deleteInventoryVisualMapObject,
  updateInventoryVisualMap,
  updateInventoryVisualMapConnection,
  updateInventoryVisualMapObject
} from "../../../api.js";
import { buildDefaultConnectionDraft } from "../inventoryVisualMapConnectionUtils.js";
import {
  buildConnectionPayload,
  buildDuplicateObjectPayload,
  buildMapPayload,
  buildObjectPayload,
  getNextObjectPosition,
  mapToDraft
} from "./visualMapDrafts.js";
import { getDeviceName, getDevicePreset } from "./visualMapDevices.js";
import { ALL_OBJECT_PRESETS } from "./visualMapPresets.js";

// Operacoes de gravacao do mapa (criar, salvar, excluir).
export function useVisualMapMapActions({ token, notify, canManage, tabs, activeTab, data, confirmDiscardChanges }) {
  const { maps, activeMapId, mapDraft, setActiveMap, setMapDraft, setActiveMapId, loadMaps, runSaving } = data;

  async function handleCreateMap() {
    if (!canManage) return;
    if (!confirmDiscardChanges("Criar outro mapa e descartar as alterações não salvas?")) return;
    await runSaving(async () => {
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
    }, "Não foi possível criar o mapa visual.");
  }

  async function handleSaveMap() {
    if (!canManage || !activeMapId) return;
    await runSaving(async () => {
      const response = await updateInventoryVisualMap(token, activeMapId, buildMapPayload(mapDraft));
      setActiveMap(response.map);
      setMapDraft(mapToDraft(response.map));
      await loadMaps();
      notify?.("Mapa visual salvo.", "success");
    }, "Não foi possível salvar o mapa visual.");
  }

  async function handleDeleteMap() {
    if (!canManage || !activeMapId) return;
    const confirmed = window.confirm("Excluir este mapa visual e todos os objetos vinculados?");
    if (!confirmed) return;
    await runSaving(async () => {
      await deleteInventoryVisualMap(token, activeMapId);
      notify?.("Mapa visual excluído.", "success");
      setActiveMapId("");
      await loadMaps();
    }, "Não foi possível excluir o mapa visual.");
  }

  return { handleCreateMap, handleSaveMap, handleDeleteMap };
}

// Operacoes de gravacao dos objetos do mapa.
export function useVisualMapObjectActions({ token, notify, canManage, devices, isEditing, data, drafts, assetToAdd, setAssetToAdd }) {
  const { activeMapId, activeMap, objects, selectedObject, setObjects, setSelectedObjectId, setSelectedConnectionId, runSaving } = data;
  const { objectDraft } = drafts;

  async function handleAddObject(presetType, layer) {
    if (!canManage || !activeMapId) return;
    const preset = ALL_OBJECT_PRESETS.find((item) => item.type === presetType);
    await runSaving(async () => {
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
    }, "Não foi possível adicionar o objeto.");
  }

  async function handleAddAssetObject() {
    if (!canManage || !activeMapId || !assetToAdd) return;
    const device = devices.find((item) => item.id === assetToAdd);
    if (!device) return;
    await runSaving(async () => {
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
    }, "Não foi possível vincular o ativo ao mapa.");
  }

  async function handleSaveObject() {
    if (!canManage || !selectedObject || !objectDraft) return;
    await runSaving(async () => {
      const response = await updateInventoryVisualMapObject(token, selectedObject.id, buildObjectPayload(objectDraft));
      setObjects((current) => current.map((object) => (object.id === response.object.id ? response.object : object)));
      setSelectedObjectId(response.object.id);
      notify?.("Objeto salvo.", "success");
    }, "Não foi possível salvar o objeto.");
  }

  async function handleDeleteObject() {
    if (!canManage || !selectedObject) return;
    if (!window.confirm(`Remover "${selectedObject.label}" deste mapa visual?`)) return;
    await runSaving(async () => {
      await deleteInventoryVisualMapObject(token, selectedObject.id);
      setObjects((current) => current.filter((object) => object.id !== selectedObject.id));
      setSelectedObjectId(null);
      notify?.("Objeto removido do mapa.", "success");
    }, "Não foi possível remover o objeto.");
  }

  async function handleDuplicateObject() {
    if (!isEditing || !selectedObject || !objectDraft) return;
    await runSaving(async () => {
      const response = await createInventoryVisualMapObject(
        token,
        activeMapId,
        buildDuplicateObjectPayload(objectDraft, selectedObject.label)
      );
      setObjects((current) => [...current, response.object]);
      setSelectedObjectId(response.object.id);
      notify?.("Objeto duplicado.", "success");
    }, "Não foi possível duplicar o objeto.");
  }

  return { handleAddObject, handleAddAssetObject, handleSaveObject, handleDeleteObject, handleDuplicateObject };
}

// Operacoes de gravacao das conexoes do mapa.
export function useVisualMapConnectionActions({ token, notify, canManage, data, drafts }) {
  const { activeMapId, selectedConnection, setConnections, setSelectedConnectionId, setSelectedObjectId, runSaving } = data;
  const { connectionDraft } = drafts;

  async function handleAddConnection(layer = "infrastructure") {
    if (!canManage || !activeMapId) return;
    const draft = buildDefaultConnectionDraft(layer);
    await runSaving(async () => {
      const response = await createInventoryVisualMapConnection(token, activeMapId, {
        ...draft,
        label: layer === "electrical" ? "Linha elétrica" : "Cabo de rede"
      });
      setConnections((current) => [...current, response.connection]);
      setSelectedConnectionId(response.connection.id);
      setSelectedObjectId(null);
      notify?.("Conexão adicionada ao mapa.", "success");
    }, "Não foi possível adicionar a conexão.");
  }

  async function handleSaveConnection() {
    if (!canManage || !selectedConnection || !connectionDraft) return;
    await runSaving(async () => {
      const response = await updateInventoryVisualMapConnection(token, selectedConnection.id, buildConnectionPayload(connectionDraft));
      setConnections((current) => current.map((connection) => (
        connection.id === response.connection.id ? response.connection : connection
      )));
      setSelectedConnectionId(response.connection.id);
      notify?.("Conexão salva.", "success");
    }, "Não foi possível salvar a conexão.");
  }

  async function handleDeleteConnection() {
    if (!canManage || !selectedConnection) return;
    if (!window.confirm(`Remover a conexão "${selectedConnection.label || "sem identificação"}"?`)) return;
    await runSaving(async () => {
      await deleteInventoryVisualMapConnection(token, selectedConnection.id);
      setConnections((current) => current.filter((connection) => connection.id !== selectedConnection.id));
      setSelectedConnectionId(null);
      notify?.("Conexão removida do mapa.", "success");
    }, "Não foi possível remover a conexão.");
  }

  return { handleAddConnection, handleSaveConnection, handleDeleteConnection };
}
