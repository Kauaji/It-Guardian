export const WALL_OBJECT_TYPES = new Set(["wall", "divider"]);
export const OPENING_OBJECT_TYPES = new Set(["door", "window"]);

const MIN_WALL_LENGTH = 40;
const DEFAULT_WALL_THICKNESS = 12;

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value || 0), min), max);
}

function snap(value, gridSize) {
  const size = Math.max(1, Number(gridSize || 1));
  return Math.round(Number(value || 0) / size) * size;
}

export function isWallObject(object) {
  return WALL_OBJECT_TYPES.has(object?.objectType);
}

export function isOpeningObject(object) {
  return OPENING_OBJECT_TYPES.has(object?.objectType);
}

export function isAnchoredOpening(object) {
  return isOpeningObject(object) && object?.metadata?.anchorType === "wall" && Boolean(object?.metadata?.parentObjectId);
}

export function getWallSegment(wall) {
  const length = Math.max(MIN_WALL_LENGTH, Number(wall?.width || MIN_WALL_LENGTH));
  const thickness = Math.max(4, Number(wall?.height || DEFAULT_WALL_THICKNESS));
  const rotation = Number(wall?.rotation || 0);
  const radians = rotation * Math.PI / 180;
  const center = {
    x: Number(wall?.x || 0) + length / 2,
    y: Number(wall?.y || 0) + thickness / 2
  };
  const halfLength = length / 2;
  const direction = { x: Math.cos(radians), y: Math.sin(radians) };
  return {
    center,
    direction,
    length,
    thickness,
    rotation,
    start: {
      x: center.x - direction.x * halfLength,
      y: center.y - direction.y * halfLength
    },
    end: {
      x: center.x + direction.x * halfLength,
      y: center.y + direction.y * halfLength
    }
  };
}

export function snapWallEndPoint(start, end, gridSize = 5, angleStep = 45) {
  const deltaX = Number(end?.x || 0) - Number(start?.x || 0);
  const deltaY = Number(end?.y || 0) - Number(start?.y || 0);
  const rawLength = Math.hypot(deltaX, deltaY);
  const rawAngle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
  const angle = Math.round(rawAngle / angleStep) * angleStep;
  const length = Math.max(MIN_WALL_LENGTH, snap(rawLength, gridSize));
  const radians = angle * Math.PI / 180;
  return {
    x: Number(start?.x || 0) + Math.cos(radians) * length,
    y: Number(start?.y || 0) + Math.sin(radians) * length,
    angle,
    length
  };
}

export function createWallObjectFromPoints({ id, planId, floorId, item, start, end, gridSize = 5 }) {
  const snappedStart = { x: snap(Number(start?.x || 0), gridSize), y: snap(Number(start?.y || 0), gridSize) };
  const snappedEnd = snapWallEndPoint(snappedStart, end, gridSize);
  const thickness = Math.max(4, Number(item?.height || DEFAULT_WALL_THICKNESS));
  const centerX = (snappedStart.x + snappedEnd.x) / 2;
  const centerY = (snappedStart.y + snappedEnd.y) / 2;
  return {
    id,
    planId,
    floorId,
    objectType: item?.objectType || "wall",
    category: "structure",
    label: item?.label || "Parede",
    linkedAssetId: null,
    groupId: null,
    segmentId: null,
    x: centerX - snappedEnd.length / 2,
    y: centerY - thickness / 2,
    width: snappedEnd.length,
    height: thickness,
    rotation: snappedEnd.angle,
    z: 0,
    height3d: Number(item?.metadata?.wallHeight || (item?.objectType === "divider" ? 82 : 110)),
    color: item?.color || "#64748b",
    metadata: {
      ...(item?.metadata || {}),
      geometryVersion: 2,
      startPoint: snappedStart,
      endPoint: { x: snappedEnd.x, y: snappedEnd.y }
    }
  };
}

export function projectPointToWall(point, wall) {
  const segment = getWallSegment(wall);
  const fromStart = {
    x: Number(point?.x || 0) - segment.start.x,
    y: Number(point?.y || 0) - segment.start.y
  };
  const distanceAlong = fromStart.x * segment.direction.x + fromStart.y * segment.direction.y;
  const anchorOffset = clamp(distanceAlong / segment.length, 0, 1);
  const projected = {
    x: segment.start.x + segment.direction.x * segment.length * anchorOffset,
    y: segment.start.y + segment.direction.y * segment.length * anchorOffset
  };
  return {
    anchorOffset,
    point: projected,
    distance: Math.hypot(Number(point?.x || 0) - projected.x, Number(point?.y || 0) - projected.y)
  };
}

export function resolveAnchoredOpening(opening, wall) {
  if (!opening || !wall) return opening;
  const segment = getWallSegment(wall);
  const openingWidth = Math.min(Math.max(24, Number(opening.width || 72)), Math.max(24, segment.length - 12));
  const openingThickness = Math.max(segment.thickness + 4, Number(opening.height || 16));
  const edgePadding = Math.min(0.45, (openingWidth / 2 + 6) / segment.length);
  const anchorOffset = clamp(Number(opening.metadata?.anchorOffset ?? 0.5), edgePadding, 1 - edgePadding);
  const center = {
    x: segment.start.x + segment.direction.x * segment.length * anchorOffset,
    y: segment.start.y + segment.direction.y * segment.length * anchorOffset
  };
  return {
    ...opening,
    x: center.x - openingWidth / 2,
    y: center.y - openingThickness / 2,
    width: openingWidth,
    height: openingThickness,
    rotation: segment.rotation,
    metadata: {
      ...(opening.metadata || {}),
      anchoringVersion: 2,
      anchorType: "wall",
      parentObjectId: wall.id,
      anchorOffset
    }
  };
}

export function attachOpeningToWall(opening, wall, point) {
  if (!opening || !wall) return opening;
  const projection = projectPointToWall(point || {
    x: Number(opening.x || 0) + Number(opening.width || 0) / 2,
    y: Number(opening.y || 0) + Number(opening.height || 0) / 2
  }, wall);
  return resolveAnchoredOpening({
    ...opening,
    metadata: {
      ...(opening.metadata || {}),
      anchoringVersion: 2,
      anchorType: "wall",
      parentObjectId: wall.id,
      anchorOffset: projection.anchorOffset,
      anchorMetadata: {
        side: opening.metadata?.anchorMetadata?.side || "center",
        sillHeight: Number(opening.metadata?.anchorMetadata?.sillHeight ?? (opening.objectType === "window" ? 48 : 0)),
        openingHeight: Number(opening.metadata?.anchorMetadata?.openingHeight ?? (opening.objectType === "window" ? 48 : 96))
      }
    }
  }, wall);
}

export function findNearestWall(point, objects = [], floorId = null, maxDistance = 36) {
  let nearest = null;
  for (const object of objects) {
    if (!isWallObject(object) || (floorId && object.floorId !== floorId)) continue;
    const projection = projectPointToWall(point, object);
    if (projection.distance > maxDistance) continue;
    if (!nearest || projection.distance < nearest.distance) nearest = { wall: object, ...projection };
  }
  return nearest;
}

export function syncAnchoredOpenings(objects = []) {
  const walls = new Map(objects.filter(isWallObject).map((wall) => [wall.id, wall]));
  return objects.map((object) => {
    if (!isAnchoredOpening(object)) return object;
    const wall = walls.get(object.metadata.parentObjectId);
    return wall ? resolveAnchoredOpening(object, wall) : object;
  });
}

export function removeObjectCascade(objects = [], objectId) {
  return objects.filter((object) => object.id !== objectId && object.metadata?.parentObjectId !== objectId);
}
