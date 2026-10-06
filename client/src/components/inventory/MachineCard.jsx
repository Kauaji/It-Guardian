import { useDraggable } from "@dnd-kit/core";
import { useState } from "react";
import { assetTypeLabel } from "./assetTypes.js";
import SelectionCheckbox from "./SelectionCheckbox.jsx";
import MetricHistoryModal from "./metrics/MetricHistoryModal.jsx";
import MachineBadgeRow from "./machineCard/MachineBadgeRow.jsx";
import MachineCardActions from "./machineCard/MachineCardActions.jsx";
import MachineCardHeader from "./machineCard/MachineCardHeader.jsx";
import MachineMetricsBlock from "./machineCard/MachineMetricsBlock.jsx";
import { buildMachineCardClassName } from "./machineCard/machineCardPresentation.js";

function MachineCardContent({
  machine,
  segments = [],
  canManage = false,
  dragHandleProps = {},
  segmentColor,
  alias,
  selected = false,
  selectionCount = 0,
  isDragging = false,
  isOverlay = false,
  onMoveMachine = () => {},
  onOpenDetails = () => {},
  onRefreshPing = () => {},
  onSelect = () => {},
  onToggleSelection = () => {},
  onAddPeripheral = () => {},
  onRemovePeripheral = () => {},
  activePopoverId = null,
  setActivePopoverId = () => {},
  token,
  user,
  notify,
  setNodeRef,
  style
}) {
  const [metricModalTarget, setMetricModalTarget] = useState(null);
  const movePopoverId = `move-${machine.id}`;
  const detailsPopoverId = `peripherals-${machine.id}`;
  const moveMenuOpen = activePopoverId === movePopoverId;
  const expanded = activePopoverId === detailsPopoverId;
  const availableSegments = segments.filter((segment) => segment.id !== machine.segmentId && !segment.isBackupSegment);
  const isManualAsset = machine.source === "manual";
  const isBackup = Boolean(machine.isBackup);
  const backupInUse = machine.backupStatus === "in_use";
  const { onPointerDown: onDragPointerDown, ...safeDragHandleProps } = dragHandleProps;

  function handleCardClick(event) {
    if (isOverlay) return;
    setActivePopoverId(null);
    onSelect(machine, { additive: event.ctrlKey || event.metaKey });
  }

  return (
    <>
    <article
      ref={setNodeRef}
      style={style}
      className={buildMachineCardClassName({ isBackup, backupInUse, selected, expanded, moveMenuOpen, isDragging, isOverlay })}
      onClick={handleCardClick}
    >
      {!isOverlay && (
        <SelectionCheckbox checked={selected} onToggle={() => onToggleSelection(machine.id)} />
      )}
      {isOverlay && selectionCount > 1 && (
        <span className="drag-selection-badge">+{selectionCount - 1} equipamentos</span>
      )}
      <MachineCardHeader
        machine={machine}
        alias={alias}
        dragHandleProps={safeDragHandleProps}
        onDragPointerDown={onDragPointerDown}
        setActivePopoverId={setActivePopoverId}
      />
      <MachineBadgeRow
        machine={machine}
        typeLabel={assetTypeLabel(machine.assetType || machine.type)}
        isManualAsset={isManualAsset}
        isBackup={isBackup}
        backupInUse={backupInUse}
        canManage={canManage}
        onRefreshPing={onRefreshPing}
        setActivePopoverId={setActivePopoverId}
      />
      <span className="machine-ip">{machine.ip}</span>
      {machine.inventorySearchTabName && (
        <span className="machine-search-tab" title={`Aba: ${machine.inventorySearchTabName}`}>
          Aba: {machine.inventorySearchTabName}
        </span>
      )}

      <MachineMetricsBlock
        machine={machine}
        metrics={machine.metrics || {}}
        isManualAsset={isManualAsset}
        onOpenMetricModal={setMetricModalTarget}
      />

      <MachineCardActions
        machine={machine}
        alias={alias}
        metrics={machine.metrics || {}}
        isManualAsset={isManualAsset}
        flags={{ expanded, moveMenuOpen }}
        ids={{ movePopoverId, detailsPopoverId }}
        availableSegments={availableSegments}
        context={{ canManage, segmentColor, token, user, notify }}
        handlers={{
          setActivePopoverId,
          onOpenMetricModal: setMetricModalTarget,
          onOpenDetails,
          onMoveToSegment: (segmentId) => {
            setActivePopoverId(null);
            onMoveMachine(machine, segmentId);
          },
          onAddPeripheral,
          onRemovePeripheral
        }}
      />
    </article>
    <MetricHistoryModal
      metric={metricModalTarget}
      deviceId={machine.id}
      deviceName={alias || machine.name}
      token={token}
      onClose={() => setMetricModalTarget(null)}
    />
    </>
  );
}

export default function MachineCard({
  machine,
  segments,
  canManage,
  segmentColor,
  alias,
  selected,
  onMoveMachine,
  onOpenDetails,
  onOpenMoveModal,
  onRefreshPing,
  onSelect,
  onToggleSelection,
  onAddPeripheral,
  onRemovePeripheral,
  activePopoverId,
  setActivePopoverId,
  token,
  user,
  notify
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: machine.id,
    data: { type: "machine", machineId: machine.id, segmentId: machine.segmentId }
  });

  const style = {
    transform: undefined,
    transition: undefined
  };

  return (
    <MachineCardContent
      machine={machine}
      segments={segments}
      canManage={canManage}
      segmentColor={segmentColor}
      alias={alias}
      selected={selected}
      onMoveMachine={onMoveMachine}
      onOpenDetails={onOpenDetails}
      onOpenMoveModal={onOpenMoveModal}
      onRefreshPing={onRefreshPing}
      onSelect={onSelect}
      onToggleSelection={onToggleSelection}
      onAddPeripheral={onAddPeripheral}
      onRemovePeripheral={onRemovePeripheral}
      activePopoverId={activePopoverId}
      setActivePopoverId={setActivePopoverId}
      token={token}
      user={user}
      notify={notify}
      dragHandleProps={{ ...attributes, ...listeners }}
      isDragging={isDragging}
      setNodeRef={setNodeRef}
      style={style}
    />
  );
}
