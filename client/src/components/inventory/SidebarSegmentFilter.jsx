import { useMemo, useState } from "react";
import SidebarGroupDropSection from "./sidebarSegmentFilter/SidebarGroupDropSection.jsx";
import SidebarGroupRow from "./sidebarSegmentFilter/SidebarGroupRow.jsx";
import SidebarSegmentDropItem from "./sidebarSegmentFilter/SidebarSegmentDropItem.jsx";
import {
  countDevicesBySegment,
  getOccupiedMaintenanceSegments,
  groupSegmentsByGroupId,
  sumGroupCount
} from "./sidebarSegmentFilter/sidebarSegmentModel.js";

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
  const countBySegment = useMemo(() => countDevicesBySegment(devices), [devices]);
  const maintenanceSegments = useMemo(
    () => getOccupiedMaintenanceSegments(visibleSegments, countBySegment),
    [countBySegment, visibleSegments]
  );
  const segmentsByGroupId = useMemo(
    () => groupSegmentsByGroupId(visibleSegments, groups),
    [groups, visibleSegments]
  );
  const ungrouped = segmentsByGroupId.get("") || [];

  function renderSegmentItems(list) {
    return list.map((segment) => (
      <SidebarSegmentDropItem
        key={segment.id}
        segment={segment}
        selected={selectedSegmentId === segment.id}
        count={countBySegment.get(segment.id) || 0}
        machineDragActive={machineDragActive}
        onSelectSegment={onSelectSegment}
      />
    ));
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
        return (
          <SidebarGroupDropSection
            key={group.id}
            groupId={group.id}
            collapsed={group.collapsed}
            machineDragActive={machineDragActive}
            onExpand={() => onToggleGroup?.(group.id)}
          >
            <SidebarGroupRow
              active={selectedGroupId === group.id && selectedSegmentId === "all"}
              dotStyle={{ backgroundColor: group.color || "#8b9bb0" }}
              label={group.name}
              count={sumGroupCount(groupSegments, countBySegment)}
              collapsed={group.collapsed}
              collapseTitle={group.collapsed ? "Expandir grupo" : "Recolher grupo"}
              onSelect={() => onSelectGroup(group.id)}
              onToggle={() => onToggleGroup?.(group.id)}
            />
            {!group.collapsed && renderSegmentItems(groupSegments)}
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
          <SidebarGroupRow
            active={selectedGroupId === "ungrouped" && selectedSegmentId === "all"}
            label="Sem grupo"
            count={sumGroupCount(ungrouped, countBySegment)}
            collapsed={ungroupedCollapsed}
            collapseTitle={ungroupedCollapsed ? "Expandir Sem grupo" : "Recolher Sem grupo"}
            onSelect={() => onSelectGroup("ungrouped")}
            onToggle={() => setUngroupedCollapsed((current) => !current)}
          />
          {!ungroupedCollapsed && renderSegmentItems(ungrouped)}
        </SidebarGroupDropSection>
      )}
      {renderSegmentItems(maintenanceSegments)}
    </div>
  );
}
