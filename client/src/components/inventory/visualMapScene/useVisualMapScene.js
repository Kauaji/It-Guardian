import { useEffect, useMemo, useRef } from "react";
import { createVisualMapRuntime } from "./sceneRuntime.js";

// Ciclo de vida da cena 3D: recria o runtime quando mapa, selecao, grade ou
// conteudo visivel mudam e despacha as acoes de camera para o runtime atual.
export default function useVisualMapScene({
  map,
  objects,
  connections,
  selectedObjectId,
  selectedConnectionId,
  layers,
  showGrid,
  cameraAction,
  onSelectObject,
  onSelectConnection
}) {
  const hostRef = useRef(null);
  const selectableMeshesRef = useRef([]);
  const cameraContextRef = useRef(null);
  const cameraStateRef = useRef(null);
  const selectObjectRef = useRef(onSelectObject);
  const selectConnectionRef = useRef(onSelectConnection);

  selectObjectRef.current = onSelectObject;
  selectConnectionRef.current = onSelectConnection;

  const visibleObjects = useMemo(() => objects.filter((object) => layers?.[object.layer] !== false), [layers, objects]);

  const visibleConnections = useMemo(() => connections.filter((connection) => layers?.[connection.layer] !== false), [connections, layers]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !map) return undefined;

    const runtime = createVisualMapRuntime({
      host,
      map,
      showGrid,
      content: { visibleObjects, visibleConnections, selectedObjectId, selectedConnectionId },
      refs: {
        selectableRef: selectableMeshesRef,
        cameraStateRef,
        onSelectObjectRef: selectObjectRef,
        onSelectConnectionRef: selectConnectionRef
      }
    });
    cameraContextRef.current = runtime.cameraApi;

    return () => {
      runtime.dispose();
      cameraContextRef.current = null;
    };
  }, [map, selectedConnectionId, selectedObjectId, showGrid, visibleConnections, visibleObjects]);

  useEffect(() => {
    if (!cameraAction?.revision) return;
    const context = cameraContextRef.current;
    if (!context) return;
    if (cameraAction.type === "selection") context.focusSelection();
    else if (cameraAction.type === "reset") context.resetCamera();
    else context.fitMap();
  }, [cameraAction]);

  return hostRef;
}
