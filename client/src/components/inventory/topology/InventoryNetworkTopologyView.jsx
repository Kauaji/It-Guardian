import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import NetworkTopologyAggregateGrid from "./NetworkTopologyAggregateGrid.jsx";
import NetworkTopologyLevelEmptyState from "./NetworkTopologyLevelEmptyState.jsx";

const DEFAULT_FILTERS = { search: "", status: "", segmentId: "", assetType: "" };

function jitteredCenter() {
  return {
    x: 800 + (Math.random() - 0.5) * 260,
    y: 500 + (Math.random() - 0.5) * 260
  };
}

/**
 * Roteador de nivel da hierarquia (Aba -> Grupo -> Segmento) do Mapa de
 * Rede. So o nivel Segmento (e o modo "Visao Global (legado)", preservado
 * intacto para nao perder mapas ja criados) usa mapa/canvas de verdade -
 * Aba e Grupo sao grades agregadas computadas a partir dos dados reais de
 * segmento/grupo/ativo, sem posicao propria persistida nesta rodada.
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
  const selectedSegmentSummary = useMemo(() => {
    if (!selectedSegmentId) return null;
    return (
      tree.groups.flatMap((group) => group.segments).find((segment) => segment.id === selectedSegmentId) ||
      tree.ungroupedSegments.find((segment) => segment.id === selectedSegmentId) ||
      null
    );
  }, [tree, selectedSegmentId]);

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
      setActiveMapId((current) => current || response.maps[0]?.id || null);
    } catch (fetchError) {
      setError(fetchError.message);
    }
  }, [token, canView]);

  useEffect(() => {
    if (viewLevel === "global-legado" && maps === null) {
      loadMaps();
    }
  }, [viewLevel, maps, loadMaps]);

  // Nivel Segmento: mapa por segmento, criado sob demanda (get-or-create no
  // servidor). Nivel "Visao Global (legado)": mesmo fluxo de sempre, por id
  // escolhido na lista de mapas. Aba/Grupo nao precisam de bundle nenhum.
  useEffect(() => {
    if (viewLevel === "segment") {
      if (!selectedSegmentId) {
        setBundle(null);
        return undefined;
      }
      let cancelled = false;
      setLoadingBundle(true);
      setError("");
      fetchNetworkTopologyMapByScope(token, "segment", selectedSegmentId)
        .then((response) => {
          if (cancelled) return;
          setBundle(response);
          setActiveMapId(response.map.id);
          setDirtyPositions(new Map());
          setSelectedNodeId(null);
          setSelectedLinkId(null);
          setLinkDraftActive(false);
          setLinkDraftSourceNodeId(null);
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
    }

    if (viewLevel === "global-legado") {
      if (!activeMapId) {
        setBundle(null);
        return undefined;
      }
      let cancelled = false;
      setLoadingBundle(true);
      setError("");
      fetchNetworkTopologyMap(token, activeMapId)
        .then((response) => {
          if (cancelled) return;
          setBundle(response);
          setDirtyPositions(new Map());
          setSelectedNodeId(null);
          setSelectedLinkId(null);
          setLinkDraftActive(false);
          setLinkDraftSourceNodeId(null);
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
    }

    setBundle(null);
    return undefined;
  }, [viewLevel, selectedSegmentId, activeMapId, token]);

  // No nivel Segmento o filtro de segmento fica implicito (o mapa ja e so
  // daquele segmento) - a Toolbar recebe lockSegmentFilter pra so esconder
  // o controle, reaproveitando o mesmo filters.segmentId/buildFilterPredicate.
  useEffect(() => {
    if (viewLevel === "segment" && selectedSegmentId) {
      setFilters((current) => (current.segmentId === selectedSegmentId ? current : { ...current, segmentId: selectedSegmentId }));
    }
  }, [viewLevel, selectedSegmentId]);

  const devicesById = useMemo(() => new Map(devices.map((device) => [device.id, device])), [devices]);
  const filterPredicate = useMemo(() => buildFilterPredicate(filters), [filters]);
  const hasActiveFilter = Boolean(filters.search || filters.status || filters.segmentId || filters.assetType);

  const visibleNodes = useMemo(() => {
    if (!bundle) return [];
    return bundle.nodes
      .filter((node) => {
        const device = devicesById.get(node.assetId);
        if (!device) return !hasActiveFilter;
        return filterPredicate(device);
      })
      .map((node) => {
        const dirty = dirtyPositions.get(node.id);
        return dirty ? { ...node, x: dirty.x, y: dirty.y } : node;
      });
  }, [bundle, devicesById, filterPredicate, hasActiveFilter, dirtyPositions]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const visibleLinks = useMemo(() => {
    if (!bundle) return [];
    const nodeIdByAssetId = new Map(bundle.nodes.map((node) => [node.assetId, node.id]));
    return bundle.links.filter((link) => {
      const sourceNodeId = nodeIdByAssetId.get(link.sourceAssetId);
      const targetNodeId = nodeIdByAssetId.get(link.targetAssetId);
      return visibleNodeIds.has(sourceNodeId) && visibleNodeIds.has(targetNodeId);
    });
  }, [bundle, visibleNodeIds]);

  const availableDevicesToAdd = useMemo(() => {
    if (!bundle) return [];
    const usedAssetIds = new Set(bundle.nodes.map((node) => node.assetId));
    return devices.filter((device) => !usedAssetIds.has(device.id) && filterPredicate(device));
  }, [bundle, devices, filterPredicate]);

  const handleCreateMap = useCallback(async () => {
    setCreatingMap(true);
    try {
      const response = await createNetworkTopologyMap(token, { name: "Mapa de Rede" });
      setMaps((current) => [response.map, ...(current || [])]);
      setActiveMapId(response.map.id);
    } catch (createError) {
      notify?.("error", createError.message);
    } finally {
      setCreatingMap(false);
    }
  }, [token, notify]);

  const handleAddAsset = useCallback(
    async (assetId) => {
      if (!assetId || !activeMapId) return;
      setAddingAsset(true);
      try {
        const point = jitteredCenter();
        const response = await createNetworkTopologyNode(token, activeMapId, { assetId, ...point });
        setBundle((current) => ({ ...current, nodes: [...current.nodes, response.node] }));
        setJustAddedNodeId(response.node.id);
        window.setTimeout(() => setJustAddedNodeId((current) => (current === response.node.id ? null : current)), 1400);
      } catch (createError) {
        notify?.("error", createError.message);
      } finally {
        setAddingAsset(false);
      }
    },
    [token, activeMapId, notify]
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
    async (sourceAssetId, targetAssetId) => {
      try {
        const response = await createNetworkTopologyLink(token, activeMapId, { sourceAssetId, targetAssetId });
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
          handleCreateLink(sourceNode.assetId, targetNode.assetId);
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

  const handleToggleLinkDraft = useCallback(() => {
    setLinkDraftActive((current) => !current);
    setLinkDraftSourceNodeId(null);
  }, []);

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

  function renderTabLevel() {
    if (!tree.groups.length && !tree.ungroupedSegments.length) {
      return <NetworkTopologyLevelEmptyState variant="tab-sem-grupos" />;
    }
    return (
      <>
        {tree.groups.length ? (
          <NetworkTopologyAggregateGrid items={tree.groups} itemKind="group" onSelectItem={(group) => goToGroupLevel(group.id)} />
        ) : null}
        {tree.ungroupedSegments.length ? (
          <>
            <h4 className="network-topology-aggregate-section-title">Sem grupo</h4>
            <NetworkTopologyAggregateGrid
              items={tree.ungroupedSegments}
              itemKind="segment"
              onSelectItem={(segment) => goToSegmentLevel(segment.id, null)}
            />
          </>
        ) : null}
      </>
    );
  }

  function renderGroupLevel() {
    if (!selectedGroup) return <NetworkTopologyLevelEmptyState variant="group-sem-segmentos" />;
    if (!selectedGroup.segments.length) return <NetworkTopologyLevelEmptyState variant="group-sem-segmentos" />;
    return (
      <NetworkTopologyAggregateGrid
        items={selectedGroup.segments}
        itemKind="segment"
        onSelectItem={(segment) => goToSegmentLevel(segment.id, selectedGroup.id)}
      />
    );
  }

  function renderCanvasLevel() {
    if (viewLevel === "global-legado" && maps === null) {
      return <ViewLoadingState />;
    }
    if (viewLevel === "global-legado" && !activeMapId) {
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

    if (error) {
      return (
        <div className="network-topology-empty-state">
          <h3>Não foi possível carregar o mapa de rede</h3>
          <p>{error}</p>
        </div>
      );
    }

    if (viewLevel === "segment" && !bundle.nodes.length && !editMode) {
      return <NetworkTopologyLevelEmptyState variant="segment-sem-ativos" />;
    }

    return (
      <>
        <NetworkTopologyToolbar
          editMode={editMode && canManageMap}
          onToggleEditMode={() => setEditMode((current) => !current)}
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
          addingAsset={addingAsset}
          nodeCount={visibleNodes.length}
          linkCount={visibleLinks.length}
          filters={filters}
          onFiltersChange={setFilters}
          segments={segments}
          assetTypeOptions={assetTypeOptions}
          canManage={canManageMap}
          lockSegmentFilter={viewLevel === "segment"}
        />
        <div className={`network-topology-body ${selectedNode || selectedLink ? "has-inspector" : ""}`}>
          <NetworkTopologyCanvas
            ref={canvasRef}
            nodes={visibleNodes}
            links={visibleLinks}
            devicesById={devicesById}
            segmentNameById={new Map(segments.map((segment) => [segment.id, segment.name]))}
            editMode={editMode && canManageMap}
            selectedNodeId={selectedNodeId}
            selectedLinkId={selectedLinkId}
            linkDraftSourceNodeId={linkDraftSourceNodeId}
            justAddedNodeId={justAddedNodeId}
            justCreatedLinkId={justCreatedLinkId}
            onNodeActivate={handleNodeActivate}
            onNodeDrag={handleNodeDrag}
            onNodeDragEnd={handleNodeDragEnd}
            onSelectLink={(linkId) => {
              setSelectedLinkId(linkId);
              setSelectedNodeId(null);
            }}
            onCanvasBackgroundClick={handleCanvasBackgroundClick}
          />
          {selectedNode ? (
            <NetworkTopologyNodeInspector
              node={selectedNode}
              device={devicesById.get(selectedNode.assetId)}
              editMode={editMode && canManageMap}
              onOpenDetails={onOpenDetails}
              onTogglePinned={() => handleTogglePinned(selectedNode)}
              onRemoveNode={() => handleRemoveNode(selectedNode.id)}
              onClose={() => setSelectedNodeId(null)}
            />
          ) : null}
          {selectedLink ? (
            <NetworkTopologyLinkInspector
              link={selectedLink}
              sourceDevice={devicesById.get(selectedLink.sourceAssetId)}
              targetDevice={devicesById.get(selectedLink.targetAssetId)}
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
        <div className="network-topology-hierarchy-main">
          {viewLevel === "tab" ? renderTabLevel() : null}
          {viewLevel === "group" ? renderGroupLevel() : null}
          {viewLevel === "segment" || viewLevel === "global-legado" ? renderCanvasLevel() : null}
        </div>
      </div>
    </div>
  );
}
