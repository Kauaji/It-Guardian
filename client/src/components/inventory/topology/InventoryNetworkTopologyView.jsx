import { useCallback, useRef } from "react";
import { useAppSession } from "../../../context/AppSessionContext.jsx";
import PermissionBlocked from "../../ui/PermissionBlocked.jsx";
import useTopologyLayout from "./useTopologyLayout.js";
import useTopologyLinkCreation from "./useTopologyLinkCreation.js";
import TopologyCanvasLevel from "./view/TopologyCanvasLevel.jsx";
import TopologyHierarchyShell from "./view/TopologyHierarchyShell.jsx";
import useTopologyFilters from "./view/useTopologyFilters.js";
import useTopologyHierarchy from "./view/useTopologyHierarchy.js";
import useTopologyInspection from "./view/useTopologyInspection.js";
import useTopologyInteractions from "./view/useTopologyInteractions.js";
import useTopologyMapData from "./view/useTopologyMapData.js";
import useTopologyMutations from "./view/useTopologyMutations.js";
import useTopologyNavigation from "./view/useTopologyNavigation.js";
import useTopologySelectionState from "./view/useTopologySelectionState.js";
import { useTopologyDisplayNodes, useTopologyVisibility } from "./view/useTopologyNodes.js";
import { buildTopologyViewContext } from "./view/topologyViewContext.js";
import "./networkTopologyInteraction.css";

/**
 * Roteador de nivel da hierarquia (Aba -> Grupo -> Segmento) do Mapa de
 * Rede. O inventário define os itens presentes; o mapa preserva suas
 * posições, rótulos e conexões sem exigir uma inclusão manual.
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
  const canEditMap = canManageMap || canLinkAssets;
  const canvasRef = useRef(null);

  const selection = useTopologySelectionState();
  const { tree } = useTopologyHierarchy({ groups, segments, devices, activeTab });
  const nav = useTopologyNavigation({ activeTab, tree });
  const mapData = useTopologyMapData({ token, canView, canEditMap, activeTab, nav, selection });
  const { filters, setFilters, filterPredicate, hasActiveFilter } = useTopologyFilters({
    viewLevel: nav.viewLevel,
    selectedSegmentId: nav.selectedSegmentId
  });
  const { bundle, setBundle, scopeKey } = mapData;
  const { devicesById, displayNodes } = useTopologyDisplayNodes({
    bundle,
    viewLevel: nav.viewLevel,
    tree,
    selectedGroupId: nav.selectedGroupId,
    selectedSegmentId: nav.selectedSegmentId,
    segments,
    devices
  });

  const handleMaterializedNode = useCallback(
    (savedNode, originalNode) => {
      selection.setSelectedNodeId((current) => (current === originalNode.id ? savedNode.id : current));
    },
    [selection.setSelectedNodeId]
  );
  const handleAutoLayout = useCallback(() => {
    requestAnimationFrame(() => canvasRef.current?.fitToNodes());
  }, []);
  const layout = useTopologyLayout({
    token,
    mapId: bundle?.map.id,
    scopeKey,
    nodes: displayNodes,
    devicesById,
    enabled: canManageMap,
    setBundle,
    onMaterialized: handleMaterializedNode,
    onAutoLayout: handleAutoLayout,
    notify
  });
  const { dirtyPositions, saving, generatingLayout } = layout;
  const layoutBusy = saving || generatingLayout;

  const visibility = useTopologyVisibility({
    bundle,
    viewLevel: nav.viewLevel,
    tree,
    devices,
    devicesById,
    displayNodes,
    filterPredicate,
    hasActiveFilter,
    dirtyPositions
  });
  const { visibleNodes, visibleLinks, clusterSummaryByRefId } = visibility;

  const inspection = useTopologyInspection({
    token,
    scopeKey,
    canView,
    bundle,
    selection,
    visibleNodes,
    visibleLinks,
    devicesById,
    clusterSummaryByRefId
  });

  const mutations = useTopologyMutations({ token, notify, canManageMap, mapData, selection });
  const linkCreation = useTopologyLinkCreation({
    token,
    mapId: bundle?.map.id,
    scopeKey,
    enabled: canLinkAssets && !layoutBusy,
    nodes: visibleNodes,
    links: bundle?.links || [],
    onCreated: mutations.handleLinkCreated,
    notify
  });
  const interactions = useTopologyInteractions({
    nav,
    selection,
    linkCreation,
    visibleNodes,
    clusterSummaryByRefId,
    canEditMap,
    linkDraftActive: linkCreation.active,
    creatingLink: linkCreation.busy
  });

  if (!canView) {
    return <PermissionBlocked />;
  }

  const ctx = buildTopologyViewContext({
    mapData,
    visibility,
    mutations,
    interactions,
    nav,
    selection,
    layout,
    linkCreation,
    canvasRef,
    devicesById,
    displayNodes,
    segments,
    filters,
    setFilters,
    canManageMap,
    canLinkAssets,
    canEditMap,
    onOpenDetails
  });

  return (
    <TopologyHierarchyShell nav={nav} tabs={tabs} activeTab={activeTab} onSelectTab={onSelectTab} tree={tree}>
      <TopologyCanvasLevel ctx={ctx} view={{ inspector: inspection }} />
    </TopologyHierarchyShell>
  );
}
