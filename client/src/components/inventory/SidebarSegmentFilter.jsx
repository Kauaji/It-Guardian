import { useDroppable } from "@dnd-kit/core";

function SidebarSegmentDropItem({ segment, selected, onSelectSegment }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `sidebar-segment-${segment.id}`,
    data: { type: "sidebar-segment", segmentId: segment.id }
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`${selected ? "active" : ""} ${isOver ? "drop-over" : ""}`}
      onClick={() => onSelectSegment(segment.id)}
    >
      <span className="segment-filter-dot" style={{ backgroundColor: segment.color || "#1f7a61" }} />
      {segment.name}
    </button>
  );
}

export default function SidebarSegmentFilter({ devices, segments, selectedSegmentId, onSelectSegment }) {
  const visibleSegments = segments.filter(
    (segment) => !segment.isDefault || devices.some((device) => device.segmentId === segment.id)
  );

  return (
    <div className="sidebar-segment-filter" aria-label="Filtro de segmentos">
      <button
        type="button"
        className={selectedSegmentId === "all" ? "active" : ""}
        onClick={() => onSelectSegment("all")}
      >
        <span className="segment-filter-dot all" />
        Todos
      </button>
      {visibleSegments.map((segment) => (
        <SidebarSegmentDropItem
          key={segment.id}
          segment={segment}
          selected={selectedSegmentId === segment.id}
          onSelectSegment={onSelectSegment}
        />
      ))}
    </div>
  );
}
