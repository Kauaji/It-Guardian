import { AlertTriangle, Wrench } from "lucide-react";
import AssetTypeIcon from "../AssetTypeIcon.jsx";
import PulseDot from "../../ui/PulseDot.jsx";
import { resolveAssetType, resolveNodeLabel, resolveNodeSecondaryName, resolveNodeStatusTone } from "./networkTopologyModel.js";

const NODE_WIDTH = 116;
const NODE_HEIGHT = 100;

export default function NetworkTopologyNode({
  node,
  device,
  segmentName,
  selected,
  editMode,
  isLinkSource,
  isNew,
  onPointerDown
}) {
  const missing = !device;
  const label = resolveNodeLabel(node, device);
  const secondaryName = resolveNodeSecondaryName(node, device, label);
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
            isLinkSource && "is-link-source",
            isNew && "is-new"
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ "--node-status-color": `var(--topology-status-${device?.status || "unknown"})` }}
          onPointerDown={(event) => onPointerDown(node.id, event)}
          title={label}
        >
          <span className="network-topology-node-icon">
            <AssetTypeIcon type={type} size={22} />
            {!missing ? <PulseDot tone={resolveNodeStatusTone(device)} className="network-topology-node-pulse" /> : null}
            {device?.status === "problem" ? (
              <AlertTriangle size={12} className="network-topology-node-badge is-critical" />
            ) : null}
            {device?.maintenance ? (
              <Wrench size={12} className="network-topology-node-badge is-maintenance" />
            ) : null}
          </span>
          <span className="network-topology-node-body">
            <strong className="network-topology-node-name">{label}</strong>
            {missing ? (
              <span className="network-topology-node-meta">Ativo removido</span>
            ) : secondaryName ? (
              <span className="network-topology-node-realname">{secondaryName}</span>
            ) : null}
            {segmentName ? <span className="network-topology-node-segment">{segmentName}</span> : null}
          </span>
        </div>
      </foreignObject>
    </g>
  );
}

export { NODE_WIDTH, NODE_HEIGHT };
