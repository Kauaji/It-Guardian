import { deriveLinkStatus, getStatusColorToken } from "./networkTopologyModel.js";

export default function NetworkTopologyLink({ link, sourceNode, targetNode, devicesById, selected, justCreated, onClick }) {
  if (!sourceNode || !targetNode) return null;

  const status = deriveLinkStatus(link, devicesById);
  const color = getStatusColorToken(status);
  const midX = (sourceNode.x + targetNode.x) / 2;
  const midY = (sourceNode.y + targetNode.y) / 2;

  return (
    <g
      className={["network-topology-link", selected && "is-selected", justCreated && "is-new"].filter(Boolean).join(" ")}
      onClick={() => onClick(link.id)}
    >
      <line
        x1={sourceNode.x}
        y1={sourceNode.y}
        x2={targetNode.x}
        y2={targetNode.y}
        stroke="transparent"
        strokeWidth={16}
      />
      <line
        x1={sourceNode.x}
        y1={sourceNode.y}
        x2={targetNode.x}
        y2={targetNode.y}
        stroke={color}
        strokeWidth={selected ? 3 : 2}
        strokeDasharray={link.type === "wifi" ? "6 4" : undefined}
      />
      {link.label ? (
        <text x={midX} y={midY - 6} textAnchor="middle" className="network-topology-link-label">
          {link.label}
        </text>
      ) : null}
    </g>
  );
}
