import { useEffect, useRef, useState } from "react";
import { createSceneRuntime } from "./runtime.js";

/**
 * Ciclo de vida da cena 3D: cria o runtime (renderer, camera, objetos) quando
 * os dados mudam, descarta o anterior e mantem selecao e grade sincronizadas
 * sem reconstruir a cena. Callbacks e flags ficam em refs para que a cena
 * sempre use os valores mais recentes.
 */
export function useFloorPlanScene({
  data,
  activeFloorId,
  preview,
  modelQuality,
  cameraView,
  selected,
  editable,
  showGrid,
  onMoveObject,
  onSelect
}) {
  const containerRef = useRef(null);
  const sceneApiRef = useRef(null);
  const callbacksRef = useRef({ onMoveObject, onSelect });
  const editableRef = useRef(editable);
  const cameraViewRef = useRef(cameraView);
  const showGridRef = useRef(showGrid);
  const selectedRef = useRef(selected);
  const [sceneReady, setSceneReady] = useState(false);
  const [pendingModels, setPendingModels] = useState(0);

  callbacksRef.current = { onMoveObject, onSelect };
  editableRef.current = editable;
  cameraViewRef.current = cameraView;
  showGridRef.current = showGrid;
  selectedRef.current = selected;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data) return undefined;

    setSceneReady(false);
    setPendingModels(0);

    const runtime = createSceneRuntime({
      container,
      data,
      activeFloorId,
      preview,
      modelQuality,
      initialView: cameraViewRef.current,
      showGrid: showGridRef.current,
      callbacksRef,
      editableRef,
      onPendingModels: setPendingModels
    });
    sceneApiRef.current = runtime.api;
    runtime.api.applySelection(selectedRef.current);
    runtime.api.render();
    setSceneReady(true);

    return () => {
      if (sceneApiRef.current === runtime.api) sceneApiRef.current = null;
      runtime.dispose();
    };
  }, [activeFloorId, data, modelQuality, preview]);

  useEffect(() => {
    sceneApiRef.current?.applySelection(selected);
  }, [selected]);

  useEffect(() => {
    sceneApiRef.current?.setGridVisible(showGrid);
  }, [showGrid]);

  return { containerRef, sceneApiRef, sceneReady, pendingModels };
}
