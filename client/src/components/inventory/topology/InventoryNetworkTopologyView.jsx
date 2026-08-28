import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import {
  createNetworkTopologyLink,
  createNetworkTopologyMap,
  createNetworkTopologyNode,
  deleteNetworkTopologyLink,
  deleteNetworkTopologyNode,
  fetchNetworkTopologyMap,
  fetchNetworkTopologyMapByScope,
  fetchNetworkTopologyMaps,
  generateNetworkTopologyAutoLayout,
  saveNetworkTopologyNodePositions,
  updateNetworkTopologyLink,
  updateNetworkTopologyNode
} from "../../../api.js";
import { useAppSession } from "../../../context/AppSessionContext.jsx";
import PermissionBlocked from "../../ui/PermissionBlocked.jsx";
import ViewLoadingState from "../../ui/ViewLoadingState.jsx";
import { assetTypeOptions } from "../assetTypes.js";
import NetworkTopologyCanvas from "./NetworkTopologyCanvas.jsx";
import NetworkTopologyToolbar from "./NetworkTopologyToolbar.jsx";
import { NetworkTopologyLinkInspector, NetworkTopologyNodeInspector } from "./NetworkTopologyInspector.jsx";
import { buildFilterPredicate, resolveAssetType } from "./networkTopologyModel.js";
import { buildHierarchyTree } from "./networkTopologyHierarchy.js";
import NetworkTopologyHierarchySidebar from "./NetworkTopologyHierarchySidebar.jsx";
import NetworkTopologyBreadcrumb from "./NetworkTopologyBreadcrumb.jsx";
import NetworkTopologyLevelEmptyState from "./NetworkTopologyLevelEmptyState.jsx";
import NetworkTopologyNavigation from "./NetworkTopologyNavigation.jsx";
import { buildInventoryTopologyPreview, getTopologySegments, resolveTopologyDisplayNodes } from "./networkTopologyProjection.js";

const DEFAULT_FILTERS = { search: "", status: "", segmentId: "", assetType: "" };

function jitteredCenter() {
  return {
    x: 800 + (Math.random() - 0.5) * 260,
    y: 500 + (Math.random() - 0.5) * 260
  };
}

/**
 * Roteador de nivel da hierarquia (Aba -> Grupo -> Segmento) do Mapa de
 * Rede. Cada nível preserva seu mapa salvo. Quando ainda não há nós,
 * uma prévia local do inventário permite navegar sem precisar editar.
 */
export default function InventoryNetworkTopologyView({
  token,
  notify,
  devices,
  segments,
  groups = [],
  tabs = [],
  activeTab,
  onSelectTab,
  onOpenDetails
}) {
  const { can } = useAppSession();
  const canView = can("inventory.topology.view");
  const canManageMap = can("inventory.topology.manage");
  const canLinkAssets = can("inventory.topology.link_assets");

  const [viewLevel, setViewLevel] = useState("tab");
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);

  const [maps, setMaps] = useState(null);
  const [activeMapId, setActiveMapId] = useState(null);
  const [legacyActiveMapId, setLegacyActiveMapId] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [loadingBundle, setLoadingBundle] = useState(false);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedLinkId, setSelectedLinkId] = useState(null);
  const [linkDraftActive, setLinkDraftActive] = useState(false);
  const [linkDraftSourceNodeId, setLinkDraftSourceNodeId] = useState(null);
  const [dirtyPositions, setDirtyPositions] = useState(new Map());
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [saving, setSaving] = useState(false);
  const [generatingLayout, setGeneratingLayout] = useState(false);
  const [addingAsset, setAddingAsset] = useState(false);
  const [creatingMap, setCreatingMap] = useState(false);
  const [justAddedNodeId, setJustAddedNodeId] = useState(null);
  const [justCreatedLinkId, setJustCreatedLinkId] = useState(null);

  const canvasRef = useRef(null);

  const goToTabLevel = useCallback(() => {
    setViewLevel("tab");
    setSelectedGroupId(null);
    setSelectedSegmentId(null);
  }, []);

  const goToGroupLevel = useCallback((groupId) => {
    setViewLevel("group");
    setSelectedGroupId(groupId);
    setSelectedSegmentId(null);
  }, []);

  const goToSegmentLevel = useCallback((segmentId, groupId = null) => {
    setViewLevel("segment");
    setSelectedSegmentId(segmentId);
    setSelectedGroupId(groupId);
  }, []);

  const goToGlobalLegacy = useCallback(() => {
    setViewLevel("global-legado");
    setSelectedGroupId(null);
    setSelectedSegmentId(null);
  }, []);

  // Grupos e segmentos da aba ativa. O segmento padrao ("Nao organizadas"/
  // backup) fica de fora da hierarquia: so tem lugar no mapa quem o tecnico
  // organizou de verdade (segmento real, com ou sem grupo) - dispositivos
  // sem segmento continuam so no Inventario ate serem organizados.
  const activeGroups = useMemo(
    () => groups.filter((group) => group.tabId === activeTab?.id),
    [groups, activeTab]
  );
  const activeSegments = useMemo(
    () => segments.filter((segment) => !segment.isDefault && segment.tabId === activeTab?.id),
    [segments, activeTab]
  );
  const tree = useMemo(
    () => buildHierarchyTree({ groups: activeGroups, segments: activeSegments, devices }),
    [activeGroups, activeSegments, devices]
  );
  const selectedGroup = useMemo(
    () => (selectedGroupId ? tree.groups.find((group) => group.id === selectedGroupId) : null),
    [tree, selectedGroupId]
  );
  const selectedSegmentSummary = useMemo(
    () => getTopologySegments(tree).find((segment) => segment.id === selectedSegmentId) || null,
    [tree, selectedSegmentId]
  );
  const previousTabId = useRef(activeTab?.id);
  useEffect(() => {
    if (previousTabId.current !== activeTab?.id) {
      previousTabId.current = activeTab?.id;
      goToTabLevel();
    }
  }, [activeTab?.id, goToTabLevel]);

  const crumbs = useMemo(() => {
    if (viewLevel === "global-legado") {
      return [
        { label: activeTab?.name || "Aba", onClick: goToTabLevel },
        { label: "Visão Global (legado)" }
      ];
    }
    const list = [{ label: activeTab?.name || "Aba", onClick: viewLevel !== "tab" ? goToTabLevel : null }];
    if (selectedGroup) {
      list.push({ label: selectedGroup.name, onClick: viewLevel !== "group" ? () => goToGroupLevel(selectedGroup.id) : null });
    }
    if (viewLevel === "segment" && selectedSegmentSummary) {
      list.push({ label: selectedSegmentSummary.name });
    }
    return list;
  }, [viewLevel, activeTab, selectedGroup, selectedSegmentSummary, goToTabLevel, goToGroupLevel]);

  const loadMaps = useCallback(async () => {
    if (!canView) return;
    try {
      const response = await fetchNetworkTopologyMaps(token);
      setMaps(response.maps);
      const legacyMaps = response.maps.filter((map) => !map.scopeType || map.scopeType === "global");
      setLegacyActiveMapId((current) => legacyMaps.some((map) => map.id === current) ? current : legacyMaps[0]?.id || null);
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
  useEffect(() => {
    if (!canView) return undefined;
    const scopeType = viewLevel === "tab" ? "inventory_tab" : viewLevel;
    const scopeId = viewLevel === "tab" ? activeTab?.id
      : viewLevel === "segment" ? selectedSegmentId : selectedGroupId;
    setBundle(null);
    if (viewLevel === "global-legado" ? !legacyMapId : !scopeId) return undefined;
    let cancelled = false;
    setLoadingBundle(true);
    setError("");
    setEditMode(false);
    setDirtyPositions(new Map());
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    setLinkDraftActive(false);
    setLinkDraftSourceNodeId(null);
    const request = viewLevel === "global-legado"
      ? fetchNetworkTopologyMap(token, legacyMapId)
      : fetchNetworkTopologyMapByScope(token, scopeType, scopeId, viewLevel === "tab" ? activeTab?.name : undefined);
    request
      .then((response) => {
        if (cancelled) return;
        setBundle(response);
        setActiveMapId(response.map.id);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingBundle(false);
      });
    return () => { cancelled = true; };
  }, [viewLevel, selectedSegmentId, selectedGroupId, activeTab?.id, activeTab?.name, legacyMapId, token, canView]);

  // No nivel Segmento o filtro de segmento fica implicito (o mapa ja e so
  // daquele segmento) - a Toolbar recebe lockSegmentFilter pra so esconder
  // o controle, reaproveitando o mesmo filters.segmentId/buildFilterPredicate.
  useEffect(() => {
    if (viewLevel === "segment" && selectedSegmentId) {
      setFilters((current) => (current.segmentId === selectedSegmentId ? current : { ...current, segmentId: selectedSegmentId }));
    }
  }, [viewLevel, selectedSegmentId]);

  // Niveis de cluster (Aba/Grupo) escondem os filtros na Toolbar - reseta
  // pra nao herdar um filtro de segmento/status deixado no nivel Segmento e
  // esconder sem querer os nos-cluster (visibleNodes usa o mesmo predicate).
  useEffect(() => {
    if (viewLevel === "tab" || viewLevel === "group" || viewLevel === "global-legado") {
      setFilters(DEFAULT_FILTERS);
    }
  }, [viewLevel]);

  const devicesById = useMemo(() => new Map(devices.map((device) => [device.id, device])), [devices]);
  const filterPredicate = useMemo(() => buildFilterPredicate(filters), [filters]);
  const hasActiveFilter = Boolean(filters.search || filters.status || filters.segmentId || filters.assetType);
  const inventoryPreviewNodes = useMemo(
    () => buildInventoryTopologyPreview({ tree, viewLevel, selectedGroupId, selectedSegmentId }),
    [tree, viewLevel, selectedGroupId, selectedSegmentId]
  );
  const isInventoryPreview = Boolean(bundle && !bundle.nodes.length && inventoryPreviewNodes.length);
  const displayNodes = useMemo(
    () => bundle ? resolveTopologyDisplayNodes(bundle.nodes, inventoryPreviewNodes) : [],
    [bundle, inventoryPreviewNodes]
  );

  const visibleNodes = useMemo(() => {
    if (!bundle) return [];
    return displayNodes
      .filter((node) => {
        if (node.nodeType && node.nodeType !== "asset") return true;
        const device = devicesById.get(node.assetId);
        if (!device) return !hasActiveFilter;
        return filterPredicate(device);
      })
      .map((node) => {
        const dirty = dirtyPositions.get(node.id);
        return dirty ? { ...node, x: dirty.x, y: dirty.y } : node;
      });
  }, [bundle, displayNodes, devicesById, filterPredicate, hasActiveFilter, dirtyPositions]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const visibleLinks = useMemo(() => {
    if (!bundle) return [];
    const nodeIdByRefKey = new Map(bundle.nodes.map((node) => [node.assetId ?? node.refId, node.id]));
    return bundle.links.filter((link) => {
      const sourceNodeId = nodeIdByRefKey.get(link.sourceAssetId);
      const targetNodeId = nodeIdByRefKey.get(link.targetAssetId);
      return visibleNodeIds.has(sourceNodeId) && visibleNodeIds.has(targetNodeId);
    });
  }, [bundle, visibleNodeIds]);

  const availableDevicesToAdd = useMemo(() => {
    if (!bundle) return [];
    const usedAssetIds = new Set(bundle.nodes.map((node) => node.assetId));
    return devices.filter((device) => !usedAssetIds.has(device.id) && filterPredicate(device));
  }, [bundle, devices, filterPredicate]);

  // Resumo ao vivo (nome/status/contagem) de cada no-cluster persistido no
  // mapa, casado por refId - vem da mesma arvore (buildHierarchyTree) que
  // ja alimenta a sidebar, sem duplicar logica de agregacao.
  const clusterSummaryByRefId = useMemo(
    () => new Map([...tree.groups, ...getTopologySegments(tree)].map((entry) => [entry.id, entry])),
    [tree]
  );

  // Segmentos/grupos que existem na hierarquia mas ainda nao tem no no mapa
  // - alimenta o picker de adicionar cluster, equivalente ao
  // availableDevicesToAdd de hoje.
  const availableClustersToAdd = useMemo(() => {
    if (!bundle) return [];
    const used = new Set(
      bundle.nodes.filter((node) => node.nodeType && node.nodeType !== "asset").map((node) => node.refId)
    );
    if (viewLevel === "tab") {
      return [
        ...tree.groups.filter((group) => !used.has(group.id)).map((group) => ({ ...group, nodeType: "group" })),
        ...[...tree.ungroupedSegments, ...tree.maintenanceSegments]
          .filter((segment) => !used.has(segment.id)).map((segment) => ({ ...segment, nodeType: "segment" }))
      ];
    }
    if (viewLevel === "group" && selectedGroup) {
      return selectedGroup.segments.filter((segment) => !used.has(segment.id)).map((segment) => ({ ...segment, nodeType: "segment" }));
    }
    return [];
  }, [bundle, viewLevel, tree, selectedGroup]);

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
  }, [token, notify]);

  const handleAddAsset = useCallback(
    async (assetId, position) => {
      if (!assetId || !activeMapId || !canManageMap || addingAsset) return;
      setAddingAsset(true);
      try {
        const point = position || jitteredCenter();
        const response = await createNetworkTopologyNode(token, activeMapId, { assetId, ...point });
        setBundle((current) => current?.map.id === activeMapId ? { ...current, nodes: [...current.nodes, response.node] } : current);
        setJustAddedNodeId(response.node.id);
        setSelectedNodeId(response.node.id);
        window.setTimeout(() => setJustAddedNodeId((current) => (current === response.node.id ? null : current)), 1400);
      } catch (createError) {
        notify?.("error", createError.message);
      } finally {
        setAddingAsset(false);
      }
    },
    [token, activeMapId, notify, canManageMap, addingAsset]
  );

  const handleAddCluster = useCallback(
    async (nodeType, refId, position) => {
      if (!refId || !activeMapId || !canManageMap || addingAsset) return;
      setAddingAsset(true);
      try {
        const point = position || jitteredCenter();
        const response = await createNetworkTopologyNode(token, activeMapId, { nodeType, refId, ...point });
        setBundle((current) => current?.map.id === activeMapId ? { ...current, nodes: [...current.nodes, response.node] } : current);
        setJustAddedNodeId(response.node.id);
        setSelectedNodeId(response.node.id);
        window.setTimeout(() => setJustAddedNodeId((current) => (current === response.node.id ? null : current)), 1400);
      } catch (createError) {
        notify?.("error", createError.message);
      } finally {
        setAddingAsset(false);
      }
    },
    [token, activeMapId, notify, canManageMap, addingAsset]
  );

  const handleNodeDrag = useCallback((nodeId, x, y) => {
    setDirtyPositions((current) => {
      const next = new Map(current);
      next.set(nodeId, { x, y });
      return next;
    });
  }, []);

  const handleNodeDragEnd = useCallback(() => {}, []);

  const handleSaveLayout = useCallback(async () => {
    if (!dirtyPositions.size || !activeMapId) return;
    setSaving(true);
    try {
      const positions = [...dirtyPositions.entries()].map(([nodeId, point]) => ({ nodeId, ...point }));
      const response = await saveNetworkTopologyNodePositions(token, activeMapId, positions);
      setBundle((current) => ({
        ...current,
        nodes: current.nodes.map((node) => response.nodes.find((updated) => updated.id === node.id) || node)
      }));
      setDirtyPositions(new Map());
      notify?.("success", "Layout do mapa de rede salvo.");
    } catch (saveError) {
      notify?.("error", saveError.message);
    } finally {
      setSaving(false);
    }
  }, [dirtyPositions, activeMapId, token, notify]);

  const handleResetLayout = useCallback(() => {
    setDirtyPositions(new Map());
  }, []);

  const handleGenerateAutoLayout = useCallback(async () => {
    if (!activeMapId || !bundle) return;
    setGeneratingLayout(true);
    try {
      const hints = bundle.nodes.map((node) => ({
        assetId: node.assetId,
        assetType: resolveAssetType(devicesById.get(node.assetId))
      }));
      const response = await generateNetworkTopologyAutoLayout(token, activeMapId, hints);
      setBundle((current) => ({
        ...current,
        nodes: current.nodes.map((node) => response.nodes.find((updated) => updated.id === node.id) || node)
      }));
      setDirtyPositions(new Map());
      notify?.("success", "Layout automático gerado.");
      requestAnimationFrame(() => canvasRef.current?.fitToNodes());
    } catch (layoutError) {
      notify?.("error", layoutError.message);
    } finally {
      setGeneratingLayout(false);
    }
  }, [activeMapId, bundle, devicesById, token, notify]);

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
    [token, notify]
  );

  const handleTogglePinned = useCallback(
    async (node) => {
      try {
        const response = await updateNetworkTopologyNode(token, node.id, { pinned: !node.pinned });
        setBundle((current) => ({
          ...current,
          nodes: current.nodes.map((entry) => (entry.id === node.id ? response.node : entry))
        }));
      } catch (updateError) {
        notify?.("error", updateError.message);
      }
    },
    [token, notify]
  );

  const handleCreateLink = useCallback(
    async (sourceNode, targetNode) => {
      try {
        const response = await createNetworkTopologyLink(token, activeMapId, {
          sourceAssetId: sourceNode.assetId ?? sourceNode.refId,
          targetAssetId: targetNode.assetId ?? targetNode.refId,
          sourceType: sourceNode.nodeType || "asset",
          targetType: targetNode.nodeType || "asset"
        });
        setBundle((current) => ({ ...current, links: [...current.links, response.link] }));
        setJustCreatedLinkId(response.link.id);
        window.setTimeout(() => setJustCreatedLinkId((current) => (current === response.link.id ? null : current)), 800);
      } catch (createError) {
        notify?.("error", createError.message);
      }
    },
    [token, activeMapId, notify]
  );

  const handleNodeActivate = useCallback(
    (nodeId) => {
      if (linkDraftActive) {
        if (!linkDraftSourceNodeId) {
          setLinkDraftSourceNodeId(nodeId);
          return;
        }
        if (linkDraftSourceNodeId === nodeId) return;
        const sourceNode = bundle?.nodes.find((node) => node.id === linkDraftSourceNodeId);
        const targetNode = bundle?.nodes.find((node) => node.id === nodeId);
        if (sourceNode && targetNode) {
          handleCreateLink(sourceNode, targetNode);
        }
        setLinkDraftActive(false);
        setLinkDraftSourceNodeId(null);
        return;
      }

      setSelectedNodeId(nodeId);
      setSelectedLinkId(null);
    },
    [linkDraftActive, linkDraftSourceNodeId, bundle, handleCreateLink]
  );

  // Duplo-clique (ou "Abrir mapa" no inspector) num no-cluster leva pro
  // canvas de dentro dele - mesma navegacao ja usada pela sidebar/breadcrumb.
  const handleNodeOpen = useCallback(
    (node) => {
      if (node.nodeType === "group") {
        goToGroupLevel(node.refId);
      } else if (node.nodeType === "segment") {
        goToSegmentLevel(node.refId, clusterSummaryByRefId.get(node.refId)?.groupId || null);
      }
    },
    [goToGroupLevel, goToSegmentLevel, clusterSummaryByRefId]
  );

  const handleToggleLinkDraft = useCallback(() => {
    if (!canLinkAssets || !editMode || isInventoryPreview) return;
    setLinkDraftActive((current) => !current);
    setLinkDraftSourceNodeId(null);
  }, [canLinkAssets, editMode, isInventoryPreview]);

  const handleCanvasBackgroundClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    setLinkDraftActive(false);
    setLinkDraftSourceNodeId(null);
  }, []);

  const handleSaveLink = useCallback(
    async (payload) => {
      if (!selectedLinkId) return;
      try {
        const link = bundle.links.find((entry) => entry.id === selectedLinkId);
        const response = await updateNetworkTopologyLink(token, selectedLinkId, {
          sourceAssetId: link.sourceAssetId,
          targetAssetId: link.targetAssetId,
          ...payload
        });
        setBundle((current) => ({
          ...current,
          links: current.links.map((entry) => (entry.id === selectedLinkId ? response.link : entry))
        }));
        notify?.("success", "Conexão atualizada.");
      } catch (updateError) {
        notify?.("error", updateError.message);
      }
    },
    [selectedLinkId, bundle, token, notify]
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
  }, [selectedLinkId, token, notify]);

  if (!canView) {
    return <PermissionBlocked />;
  }

  const selectedNode = selectedNodeId ? visibleNodes.find((node) => node.id === selectedNodeId) : null;
  const selectedLink = selectedLinkId ? visibleLinks.find((link) => link.id === selectedLinkId) : null;

  function renderCanvasLevel() {
    // A failed first load has no bundle; report it before the loading guard.
    if (error) {
      return (
        <div className="network-topology-empty-state" role="alert">
          <h3>Não foi possível carregar o mapa de rede</h3>
          <p>{error}</p>
        </div>
      );
    }

    if (viewLevel === "global-legado" && maps === null) {
      return <ViewLoadingState />;
    }
    if (viewLevel === "global-legado" && !legacyActiveMapId) {
      return (
        <div className="network-topology-empty-state">
          <h3>Nenhum mapa de rede criado</h3>
          <p>
            Gere uma topologia inicial a partir dos ativos do inventário ou crie um mapa manual para começar a
            desenhar as conexões da sua rede.
          </p>
          {canManageMap ? (
            <button type="button" className="network-topology-toolbar-button" disabled={creatingMap} onClick={handleCreateMap}>
              {creatingMap ? "Criando..." : "Criar mapa"}
            </button>
          ) : null}
        </div>
      );
    }

    if (loadingBundle || !bundle) {
      return <ViewLoadingState />;
    }

    const isClusterLevel = viewLevel === "tab" || viewLevel === "group";
    // sourceAssetId/targetAssetId carregam o valor generico (asset id OU
    // segment/group id) independente do tipo - ver decisao de nao renomear
    // essas colunas em networkTopologyRepository.js.
    const resolveLinkEntity = (type, refValue) => {
      if (type && type !== "asset") return clusterSummaryByRefId.get(refValue) ?? null;
      return devicesById.get(refValue) ?? null;
    };

    return (
      <>
        <NetworkTopologyToolbar
          editMode={editMode && canManageMap}
          onToggleEditMode={() => {
            setEditMode((current) => !current);
            setLinkDraftActive(false);
            setLinkDraftSourceNodeId(null);
          }}
          onCenterView={() => canvasRef.current?.centerView()}
          onFitView={() => canvasRef.current?.fitToNodes()}
          onSaveLayout={handleSaveLayout}
          hasDirtyPositions={dirtyPositions.size > 0}
          saving={saving}
          onResetLayout={handleResetLayout}
          onGenerateAutoLayout={handleGenerateAutoLayout}
          generatingLayout={generatingLayout}
          linkDraftActive={linkDraftActive && canLinkAssets}
          onToggleLinkDraft={handleToggleLinkDraft}
          availableDevicesToAdd={availableDevicesToAdd}
          onAddAsset={handleAddAsset}
          availableClustersToAdd={availableClustersToAdd}
          onAddCluster={handleAddCluster}
          addingAsset={addingAsset}
          nodeCount={visibleNodes.length}
          linkCount={visibleLinks.length}
          filters={filters}
          onFiltersChange={setFilters}
          segments={segments}
          assetTypeOptions={assetTypeOptions}
          canManage={canManageMap}
          lockSegmentFilter={viewLevel === "segment"}
          isClusterLevel={isClusterLevel}
          isInventoryPreview={isInventoryPreview}
        />
        {isInventoryPreview ? (
          <div className="network-topology-inventory-preview" role="status">
            <Info size={16} aria-hidden="true" />
            <p>
              <strong>Prévia do inventário · não salva.</strong>{" "}
              {isClusterLevel ? "Selecione um grupo ou segmento para abrir seu mapa." : "Estes são os ativos reais deste segmento."}{" "}
              {canManageMap ? (editMode
                ? "Selecione um item e use Adicionar ao mapa para salvar sua posição."
                : "Edite o mapa para salvar posições e adicionar conexões manualmente.") : "Nenhuma conexão é presumida nesta prévia."}
            </p>
          </div>
        ) : null}
        <div className={`network-topology-body ${selectedNode || selectedLink ? "has-inspector" : ""}`}>
          {!displayNodes.length && viewLevel !== "global-legado" ? (
            <NetworkTopologyLevelEmptyState variant={viewLevel === "segment" ? "segment-sem-ativos" : viewLevel === "group" ? "group-sem-segmentos" : "tab-sem-grupos"} />
          ) : (
            <NetworkTopologyCanvas
              key={bundle.map.id}
              ref={canvasRef}
              nodes={visibleNodes}
              links={visibleLinks}
              devicesById={devicesById}
              segmentNameById={new Map(segments.map((segment) => [segment.id, segment.name]))}
              clusterSummaryByRefId={clusterSummaryByRefId}
              editMode={editMode && canManageMap && !isInventoryPreview}
              selectedNodeId={selectedNodeId}
              selectedLinkId={selectedLinkId}
              linkDraftSourceNodeId={linkDraftSourceNodeId}
              justAddedNodeId={justAddedNodeId}
              justCreatedLinkId={justCreatedLinkId}
              onNodeActivate={handleNodeActivate}
              onNodeDrag={handleNodeDrag}
              onNodeDragEnd={handleNodeDragEnd}
              onNodeOpen={handleNodeOpen}
              onSelectLink={(linkId) => {
                setSelectedLinkId(linkId);
                setSelectedNodeId(null);
              }}
              onCanvasBackgroundClick={handleCanvasBackgroundClick}
            />
          )}
          {selectedNode ? (
            <NetworkTopologyNodeInspector
              node={selectedNode}
              device={devicesById.get(selectedNode.assetId)}
              clusterInfo={clusterSummaryByRefId.get(selectedNode.refId) ?? null}
              editMode={editMode && canManageMap && !selectedNode.preview}
              addingToMap={addingAsset}
              onAddToMap={selectedNode.preview && canManageMap && editMode ? () => {
                const position = { x: selectedNode.x, y: selectedNode.y };
                if (selectedNode.nodeType === "asset") handleAddAsset(selectedNode.assetId, position);
                else handleAddCluster(selectedNode.nodeType, selectedNode.refId, position);
              } : undefined}
              onOpenDetails={onOpenDetails}
              onOpenCluster={handleNodeOpen}
              onTogglePinned={() => handleTogglePinned(selectedNode)}
              onRemoveNode={() => handleRemoveNode(selectedNode.id)}
              onClose={() => setSelectedNodeId(null)}
            />
          ) : null}
          {selectedLink ? (
            <NetworkTopologyLinkInspector
              link={selectedLink}
              sourceEntity={resolveLinkEntity(selectedLink.sourceType, selectedLink.sourceAssetId)}
              targetEntity={resolveLinkEntity(selectedLink.targetType, selectedLink.targetAssetId)}
              editMode={editMode && canLinkAssets}
              onSave={handleSaveLink}
              onRemove={handleRemoveLink}
              onClose={() => setSelectedLinkId(null)}
            />
          ) : null}
        </div>
      </>
    );
  }

  return (
    <div className="network-topology-view">
      <div className="network-topology-hierarchy-header">
        <NetworkTopologyBreadcrumb crumbs={crumbs} />
        {viewLevel !== "global-legado" ? (
          <button type="button" className="network-topology-legacy-link" onClick={goToGlobalLegacy}>
            Visão global (legado)
          </button>
        ) : null}
      </div>
      <div className="network-topology-hierarchy-layout">
        <NetworkTopologyNavigation>
          <NetworkTopologyHierarchySidebar
            tabs={tabs}
            activeTabId={activeTab?.id}
            onSelectTab={(tabId) => {
              onSelectTab?.(tabId);
              goToTabLevel();
            }}
            tree={tree}
            selectedGroupId={selectedGroupId}
            selectedSegmentId={selectedSegmentId}
            onSelectGroup={goToGroupLevel}
            onSelectSegment={goToSegmentLevel}
          />
        </NetworkTopologyNavigation>
        <div className="network-topology-hierarchy-main">{renderCanvasLevel()}</div>
      </div>
    </div>
  );
}
