import { ArrowDown, ArrowUp, ChevronDown, Edit3, MoreHorizontal, Trash2 } from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useState } from "react";
import MachineCard from "./MachineCard.jsx";
import ColorPickerSegment from "./ColorPickerSegment.jsx";

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
  onRemovePeripheral,
  activePopoverId,
  setActivePopoverId
}) {
  const { isOver, setNodeRef: setDropNodeRef } = useDroppable({
    id: `segment-drop-${segment.id}`,
    data: { type: "segment", segmentId: segment.id }
  });
  const {
    attributes: segmentDragAttributes,
    listeners: segmentDragListeners,
    setNodeRef: setSegmentDragNodeRef,
    isDragging: isSegmentDragging
  } = useDraggable({
    id: `segment-drag-${segment.id}`,
    data: { type: "segment", segmentId: segment.id, origin: "board" },
    disabled: segment.isDefault || !canManage
  });
  const [collapsed, setCollapsed] = useState(false);
  const isDefaultSegment = Boolean(segment.isDefault);
  const isBackupSegment = Boolean(segment.isBackupSegment);
  const color = isBackupSegment ? "#f97316" : isDefaultSegment ? "#111827" : segment.color || "#1f7a61";
  const actionsMenuId = `segment-actions-${segment.id}`;
  const actionsOpen = activePopoverId === actionsMenuId;
  const sectionStyle = {
    "--segment-color": color,
    opacity: isSegmentDragging ? 0.62 : undefined
  };

  function closeActions() {
    setActivePopoverId?.(null);
  }

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
        setDropNodeRef(node);
      }}
      className={`segment-card ${isDefaultSegment ? "default-segment-card" : ""} ${isBackupSegment ? "backup-segment-card" : ""} ${isOver ? "drop-over" : ""} ${isSegmentDragging ? "segment-dragging" : ""} ${selected ? "segment-selected" : ""}`}
      style={sectionStyle}
    >
      <header className="segment-card-header">
        <div className="segment-title-row">
          <button
            type="button"
            ref={setSegmentDragNodeRef}
            className={`segment-title-drag-handle ${isSegmentDragging ? "dragging" : ""}`}
            title={isDefaultSegment ? "Segmento padrao nao pode ser movido" : "Mover segmento"}
            disabled={isDefaultSegment || !canManage}
            {...segmentDragAttributes}
            {...segmentDragListeners}
            onClick={handleSegmentTitleClick}
            onPointerDown={(event) => {
              setActivePopoverId?.(null);
              segmentDragListeners?.onPointerDown?.(event);
            }}
          >
            <span className="segment-color-mark" aria-hidden="true" />
            <span className="segment-title-copy">
              <h3>{segment.name}</h3>
              <span>{machines.length} {machines.length === 1 ? "máquina" : "máquinas"}</span>
            </span>
          </button>
        </div>

        <div className="segment-header-tools">
          {isDefaultSegment ? (
            <button
              type="button"
              className={`segment-collapse ${collapsed ? "collapsed" : ""}`}
              title={collapsed ? "Expandir segmento" : "Recolher segmento"}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((current) => !current)}
            >
              <ChevronDown size={16} />
            </button>
          ) : (
            <div className="segment-actions-menu-wrap">
              {actionsOpen && (
                <div className="inline-action-strip segment-inline-actions" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    className="inline-action-button"
                    onClick={() => {
                      setCollapsed((current) => !current);
                      closeActions();
                    }}
                    title={collapsed ? "Expandir segmento" : "Recolher segmento"}
                    aria-label={collapsed ? "Expandir segmento" : "Recolher segmento"}
                  >
                    <ChevronDown size={15} className={collapsed ? "rotated" : ""} />
                  </button>
                  {canManage && canMoveSegmentUp && (
                    <button
                      type="button"
                      className="inline-action-button"
                      onClick={() => {
                        onMoveSegmentOrder?.(segment, "up");
                        closeActions();
                      }}
                      title="Subir segmento"
                      aria-label="Subir segmento"
                    >
                      <ArrowUp size={15} />
                    </button>
                  )}
                  {canManage && canMoveSegmentDown && (
                    <button
                      type="button"
                      className="inline-action-button"
                      onClick={() => {
                        onMoveSegmentOrder?.(segment, "down");
                        closeActions();
                      }}
                      title="Descer segmento"
                      aria-label="Descer segmento"
                    >
                      <ArrowDown size={15} />
                    </button>
                  )}
                  {canManage && (
                    <ColorPickerSegment
                      color={color}
                      disabled={!canManage}
                      onChange={(nextColor) => onColorChange(segment, nextColor)}
                    />
                  )}
                  {canManage && (
                    <button
                      type="button"
                      className="inline-action-button"
                      onClick={() => {
                        onRename(segment);
                        closeActions();
                      }}
                      title="Renomear segmento"
                      aria-label="Renomear segmento"
                    >
                      <Edit3 size={15} />
                    </button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      className="inline-action-button danger"
                      onClick={() => {
                        onDelete(segment);
                        closeActions();
                      }}
                      title="Excluir segmento"
                      aria-label="Excluir segmento"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              )}
              <button
                type="button"
                className="segment-options-trigger"
                title="Ações do segmento"
                aria-label="Ações do segmento"
                aria-expanded={actionsOpen}
                onClick={(event) => {
                  event.stopPropagation();
                  setActivePopoverId(actionsOpen ? null : actionsMenuId);
                }}
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      {!collapsed && (
        <div className="segment-machine-grid">
          {machines.map((machine) => (
            <MachineCard
              key={machine.id}
              machine={machine}
              segments={segments}
              canManage={canManage}
              segmentColor={color}
              alias={aliases[machine.id]}
              selected={selectedAssetIds.has(machine.id)}
              onMoveMachine={onMoveMachine}
              onOpenDetails={onOpenDetails}
              onOpenMoveModal={onOpenMoveModal}
              onRefreshPing={onRefreshPing}
              onSelect={onSelectAsset}
              onToggleSelection={onToggleSelection}
              onRemovePeripheral={onRemovePeripheral}
              activePopoverId={activePopoverId}
              setActivePopoverId={setActivePopoverId}
            />
          ))}
          {!machines.length && (
            <div className="empty-segment wide-empty">
              <span>Solte maquinas aqui</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
