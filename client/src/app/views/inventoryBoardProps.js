// O InventoryBoard recebe uma API "plana" de ~90 props (contrato antigo do
// componente, mantido como esta). Estas funcoes puras montam essa API por
// assunto a partir das fatias do workspace, evitando um bloco unico gigante.

export function buildBoardDataProps({ access, drag, filters, model, persistence, selection, session, sidebar }) {
  return {
    devices: model.decoratedAllDevices,
    token: session.token,
    notify: session.notify,
    user: session.user,
    userName: session.user.name,
    canManage: access.canManageInventory,
    segments: filters.inventoryViewSegments,
    groups: filters.inventoryViewGroups,
    machinesBySegment: drag.machinesBySegment,
    search: filters.inventorySearch,
    setSearch: filters.setInventorySearch,
    selectedGroupId: filters.selectedInventoryGroup,
    selectedSegmentId: filters.selectedInventorySegment,
    aliases: persistence.machineAliases,
    observations: persistence.machineObservations,
    isBulkSelectionDragging: Boolean(
      sidebar.dragActive &&
      drag.activeDragMachine &&
      selection.selectedAssetIds.has(drag.activeDragMachine.id) &&
      selection.selectedAssetIds.size > 1
    )
  };
}

export function buildSelectionProps({ backup, filters, moves, peripherals, selection, bulkPrint }) {
  return {
    selectedAssetIds: selection.selectedAssetIds,
    bulkMoveTarget: selection.bulkMoveTarget,
    onBulkMoveTargetChange: selection.setBulkMoveTarget,
    onBulkMove: moves.handleBulkMove,
    onBulkPrint: bulkPrint.handleBulkPrint,
    onBulkMarkBackup: backup.handleBulkMarkBackup,
    onClearSelection: selection.clearAssetSelection,
    onSelectAsset: selection.handleSelectAsset,
    onToggleSelection: selection.toggleAssetSelection,
    onSelectGroup: filters.selectInventoryGroup,
    onSelectSegment: filters.selectInventorySegment,
    onAddPeripheral: peripherals.addMachinePeripheral,
    onRemovePeripheral: peripherals.removeMachinePeripheral
  };
}

export function buildStructureProps({ groups, model, segments, tabs }) {
  return {
    onCreateSegment: segments.handleCreateSegment,
    onRenameSegment: segments.handleRenameSegment,
    onDeleteSegment: segments.handleDeleteSegment,
    onChangeSegmentColor: segments.handleChangeSegmentColor,
    onMoveSegmentToGroup: segments.moveSegmentToGroup,
    onMoveSegmentOrder: segments.moveSegmentOrder,
    onCreateGroup: groups.openSegmentGroupForm,
    onRenameGroup: groups.renameSegmentGroup,
    onDeleteGroup: groups.deleteSegmentGroup,
    onChangeGroupColor: groups.changeSegmentGroupColor,
    onToggleGroup: groups.toggleSegmentGroup,
    onMoveGroupOrder: groups.moveGroupOrder,
    tabs: model.inventoryTabs,
    activeTab: model.activeInventoryTab,
    activeTabId: model.activeInventoryTab.id,
    onSelectTab: tabs.selectInventoryTab,
    onCreateTab: tabs.createInventoryTab,
    onRenameTab: tabs.renameInventoryTab,
    onDeleteTab: tabs.deleteInventoryTab,
    onChangeTabColor: tabs.changeInventoryTabColor
  };
}

export function buildAssetProps({ assets, backup, maintenance, moves }) {
  return {
    moveModal: moves.moveModal,
    moveTarget: moves.moveTarget,
    setMoveTarget: moves.setMoveTarget,
    onMoveMachine: moves.handleMoveMachine,
    onCloseMoveModal: moves.closeMoveModal,
    onOpenMoveModal: moves.openMoveModal,
    onAliasSave: assets.saveMachineAlias,
    onAddObservation: assets.addMachineObservation,
    onCreateManualAsset: assets.openManualAssetForm,
    onRefreshPing: assets.handleRefreshPing,
    onChangeDeviceType: assets.handleChangeDeviceType,
    onRemoveMachine: assets.removeMachineFromInventory,
    onPutMaintenance: maintenance.putMachineInMaintenance,
    onToggleBackup: backup.handleToggleBackup
  };
}
