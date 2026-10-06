import { useCallback, useEffect, useState } from "react";
import { getQuickLayerState } from "../inventoryVisualMapConnectionUtils.js";

// Modo, camadas, camera e trocas de selecao/mapa com confirmacao de descarte.
export default function useVisualMapNavigation({ canManage, data, drafts }) {
  const [mode, setMode] = useState("view");
  const [showGrid, setShowGrid] = useState(true);
  const [layers, setLayers] = useState(getQuickLayerState("all"));
  const [cameraAction, setCameraAction] = useState({ type: "fit", revision: 0 });
  const {
    activeMapId, setActiveMapId, selectedObject, selectedConnection, selectedObjectId, selectedConnectionId,
    setSelectedObjectId, setSelectedConnectionId, loadMaps, loadActiveMap
  } = data;
  const { hasUnsavedChanges, objectDirty, connectionDirty, resetAllDrafts } = drafts;

  const isEditing = Boolean(canManage && mode === "edit");

  const confirmDiscardChanges = useCallback((message = "Descartar as alterações não salvas?") => {
    if (!hasUnsavedChanges) return true;
    return window.confirm(message);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (selectedObject && layers?.[selectedObject.layer] === false) {
      setSelectedObjectId(null);
    }
    if (selectedConnection && layers?.[selectedConnection.layer] === false) {
      setSelectedConnectionId(null);
    }
  }, [layers, selectedConnection, selectedObject, setSelectedConnectionId, setSelectedObjectId]);

  function handleSelectObject(objectId) {
    if (objectId !== selectedObjectId && objectDirty && !window.confirm("Descartar as alterações deste objeto?")) return;
    setSelectedObjectId(objectId);
    if (objectId) setSelectedConnectionId(null);
  }

  function handleSelectConnection(connectionId) {
    if (connectionId !== selectedConnectionId && connectionDirty && !window.confirm("Descartar as alterações desta conexão?")) return;
    setSelectedConnectionId(connectionId);
    if (connectionId) setSelectedObjectId(null);
  }

  function handleMapChange(nextMapId) {
    if (nextMapId === activeMapId) return;
    if (!confirmDiscardChanges("Trocar de mapa e descartar as alterações não salvas?")) return;
    setActiveMapId(nextMapId);
  }

  function handleModeChange(nextMode) {
    if (nextMode === mode) return;
    if (nextMode === "view" && !confirmDiscardChanges("Sair do modo de edição e descartar as alterações não salvas?")) return;
    if (nextMode === "view") resetAllDrafts();
    setMode(nextMode);
  }

  async function handleRefresh() {
    if (!confirmDiscardChanges("Atualizar o mapa e descartar as alterações não salvas?")) return;
    await loadMaps();
    await loadActiveMap();
  }

  return {
    mode, showGrid, layers, cameraAction, isEditing, setLayers, confirmDiscardChanges,
    toggleGrid: () => setShowGrid((current) => !current),
    toggleLayer: (key) => setLayers((current) => ({ ...current, [key]: !current[key] })),
    runCameraAction: (type) => setCameraAction((current) => ({ type, revision: current.revision + 1 })),
    handleSelectObject, handleSelectConnection, handleMapChange, handleModeChange, handleRefresh
  };
}
