/**
 * An empty saved map is not an empty inventory. These local-only nodes make
 * existing groups, segments and devices navigable before a layout is saved.
 * No API calls, synthetic devices or inferred network links belong here.
 */
export function getTopologySegments(tree) {
  return [
    ...tree.groups.flatMap((group) => group.segments),
    ...tree.ungroupedSegments,
    ...(tree.maintenanceSegments || [])
  ];
}

export function buildInventoryTopologyPreview({ tree, viewLevel, selectedGroupId, selectedSegmentId }) {
  let entries = [];
  if (viewLevel === "tab") {
    entries = [
      ...tree.groups.map((group) => ({ nodeType: "group", entity: group })),
      ...[...tree.ungroupedSegments, ...(tree.maintenanceSegments || [])]
        .map((segment) => ({ nodeType: "segment", entity: segment }))
    ];
  } else if (viewLevel === "group") {
    entries = (tree.groups.find((group) => group.id === selectedGroupId)?.segments || [])
      .map((segment) => ({ nodeType: "segment", entity: segment }));
  } else if (viewLevel === "segment") {
    entries = (getTopologySegments(tree).find((segment) => segment.id === selectedSegmentId)?.devices || [])
      .map((device) => ({ nodeType: "asset", entity: device }));
  }

  const columns = Math.max(1, Math.min(5, Math.ceil(Math.sqrt(entries.length))));
  const rows = Math.ceil(entries.length / columns);
  return entries.map(({ nodeType, entity }, index) => ({
    id: `inventory-preview:${nodeType}:${entity.id}`,
    nodeType,
    assetId: nodeType === "asset" ? entity.id : null,
    refId: nodeType === "asset" ? null : entity.id,
    x: 800 + ((index % columns) - (columns - 1) / 2) * 230,
    y: 500 + (Math.floor(index / columns) - (rows - 1) / 2) * 185,
    preview: true
  }));
}

export function resolveTopologyDisplayNodes(savedNodes, previewNodes) {
  // Never merge the preview into a user's saved map or overwrite its layout.
  return savedNodes.length ? savedNodes : previewNodes;
}
