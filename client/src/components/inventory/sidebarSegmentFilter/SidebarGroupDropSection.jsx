import { useDroppable } from "@dnd-kit/core";
import { useEffect } from "react";

export default function SidebarGroupDropSection({ groupId, collapsed = false, machineDragActive, onExpand, children }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `sidebar-group-${groupId || "ungrouped"}`,
    data: { type: "sidebar-segment-group-drop", groupId },
    disabled: machineDragActive
  });

  useEffect(() => {
    if (!machineDragActive && isOver && collapsed) onExpand?.();
  }, [collapsed, isOver, machineDragActive, onExpand]);

  return (
    <section ref={setNodeRef} className={`sidebar-segment-group ${isOver ? "sidebar-group-drop-over" : ""}`}>
      {children}
    </section>
  );
}
