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

export function findNearestWallEndpoint(point, objects = [], floorId = null, excludeId = null, maxDistance = 22) {
  let nearest = null;
  for (const wall of objects) {
    if (!isWallObject(wall) || wall.id === excludeId || (floorId && wall.floorId !== floorId)) continue;
    const segment = getWallSegment(wall);
    for (const endpoint of [segment.start, segment.end]) {
      const distance = Math.hypot(Number(point?.x || 0) - endpoint.x, Number(point?.y || 0) - endpoint.y);
      if (distance <= maxDistance && (!nearest || distance < nearest.distance)) nearest = { point: endpoint, wall, distance };
    }
  }
  return nearest;
}

export function snapPointToWallEndpoints(point, objects = [], floorId = null, excludeId = null, maxDistance = 22) {
  return findNearestWallEndpoint(point, objects, floorId, excludeId, maxDistance)?.point || point;
}

export function resizeWallEndpoint(wall, side, point, objects = [], gridSize = 5) {
  if (!isWallObject(wall)) return wall;
  const segment = getWallSegment(wall);
  const moving = snapPointToWallEndpoints(point, objects, wall.floorId, wall.id);
  const start = side === "wall-start" ? moving : segment.start;
  const end = side === "wall-start" ? segment.end : moving;
  const rebuilt = createWallObjectFromPoints({
    id: wall.id,
    planId: wall.planId,
    floorId: wall.floorId,
    item: wall,
    start,
    end,
    gridSize
  });
  return {
    ...wall,
    ...rebuilt,
    metadata: { ...(wall.metadata || {}), ...(rebuilt.metadata || {}) }
  };
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

const ROOM_WALL_SIDES = ["top", "right", "bottom", "left"];

function stableUuid(value) {
  const text = String(value || "floor-plan-wall");
  const seeds = [2166136261, 2246822507, 3266489909, 668265263];
  const hex = seeds.map((seed) => {
    let hash = seed >>> 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }).join("").split("");

  hex[12] = "5";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16], 16) % 4];
  const compact = hex.join("");
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

export function getRoomWallId(roomId, side) {
  return stableUuid(`${roomId}:wall:${side}`);
}

export function createRoomWallObjects(room, planId = room?.planId) {
  const geometry = room?.geometry || {};
  const x = Number(geometry.x || 0);
  const y = Number(geometry.y || 0);
  const width = Math.max(MIN_WALL_LENGTH, Number(geometry.width || 0));
  const height = Math.max(MIN_WALL_LENGTH, Number(geometry.height || 0));
  const thickness = Math.max(4, Number(room?.metadata?.room?.wallThickness || 10));
  const wallHeight = Number(room?.metadata?.room?.wallHeight || 110);
  const segments = {
    top: [{ x, y }, { x: x + width, y }],
    right: [{ x: x + width, y }, { x: x + width, y: y + height }],
    bottom: [{ x: x + width, y: y + height }, { x, y: y + height }],
    left: [{ x, y: y + height }, { x, y }]
  };

  return ROOM_WALL_SIDES.map((side, orderIndex) => {
    const wall = createWallObjectFromPoints({
      id: getRoomWallId(room.id, side),
      planId,
      floorId: room.floorId,
      item: {
        objectType: "wall",
        label: `Parede ${side}`,
        height: thickness,
        color: "#e2e8f0",
        metadata: { wallHeight }
      },
      start: segments[side][0],
      end: segments[side][1],
      gridSize: 1
    });
    return {
      ...wall,
      orderIndex,
      metadata: {
        ...(wall.metadata || {}),
        geometryVersion: 2,
        wallHeight,
        parentRoomId: room.id,
        roomWallSide: side,
        generatedFromRoom: true
      }
    };
  });
}

export function ensureRoomWallObjects(objects = [], zones = []) {
  const rooms = zones.filter((zone) => zone?.zoneType === "room");
  const roomIds = new Set(rooms.map((room) => room.id));
  const retained = objects.filter((object) => !object.metadata?.generatedFromRoom || roomIds.has(object.metadata?.parentRoomId));
  const byId = new Map(retained.map((object) => [object.id, object]));

  for (const room of rooms) {
    for (const wall of createRoomWallObjects(room, room.planId)) {
      const existing = byId.get(wall.id);
      byId.set(wall.id, existing ? {
        ...wall,
        color: existing.color || wall.color,
        metadata: { ...(existing.metadata || {}), ...wall.metadata }
      } : wall);
    }
  }
  return [...byId.values()];
}

export function removeRoomCascade(objects = [], zones = [], roomId) {
  const roomWallIds = new Set(objects
    .filter((object) => object.metadata?.parentRoomId === roomId && object.metadata?.generatedFromRoom)
    .map((object) => object.id));
  return {
    objects: objects.filter((object) => object.metadata?.parentRoomId !== roomId && !roomWallIds.has(object.metadata?.parentObjectId)),
    zones: zones.filter((zone) => zone.id !== roomId && zone.metadata?.paintArea?.parentAreaId !== roomId)
  };
}
