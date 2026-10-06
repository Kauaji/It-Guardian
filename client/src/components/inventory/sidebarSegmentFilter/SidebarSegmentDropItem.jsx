import { useDraggable, useDroppable } from "@dnd-kit/core";
import { isMaintenanceSegmentName } from "../../../utils/display.js";

export default function SidebarSegmentDropItem({ segment, selected, count, machineDragActive, onSelectSegment }) {
  const isMaintenance = isMaintenanceSegmentName(segment.name || "");
  const { isOver, setNodeRef } = useDroppable({
    id: `sidebar-segment-${segment.id}`,
    data: { type: "sidebar-segment", segmentId: segment.id }
  });
  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
    isDragging
  } = useDraggable({
    id: `sidebar-segment-drag-${segment.id}`,
    data: { type: "segment", segmentId: segment.id, origin: "sidebar" },
    disabled: segment.isDefault || isMaintenance || machineDragActive
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`sidebar-segment-item ${selected ? "active" : ""} ${isOver ? "drop-over" : ""}`}
      onClick={() => onSelectSegment(segment.id)}
    >
      <span
        ref={setDragNodeRef}
        className={`sidebar-segment-drag-handle ${isDragging ? "dragging" : ""}`}
        title={
          isMaintenance ? "Manutenção não pertence a grupos" : segment.isDefault ? "Segmento padrão não pode ser movido" : "Mover segmento"
        }
        {...attributes}
        {...listeners}
      >
        <span className="segment-filter-dot" style={{ backgroundColor: segment.color || "#1f7a61" }} />
        <span className="sidebar-filter-label">{segment.name}</span>
      </span>
      <small>{count}</small>
    </button>
  );
}
