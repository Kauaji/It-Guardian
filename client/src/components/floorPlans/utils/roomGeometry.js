export const ROOM_DEFAULTS = {
  shape: "rect",
  wallThickness: 10,
  wallHeight: 110,
  metersPerGridCell: 0.5
};

export function isRoomZone(zone) {
  return zone?.zoneType === "room";
}

export function getRoomMetadata(zone) {
  return {
    ...ROOM_DEFAULTS,
    ...(zone?.metadata?.room || {})
  };
}

export function normalizeRoomZone(zone, plan = {}) {
  if (!isRoomZone(zone)) return zone;
  const metadata = getRoomMetadata(zone);
  const geometry = zone.geometry || {};
  const width = Number(geometry.width || 220);
  const height = Number(geometry.height || 160);
  return {
    ...zone,
    color: zone.color || "#8b5cf6",
    geometry: {
      x: Number(geometry.x || 0),
      y: Number(geometry.y || 0),
      width,
      height
    },
    metadata: {
      ...(zone.metadata || {}),
      room: {
        ...metadata,
        metersPerGridCell: Number(metadata.metersPerGridCell || plan.metersPerGridCell || ROOM_DEFAULTS.metersPerGridCell)
      }
    }
  };
}

export function getRoomGeometry(zone) {
  const normalized = normalizeRoomZone(zone);
  return normalized.geometry;
}

export function getRoomInterior(zone) {
  const geometry = getRoomGeometry(zone);
  const { wallThickness } = getRoomMetadata(zone);
  return {
    x: geometry.x + wallThickness,
    y: geometry.y + wallThickness,
    width: Math.max(0, geometry.width - wallThickness * 2),
    height: Math.max(0, geometry.height - wallThickness * 2)
  };
}

export function getRoomWalls(zone) {
  const geometry = getRoomGeometry(zone);
  const { wallThickness } = getRoomMetadata(zone);
  return {
    north: {
      x: geometry.x,
      y: geometry.y,
      width: geometry.width,
      height: wallThickness
    },
    east: {
      x: geometry.x + geometry.width - wallThickness,
      y: geometry.y,
      width: wallThickness,
      height: geometry.height
    },
    south: {
      x: geometry.x,
      y: geometry.y + geometry.height - wallThickness,
      width: geometry.width,
      height: wallThickness
    },
    west: {
      x: geometry.x,
      y: geometry.y,
      width: wallThickness,
      height: geometry.height
    }
  };
}

export function snapToGrid(value, snapSize = 25) {
  const size = Number(snapSize) || 1;
  return Math.round(Number(value || 0) / size) * size;
}

export function clampRoomGeometry(geometry, floor, snapSize = 25) {
  const floorWidth = Number(floor?.width || 1280);
  const floorHeight = Number(floor?.height || 820);
  const width = Math.min(Number(geometry.width || 0), floorWidth);
  const height = Math.min(Number(geometry.height || 0), floorHeight);
  return {
    x: Math.min(Math.max(snapToGrid(geometry.x, snapSize), 0), floorWidth - width),
    y: Math.min(Math.max(snapToGrid(geometry.y, snapSize), 0), floorHeight - height),
    width: snapToGrid(width, snapSize),
    height: snapToGrid(height, snapSize)
  };
}

export function getRoomMeasurements(zone, plan = {}) {
  const geometry = getRoomGeometry(zone);
  const gridSize = Number(plan.gridSize || 25);
  const metersPerGridCell = Number(getRoomMetadata(zone).metersPerGridCell || plan.metersPerGridCell || ROOM_DEFAULTS.metersPerGridCell);
  const pxToMeters = (value) => (Number(value || 0) / gridSize) * metersPerGridCell;
  return {
    widthMeters: pxToMeters(geometry.width),
    heightMeters: pxToMeters(geometry.height),
    areaMeters: pxToMeters(geometry.width) * pxToMeters(geometry.height)
  };
}

export function resizeRoomGeometry({ geometry, side, deltaX, deltaY, floor, snapSize = 25, minCells = 2 }) {
  const minSize = snapSize * minCells;
  const floorWidth = Number(floor?.width || 1280);
  const floorHeight = Number(floor?.height || 820);
  let next = { ...geometry };

  if (side === "east") {
    next.width = snapToGrid(Math.max(minSize, Math.min(floorWidth - next.x, geometry.width + deltaX)), snapSize);
  }
  if (side === "south") {
    next.height = snapToGrid(Math.max(minSize, Math.min(floorHeight - next.y, geometry.height + deltaY)), snapSize);
  }
  if (side === "west") {
    const proposedX = snapToGrid(Math.max(0, geometry.x + deltaX), snapSize);
    const proposedWidth = snapToGrid(geometry.width + (geometry.x - proposedX), snapSize);
    if (proposedWidth >= minSize) {
      next.x = proposedX;
      next.width = proposedWidth;
    }
  }
  if (side === "north") {
    const proposedY = snapToGrid(Math.max(0, geometry.y + deltaY), snapSize);
    const proposedHeight = snapToGrid(geometry.height + (geometry.y - proposedY), snapSize);
    if (proposedHeight >= minSize) {
      next.y = proposedY;
      next.height = proposedHeight;
    }
  }

  return clampRoomGeometry(next, floor, snapSize);
}

export function isRoomPlacementValid(geometry, floor, zones = [], ignoredZoneId = null) {
  const floorWidth = Number(floor?.width || 1280);
  const floorHeight = Number(floor?.height || 820);
  if (geometry.x < 0 || geometry.y < 0 || geometry.x + geometry.width > floorWidth || geometry.y + geometry.height > floorHeight) return false;

  return !(zones || []).some((zone) => {
    if (!isRoomZone(zone) || zone.id === ignoredZoneId) return false;
    const other = getRoomGeometry(zone);
    return (
      geometry.x < other.x + other.width &&
      geometry.x + geometry.width > other.x &&
      geometry.y < other.y + other.height &&
      geometry.y + geometry.height > other.y
    );
  });
}

export function rotateRoomSize(width, height, rotation = 0) {
  const normalized = ((Number(rotation) % 180) + 180) % 180;
  return normalized === 90 ? { width: height, height: width } : { width, height };
}
