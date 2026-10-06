import { useCallback, useMemo, useRef, useState } from "react";
import { cloneEditor, getActiveFloor } from "../utils/editorGeometry.js";
import { ensureRoomWallObjects, syncAnchoredOpenings } from "../utils/wallGeometry.js";

const HISTORY_LIMIT = 30;

/**
 * Documento do editor: planta carregada, andar ativo e historico de
 * desfazer/refazer (ate 30 passos). `markDirty` avisa a persistencia de que
 * houve alteracao.
 */
export function useFloorPlanEditor({ markDirty }) {
  const [editor, setEditor] = useState(null);
  const [activeFloorId, setActiveFloorId] = useState("");
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const editorRef = useRef(null);

  editorRef.current = editor;

  const activeFloorRecord = useMemo(() => getActiveFloor(editor, activeFloorId), [activeFloorId, editor]);

  const pushHistory = useCallback((snapshot) => {
    setPast((items) => [...items.slice(-(HISTORY_LIMIT - 1)), cloneEditor(snapshot)]);
    setFuture([]);
  }, []);

  /**
   * Aplica uma alteracao ao editor (funcao sobre um rascunho clonado ou o novo
   * valor). Com `track: false` a alteracao nao entra no historico (ex.: arrasto).
   */
  const commitEditor = useCallback(
    (updater, { track = true } = {}) => {
      setEditor((current) => {
        if (!current) return current;
        const before = cloneEditor(current);
        const next = typeof updater === "function" ? updater(cloneEditor(current)) : updater;
        if (next) {
          next.objects = syncAnchoredOpenings(ensureRoomWallObjects(next.objects || [], next.zones || []));
        }
        if (track) {
          setPast((items) => [...items.slice(-(HISTORY_LIMIT - 1)), before]);
          setFuture([]);
        }
        return next;
      });
      markDirty();
    },
    [markDirty]
  );

  const undo = useCallback(() => {
    setPast((items) => {
      if (items.length === 0) return items;
      const previous = items[items.length - 1];
      setFuture((futureItems) => [cloneEditor(editor), ...futureItems.slice(0, HISTORY_LIMIT - 1)]);
      setEditor(previous);
      markDirty();
      return items.slice(0, -1);
    });
  }, [editor, markDirty]);

  const redo = useCallback(() => {
    setFuture((items) => {
      if (items.length === 0) return items;
      const next = items[0];
      setPast((pastItems) => [...pastItems.slice(-(HISTORY_LIMIT - 1)), cloneEditor(editor)]);
      setEditor(next);
      markDirty();
      return items.slice(1);
    });
  }, [editor, markDirty]);

  /** Abre uma planta carregada do servidor: zera historico e escolhe o andar ativo. */
  const loadEditor = useCallback((loaded) => {
    editorRef.current = loaded;
    setEditor(loaded);
    setActiveFloorId(loaded?.plan?.activeFloorId || loaded?.floors?.[0]?.id || "");
    setPast([]);
    setFuture([]);
  }, []);

  return {
    editor,
    setEditor,
    editorRef,
    activeFloorId,
    setActiveFloorId,
    activeFloorRecord,
    past,
    future,
    pushHistory,
    commitEditor,
    undo,
    redo,
    loadEditor
  };
}
