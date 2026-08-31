import { isClusterNode, resolveEntityLabel } from "./networkTopologyModel.js";

export function topologyNodeKey(node) {
  if (!node) return null;
  return `${node.nodeType || "asset"}:${node.assetId ?? node.refId}`;
}

export function topologyLinkKey(link, side) {
  return `${link[`${side}Type`] || "asset"}:${link[`${side}AssetId`]}`;
}

export function linkConnectsNodes(link, first, second) {
  const a = topologyNodeKey(first);
  const b = topologyNodeKey(second);
  const source = topologyLinkKey(link, "source");
  const target = topologyLinkKey(link, "target");
  return (source === a && target === b) || (source === b && target === a);
}

export function hasTopologyConnectionPair(nodes = []) {
  const countsByType = new Map();
  for (const node of nodes) {
    const type = node?.nodeType || "asset";
    const nextCount = (countsByType.get(type) || 0) + 1;
    if (nextCount >= 2) return true;
    countsByType.set(type, nextCount);
  }
  return false;
}

export function hasTopologyConnectionPartner(nodes = [], node) {
  if (!node) return false;
  const type = node.nodeType || "asset";
  const key = topologyNodeKey(node);
  return nodes.some((candidate) =>
    candidate &&
    (candidate.nodeType || "asset") === type &&
    topologyNodeKey(candidate) !== key
  );
}

export function buildTopologyLinkPayload(first, second) {
  // Connections are undirected. A stable endpoint order also avoids creating
  // the same pair in reverse from two clients using this flow.
  const [source, target] = [first, second].sort((a, b) => topologyNodeKey(a).localeCompare(topologyNodeKey(b)));
  return {
    sourceType: source.nodeType || "asset",
    sourceAssetId: source.assetId ?? source.refId,
    targetType: target.nodeType || "asset",
    targetAssetId: target.assetId ?? target.refId
  };
}

export function clusterDevices(clusterInfo, nodeType) {
  const devices = nodeType === "group"
    ? (clusterInfo?.segments || []).flatMap((segment) => segment.devices || [])
    : clusterInfo?.devices || [];
  return [...new Map(devices.map((device) => [device.id, device])).values()]
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR"));
}

export function inspectorConnections({ node, links = [], internalLinks = [], devicesById, clustersById, clusterName }) {
  const entityName = (link, side) => {
    const type = link[`${side}Type`] || "asset";
    const id = link[`${side}AssetId`];
    return resolveEntityLabel(type, type === "asset" ? devicesById.get(id) : clustersById.get(id));
  };
  const describe = (link, scopeLabel) => ({
    id: link.id, label: link.label, type: link.type, scopeLabel,
    sourceName: entityName(link, "source"), targetName: entityName(link, "target")
  });
  const key = topologyNodeKey(node);
  const result = links
    .filter((link) => topologyLinkKey(link, "source") === key || topologyLinkKey(link, "target") === key)
    .map((link) => describe(link, "Neste mapa"));
  if (isClusterNode(node)) {
    result.push(...internalLinks.map((link) => describe(link, `Dentro de ${clusterName || "este item"}`)));
  }
  return [...new Map(result.map((link) => [link.id, link])).values()];
}
