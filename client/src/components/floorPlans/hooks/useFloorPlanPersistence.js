import { useCallback, useEffect, useRef, useState } from "react";
import { saveFloorPlanEditorData } from "../../../api.js";
import { buildEditorPayload, normalizeResponsePlan } from "../utils/editorGeometry.js";

export const AUTOSAVE_DELAY_MS = 900;

/**
 * Controle do estado de salvamento: "saved", "saving", "dirty" ou "error".
 * Mantem a revisao local para saber se houve edicao enquanto um salvamento
 * estava em andamento (nesse caso um novo salvamento e enfileirado).
 */
export function useSaveTracker() {
  const [saveState, setSaveState] = useState("saved");
  const editorRevisionRef = useRef(0);
  const saveInFlightRef = useRef(null);
  const saveQueuedRef = useRef(false);

  const markDirty = useCallback(() => {
    editorRevisionRef.current += 1;
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      setSaveState("saving");
      return;
    }
    setSaveState("dirty");
  }, []);

  /** Zera o controle ao abrir uma planta (nada pendente, estado "saved"). */
  const resetTracking = useCallback(() => {
    editorRevisionRef.current = 0;
    saveQueuedRef.current = false;
    setSaveState("saved");
  }, []);

  return { saveState, setSaveState, markDirty, resetTracking, editorRevisionRef, saveInFlightRef, saveQueuedRef };
}

/**
 * Salvamento da planta no servidor, com autosave 900 ms apos a ultima
 * alteracao. `onSaved(updatedEditor)` e `onError(message)` avisam a lista de
 * plantas e o banner de erro.
 */
export function useFloorPlanPersistence({ token, permissions, notify, doc, tracker, onSaved, onError }) {
  const { editor, editorRef, setEditor, setActiveFloorId } = doc;
  const { saveState, setSaveState, editorRevisionRef, saveInFlightRef, saveQueuedRef } = tracker;
  const autosaveRef = useRef(null);
  const persistEditorRef = useRef(null);

  const persistEditor = useCallback(async () => {
    const snapshot = editorRef.current;
    if (!snapshot?.plan?.id || !permissions.update) return;
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return saveInFlightRef.current;
    }

    const snapshotRevision = editorRevisionRef.current;
    setSaveState("saving");
    const saveRequest = (async () => {
      try {
        const payload = await saveFloorPlanEditorData(token, snapshot.plan.id, buildEditorPayload(snapshot));
        const updated = normalizeResponsePlan(payload);
        const samePlanStillOpen = editorRef.current?.plan?.id === snapshot.plan.id;
        const hasNewerLocalRevision = editorRevisionRef.current !== snapshotRevision;

        if (samePlanStillOpen && !hasNewerLocalRevision) {
          editorRef.current = updated;
          setEditor(updated);
          setActiveFloorId((current) => current || updated?.plan?.activeFloorId || updated?.floors?.[0]?.id || "");
          setSaveState("saved");
        } else if (samePlanStillOpen) {
          saveQueuedRef.current = true;
          setSaveState("saving");
        }

        onSaved(updated);
      } catch (requestError) {
        setSaveState("error");
        onError(requestError.message);
        notify?.(requestError.message, "danger");
      } finally {
        saveInFlightRef.current = null;
        if (saveQueuedRef.current) {
          saveQueuedRef.current = false;
          window.setTimeout(() => persistEditorRef.current?.(), 0);
        }
      }
    })();
    saveInFlightRef.current = saveRequest;
    return saveRequest;
  }, [notify, permissions.update, token]);

  persistEditorRef.current = persistEditor;

  useEffect(() => {
    if (saveState !== "dirty" || !editor?.plan?.id) return undefined;
    window.clearTimeout(autosaveRef.current);
    autosaveRef.current = window.setTimeout(() => {
      persistEditor();
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(autosaveRef.current);
  }, [editor, persistEditor, saveState]);

  return { persistEditor };
}
