import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import PulseDot from "../../../ui/PulseDot.jsx";
import AssetTypeIcon from "../../AssetTypeIcon.jsx";
import { getAggregateStatusColorToken } from "../networkTopologyHierarchy.js";
import { resolveAssetType, resolveNodeStatusTone } from "../networkTopologyModel.js";

export default function HierarchySegmentRow({ segment, groupId, expanded, selectedSegmentId, onToggleExpanded, onSelectSegment }) {
  const devices = segment.devices || [];
  return (
    <div className="network-topology-hierarchy-segment">
      <div className="network-topology-hierarchy-row">
        <button
          type="button"
          className="network-topology-hierarchy-collapse-toggle"
          onClick={() => onToggleExpanded(segment.id)}
          aria-label={`${expanded ? "Recolher" : "Expandir"} segmento ${segment.name}`}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <button
          type="button"
          className={`network-topology-hierarchy-item ${selectedSegmentId === segment.id ? "is-selected" : ""}`}
          onClick={() => onSelectSegment(segment.id, groupId)}
        >
          <Layers size={14} />
          <span className="network-topology-hierarchy-status-dot" style={{ background: getAggregateStatusColorToken(segment.status) }} />
          <span>{segment.name}</span>
          <span className="network-topology-hierarchy-count">{segment.deviceCount}</span>
        </button>
      </div>
      {expanded ? (
        <div className="network-topology-hierarchy-devices">
          {devices.map((device) => (
            <button
              type="button"
              key={device.id}
              className="network-topology-hierarchy-device"
              onClick={() => onSelectSegment(segment.id, groupId)}
            >
              <AssetTypeIcon type={resolveAssetType(device)} size={12} />
              <PulseDot tone={resolveNodeStatusTone(device)} className="network-topology-hierarchy-device-pulse" />
              <span>{device.name}</span>
            </button>
          ))}
          {!devices.length ? <p className="network-topology-hierarchy-empty">Sem ativos.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
