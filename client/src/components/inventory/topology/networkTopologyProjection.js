import { topologyNodeKey } from "./networkTopologyConnections.js";
import { isTopologySegmentEligible } from "./networkTopologyHierarchy.js";

/**
 * Inventory owns map membership. Saved nodes supply positions and labels;
 * these deterministic defaults keep every eligible inventory item visible.
 * No API calls, synthetic devices or inferred network links belong here.
 */
export function getTopologySegments(tree) {
  return [
    ...tree.groups.flatMap((group) => group.segments),
    ...tree.ungroupedSegments
  ].filter(isTopologySegmentEligible);
}

export function buildInventoryTopologyNodes({ tree, viewLevel, selectedGroupId, selectedSegmentId }) {
  let entries = [];
  if (viewLevel === "tab") {
    entries = [
      ...tree.groups.map((group) => ({ nodeType: "group", entity: group })),
      ...tree.ungroupedSegments.filter(isTopologySegmentEligible)
        .map((segment) => ({ nodeType: "segment", entity: segment }))
    ];
  } else if (viewLevel === "group") {
    entries = (tree.groups.find((group) => group.id === selectedGroupId)?.segments || [])
      .filter(isTopologySegmentEligible)
      .map((segment) => ({ nodeType: "segment", entity: segment }));
  } else if (viewLevel === "segment") {
    entries = (getTopologySegments(tree).find((segment) => segment.id === selectedSegmentId)?.devices || [])
      .map((device) => ({ nodeType: "asset", entity: device }));
  }

  const columns = Math.max(1, Math.min(5, Math.ceil(Math.sqrt(entries.length))));
  const rows = Math.ceil(entries.length / columns);
  return entries.map(({ nodeType, entity }, index) => ({
    id: `inventory-default:${nodeType}:${entity.id}`,
    nodeType,
    assetId: nodeType === "asset" ? entity.id : null,
    refId: nodeType === "asset" ? null : entity.id,
    x: 800 + ((index % columns) - (columns - 1) / 2) * 230,
    y: 500 + (Math.floor(index / columns) - (rows - 1) / 2) * 185,
    automatic: true
  }));
}

export function resolveTopologyDisplayNodes(savedNodes = [], inventoryNodes = []) {
  if (!savedNodes.length || !inventoryNodes.length) return inventoryNodes;
  const savedByKey = new Map(savedNodes.map((node) => [topologyNodeKey(node), node]));
  // Omit old/out-of-scope nodes only from this projection. The original nodes
  // and their connections remain untouched, including every saved metadata field.
  return inventoryNodes.map((node) => savedByKey.get(topologyNodeKey(node)) || node);
}
