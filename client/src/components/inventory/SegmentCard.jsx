import { ChevronDown, Edit3, Trash2 } from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
    transform: segmentTransform,
    isDragging: isSegmentDragging
  } = useDraggable({
    id: `segment-drag-${segment.id}`,
    data: { type: "segment", segmentId: segment.id },
    disabled: segment.isDefault || !canManage
  });
  const [collapsed, setCollapsed] = useState(false);
  const color = segment.color || "#1f7a61";
  const machineIds = machines.map((machine) => machine.id);
  const sectionStyle = {
    "--segment-color": color,
    transform: CSS.Transform.toString(segmentTransform),
    opacity: isSegmentDragging ? 0.62 : undefined
  };

  return (
    <section
      id={`inventory-segment-${segment.id}`}
      ref={(node) => {
        setDropNodeRef(node);
        setSegmentDragNodeRef(node);
      }}
      className={`segment-card ${isOver ? "drop-over" : ""} ${isSegmentDragging ? "segment-dragging" : ""}`}
      style={sectionStyle}
    >
      <header className="segment-card-header">
        <div className="segment-title-row">
          <button
            type="button"
            className="segment-color-mark"
            aria-label="Mover segmento"
            title={segment.isDefault ? "Segmento padrao nao pode ser movido" : "Mover segmento"}
            disabled={segment.isDefault || !canManage}
            {...segmentDragAttributes}
            {...segmentDragListeners}
          />
          <div>
            <h3>{segment.name}</h3>
            <span>{machines.length} maquinas</span>
          </div>
        </div>

        <div className="segment-header-tools">
          <ColorPickerSegment
            color={color}
            disabled={!canManage || segment.isDefault}
            onChange={(nextColor) => onColorChange(segment, nextColor)}
          />
          {canManage && (
            <>
              <button
                type="button"
                disabled={segment.isDefault}
                onClick={() => onRename(segment)}
                title={segment.isDefault ? "Segmento padrao nao pode ser renomeado" : "Renomear segmento"}
              >
                <Edit3 size={15} />
              </button>
              <button
                type="button"
                disabled={segment.isDefault}
                onClick={() => onDelete(segment)}
                title={segment.isDefault ? "Segmento padrao nao pode ser excluido" : "Excluir segmento"}
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
          {canManage && (
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
