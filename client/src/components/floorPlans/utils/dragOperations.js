import {
  DEFAULT_PLAN_SIZE,
  centerLinkedAssetsOnTable,
  clamp,
  constrainObjectToBounds,
  getActiveFloor,
  getFineSnapSize,
  isTableObject,
  resizeObjectGeometry,
  snap,
  snapObjectToAlignment
} from "./editorGeometry.js";
import { isRoomZone, normalizeRoomZone, resizeRoomGeometry } from "./roomGeometry.js";
import {
  attachOpeningToWall,
  isAnchoredOpening,
  isWallObject,
  resizeWallEndpoint,
  syncAnchoredOpenings
} from "./wallGeometry.js";

const OBJECT_SNAP_DRAGS = ["object", "object-resize", "point"];

/** Passo de grade do arrasto: fino para objetos e pontos, grade do plano para comodos. */
export function getDragSnapSize(drag, editor) {
  return OBJECT_SNAP_DRAGS.includes(drag.type)
    ? getFineSnapSize(editor)
    : editor?.plan?.snapSize || 25;
}

/** Deslocamento (ja ajustado a grade) do arrasto em relacao a origem. */
export function computeDragDeltas(drag, point, snapSize) {
  const nextX = snap(drag.originX + point.x - drag.startX, snapSize);
  const nextY = snap(drag.originY + point.y - drag.startY, snapSize);
  return { nextX, nextY, deltaX: nextX - drag.originX, deltaY: nextY - drag.originY };
}

/**
 * Deslocamento final dos objetos arrastados, imantando em alinhamentos de
 * outros objetos (a menos que Alt esteja pressionado). Retorna tambem as guias.
 */
export function computeObjectDragAlignment({ drag, deltas, editor, floor, snapSize, altKey }) {
  if (drag.type !== "object" || !drag.originObject || altKey) {
    return { objectDeltaX: deltas.deltaX, objectDeltaY: deltas.deltaY, guides: [] };
  }
  const aligned = snapObjectToAlignment({
    object: drag.originObject,
    proposedX: Number(drag.originObject.x || 0) + deltas.deltaX,
    proposedY: Number(drag.originObject.y || 0) + deltas.deltaY,
    objects: editor?.objects || [],
    floor,
    excludedIds: (drag.selectedObjectOrigins || []).map((object) => object.id),
    threshold: Math.max(5, snapSize)
  });
  return {
    objectDeltaX: aligned.x - Number(drag.originObject.x || 0),
    objectDeltaY: aligned.y - Number(drag.originObject.y || 0),
    guides: aligned.guides
  };
}

function getDragOrigins(drag) {
  return drag.selectedObjectOrigins?.length ? drag.selectedObjectOrigins : [drag.originObject].filter(Boolean);
}

function moveOneObject({ object, origins, draft, draftFloor, objectDelta, movedTables }) {
  const objectOrigin = origins.find((entry) => entry.id === object.id) || object;
  const proposedX = Number(objectOrigin.x || 0) + objectDelta.x;
  const proposedY = Number(objectOrigin.y || 0) + objectDelta.y;
  if (isAnchoredOpening(object)) {
    const parentWall = (draft.objects || []).find((entry) => entry.id === object.metadata.parentObjectId);
    if (parentWall) {
      return attachOpeningToWall(object, parentWall, {
        x: proposedX + Number(object.width || 0) / 2,
        y: proposedY + Number(object.height || 0) / 2
      });
    }
  }
  const movedObject = constrainObjectToBounds(object, draft, draftFloor, { x: proposedX, y: proposedY });
  if (isTableObject(movedObject)) movedTables.push(movedObject);
  return movedObject;
}

function applyObjectDrag(draft, drag, ctx) {
  const draftFloor = getActiveFloor(draft, ctx.activeFloorId) || ctx.floor;
  const origins = getDragOrigins(drag);
  const selectedIds = new Set(origins.map((object) => object.id));
  const movedTables = [];
  const objectDelta = { x: ctx.objectDeltaX, y: ctx.objectDeltaY };
  draft.objects = (draft.objects || []).map((object) => (
    selectedIds.has(object.id)
      ? moveOneObject({ object, origins, draft, draftFloor, objectDelta, movedTables })
      : object
  ));
  for (const movedTable of movedTables) {
    draft.objects = centerLinkedAssetsOnTable(draft.objects, movedTable);
  }
  draft.objects = syncAnchoredOpenings(draft.objects);
}

/** Desloca objetos e pontos filhos de um comodo pela variacao aplicada ao comodo. */
function shiftRoomChildren(draft, drag, deltaX, deltaY) {
  draft.objects = (draft.objects || []).map((object) => {
    const origin = drag.childObjects.find((entry) => entry.id === object.id);
    return origin ? { ...object, x: origin.x + deltaX, y: origin.y + deltaY } : object;
  });
  draft.objects = syncAnchoredOpenings(draft.objects);
  draft.connectionPoints = (draft.connectionPoints || []).map((pointEntry) => {
    const origin = drag.childPoints.find((entry) => entry.id === pointEntry.id);
    return origin ? { ...pointEntry, x: origin.x + deltaX, y: origin.y + deltaY } : pointEntry;
  });
}

function applyZoneDrag(draft, drag, ctx) {
  const { floor, nextX, nextY } = ctx;
  let movedRoom = false;
  let appliedDeltaX = ctx.deltaX;
  let appliedDeltaY = ctx.deltaY;
  draft.zones = draft.zones.map((zone) => {
    if (zone.id !== drag.id) return zone;
    const geometry = {
      ...zone.geometry,
      x: clamp(nextX, 0, (floor?.width || DEFAULT_PLAN_SIZE.width) - (zone.geometry?.width || 180)),
      y: clamp(nextY, 0, (floor?.height || DEFAULT_PLAN_SIZE.height) - (zone.geometry?.height || 120))
    };
    movedRoom = isRoomZone(zone);
    appliedDeltaX = geometry.x - Number(drag.originGeometry?.x || 0);
    appliedDeltaY = geometry.y - Number(drag.originGeometry?.y || 0);
    return normalizeRoomZone({ ...zone, geometry }, draft.plan);
  });
  if (movedRoom) shiftRoomChildren(draft, drag, appliedDeltaX, appliedDeltaY);
}

function applyRoomResizeDrag(draft, drag, ctx) {
  const resized = resizeRoomGeometry({
    geometry: drag.originGeometry,
    side: drag.side,
    deltaX: ctx.point.x - drag.startX,
    deltaY: ctx.point.y - drag.startY,
    floor: ctx.floor,
    snapSize: ctx.snapSize
  });
  draft.zones = draft.zones.map((zone) => (
    zone.id === drag.id ? normalizeRoomZone({ ...zone, geometry: resized }, draft.plan) : zone
  ));
  shiftRoomChildren(draft, drag, resized.x - drag.originGeometry.x, resized.y - drag.originGeometry.y);
}

function applyObjectResizeDrag(draft, drag, ctx) {
  const draftFloor = getActiveFloor(draft, ctx.activeFloorId) || ctx.floor;
  let resizedObject = null;
  draft.objects = (draft.objects || []).map((object) => {
    if (object.id !== drag.id) return object;
    const source = drag.originObject || object;
    resizedObject = isWallObject(source)
      ? resizeWallEndpoint(source, drag.side, ctx.point, draft.objects || [], ctx.snapSize)
      : resizeObjectGeometry({
        object: source,
        side: drag.side,
        deltaX: ctx.point.x - drag.startX,
        deltaY: ctx.point.y - drag.startY,
        editor: draft,
        floor: draftFloor,
        snapSize: ctx.snapSize,
        preserveAspectRatio: Boolean(ctx.shiftKey)
      });
    return resizedObject;
  });
  if (resizedObject && isTableObject(resizedObject)) {
    draft.objects = centerLinkedAssetsOnTable(draft.objects, resizedObject);
  }
  draft.objects = syncAnchoredOpenings(draft.objects);
}

function applyPointDrag(draft, drag, ctx) {
  const { floor, nextX, nextY } = ctx;
  draft.connectionPoints = draft.connectionPoints.map((pointEntry) => (
    pointEntry.id === drag.id
      ? {
        ...pointEntry,
        x: clamp(nextX, 0, floor?.width || DEFAULT_PLAN_SIZE.width),
        y: clamp(nextY, 0, floor?.height || DEFAULT_PLAN_SIZE.height)
      }
      : pointEntry
  ));
}

const DRAG_APPLIERS = {
  object: applyObjectDrag,
  zone: applyZoneDrag,
  "room-resize": applyRoomResizeDrag,
  "object-resize": applyObjectResizeDrag,
  point: applyPointDrag
};

/**
 * Aplica o movimento corrente do arrasto ao rascunho do editor. `ctx` reune o
 * ponto atual, os deslocamentos, o pavimento e o passo de grade.
 */
export function applyDragToDraft(draft, drag, ctx) {
  DRAG_APPLIERS[drag.type]?.(draft, drag, ctx);
  return draft;
}
