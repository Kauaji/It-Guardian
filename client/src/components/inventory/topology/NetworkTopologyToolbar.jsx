import ToolbarFilters from "./toolbar/ToolbarFilters.jsx";
import ToolbarLayoutGroup from "./toolbar/ToolbarLayoutGroup.jsx";
import ToolbarLegend from "./toolbar/ToolbarLegend.jsx";
import ToolbarManualAdd from "./toolbar/ToolbarManualAdd.jsx";
import ToolbarModeGroup from "./toolbar/ToolbarModeGroup.jsx";

export default function NetworkTopologyToolbar({
  editMode,
  onToggleEditMode,
  onCenterView,
  onSaveLayout,
  hasDirtyPositions,
  saving,
  onResetLayout,
  onGenerateAutoLayout,
  generatingLayout,
  linkDraftActive,
  linkDraftSourceNodeId,
  creatingLink = false,
  onToggleLinkDraft,
  availableDevicesToAdd,
  onAddAsset,
  availableClustersToAdd,
  onAddCluster,
  addingAsset,
  nodeCount,
  linkCount,
  filters,
  onFiltersChange,
  segments,
  assetTypeOptions,
  canManage,
  canLink = false,
  canStartLink,
  linkItemLabel = "itens",
  lockSegmentFilter = false,
  isClusterLevel = false,
  showManualAdd = false
}) {
  const layoutBusy = Boolean(saving || generatingLayout);
  const manualAddBusy = Boolean(addingAsset || layoutBusy);
  const linkActionAvailable = canStartLink ?? nodeCount >= 2;

  return (
    <div className="network-topology-toolbar">
      <div className="network-topology-toolbar-row">
        <ToolbarModeGroup
          editMode={editMode}
          canManage={canManage}
          canLink={canLink}
          creatingLink={creatingLink}
          layoutBusy={layoutBusy}
          linkDraftActive={linkDraftActive}
          linkDraftSourceNodeId={linkDraftSourceNodeId}
          linkActionAvailable={linkActionAvailable}
          linkItemLabel={linkItemLabel}
          onToggleEditMode={onToggleEditMode}
          onToggleLinkDraft={onToggleLinkDraft}
          onCenterView={onCenterView}
        />

        {editMode ? (
          <ToolbarLayoutGroup
            canManage={canManage}
            isClusterLevel={isClusterLevel}
            hasDirtyPositions={hasDirtyPositions}
            saving={saving}
            generatingLayout={generatingLayout}
            layoutBusy={layoutBusy}
            nodeCount={nodeCount}
            onSaveLayout={onSaveLayout}
            onResetLayout={onResetLayout}
            onGenerateAutoLayout={onGenerateAutoLayout}
          />
        ) : null}

        <div className="network-topology-toolbar-counters">
          <span key={nodeCount} className="network-topology-toolbar-counter-pop">
            {nodeCount} {isClusterLevel ? "item(ns)" : "ativo(s)"}
          </span>
          <span key={`links-${linkCount}`} className="network-topology-toolbar-counter-pop">
            {linkCount} conexão(ões)
          </span>
        </div>
      </div>

      {showManualAdd && editMode && canManage ? (
        <ToolbarManualAdd
          isClusterLevel={isClusterLevel}
          manualAddBusy={manualAddBusy}
          availableClustersToAdd={availableClustersToAdd}
          onAddCluster={onAddCluster}
          availableDevicesToAdd={availableDevicesToAdd}
          onAddAsset={onAddAsset}
        />
      ) : null}

      {!isClusterLevel ? (
        <ToolbarFilters
          filters={filters}
          onFiltersChange={onFiltersChange}
          segments={segments}
          assetTypeOptions={assetTypeOptions}
          lockSegmentFilter={lockSegmentFilter}
        />
      ) : null}

      <ToolbarLegend />
    </div>
  );
}
