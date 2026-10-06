import { useCallback, useRef } from "react";
import { useAppSession } from "../../../context/AppSessionContext.jsx";
import PermissionBlocked from "../../ui/PermissionBlocked.jsx";
import NetworkTopologyBreadcrumb from "./NetworkTopologyBreadcrumb.jsx";
import NetworkTopologyHierarchySidebar from "./NetworkTopologyHierarchySidebar.jsx";
import NetworkTopologyNavigation from "./NetworkTopologyNavigation.jsx";
import { inspectorConnections } from "./networkTopologyConnections.js";
import useTopologyInspectorConnections from "./useTopologyInspectorConnections.js";
import useTopologyLayout from "./useTopologyLayout.js";
import useTopologyLinkCreation from "./useTopologyLinkCreation.js";
import TopologyCanvasLevel from "./view/TopologyCanvasLevel.jsx";
import useTopologyFilters from "./view/useTopologyFilters.js";
import useTopologyHierarchy from "./view/useTopologyHierarchy.js";
import useTopologyInteractions from "./view/useTopologyInteractions.js";
import useTopologyMapData from "./view/useTopologyMapData.js";
import useTopologyMutations from "./view/useTopologyMutations.js";
import useTopologyNavigation from "./view/useTopologyNavigation.js";
import useTopologySelectionState from "./view/useTopologySelectionState.js";
import { useTopologyDisplayNodes, useTopologyVisibility } from "./view/useTopologyNodes.js";
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
    viewLevel: nav.viewLevel, selectedSegmentId: nav.selectedSegmentId
  });
  const { bundle, setBundle, scopeKey } = mapData;
  const { devicesById, displayNodes } = useTopologyDisplayNodes({
    bundle, viewLevel: nav.viewLevel, tree, selectedGroupId: nav.selectedGroupId, selectedSegmentId: nav.selectedSegmentId, segments, devices
  });

  const handleMaterializedNode = useCallback((savedNode, originalNode) => {
    selection.setSelectedNodeId((current) => current === originalNode.id ? savedNode.id : current);
  }, [selection.setSelectedNodeId]);
  const handleAutoLayout = useCallback(() => {
    requestAnimationFrame(() => canvasRef.current?.fitToNodes());
  }, []);
  const layout = useTopologyLayout({
    token, mapId: bundle?.map.id, scopeKey, nodes: displayNodes, devicesById,
    enabled: canManageMap, setBundle, onMaterialized: handleMaterializedNode,
    onAutoLayout: handleAutoLayout, notify
  });
  const { dirtyPositions, saving, generatingLayout } = layout;
  const layoutBusy = saving || generatingLayout;

  const visibility = useTopologyVisibility({
    bundle, viewLevel: nav.viewLevel, tree, devices, devicesById, displayNodes, filterPredicate, hasActiveFilter, dirtyPositions
  });
  const { visibleNodes, visibleLinks, clusterSummaryByRefId } = visibility;

  const selectedNode = selection.selectedNodeId ? visibleNodes.find((node) => node.id === selection.selectedNodeId) : null;
  const selectedLink = selection.selectedLinkId ? visibleLinks.find((link) => link.id === selection.selectedLinkId) : null;
  const selectedClusterInfo = clusterSummaryByRefId.get(selectedNode?.refId) || null;
  const internalConnections = useTopologyInspectorConnections({
    token, node: selectedNode, scopeKey, enabled: canView && Boolean(selectedClusterInfo)
  });
  const selectedConnections = inspectorConnections({
    node: selectedNode, links: bundle?.links, internalLinks: internalConnections.links,
    devicesById, clustersById: clusterSummaryByRefId, clusterName: selectedClusterInfo?.name
  });

  const mutations = useTopologyMutations({ token, notify, canManageMap, mapData, selection });
  const linkCreation = useTopologyLinkCreation({
    token, mapId: bundle?.map.id, scopeKey, enabled: canLinkAssets && !layoutBusy,
    nodes: visibleNodes, links: bundle?.links || [], onCreated: mutations.handleLinkCreated, notify
  });
  const linkBusy = linkCreation.active || linkCreation.busy;
  const interactions = useTopologyInteractions({
    nav, selection, linkCreation, visibleNodes, clusterSummaryByRefId, canEditMap,
    linkDraftActive: linkCreation.active, creatingLink: linkCreation.busy
  });

  if (!canView) {
    return <PermissionBlocked />;
  }

  const ctx = {
    ...mapData, ...visibility, ...mutations, ...interactions, nav, selection, layout, linkCreation, linkBusy, layoutBusy,
    viewLevel: nav.viewLevel, canvasRef, devicesById, displayNodes, segments, filters, setFilters, dirtyPositions, saving, generatingLayout,
    editMode: selection.editMode, canManageMap, canLinkAssets, canEditMap, onOpenDetails
  };
  const view = { inspector: { selectedNode, selectedLink, selectedClusterInfo, selectedConnections, internalConnections } };

  return (
    <div className="network-topology-view">
      <div className="network-topology-hierarchy-header">
        <NetworkTopologyBreadcrumb crumbs={nav.crumbs} />
        {nav.viewLevel !== "global-legado" ? (
          <button type="button" className="network-topology-legacy-link" onClick={nav.goToGlobalLegacy}>
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
              nav.goToTabLevel();
            }}
            tree={tree}
            selectedGroupId={nav.selectedGroupId}
            selectedSegmentId={nav.selectedSegmentId}
            onSelectGroup={nav.goToGroupLevel}
            onSelectSegment={nav.goToSegmentLevel}
          />
        </NetworkTopologyNavigation>
        <div className="network-topology-hierarchy-main"><TopologyCanvasLevel ctx={ctx} view={view} /></div>
      </div>
    </div>
  );
}
