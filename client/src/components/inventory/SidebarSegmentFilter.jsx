import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useEffect, useMemo, useState } from "react";
import { getSegmentGroupId } from "./inventoryUtils.js";

function SidebarSegmentDropItem({ segment, selected, count, machineDragActive, onSelectSegment }) {
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
    disabled: segment.isDefault || machineDragActive
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
        title={segment.isDefault ? "Segmento padrao nao pode ser movido" : "Mover segmento"}
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

function SidebarGroupDropSection({ groupId, collapsed = false, machineDragActive, onExpand, children }) {
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

export default function SidebarSegmentFilter({
  devices,
  segments,
  groups = [],
  selectedGroupId = "all",
  selectedSegmentId,
  machineDragActive = false,
  onSelectGroup,
  onSelectSegment,
  onToggleGroup
}) {
  const [ungroupedCollapsed, setUngroupedCollapsed] = useState(false);
  const visibleSegments = segments;
  const countBySegment = useMemo(() => {
    const next = new Map();
    for (const device of devices) {
      next.set(device.segmentId, (next.get(device.segmentId) || 0) + 1);
    }
    return next;
  }, [devices]);
  const segmentsByGroupId = useMemo(() => {
    const next = new Map([["", []]]);

    for (const group of groups) {
      next.set(group.id, []);
    }

    for (const segment of visibleSegments) {
      const groupId = getSegmentGroupId(segment, groups);
      const list = next.get(groupId) || [];
      list.push(segment);
      next.set(groupId, list);
    }

    return next;
  }, [groups, visibleSegments]);
  const ungrouped = segmentsByGroupId.get("") || [];

  function groupCount(groupSegments) {
    return groupSegments.reduce((total, segment) => total + (countBySegment.get(segment.id) || 0), 0);
  }

  return (
    <div className="sidebar-segment-filter" aria-label="Filtro de segmentos">
      <button
        type="button"
        className={selectedGroupId === "all" && selectedSegmentId === "all" ? "active" : ""}
        onClick={() => onSelectGroup("all")}
      >
        <span className="segment-filter-dot all" />
        <span className="sidebar-filter-label">Todos</span>
        <small>{devices.length}</small>
      </button>
      {groups.map((group) => {
        const groupSegments = segmentsByGroupId.get(group.id) || [];
        const count = groupCount(groupSegments);

        return (
          <SidebarGroupDropSection
            key={group.id}
            groupId={group.id}
            collapsed={group.collapsed}
            machineDragActive={machineDragActive}
            onExpand={() => onToggleGroup?.(group.id)}
          >
            <div className="sidebar-group-row">
              <button
                type="button"
                className={`sidebar-group-filter ${selectedGroupId === group.id && selectedSegmentId === "all" ? "active" : ""}`}
                onClick={() => onSelectGroup(group.id)}
              >
                <span className="segment-filter-dot group" style={{ backgroundColor: group.color || "#8b9bb0" }} />
                <span className="sidebar-filter-label">{group.name}</span>
                <small>{count}</small>
              </button>
              <button
                type="button"
                className="sidebar-group-collapse"
                onClick={() => onToggleGroup?.(group.id)}
                title={group.collapsed ? "Expandir grupo" : "Recolher grupo"}
              >
                {group.collapsed ? "+" : "-"}
              </button>
            </div>
            {!group.collapsed && groupSegments.map((segment) => (
              <SidebarSegmentDropItem
                key={segment.id}
                segment={segment}
                selected={selectedSegmentId === segment.id}
                count={countBySegment.get(segment.id) || 0}
                machineDragActive={machineDragActive}
                onSelectSegment={onSelectSegment}
              />
            ))}
          </SidebarGroupDropSection>
        );
      })}
      {ungrouped.length > 0 && (
        <SidebarGroupDropSection
          groupId=""
          collapsed={ungroupedCollapsed}
          machineDragActive={machineDragActive}
          onExpand={() => setUngroupedCollapsed(false)}
        >
          <div className="sidebar-group-row">
            <button
              type="button"
              className={`sidebar-group-filter ${selectedGroupId === "ungrouped" && selectedSegmentId === "all" ? "active" : ""}`}
              onClick={() => onSelectGroup("ungrouped")}
            >
              <span className="segment-filter-dot group" />
              <span className="sidebar-filter-label">Sem grupo</span>
              <small>{groupCount(ungrouped)}</small>
            </button>
            <button
              type="button"
              className="sidebar-group-collapse"
              onClick={() => setUngroupedCollapsed((current) => !current)}
              title={ungroupedCollapsed ? "Expandir Sem grupo" : "Recolher Sem grupo"}
            >
              {ungroupedCollapsed ? "+" : "-"}
            </button>
          </div>
          {!ungroupedCollapsed && ungrouped.map((segment) => (
            <SidebarSegmentDropItem
              key={segment.id}
              segment={segment}
              selected={selectedSegmentId === segment.id}
              count={countBySegment.get(segment.id) || 0}
              machineDragActive={machineDragActive}
              onSelectSegment={onSelectSegment}
            />
          ))}
        </SidebarGroupDropSection>
      )}
    </div>
  );
}
