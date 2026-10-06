import { useDroppable } from "@dnd-kit/core";

export default function SegmentGroupContainer({ groupId, color, className = "", children }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `group-drop-${groupId || "ungrouped"}`,
    data: { type: "segment-group-drop", groupId }
  });

  return (
    <section
      ref={setNodeRef}
      className={`segment-group-section ${className} ${isOver ? "group-drop-over" : ""}`}
      style={{ "--group-color": color || "#8b9bb0" }}
    >
      {children}
    </section>
  );
}
