import { getStatusColorToken, getStatusLabel } from "../networkTopologyModel.js";

const LEGEND_STATUSES = ["online", "warning", "critical", "unknown", "manual"];

export default function ToolbarLegend() {
  return (
    <div className="network-topology-legend">
      {LEGEND_STATUSES.map((status) => (
        <span key={status} className="network-topology-legend-item">
          <span className="network-topology-legend-dot" style={{ background: getStatusColorToken(status) }} />
          {getStatusLabel(status)}
        </span>
      ))}
    </div>
  );
}
