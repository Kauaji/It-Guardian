import { useCallback, useState } from "react";
import {
  createNetworkTopologyMap,
  createNetworkTopologyNode,
  deleteNetworkTopologyLink,
  deleteNetworkTopologyNode,
  updateNetworkTopologyLink
} from "../../../../api.js";
import { jitteredCenter } from "./topologyViewConstants.js";

// Gravacoes do mapa: criar mapa, adicionar/remover ativo, salvar/remover/criar conexao.
export default function useTopologyMutations({ token, notify, canManageMap, mapData, selection }) {
  const [addingAsset, setAddingAsset] = useState(false);
  const [creatingMap, setCreatingMap] = useState(false);
  const { bundle, setBundle, activeMapId, setMaps, setActiveMapId, setLegacyActiveMapId } = mapData;
  const { selectedLinkId, setSelectedNodeId, setSelectedLinkId, setJustAddedNodeId, setJustCreatedLinkId } = selection;

  const handleLinkCreated = useCallback(
    (mapId, link, isNew) => {
      setBundle((current) =>
        current?.map.id === mapId
          ? {
              ...current,
              links: [...current.links.filter((entry) => entry.id !== link.id), link]
            }
          : current
      );
      setSelectedNodeId(null);
      setSelectedLinkId(link.id);
      if (isNew) {
        setJustCreatedLinkId(link.id);
        window.setTimeout(() => setJustCreatedLinkId((current) => (current === link.id ? null : current)), 800);
      }
    },
    [setBundle, setSelectedNodeId, setSelectedLinkId, setJustCreatedLinkId]
  );

  const handleCreateMap = useCallback(async () => {
    setCreatingMap(true);
    try {
      const response = await createNetworkTopologyMap(token, { name: "Mapa de Rede" });
      setMaps((current) => [response.map, ...(current || [])]);
      setActiveMapId(response.map.id);
      setLegacyActiveMapId(response.map.id);
    } catch (createError) {
      notify?.("error", createError.message);
    } finally {
      setCreatingMap(false);
    }
  }, [token, notify, setMaps, setActiveMapId, setLegacyActiveMapId]);

  const handleAddAsset = useCallback(
    async (assetId, position) => {
      if (!assetId || !activeMapId || !canManageMap || addingAsset) return;
      setAddingAsset(true);
      try {
        const point = position || jitteredCenter();
        const response = await createNetworkTopologyNode(token, activeMapId, { assetId, ...point });
        setBundle((current) => (current?.map.id === activeMapId ? { ...current, nodes: [...current.nodes, response.node] } : current));
        setJustAddedNodeId(response.node.id);
        setSelectedNodeId(response.node.id);
        window.setTimeout(() => setJustAddedNodeId((current) => (current === response.node.id ? null : current)), 1400);
      } catch (createError) {
        notify?.("error", createError.message);
      } finally {
        setAddingAsset(false);
      }
    },
    [token, activeMapId, notify, canManageMap, addingAsset, setBundle, setJustAddedNodeId, setSelectedNodeId]
  );

  const handleRemoveNode = useCallback(
    async (nodeId) => {
      if (!window.confirm("Remover este ativo do mapa de rede?")) return;
      try {
        await deleteNetworkTopologyNode(token, nodeId);
        setBundle((current) => ({
          ...current,
          nodes: current.nodes.filter((node) => node.id !== nodeId),
          links: current.links
        }));
        setSelectedNodeId(null);
      } catch (removeError) {
        notify?.("error", removeError.message);
      }
    },
    [token, notify, setBundle, setSelectedNodeId]
  );

  const handleSaveLink = useCallback(
    async (payload) => {
      if (!selectedLinkId) return;
      try {
        const link = bundle.links.find((entry) => entry.id === selectedLinkId);
        const response = await updateNetworkTopologyLink(token, selectedLinkId, {
          sourceAssetId: link.sourceAssetId,
          targetAssetId: link.targetAssetId,
          sourceType: link.sourceType || "asset",
          targetType: link.targetType || "asset",
          ...payload
        });
        setBundle((current) =>
          current?.map.id === bundle.map.id
            ? {
                ...current,
                links: current.links.map((entry) => (entry.id === selectedLinkId ? response.link : entry))
              }
            : current
        );
        notify?.("success", "Conexão atualizada.");
      } catch (updateError) {
        notify?.("error", updateError.message);
      }
    },
    [selectedLinkId, bundle, token, notify, setBundle]
  );

  const handleRemoveLink = useCallback(async () => {
    if (!selectedLinkId) return;
    if (!window.confirm("Excluir esta conexão?")) return;
    try {
      await deleteNetworkTopologyLink(token, selectedLinkId);
      setBundle((current) => ({
        ...current,
        links: current.links.filter((entry) => entry.id !== selectedLinkId)
      }));
      setSelectedLinkId(null);
    } catch (removeError) {
      notify?.("error", removeError.message);
    }
  }, [selectedLinkId, token, notify, setBundle, setSelectedLinkId]);

  return {
    addingAsset,
    creatingMap,
    handleLinkCreated,
    handleCreateMap,
    handleAddAsset,
    handleRemoveNode,
    handleSaveLink,
    handleRemoveLink
  };
}
