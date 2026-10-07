import { assetTypeOptions } from "../../assetTypes.js";
import NetworkTopologyToolbar from "../NetworkTopologyToolbar.jsx";
import TopologyCanvasBody from "./TopologyCanvasBody.jsx";
import TopologyConnectionGuide from "./TopologyConnectionGuide.jsx";
import topologyLevelStatus from "./topologyLevelStatus.jsx";
import { CONNECTION_ITEM_LABELS_BY_TYPE } from "./topologyViewConstants.js";

function TopologyToolbarSection({ ctx }) {
  const {
    editMode,
    canEditMap,
    canManageMap,
    canLinkAssets,
    canStartLink,
    viewLevel,
    canvasRef,
    layout,
    dirtyPositions,
    saving,
    generatingLayout,
    linkCreation,
    availableDevicesToAdd,
    addingAsset,
    visibleNodes,
    visibleLinks,
    filters,
    setFilters,
    segments,
    connectionItemLabels,
    handleAddAsset,
    handleToggleLinkDraft,
    selection
  } = ctx;
  return (
    <NetworkTopologyToolbar
      editMode={editMode && canEditMap}
      onToggleEditMode={() => {
        selection.setEditMode((current) => !current);
        linkCreation.reset();
      }}
      onCenterView={() => canvasRef.current?.centerView()}
      onSaveLayout={layout.saveLayout}
      hasDirtyPositions={dirtyPositions.size > 0}
      saving={saving}
      onResetLayout={layout.resetLayout}
      onGenerateAutoLayout={layout.generateAutoLayout}
      generatingLayout={generatingLayout}
      linkDraftActive={linkCreation.active && canLinkAssets}
      linkDraftSourceNodeId={linkCreation.sourceNodeId}
      creatingLink={linkCreation.busy}
      onToggleLinkDraft={handleToggleLinkDraft}
      availableDevicesToAdd={availableDevicesToAdd}
      onAddAsset={handleAddAsset}
      showManualAdd={viewLevel === "global-legado"}
      addingAsset={addingAsset}
      nodeCount={visibleNodes.length}
      linkCount={visibleLinks.length}
      filters={filters}
      onFiltersChange={setFilters}
      segments={segments}
      assetTypeOptions={assetTypeOptions}
      canManage={canManageMap}
      canLink={canLinkAssets}
      canStartLink={canStartLink}
      linkItemLabel={connectionItemLabels.plural}
      lockSegmentFilter={viewLevel === "segment"}
      isClusterLevel={viewLevel === "tab" || viewLevel === "group"}
    />
  );
}

// Conteudo do nivel atual: estado (erro/carregando/vazio) ou barra de ferramentas + canvas.
export default function TopologyCanvasLevel({ ctx, view }) {
  const status = topologyLevelStatus(ctx);
  if (status) return status;

  const { linkCreation, linkBusy: guideActive, visibleNodes, connectionItemLabels } = ctx;
  const sourceNode = linkCreation.sourceNodeId ? visibleNodes.find((node) => node.id === linkCreation.sourceNodeId) : null;
  const guideLabels = sourceNode ? CONNECTION_ITEM_LABELS_BY_TYPE[sourceNode.nodeType || "asset"] : connectionItemLabels;

  return (
    <>
      <TopologyToolbarSection ctx={ctx} />
      <TopologyConnectionGuide
        active={guideActive}
        creatingLink={linkCreation.busy}
        sourceNodeId={linkCreation.sourceNodeId}
        labels={guideLabels}
        onCancel={linkCreation.reset}
      />
      {linkCreation.error ? (
        <p className="network-topology-connection-error" role="alert">
          {linkCreation.error}
        </p>
      ) : null}
      <TopologyCanvasBody ctx={ctx} view={view} />
    </>
  );
}
