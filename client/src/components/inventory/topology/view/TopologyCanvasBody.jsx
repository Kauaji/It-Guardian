import NetworkTopologyCanvas from "../NetworkTopologyCanvas.jsx";
import { NetworkTopologyLinkInspector, NetworkTopologyNodeInspector } from "../NetworkTopologyInspector.jsx";
import NetworkTopologyLevelEmptyState from "../NetworkTopologyLevelEmptyState.jsx";
import { clusterDevices, hasTopologyConnectionPartner } from "../networkTopologyConnections.js";
import { emptyStateVariant } from "./topologyViewConstants.js";

function NodeInspector({ view, ctx }) {
  const { selectedNode, selectedClusterInfo, selectedConnections, internalConnections } = view.inspector;
  const { devicesById, clusterSummaryByRefId, canEditMap, canLinkAssets, canManageMap, editMode, layoutBusy, linkBusy, linkCreation, visibleNodes, layout, selection } = ctx;
  const { setSelectedNodeId, setSelectedLinkId } = selection;
  return (
    <NetworkTopologyNodeInspector
      node={selectedNode}
      device={devicesById.get(selectedNode.assetId)}
      clusterInfo={clusterSummaryByRefId.get(selectedNode.refId) ?? null}
      clusterDevices={clusterDevices(selectedClusterInfo, selectedNode.nodeType)}
      connections={selectedConnections}
      connectionsLoading={internalConnections.loading}
      connectionsError={internalConnections.error}
      canEditCluster={canEditMap}
      connecting={linkBusy}
      onConnectNode={editMode && canLinkAssets && !layoutBusy && hasTopologyConnectionPartner(visibleNodes, selectedNode) ? (node) => {
        setSelectedNodeId(null);
        setSelectedLinkId(null);
        linkCreation.start(node);
      } : undefined}
      editMode={editMode && canManageMap && !layoutBusy}
      onOpenDetails={ctx.onOpenDetails}
      onOpenCluster={ctx.handleNodeOpen}
      onTogglePinned={() => layout.togglePinned(selectedNode)}
      onRemoveNode={ctx.viewLevel === "global-legado" ? () => ctx.handleRemoveNode(selectedNode.id) : undefined}
      onClose={() => setSelectedNodeId(null)}
    />
  );
}

function LinkInspector({ selectedLink, ctx }) {
  const { clusterSummaryByRefId, devicesById, editMode, canLinkAssets, selection } = ctx;
  // sourceAssetId/targetAssetId carregam o valor generico (asset id OU
  // segment/group id) independente do tipo - ver decisao de nao renomear
  // essas colunas em networkTopologyRepository.js.
  const resolveLinkEntity = (type, refValue) => {
    if (type && type !== "asset") return clusterSummaryByRefId.get(refValue) ?? null;
    return devicesById.get(refValue) ?? null;
  };
  return (
    <NetworkTopologyLinkInspector
      link={selectedLink}
      sourceEntity={resolveLinkEntity(selectedLink.sourceType, selectedLink.sourceAssetId)}
      targetEntity={resolveLinkEntity(selectedLink.targetType, selectedLink.targetAssetId)}
      editMode={editMode && canLinkAssets}
      onSave={ctx.handleSaveLink}
      onRemove={ctx.handleRemoveLink}
      onClose={() => selection.setSelectedLinkId(null)}
    />
  );
}

// Corpo do mapa: canvas e inspetores de no/conexao.
export default function TopologyCanvasBody({ ctx, view }) {
  const {
    bundle, viewLevel, devicesById, segments, clusterSummaryByRefId, editMode, canManageMap, layoutBusy, selection, linkCreation,
    linkBusy, layout, displayNodes, visibleNodes, visibleLinks, canvasRef, nav
  } = ctx;
  const { selectedNode, selectedLink } = view.inspector;
  return (
    <div
      className={`network-topology-body ${selectedNode || selectedLink ? "has-inspector" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && linkCreation.active && !linkCreation.busy && !event.defaultPrevented) {
          event.preventDefault();
          linkCreation.reset();
        }
      }}
    >
      <NetworkTopologyCanvas
        key={bundle.map.id}
        ref={canvasRef}
        nodes={visibleNodes}
        links={visibleLinks}
        devicesById={devicesById}
        segmentNameById={new Map(segments.map((segment) => [segment.id, segment.name]))}
        clusterSummaryByRefId={clusterSummaryByRefId}
        editMode={editMode && canManageMap && !layoutBusy}
        selectedNodeId={selection.selectedNodeId}
        selectedLinkId={selection.selectedLinkId}
        linkDraftSourceNodeId={linkCreation.sourceNodeId}
        linkDraftActive={linkBusy}
        justAddedNodeId={selection.justAddedNodeId}
        justCreatedLinkId={selection.justCreatedLinkId}
        onNodeActivate={ctx.handleNodeActivate}
        onNodeDrag={layout.onNodeDrag}
        onNodeOpen={ctx.handleNodeOpen}
        onNavigateBack={nav.onNavigateBack}
        backLabel={nav.backLabel}
        emptyState={!displayNodes.length && viewLevel !== "global-legado" ? (
          <NetworkTopologyLevelEmptyState variant={emptyStateVariant(viewLevel)} />
        ) : null}
        onSelectLink={(linkId) => {
          selection.setSelectedLinkId(linkId);
          selection.setSelectedNodeId(null);
        }}
        onCanvasBackgroundClick={ctx.handleCanvasBackgroundClick}
      />
      {selectedNode ? <NodeInspector view={view} ctx={ctx} /> : null}
      {selectedLink ? <LinkInspector selectedLink={selectedLink} ctx={ctx} /> : null}
    </div>
  );
}
