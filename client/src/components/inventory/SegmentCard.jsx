import { ArrowDown, ArrowUp, ChevronDown, Edit3, Trash2 } from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import MachineCard from "./MachineCard.jsx";
import ColorPickerSegment from "./ColorPickerSegment.jsx";

export default function SegmentCard({
  segment,
  machines,
  segments,
  groups = [],
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
  onMoveSegmentToGroup,
  onMoveSegmentOrder,
  canMoveSegmentUp,
  canMoveSegmentDown,
  hideGroupSelect = false,
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
  const color = segment.color || "#1f7a61";
  const machineIds = machines.map((machine) => machine.id);
  const sectionStyle = {
    "--segment-color": color,
    opacity: isSegmentDragging ? 0.62 : undefined
  };

  return (
    <section
      id={`inventory-segment-${segment.id}`}
      ref={(node) => {
        setDropNodeRef(node);
      }}
      className={`segment-card ${isOver ? "drop-over" : ""} ${isSegmentDragging ? "segment-dragging" : ""}`}
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
            onPointerDown={(event) => {
              setActivePopoverId(null);
              segmentDragListeners?.onPointerDown?.(event);
            }}
          >
            <span className="segment-color-mark" aria-hidden="true" />
            <span className="segment-title-copy">
              <h3>{segment.name}</h3>
              <span>{machines.length} maquinas</span>
            </span>
          </button>
        </div>

        <div className="segment-header-tools">
          {canManage && !isDefaultSegment && (
            <>
              {canMoveSegmentUp && (
                <button
                  type="button"
                  onClick={() => onMoveSegmentOrder?.(segment, "up")}
                  title="Subir segmento"
                >
                  <ArrowUp size={15} />
                </button>
              )}
              {canMoveSegmentDown && (
                <button
                  type="button"
                  onClick={() => onMoveSegmentOrder?.(segment, "down")}
                  title="Descer segmento"
                >
                  <ArrowDown size={15} />
                </button>
              )}
            </>
          )}
          {!isDefaultSegment && (
            <ColorPickerSegment
              color={color}
              disabled={!canManage}
              onChange={(nextColor) => onColorChange(segment, nextColor)}
              popoverId={`segment-color-${segment.id}`}
              activePopoverId={activePopoverId}
              setActivePopoverId={setActivePopoverId}
            />
          )}
          {canManage && !isDefaultSegment && (
            <>
              <button
                type="button"
                onClick={() => onRename(segment)}
                title="Renomear segmento"
              >
                <Edit3 size={15} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(segment)}
                title="Excluir segmento"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
          <button
            type="button"
            className={`segment-collapse ${collapsed ? "collapsed" : ""}`}
            title={collapsed ? "Expandir segmento" : "Recolher segmento"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((current) => !current)}
          >
            <ChevronDown size={16} />
          </button>
          {canManage && !hideGroupSelect && !isDefaultSegment && (
            <select
              className="segment-group-select"
              value={segment.groupId || groups.find((group) => (group.segmentIds || []).includes(segment.id))?.id || ""}
              onChange={(event) => onMoveSegmentToGroup(segment.id, event.target.value)}
              title="Mover segmento para grupo"
            >
              <option value="">Sem grupo</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          )}
        </div>
      </header>

      {!collapsed && (
        <SortableContext items={machineIds} strategy={rectSortingStrategy}>
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
        </SortableContext>
      )}
    </section>
  );
}
