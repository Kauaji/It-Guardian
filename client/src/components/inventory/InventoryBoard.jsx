import { cloneElement } from "react";
import MoveMachineModal from "./MoveMachineModal.jsx";
import MachineDetailsModal from "./MachineDetailsModal.jsx";
import BulkActionsBar from "./BulkActionsBar.jsx";
import InventoryTabs from "./InventoryTabs.jsx";
import BoardActionsBar from "./board/BoardActionsBar.jsx";
import BoardSegmentStack from "./board/BoardSegmentStack.jsx";
import BoardViewSwitch from "./board/BoardViewSwitch.jsx";
import { resolveBoardProps } from "./board/boardProps.js";
import useBoardSections from "./board/useBoardSections.js";
import useInventoryBoardState from "./board/useInventoryBoardState.js";
import useMachineDetailsProps from "./board/useMachineDetailsProps.js";

// Props repassadas igualmente a todos os cartoes de segmento do quadro.
function buildSegmentCardProps(props, state) {
  const {
    segments, groups, aliases, selectedAssetIds, canManage, token, user, notify,
    onRenameSegment, onDeleteSegment, onChangeSegmentColor, onMoveMachine, onOpenMoveModal, onRefreshPing,
    onSelectAsset, onToggleSelection, onMoveSegmentToGroup, onMoveSegmentOrder, onAddPeripheral, onRemovePeripheral
  } = props;
  return {
    segments,
    groups,
    aliases,
    selectedAssetIds,
    canManage,
    onRename: onRenameSegment,
    onDelete: onDeleteSegment,
    onColorChange: onChangeSegmentColor,
    onMoveMachine,
    onOpenDetails: state.setSelectedMachine,
    onOpenMoveModal,
    onRefreshPing,
    onSelectAsset,
    onToggleSelection,
    onMoveSegmentToGroup,
    onMoveSegmentOrder,
    onSelectSegment: state.handleSelectSegment,
    onAddPeripheral,
    onRemovePeripheral,
    activePopoverId: state.activePopoverId,
    setActivePopoverId: state.setActivePopoverId,
    token,
    user,
    notify
  };
}

function renderBoardPanel(props, state, sections) {
  const { selectedSegmentIds } = state;
  return (
    <>
      <BoardActionsBar
        search={props.search}
        setSearch={props.setSearch}
        searchFocused={state.searchFocused}
        setSearchFocused={state.setSearchFocused}
        filtersOpen={state.filtersOpen}
        setFiltersOpen={state.setFiltersOpen}
        canManage={props.canManage}
        onCreateManualAsset={props.onCreateManualAsset}
        onCreateSegment={props.onCreateSegment}
        onCreateGroup={props.onCreateGroup}
        tabs={props.tabs}
        groups={props.groups}
        availableSegments={sections.availableSegments}
        backupSegment={sections.backupSegment}
        maintenanceSegment={sections.maintenanceSegment}
        activeTabId={props.activeTabId}
        selectedGroupId={props.selectedGroupId}
        selectedSegmentId={props.selectedSegmentId}
        onSelectTab={props.onSelectTab}
        onSelectGroup={props.onSelectGroup}
        onSelectSegment={props.onSelectSegment}
      />

      <BulkActionsBar
        count={props.selectedAssetIds.size}
        segments={props.segments}
        currentTarget={props.bulkMoveTarget}
        onTargetChange={props.onBulkMoveTargetChange}
        onMove={props.onBulkMove}
        onPrint={props.onBulkPrint}
        onMarkBackup={props.onBulkMarkBackup}
        onClear={props.onClearSelection}
        isDragActive={props.isBulkSelectionDragging}
      />

      <BoardSegmentStack
        sections={sections}
        shared={{
          activeTab: props.activeTab,
          machinesBySegment: props.machinesBySegment,
          selectedSegmentIds,
          cardProps: buildSegmentCardProps(props, state),
          groupActions: {
            onToggleGroup: props.onToggleGroup,
            onMoveGroupOrder: props.onMoveGroupOrder,
            onChangeGroupColor: props.onChangeGroupColor,
            onRenameGroup: props.onRenameGroup,
            onDeleteGroup: props.onDeleteGroup
          }
        }}
      />
    </>
  );
}

export default function InventoryBoard(rawProps) {
  const props = resolveBoardProps(rawProps);
  const state = useInventoryBoardState(props);
  const sections = useBoardSections(props);
  const machineDetailsProps = useMachineDetailsProps(props, state);
  const { inventoryViewMode, setInventoryViewMode, setSelectedMachine, activePopoverId, setActivePopoverId } = state;
  const { floorPlansView, topologyView, activeTab } = props;

  let content = floorPlansView;
  if (inventoryViewMode === "topology") {
    content = topologyView && cloneElement(topologyView, { onOpenDetails: setSelectedMachine });
  } else if (inventoryViewMode === "board") {
    content = renderBoardPanel(props, state, sections);
  }

  return (
    <section
      className="inventory-board-view"
      style={{ "--active-tab-color": activeTab?.color || "#2563eb" }}
    >
      <InventoryTabs
        tabs={props.tabs}
        activeTabId={props.activeTabId}
        onSelect={props.onSelectTab}
        onCreate={props.onCreateTab}
        onRename={props.onRenameTab}
        onDelete={props.onDeleteTab}
        onColorChange={props.onChangeTabColor}
        activePopoverId={activePopoverId}
        setActivePopoverId={setActivePopoverId}
      />

      <BoardViewSwitch
        mode={inventoryViewMode}
        hasFloorPlans={Boolean(floorPlansView)}
        hasTopology={Boolean(topologyView)}
        onChange={setInventoryViewMode}
      />

      {content}

      <MoveMachineModal
        machine={props.moveModal}
        segments={props.segments.filter((segment) => !segment.isBackupSegment)}
        targetSegmentId={props.moveTarget}
        onTargetChange={props.setMoveTarget}
        onClose={props.onCloseMoveModal}
        onConfirm={() => props.onMoveMachine(props.moveModal, props.moveTarget)}
      />
      <MachineDetailsModal {...machineDetailsProps} />
    </section>
  );
}
