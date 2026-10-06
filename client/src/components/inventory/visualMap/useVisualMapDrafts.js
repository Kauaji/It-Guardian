import { useEffect, useMemo, useState } from "react";
import {
  connectionToDraft,
  draftsMatch,
  mapToDraft,
  objectToDraft,
  withAddedConnectionPoint,
  withConnectionField,
  withConnectionMetadata,
  withConnectionPoint,
  withObjectField,
  withObjectMetadata,
  withoutConnectionPoint
} from "./visualMapDrafts.js";

// Rascunhos editaveis (mapa, objeto, conexao), indicadores de alteracao e atualizadores.
export default function useVisualMapDrafts({ activeMap, mapDraft, setMapDraft, selectedObject, selectedConnection }) {
  const [objectDraft, setObjectDraft] = useState(null);
  const [connectionDraft, setConnectionDraft] = useState(null);

  const mapDirty = useMemo(() => Boolean(activeMap && !draftsMatch(mapDraft, mapToDraft(activeMap))), [activeMap, mapDraft]);
  const objectDirty = useMemo(
    () => Boolean(selectedObject && objectDraft && !draftsMatch(objectDraft, objectToDraft(selectedObject))),
    [objectDraft, selectedObject]
  );
  const connectionDirty = useMemo(
    () => Boolean(selectedConnection && connectionDraft && !draftsMatch(connectionDraft, connectionToDraft(selectedConnection))),
    [connectionDraft, selectedConnection]
  );
  const hasUnsavedChanges = mapDirty || objectDirty || connectionDirty;

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

  return {
    objectDraft,
    setObjectDraft,
    connectionDraft,
    setConnectionDraft,
    mapDirty,
    objectDirty,
    connectionDirty,
    hasUnsavedChanges,
    updateMapDraft: (key, value) => setMapDraft((current) => ({ ...current, [key]: value })),
    updateObjectDraft: (key, value) => setObjectDraft((current) => withObjectField(current, key, value)),
    updateObjectMetadata: (key, value) => setObjectDraft((current) => withObjectMetadata(current, key, value)),
    updateConnectionDraft: (key, value) => setConnectionDraft((current) => withConnectionField(current, key, value)),
    updateConnectionPoint: (index, key, value) => setConnectionDraft((current) => withConnectionPoint(current, index, key, value)),
    addConnectionPoint: () => setConnectionDraft(withAddedConnectionPoint),
    removeConnectionPoint: (index) => setConnectionDraft((current) => withoutConnectionPoint(current, index)),
    updateConnectionMetadata: (key, value) => setConnectionDraft((current) => withConnectionMetadata(current, key, value)),
    resetObjectDraft: () => setObjectDraft(objectToDraft(selectedObject)),
    resetConnectionDraft: () => setConnectionDraft(connectionToDraft(selectedConnection)),
    resetAllDrafts: () => {
      setMapDraft(mapToDraft(activeMap));
      setObjectDraft(objectToDraft(selectedObject));
      setConnectionDraft(connectionToDraft(selectedConnection));
    }
  };
}
