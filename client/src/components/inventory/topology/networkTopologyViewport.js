import { getNodeDimensions } from "./networkTopologyModel.js";

export const DEFAULT_TOPOLOGY_VIEWBOX = { x: 0, y: 0, width: 1600, height: 1000 };
export const MIN_TOPOLOGY_VIEWBOX_WIDTH = 400;
export const MAX_TOPOLOGY_VIEWBOX_WIDTH = 6000;

const WHEEL_LINE_HEIGHT = 16;
const MAX_WHEEL_STEP = 120;
const WHEEL_ZOOM_SENSITIVITY = 0.0005;

export function normalizeTopologyWheelDelta(deltaY, deltaMode = 0, pageHeight = 800) {
  if (!Number.isFinite(deltaY)) return 0;
  const safePageHeight = Number.isFinite(pageHeight) && pageHeight > 0 ? pageHeight : 800;
  const unit = deltaMode === 1 ? WHEEL_LINE_HEIGHT : deltaMode === 2 ? safePageHeight : 1;
  return Math.max(-MAX_WHEEL_STEP, Math.min(MAX_WHEEL_STEP, deltaY * unit));
}

export function zoomTopologyViewBox(current, anchor, wheelDelta) {
  if (!Number.isFinite(wheelDelta) || wheelDelta === 0) return current;
  // A normal mouse step changes the scale by about 5–6%; small trackpad deltas
  // remain proportional instead of taking a whole mouse step on every event.
  const boundedDelta = Math.max(-MAX_WHEEL_STEP, Math.min(MAX_WHEEL_STEP, wheelDelta));
  const width = Math.min(MAX_TOPOLOGY_VIEWBOX_WIDTH, Math.max(
    MIN_TOPOLOGY_VIEWBOX_WIDTH,
    current.width * Math.exp(boundedDelta * WHEEL_ZOOM_SENSITIVITY)
  ));
  if (width === current.width) return current;
  const height = width * current.height / current.width;
  const ratioX = (anchor.x - current.x) / current.width;
  const ratioY = (anchor.y - current.y) / current.height;
  return { x: anchor.x - ratioX * width, y: anchor.y - ratioY * height, width, height };
}

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
