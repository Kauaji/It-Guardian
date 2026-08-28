import { getNodeDimensions } from "./networkTopologyModel.js";

export const DEFAULT_TOPOLOGY_VIEWBOX = { x: 0, y: 0, width: 1600, height: 1000 };

export function fitTopologyViewBox(nodes, aspectRatio = 1.6) {
  const positioned = nodes.filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y));
  if (!positioned.length) return { ...DEFAULT_TOPOLOGY_VIEWBOX };
  const ratio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1.6;
  const bounds = positioned.reduce((acc, node) => {
    const { width, height } = getNodeDimensions(node);
    return {
      minX: Math.min(acc.minX, node.x - width / 2),
      maxX: Math.max(acc.maxX, node.x + width / 2),
      minY: Math.min(acc.minY, node.y - height / 2),
      maxY: Math.max(acc.maxY, node.y + height / 2)
    };
  }, { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  const padding = 90;
  // Width alone clips tall layouts. Include both axes without moving nodes.
  const width = Math.max(400, bounds.maxX - bounds.minX + padding * 2, (bounds.maxY - bounds.minY + padding * 2) * ratio);
  const height = width / ratio;
  return {
    x: (bounds.minX + bounds.maxX - width) / 2,
    y: (bounds.minY + bounds.maxY - height) / 2,
    width,
    height
  };
}
