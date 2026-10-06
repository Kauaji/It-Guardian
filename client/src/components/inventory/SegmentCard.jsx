import { useState } from "react";
import { calculateSegmentHealth, describeSegmentHealth } from "./segmentHealth.js";
import { formatSegmentName } from "../../utils/display.js";
import SegmentHeaderTools from "./segmentCard/SegmentHeaderTools.jsx";
import SegmentMachineGrid from "./segmentCard/SegmentMachineGrid.jsx";
import SegmentTitleRow from "./segmentCard/SegmentTitleRow.jsx";
import useSegmentCardDnd from "./segmentCard/useSegmentCardDnd.js";

export default function SegmentCard({
  segment,
  machines,
  segments,
  aliases,
  selectedAssetIds = new Set(),
  canManage,
  onRename,
  onDelete,
  onColorChange,
  onMoveMachine,
  onOpenDetails,
  onOpenMoveModal,
  onRefreshPing,
  onSelectAsset,
  onToggleSelection,
  onMoveSegmentOrder,
  canMoveSegmentUp,
  canMoveSegmentDown,
  selected = false,
  onSelectSegment,
  onAddPeripheral,
  onRemovePeripheral,
  activePopoverId,
  setActivePopoverId,
  token,
  user,
  notify
}) {
  const dnd = useSegmentCardDnd({ segment, canManage });
  const [collapsed, setCollapsed] = useState(false);
  const isDefaultSegment = Boolean(segment.isDefault);
  const isBackupSegment = Boolean(segment.isBackupSegment);
  const color = isBackupSegment ? "#f97316" : isDefaultSegment ? "#111827" : segment.color || "#1f7a61";
  const actionsMenuId = `segment-actions-${segment.id}`;
  const health = calculateSegmentHealth(machines);
  const displayName = formatSegmentName(segment.name);
  const sectionStyle = {
    "--segment-color": color,
    opacity: dnd.isDragging ? 0.62 : undefined
  };

  function handleSegmentTitleClick(event) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectSegment?.(segment.id, true);
  }

  return (
    <section
      id={`inventory-segment-${segment.id}`}
      ref={(node) => {
        dnd.setDropNodeRef(node);
      }}
      className={`segment-card ${isDefaultSegment ? "default-segment-card" : ""} ${isBackupSegment ? "backup-segment-card" : ""} ${dnd.isOver ? "drop-over" : ""} ${dnd.isDragging ? "segment-dragging" : ""} ${selected ? "segment-selected" : ""}`}
      style={sectionStyle}
    >
      <header className="segment-card-header">
        <SegmentTitleRow
          isDefaultSegment={isDefaultSegment}
          canManage={canManage}
          isSegmentDragging={dnd.isDragging}
          dnd={dnd}
          displayName={displayName}
          machineCount={machines.length}
          health={health}
          healthDescription={describeSegmentHealth(health)}
          setActivePopoverId={setActivePopoverId}
          onTitleClick={handleSegmentTitleClick}
        />
        <SegmentHeaderTools
          isDefaultSegment={isDefaultSegment}
          collapsed={collapsed}
          actionsOpen={activePopoverId === actionsMenuId}
          actionsMenuId={actionsMenuId}
          setActivePopoverId={setActivePopoverId}
          onToggleCollapsed={() => setCollapsed((current) => !current)}
          stripProps={{
            segment, color, canManage, canMoveSegmentUp, canMoveSegmentDown,
            closeActions: () => setActivePopoverId?.(null),
            onMoveSegmentOrder, onColorChange, onRename, onDelete
          }}
        />
      </header>

      {!collapsed && (
        <SegmentMachineGrid
          machines={machines}
          color={color}
          selectedAssetIds={selectedAssetIds}
          aliases={aliases}
          cardProps={{
            segments, canManage, onMoveMachine, onOpenDetails, onOpenMoveModal, onRefreshPing,
            onSelect: onSelectAsset, onToggleSelection, onAddPeripheral, onRemovePeripheral,
            activePopoverId, setActivePopoverId, token, user, notify
          }}
        />
      )}
    </section>
  );
}
