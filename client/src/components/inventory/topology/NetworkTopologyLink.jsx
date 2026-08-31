import { deriveLinkStatus, getStatusColorToken, resolveEntityLabel } from "./networkTopologyModel.js";

export default function NetworkTopologyLink({
  link,
  sourceNode,
  targetNode,
  devicesById,
  clusterSummaryByRefId,
  selected,
  justCreated,
  onClick
}) {
  if (!sourceNode || !targetNode) return null;

  const status = deriveLinkStatus(link, devicesById, clusterSummaryByRefId);
  const color = getStatusColorToken(status);
  const midX = (sourceNode.x + targetNode.x) / 2;
  const midY = (sourceNode.y + targetNode.y) / 2;
  const endpointName = (side) => {
    const type = link[`${side}Type`] || "asset";
    const id = link[`${side}AssetId`];
    return resolveEntityLabel(type, type === "asset" ? devicesById.get(id) : clusterSummaryByRefId?.get(id));
  };

  return (
    <g
      className={["network-topology-link", selected && "is-selected", justCreated && "is-new"].filter(Boolean).join(" ")}
      role="button"
      tabIndex={0}
      aria-label={`Conexão entre ${endpointName("source")} e ${endpointName("target")}${link.label ? `: ${link.label}` : ""}`}
      onClick={(event) => { event.stopPropagation(); onClick(link.id); }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onClick(link.id);
      }}
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
