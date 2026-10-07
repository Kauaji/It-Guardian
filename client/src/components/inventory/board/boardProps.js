// Aplica os valores padrao das props do InventoryBoard (somente quando undefined).
export function resolveBoardProps(props) {
  const pick = (key, fallback) => (props[key] === undefined ? fallback : props[key]);
  return {
    ...props,
    selectedGroupId: pick("selectedGroupId", "all"),
    selectedSegmentId: pick("selectedSegmentId", "all"),
    selectedAssetIds: pick("selectedAssetIds", new Set()),
    isBulkSelectionDragging: pick("isBulkSelectionDragging", false),
    aliases: pick("aliases", {}),
    observations: pick("observations", {}),
    groups: pick("groups", []),
    tabs: pick("tabs", []),
    floorPlansView: pick("floorPlansView", null),
    topologyView: pick("topologyView", null)
  };
}

export function pluralizeSegments(count) {
  return `${count} ${count === 1 ? "segmento" : "segmentos"}`;
}
