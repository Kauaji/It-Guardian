import { useCallback, useEffect, useRef, useState } from "react";
import { generateNetworkTopologyAutoLayout, updateNetworkTopologyNode } from "../../../api.js";
import { topologyNodeKey } from "./networkTopologyConnections.js";
import { ensureTopologyNode, saveTopologyPositions } from "./networkTopologyPersistence.js";
import {
  autoLayoutHints,
  dirtyPositionChanges,
  mergeSavedNodes,
  withDraggedPosition,
  withoutSavedPositions
} from "./topologyLayoutState.js";

/** Inventory membership is automatic; only explicit layout actions write positions. */
export default function useTopologyLayout({
  token,
  mapId,
  scopeKey,
  nodes,
  devicesById,
  enabled,
  setBundle,
  onMaterialized,
  onAutoLayout,
  notify
}) {
  const [dirtyPositions, setDirtyPositions] = useState(new Map());
  const [saving, setSaving] = useState(false);
  const [generatingLayout, setGeneratingLayout] = useState(false);
  const busyRef = useRef(false);
  const version = useRef(0);

  useEffect(() => {
    version.current += 1;
    busyRef.current = false;
    setDirtyPositions(new Map());
    setSaving(false);
    setGeneratingLayout(false);
    return () => {
      version.current += 1;
    };
  }, [token, mapId, scopeKey, enabled]);

  const mergeNodes = useCallback(
    (updates) => {
      setBundle((current) => mergeSavedNodes(current, mapId, updates));
    },
    [mapId, setBundle]
  );

  const materialized = useCallback(
    (savedNode, originalNode) => {
      mergeNodes([savedNode]);
      onMaterialized?.(savedNode, originalNode);
    },
    [mergeNodes, onMaterialized]
  );

  const onNodeDrag = useCallback(
    (nodeId, x, y) => {
      if (!enabled || busyRef.current || !Number.isFinite(x) || !Number.isFinite(y)) return;
      const node = nodes.find((entry) => entry.id === nodeId);
      if (!node) return;
      setDirtyPositions((current) => withDraggedPosition(current, node, x, y));
    },
    [enabled, nodes]
  );

  const resetLayout = useCallback(() => {
    if (!busyRef.current) setDirtyPositions(new Map());
  }, []);

  const saveLayout = useCallback(async () => {
    if (!enabled || !mapId || busyRef.current || !dirtyPositions.size) return;
    const snapshot = new Map(dirtyPositions);
    const changes = dirtyPositionChanges(nodes, snapshot);
    const requestVersion = version.current;
    const isCurrent = () => version.current === requestVersion;
    busyRef.current = true;
    setSaving(true);
    try {
      const response = await saveTopologyPositions({ token, mapId, changes, isCurrent, onMaterialized: materialized });
      if (!isCurrent() || !response) return;
      mergeNodes(response.nodes);
      setDirtyPositions((current) => withoutSavedPositions(current, snapshot));
      notify?.("success", "Layout do mapa de rede salvo.");
    } catch (error) {
      if (isCurrent()) notify?.("error", error.message);
    } finally {
      if (isCurrent()) {
        busyRef.current = false;
        setSaving(false);
      }
    }
  }, [enabled, mapId, dirtyPositions, nodes, token, materialized, mergeNodes, notify]);

  const generateAutoLayout = useCallback(async () => {
    if (!enabled || !mapId || busyRef.current || !nodes.length) return;
    const requestVersion = version.current;
    const isCurrent = () => version.current === requestVersion;
    busyRef.current = true;
    setGeneratingLayout(true);
    try {
      // Include every eligible inventory item, not just items matching a UI filter.
      for (const node of nodes) {
        const saved = await ensureTopologyNode({ token, mapId, node, isCurrent, onMaterialized: materialized });
        if (!isCurrent() || !saved) return;
      }
      const response = await generateNetworkTopologyAutoLayout(token, mapId, autoLayoutHints(nodes, devicesById));
      if (!isCurrent()) return;
      mergeNodes(response.nodes);
      setDirtyPositions(new Map());
      notify?.("success", "Layout automático gerado.");
      onAutoLayout?.();
    } catch (error) {
      if (isCurrent()) notify?.("error", error.message);
    } finally {
      if (isCurrent()) {
        busyRef.current = false;
        setGeneratingLayout(false);
      }
    }
  }, [enabled, mapId, nodes, token, materialized, devicesById, mergeNodes, notify, onAutoLayout]);

  const togglePinned = useCallback(
    async (selectedNode) => {
      if (!enabled || !mapId || busyRef.current) return;
      // A dirty screen position is not the saved base position used for materialization.
      const node = nodes.find((entry) => topologyNodeKey(entry) === topologyNodeKey(selectedNode));
      if (!node) return;
      const requestVersion = version.current;
      const isCurrent = () => version.current === requestVersion;
      busyRef.current = true;
      setSaving(true);
      try {
        const saved = await ensureTopologyNode({ token, mapId, node, isCurrent, onMaterialized: materialized });
        if (!isCurrent() || !saved) return;
        const response = await updateNetworkTopologyNode(token, saved.id, { pinned: !saved.pinned });
        if (isCurrent()) mergeNodes([response.node]);
      } catch (error) {
        if (isCurrent()) notify?.("error", error.message);
      } finally {
        if (isCurrent()) {
          busyRef.current = false;
          setSaving(false);
        }
      }
    },
    [enabled, mapId, nodes, token, materialized, mergeNodes, notify]
  );

  return { dirtyPositions, saving, generatingLayout, onNodeDrag, resetLayout, saveLayout, generateAutoLayout, togglePinned };
}
