import { useCallback, useEffect, useState } from "react";
import { fetchNetworkTopologyMap, fetchNetworkTopologyMapByScope, fetchNetworkTopologyMaps } from "../../../../api.js";

// Mapas e pacote (nos + conexoes) do escopo exibido. Trocar de escopo recarrega o
// pacote e zera selecao/edicao, abrindo em edicao quando ha intencao registrada.
export default function useTopologyMapData({ token, canView, canEditMap, activeTab, nav, selection }) {
  const { viewLevel, selectedGroupId, selectedSegmentId, selectedGroup, selectedSegmentSummary, editIntentRef } = nav;
  const { setEditMode, setSelectedNodeId, setSelectedLinkId } = selection;
  const [maps, setMaps] = useState(null);
  const [activeMapId, setActiveMapId] = useState(null);
  const [legacyActiveMapId, setLegacyActiveMapId] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [loadingBundle, setLoadingBundle] = useState(false);
  const [error, setError] = useState("");

  const loadMaps = useCallback(async () => {
    if (!canView) return;
    try {
      const response = await fetchNetworkTopologyMaps(token);
      setMaps(response.maps);
      const legacyMaps = response.maps.filter((map) => !map.scopeType || map.scopeType === "global");
      setLegacyActiveMapId((current) => (legacyMaps.some((map) => map.id === current) ? current : legacyMaps[0]?.id || null));
    } catch (fetchError) {
      setError(fetchError.message);
    }
  }, [token, canView]);

  useEffect(() => {
    if (viewLevel === "global-legado" && maps === null) {
      loadMaps();
    }
  }, [viewLevel, maps, loadMaps]);

  // Updating the scoped map's id must not refetch its bundle and discard
  // unsaved edits. Only the legacy view selects a map directly by id.
  const legacyMapId = viewLevel === "global-legado" ? legacyActiveMapId : null;
  const scopeKey = JSON.stringify([activeTab?.id, viewLevel, selectedGroupId, selectedSegmentId, legacyMapId]);
  const scopeAvailable = viewLevel === "group" ? Boolean(selectedGroup) : viewLevel === "segment" ? Boolean(selectedSegmentSummary) : true;
  useEffect(() => {
    if (!canView) return undefined;
    const scopeType = viewLevel === "tab" ? "inventory_tab" : viewLevel;
    const scopeId = viewLevel === "tab" ? activeTab?.id : viewLevel === "segment" ? selectedSegmentId : selectedGroupId;
    setBundle(null);
    if (!scopeAvailable || (viewLevel === "global-legado" ? !legacyMapId : !scopeId)) {
      setLoadingBundle(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingBundle(true);
    setError("");
    setEditMode(false);
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    const openForEditing = canEditMap && editIntentRef.current?.scopeType === scopeType && editIntentRef.current?.scopeId === scopeId;
    editIntentRef.current = null;
    const request =
      viewLevel === "global-legado"
        ? fetchNetworkTopologyMap(token, legacyMapId)
        : fetchNetworkTopologyMapByScope(token, scopeType, scopeId, viewLevel === "tab" ? activeTab?.name : undefined);
    request
      .then((response) => {
        if (cancelled) return;
        setBundle(response);
        setActiveMapId(response.map.id);
        setEditMode(openForEditing);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingBundle(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    viewLevel,
    selectedSegmentId,
    selectedGroupId,
    activeTab?.id,
    activeTab?.name,
    legacyMapId,
    token,
    canView,
    canEditMap,
    scopeAvailable
  ]);

  return {
    maps,
    setMaps,
    activeMapId,
    setActiveMapId,
    legacyActiveMapId,
    setLegacyActiveMapId,
    bundle,
    setBundle,
    loadingBundle,
    error,
    scopeKey
  };
}
