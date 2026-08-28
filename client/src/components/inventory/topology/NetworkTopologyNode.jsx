import { AlertTriangle, FolderTree, Layers, Wrench } from "lucide-react";
import AssetTypeIcon from "../AssetTypeIcon.jsx";
import PulseDot from "../../ui/PulseDot.jsx";
import { getAggregateStatusColorToken } from "./networkTopologyHierarchy.js";
import {
  getNodeDimensions,
  isClusterNode,
  resolveAssetType,
  resolveEntityLabel,
  resolveNodeLabel,
  resolveNodeSecondaryName,
  resolveNodeStatusTone
} from "./networkTopologyModel.js";

const NODE_WIDTH = 116;
const NODE_HEIGHT = 100;

export default function NetworkTopologyNode({
  node,
  device,
  clusterInfo,
  segmentName,
  selected,
  editMode,
  linkDraftActive = false,
  isLinkSource,
  isNew,
  onPointerDown,
  onActivate,
  onOpen
}) {
  const cluster = isClusterNode(node);
  const { width, height } = getNodeDimensions(node);

  const missing = cluster ? !clusterInfo : !device;
  const label = cluster ? clusterInfo?.name || resolveEntityLabel(node.nodeType, null) : resolveNodeLabel(node, device);
  const secondaryName = cluster ? null : resolveNodeSecondaryName(node, device, label);
  const type = cluster ? null : resolveAssetType(device);
  const statusColor = cluster
    ? getAggregateStatusColorToken(clusterInfo?.status)
    : `var(--topology-status-${device?.status || "unknown"})`;
  const countsLabel = cluster && clusterInfo
    ? node.nodeType === "group"
      ? `${clusterInfo.segmentCount} segmento(s) · ${clusterInfo.deviceCount} ativo(s)`
      : `${clusterInfo.deviceCount} ativo(s)`
    : null;

  return (
    <g transform={`translate(${node.x - width / 2}, ${node.y - height / 2})`}>
      <foreignObject width={width} height={height} style={{ overflow: "visible" }}>
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          className={[
            "network-topology-node",
            cluster && "is-cluster",
            selected && "is-selected",
            missing && "is-missing",
            editMode && "is-editable",
            isLinkSource && "is-link-source",
            isNew && "is-new"
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ "--node-status-color": statusColor }}
          role="button"
          tabIndex={0}
          aria-label={`${label}, ver ${cluster ? (node.nodeType === "group" ? "grupo" : "segmento") : "ativo"}`}
          aria-description={cluster
            ? "Um clique mostra máquinas e conexões. Dois cliques ou Alt+Enter abrem o mapa para edição."
            : "Selecione para ver os detalhes e as conexões deste ativo."}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            if (cluster && event.key === "Enter" && event.altKey && !linkDraftActive) onOpen?.(node);
            else onActivate?.(node.id);
          }}
          onPointerDown={(event) => onPointerDown(node.id, event)}
          onDoubleClick={
            cluster && onOpen && !linkDraftActive
              ? (event) => {
                event.stopPropagation();
                onOpen(node);
              }
              : undefined
          }
          title={label}
        >
          <span className="network-topology-node-icon">
            {cluster ? (
              node.nodeType === "group" ? <FolderTree size={22} /> : <Layers size={22} />
            ) : (
              <AssetTypeIcon type={type} size={22} />
            )}
            {!missing && !cluster ? (
              <PulseDot tone={resolveNodeStatusTone(device)} className="network-topology-node-pulse" />
            ) : null}
            {!cluster && device?.status === "problem" ? (
              <AlertTriangle size={12} className="network-topology-node-badge is-critical" />
            ) : null}
            {!cluster && device?.maintenance ? (
              <Wrench size={12} className="network-topology-node-badge is-maintenance" />
            ) : null}
          </span>
          <span className="network-topology-node-body">
            <strong className="network-topology-node-name">{label}</strong>
            {cluster ? (
              countsLabel ? <span className="network-topology-node-counts">{countsLabel}</span> : null
            ) : missing ? (
              <span className="network-topology-node-meta">Ativo removido</span>
            ) : secondaryName ? (
              <span className="network-topology-node-realname">{secondaryName}</span>
            ) : null}
            {!cluster && segmentName ? <span className="network-topology-node-segment">{segmentName}</span> : null}
          </span>
        </div>
      </foreignObject>
    </g>
  );
}

export { NODE_WIDTH, NODE_HEIGHT };
