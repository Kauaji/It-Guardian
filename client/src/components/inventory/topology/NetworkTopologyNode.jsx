import { AlertTriangle, Wrench } from "lucide-react";
import AssetTypeIcon from "../AssetTypeIcon.jsx";
import { assetTypeLabel } from "../assetTypes.js";
import { resolveAssetType } from "./networkTopologyModel.js";

const NODE_WIDTH = 176;
const NODE_HEIGHT = 72;

export default function NetworkTopologyNode({
  node,
  device,
  segmentName,
  selected,
  editMode,
  isLinkSource,
  onPointerDown
}) {
  const missing = !device;
  const label = node.labelOverride || device?.name || "Ativo removido";
  const type = resolveAssetType(device);

  return (
    <g transform={`translate(${node.x - NODE_WIDTH / 2}, ${node.y - NODE_HEIGHT / 2})`}>
      <foreignObject width={NODE_WIDTH} height={NODE_HEIGHT} style={{ overflow: "visible" }}>
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          className={[
            "network-topology-node",
            selected && "is-selected",
            missing && "is-missing",
            editMode && "is-editable",
            isLinkSource && "is-link-source"
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ "--node-status-color": `var(--topology-status-${device?.status || "unknown"})` }}
          onPointerDown={(event) => onPointerDown(node.id, event)}
          title={label}
        >
          <span className="network-topology-node-icon">
            <AssetTypeIcon type={type} size={18} />
          </span>
          <span className="network-topology-node-body">
            <strong className="network-topology-node-name">{label}</strong>
            <span className="network-topology-node-meta">
              {missing ? "Ativo removido do inventário" : device.ip || assetTypeLabel(type)}
            </span>
            {segmentName ? <span className="network-topology-node-segment">{segmentName}</span> : null}
          </span>
          <span className="network-topology-node-badges">
            {device?.status === "problem" ? (
              <AlertTriangle size={14} className="network-topology-node-badge is-critical" />
            ) : null}
            {device?.maintenance ? (
              <Wrench size={14} className="network-topology-node-badge is-maintenance" />
            ) : null}
          </span>
        </div>
      </foreignObject>
    </g>
  );
}

export { NODE_WIDTH, NODE_HEIGHT };
