import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchInventoryVisualMap, fetchInventoryVisualMaps } from "../../../api.js";
import { EMPTY_MAP_DRAFT, mapToDraft } from "./visualMapDrafts.js";
import { getDeviceMeta } from "./visualMapDevices.js";

// Carrega os mapas visuais, o mapa ativo (objetos/conexoes) e mantem a selecao.
export default function useVisualMapData({ token, devices }) {
  const [maps, setMaps] = useState([]);
  const [activeMapId, setActiveMapId] = useState("");
  const [activeMap, setActiveMap] = useState(null);
  const [mapDraft, setMapDraft] = useState(EMPTY_MAP_DRAFT);
  const [objects, setObjects] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedObject = useMemo(
    () => objects.find((object) => object.id === selectedObjectId) || null,
    [objects, selectedObjectId]
  );
  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.id === selectedConnectionId) || null,
    [connections, selectedConnectionId]
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
  const usedAssetIds = useMemo(
    () => new Set(objects.map((object) => object.linkedAssetId).filter(Boolean)),
    [objects]
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
      setError(loadError.message || "Não foi possível carregar os mapas visuais.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadActiveMap = useCallback(async () => {
    if (!activeMapId) {
      setActiveMap(null);
      setMapDraft(EMPTY_MAP_DRAFT);
      setObjects([]);
      setConnections([]);
      setSelectedObjectId(null);
      setSelectedConnectionId(null);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetchInventoryVisualMap(token, activeMapId);
      setActiveMap(response.map);
      setMapDraft(mapToDraft(response.map));
      setObjects(response.objects || []);
      setConnections(response.connections || []);
      setSelectedObjectId((current) => {
        if (current && (response.objects || []).some((object) => object.id === current)) return current;
        return (response.objects || [])[0]?.id || null;
      });
      setSelectedConnectionId((current) => {
        if (current && (response.connections || []).some((connection) => connection.id === current)) return current;
        return null;
      });
    } catch (loadError) {
      setError(loadError.message || "Não foi possível abrir o mapa visual.");
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

  // Executa uma gravacao com o ciclo saving/erro padrao do painel.
  const runSaving = useCallback(async (task, fallbackMessage) => {
    setSaving(true);
    setError("");
    try {
      await task();
    } catch (taskError) {
      setError(taskError.message || fallbackMessage);
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    maps, activeMapId, setActiveMapId, activeMap, setActiveMap, activeMapOption,
    mapDraft, setMapDraft, objects, setObjects, connections, setConnections,
    selectedObjectId, setSelectedObjectId, selectedConnectionId, setSelectedConnectionId,
    selectedObject, selectedConnection, linkedDevice, linkedDeviceMeta, usedAssetIds,
    loading, saving, error, loadMaps, loadActiveMap, runSaving
  };
}
