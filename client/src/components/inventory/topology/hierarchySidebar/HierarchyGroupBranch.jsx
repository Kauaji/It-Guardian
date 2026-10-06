import { ChevronDown, ChevronRight, FolderTree } from "lucide-react";
import { getAggregateStatusColorToken } from "../networkTopologyHierarchy.js";
import HierarchySegmentRow from "./HierarchySegmentRow.jsx";

export default function HierarchyGroupBranch({
  group, collapsed, selectedGroupId, selectedSegmentId, expandedSegmentIds, onToggleCollapsed, onToggleSegmentExpanded, onSelectGroup, onSelectSegment
}) {
  return (
    <div className="network-topology-hierarchy-group">
      <div className="network-topology-hierarchy-row">
        <button
          type="button"
          className="network-topology-hierarchy-collapse-toggle"
          onClick={() => onToggleCollapsed(group.id)}
          aria-label={`${collapsed ? "Expandir" : "Recolher"} grupo ${group.name}`}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          type="button"
          className={`network-topology-hierarchy-item ${selectedGroupId === group.id ? "is-selected" : ""}`}
          onClick={() => onSelectGroup(group.id)}
        >
          <FolderTree size={15} />
          <span
            className="network-topology-hierarchy-status-dot"
            style={{ background: getAggregateStatusColorToken(group.status) }}
          />
          <strong>{group.name}</strong>
          <span className="network-topology-hierarchy-count" title={`${group.deviceCount} ativo(s) em ${group.segmentCount} segmento(s)`}>{group.deviceCount}</span>
        </button>
      </div>
      {!collapsed ? (
        <div className="network-topology-hierarchy-children">
          {group.segments.map((segment) => (
            <HierarchySegmentRow
              key={segment.id}
              segment={segment}
              groupId={group.id}
              expanded={expandedSegmentIds.has(segment.id)}
              selectedSegmentId={selectedSegmentId}
              onToggleExpanded={onToggleSegmentExpanded}
              onSelectSegment={onSelectSegment}
            />
          ))}
          {!group.segments.length ? (
            <p className="network-topology-hierarchy-empty">Sem segmentos.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
