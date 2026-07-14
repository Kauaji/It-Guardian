import { getRoomInterior, isRoomZone, normalizeRoomZone } from "./roomGeometry.js";
import { syncAnchoredOpenings } from "./wallGeometry.js";

export const DEFAULT_PLAN_SIZE = { width: 1280, height: 820, gridSize: 25, snapSize: 25 };
export const FINE_OBJECT_SNAP_SIZE = 5;
export const OBJECT_MIN_SIZE = { width: 34, height: 24 };

const TABLE_OBJECT_TYPES = new Set(["desk", "table", "meeting_table"]);
const DESKTOP_OBJECT_TYPES = new Set(["pc", "notebook"]);
const POWER_ACCESSORY_TYPES = new Set(["stabilizer_600", "stabilizer_1000", "extension_cord", "power_strip"]);

export function cloneEditor(editor) {
  return editor ? JSON.parse(JSON.stringify(editor)) : editor;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function snap(value, size = 25) {
  const numeric = Number(value);
  const snapSize = Number(size) || 1;
  return Math.round(numeric / snapSize) * snapSize;
}

export function normalizeEditorData(editorData) {
  if (!editorData?.plan) return editorData;
  const plan = { metersPerGridCell: 0.5, ...editorData.plan };
  return {
    ...editorData,
    plan,
    zones: (editorData.zones || []).map((zone) => normalizeRoomZone(zone, plan)),
    objects: syncAnchoredOpenings(centerDesktopsOnTables(editorData.objects || []))
  };
}

export function normalizeResponsePlan(payload) {
  return normalizeEditorData(payload?.plan || payload || null);
}

export function getActiveFloor(editor, activeFloorId) {
  return editor?.floors?.find((floor) => floor.id === activeFloorId) || editor?.floors?.[0] || null;
}

export function buildEditorPayload(editor) {
  return {
    plan: editor.plan,
    floors: editor.floors || [],
    zones: editor.zones || [],
    objects: editor.objects || [],
    connectionPoints: editor.connectionPoints || [],
    cableRoutes: editor.cableRoutes || []
  };
}

export function getObjectSize(object) {
  return {
    width: Number(object?.width || 80),
    height: Number(object?.height || 56)
  };
}

export function getObjectCenter(object) {
  const { width, height } = getObjectSize(object);
  return {
    x: Number(object?.x || 0) + width / 2,
    y: Number(object?.y || 0) + height / 2
  };
}

export function getFineSnapSize(editor) {
  return Math.max(FINE_OBJECT_SNAP_SIZE, Math.round(Number(editor?.plan?.snapSize || DEFAULT_PLAN_SIZE.snapSize) / 5));
}

export function isTableObject(object) {
  return TABLE_OBJECT_TYPES.has(object?.objectType);
}

export function isDesktopObject(object) {
  return DESKTOP_OBJECT_TYPES.has(object?.objectType);
}

export function isPowerAccessoryObject(object) {
  return POWER_ACCESSORY_TYPES.has(object?.objectType) || object?.metadata?.connectableToAssets;
}

export function getRoomForObject(editor, object, floor) {
  const rooms = (editor?.zones || []).filter((zone) => zone.floorId === floor?.id && isRoomZone(zone));
  const explicitRoom = rooms.find((zone) => zone.id === object?.metadata?.parentRoomId);
  if (explicitRoom) return explicitRoom;
  const center = getObjectCenter(object);
  return rooms.find((zone) => {
    const interior = getRoomInterior(zone);
    return center.x >= interior.x
      && center.x <= interior.x + interior.width
      && center.y >= interior.y
      && center.y <= interior.y + interior.height;
  }) || null;
}

export function getDefaultPlacementBounds(editor, floor) {
  const room = (editor?.zones || []).find((zone) => zone.floorId === floor?.id && isRoomZone(zone));
  if (room) {
    return { bounds: getRoomInterior(room), parentRoomId: room.id };
  }
  return {
    bounds: {
      x: 0,
      y: 0,
      width: Number(floor?.width || DEFAULT_PLAN_SIZE.width),
      height: Number(floor?.height || DEFAULT_PLAN_SIZE.height)
    },
    parentRoomId: null
  };
}

export function constrainObjectToBounds(object, editor, floor, patch = {}) {
  const next = { ...object, ...patch };
  const { width, height } = getObjectSize(next);
  const room = getRoomForObject(editor, next, floor);
  const bounds = room
    ? getRoomInterior(room)
    : {
      x: 0,
      y: 0,
      width: Number(floor?.width || DEFAULT_PLAN_SIZE.width),
      height: Number(floor?.height || DEFAULT_PLAN_SIZE.height)
    };
  const x = clamp(Number(next.x || 0), bounds.x, bounds.x + Math.max(0, bounds.width - width));
  const y = clamp(Number(next.y || 0), bounds.y, bounds.y + Math.max(0, bounds.height - height));
  return {
    ...next,
    x,
    y,
    width,
    height,
    metadata: {
      ...(next.metadata || {}),
      parentRoomId: room?.id || next.metadata?.parentRoomId || null
    }
  };
}

export function findNearestObject(source, candidates) {
  const sourceCenter = getObjectCenter(source);
  return candidates
    .map((candidate) => {
      const candidateCenter = getObjectCenter(candidate);
      return {
        candidate,
        distance: Math.hypot(sourceCenter.x - candidateCenter.x, sourceCenter.y - candidateCenter.y)
      };
    })
    .sort((a, b) => a.distance - b.distance)[0]?.candidate || null;
}

export function findNearestTable(asset, objects) {
  const roomId = asset?.metadata?.parentRoomId || null;
  const tables = (objects || []).filter((object) => isTableObject(object) && (!roomId || object.metadata?.parentRoomId === roomId));
  return findNearestObject(asset, tables);
}

export function findNearestDesktop(accessory, objects) {
  const roomId = accessory?.metadata?.parentRoomId || null;
  const desktops = (objects || []).filter((object) => isDesktopObject(object) && (!roomId || object.metadata?.parentRoomId === roomId));
  return findNearestObject(accessory, desktops);
}

export function centerAssetOnTable(asset, table) {
  if (!asset || !table) return asset;
  const assetSize = getObjectSize(asset);
  const tableSize = getObjectSize(table);
  return {
    ...asset,
    x: Number(table.x || 0) + (tableSize.width - assetSize.width) / 2,
    y: Number(table.y || 0) + (tableSize.height - assetSize.height) / 2,
    metadata: {
      ...(asset.metadata || {}),
      parentRoomId: table.metadata?.parentRoomId || asset.metadata?.parentRoomId || null,
      anchorObjectId: table.id
    }
  };
}

export function centerDesktopsOnTables(objects) {
  return (objects || []).map((object) => {
    if (!isDesktopObject(object)) return object;
    const table = findNearestTable(object, objects);
    return table ? centerAssetOnTable(object, table) : object;
  });
}

export function centerLinkedAssetsOnTable(objects, table) {
  return (objects || []).map((object) => {
    if (!isDesktopObject(object)) return object;
    const shouldFollow = object.metadata?.anchorObjectId === table.id || findNearestTable(object, objects)?.id === table.id;
    return shouldFollow ? centerAssetOnTable(object, table) : object;
  });
}

export function resizeObjectGeometry({ object, side, deltaX, deltaY, editor, floor, snapSize }) {
  const current = getObjectSize(object);
  let nextX = Number(object.x || 0);
  let nextY = Number(object.y || 0);
  let nextWidth = current.width;
  let nextHeight = current.height;
  if (side === "east") nextWidth = current.width + deltaX;
  if (side === "west") {
    nextX = Number(object.x || 0) + deltaX;
    nextWidth = current.width - deltaX;
  }
  if (side === "south") nextHeight = current.height + deltaY;
  if (side === "north") {
    nextY = Number(object.y || 0) + deltaY;
    nextHeight = current.height - deltaY;
  }
  nextWidth = Math.max(OBJECT_MIN_SIZE.width, snap(nextWidth, snapSize));
  nextHeight = Math.max(OBJECT_MIN_SIZE.height, snap(nextHeight, snapSize));
  nextX = snap(nextX, snapSize);
  nextY = snap(nextY, snapSize);
  return constrainObjectToBounds(object, editor, floor, {
    x: nextX,
    y: nextY,
    width: nextWidth,
    height: nextHeight
  });
}
