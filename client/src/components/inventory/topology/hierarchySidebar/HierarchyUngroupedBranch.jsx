import HierarchySegmentRow from "./HierarchySegmentRow.jsx";

export default function HierarchyUngroupedBranch({
  segments,
  selectedSegmentId,
  expandedSegmentIds,
  onToggleSegmentExpanded,
  onSelectSegment
}) {
  return (
    <div className="network-topology-hierarchy-group">
      <div className="network-topology-hierarchy-row">
        <span className="network-topology-hierarchy-collapse-toggle-spacer" />
        <span className="network-topology-hierarchy-item is-heading">
          <strong>Sem grupo</strong>
        </span>
      </div>
      <div className="network-topology-hierarchy-children">
        {segments.map((segment) => (
          <HierarchySegmentRow
            key={segment.id}
            segment={segment}
            groupId={null}
            expanded={expandedSegmentIds.has(segment.id)}
            selectedSegmentId={selectedSegmentId}
            onToggleExpanded={onToggleSegmentExpanded}
            onSelectSegment={onSelectSegment}
          />
        ))}
      </div>
    </div>
  );
}
