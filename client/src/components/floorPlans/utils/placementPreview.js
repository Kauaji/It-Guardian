import {
  DEFAULT_PLAN_SIZE,
  centerAssetOnTable,
  findNearestTable,
  getFineSnapSize,
  getObjectSize,
  getRoomForObject,
  isDesktopObject,
  isPowerAccessoryObject,
  isTableObject,
  snap
} from "./editorGeometry.js";
import {
  clampRoomGeometry,
  getRoomGeometry,
  isRoomPlacementValid,
  isRoomZone,
  normalizeRoomZone,
  rotateRoomSize,
  snapToGrid
} from "./roomGeometry.js";
import { isOpeningObject, isWallObject } from "./wallGeometry.js";

const PLACEMENT_OK = "Clique para posicionar";

function isInsideRect(rect, { x, y, width, height }) {
  return x >= rect.x && y >= rect.y && x + width <= rect.x + rect.width && y + height <= rect.y + rect.height;
}

function buildPointPreview(item, snappedPoint, floorSize) {
  const valid = snappedPoint.x >= 0 && snappedPoint.x <= floorSize.width
    && snappedPoint.y >= 0 && snappedPoint.y <= floorSize.height;
  return { type: "point", point: snappedPoint, color: item.color, valid, reason: valid ? PLACEMENT_OK : "Fora dos limites da planta" };
}

function buildRoutePreview(item, snappedPoint, floorSize, fineSnapSize) {
  const path = [
    { x: snap(snappedPoint.x - 90, fineSnapSize), y: snappedPoint.y },
    { x: snap(snappedPoint.x + 90, fineSnapSize), y: snappedPoint.y }
  ];
  const valid = path.every((entry) => entry.x >= 0 && entry.x <= floorSize.width && entry.y >= 0 && entry.y <= floorSize.height);
  return { type: "route", point: snappedPoint, path, color: item.color, valid, reason: valid ? PLACEMENT_OK : "O trecho ultrapassa a planta" };
}

function collidesWithObjects(candidate, floor, objects) {
  const { width, height } = getObjectSize(candidate);
  return objects.some((object) => {
    if (object.floorId !== floor.id || isWallObject(object) || isOpeningObject(object)) return false;
    if (isDesktopObject(candidate) && isTableObject(object)) return false;
    if (isPowerAccessoryObject(candidate) && isDesktopObject(object)) return false;
    const otherSize = getObjectSize(object);
    return candidate.x < Number(object.x || 0) + otherSize.width
      && candidate.x + width > Number(object.x || 0)
      && candidate.y < Number(object.y || 0) + otherSize.height
      && candidate.y + height > Number(object.y || 0);
  });
}

function getPlacementFailure({ withinFloor, withinRoom, collides }) {
  if (!withinFloor) return "Fora dos limites da planta";
  if (!withinRoom) return "Posicione o item inteiramente dentro de um cômodo";
  if (collides) return "Este item colide com outro objeto";
  return PLACEMENT_OK;
}

function buildObjectPreview({ editor, floor, item, snappedPoint, floorSize, fineSnapSize }) {
  const width = Number(item.width || 80);
  const height = Number(item.height || 56);
  const rawObject = {
    objectType: item.objectType || item.id,
    category: item.category || "asset",
    label: item.label,
    x: snap(snappedPoint.x - width / 2, fineSnapSize),
    y: snap(snappedPoint.y - height / 2, fineSnapSize),
    width,
    height,
    rotation: 0,
    color: item.color || "#1f7a61",
    metadata: { ...(item.metadata || {}) }
  };
  const candidate = isDesktopObject(rawObject)
    ? centerAssetOnTable(rawObject, findNearestTable(rawObject, editor.objects || []))
    : rawObject;
  const withinFloor = isInsideRect({ x: 0, y: 0, ...floorSize }, { x: candidate.x, y: candidate.y, width, height });
  const rooms = (editor.zones || []).filter((zone) => zone.floorId === floor.id && isRoomZone(zone));
  const room = getRoomForObject(editor, candidate, floor);
  const withinRoom = !rooms.length || Boolean(room && isInsideRect(getRoomGeometry(room), { x: candidate.x, y: candidate.y, width, height }));
  const collides = collidesWithObjects(candidate, floor, editor.objects || []);
  const valid = withinFloor && withinRoom && !collides;
  const reason = getPlacementFailure({ withinFloor, withinRoom, collides });
  return { type: "object", point: snappedPoint, object: candidate, valid, reason };
}

/**
 * Pre-visualizacao do posicionamento de um item do catalogo (ponto, rota ou
 * objeto) sob o cursor, com validacao de limites, comodo e colisao.
 */
export function buildCatalogPlacementPreview({ editor, floor, item, point }) {
  if (!floor || !item || !point) return null;
  const fineSnapSize = getFineSnapSize(editor);
  const floorSize = {
    width: Number(floor.width || editor?.plan?.width || DEFAULT_PLAN_SIZE.width),
    height: Number(floor.height || editor?.plan?.height || DEFAULT_PLAN_SIZE.height)
  };
  const snappedPoint = { x: snap(point.x, fineSnapSize), y: snap(point.y, fineSnapSize) };
  if (item.category === "point") return buildPointPreview(item, snappedPoint, floorSize);
  if (item.category === "route") return buildRoutePreview(item, snappedPoint, floorSize, fineSnapSize);
  return buildObjectPreview({ editor, floor, item, snappedPoint, floorSize, fineSnapSize });
}

function createRoomPreview({ editor, floor, template, geometry, rotation }) {
  const zone = normalizeRoomZone({
    id: "placement-preview",
    planId: editor.plan.id,
    floorId: floor.id,
    zoneType: "room",
    name: template.label,
    color: template.color,
    geometry,
    metadata: {
      room: {
        templateId: template.id,
        shape: "rect",
        rotation,
        wallThickness: 10,
        wallHeight: 110,
        metersPerGridCell: editor.plan.metersPerGridCell || 0.5
      }
    }
  }, editor.plan);
  return {
    zone,
    geometry,
    valid: isRoomPlacementValid(geometry, floor, editor.zones || []),
    rotation
  };
}

/** Pre-visualizacao de um comodo do modelo centralizado no ponto (clique simples). */
export function buildRoomPlacementPreview({ editor, floor, template, point, rotation = 0 }) {
  if (!floor || !template) return null;
  const snapSize = editor?.plan?.snapSize || DEFAULT_PLAN_SIZE.snapSize;
  const size = rotateRoomSize(template.width, template.height, rotation);
  const geometry = clampRoomGeometry({
    x: snapToGrid(point.x - size.width / 2, snapSize),
    y: snapToGrid(point.y - size.height / 2, snapSize),
    width: size.width,
    height: size.height
  }, floor, snapSize);
  return createRoomPreview({ editor, floor, template, geometry, rotation });
}

/**
 * Pre-visualizacao de um comodo desenhado arrastando do inicio ao fim; um
 * arrasto curto equivale ao clique simples do modelo.
 */
export function buildDraggedRoomPreview({ editor, floor, template, start, end, rotation = 0 }) {
  if (!floor || !template || !start || !end) return null;
  const snapSize = editor?.plan?.snapSize || DEFAULT_PLAN_SIZE.snapSize;
  const defaultSize = rotateRoomSize(template.width, template.height, rotation);
  const snappedStart = { x: snapToGrid(start.x, snapSize), y: snapToGrid(start.y, snapSize) };
  const snappedEnd = { x: snapToGrid(end.x, snapSize), y: snapToGrid(end.y, snapSize) };
  const draggedWidth = Math.abs(snappedEnd.x - snappedStart.x);
  const draggedHeight = Math.abs(snappedEnd.y - snappedStart.y);

  if (draggedWidth < snapSize * 2 && draggedHeight < snapSize * 2) {
    return buildRoomPlacementPreview({ editor, floor, template, point: start, rotation });
  }

  const geometry = clampRoomGeometry({
    x: Math.min(snappedStart.x, snappedEnd.x),
    y: Math.min(snappedStart.y, snappedEnd.y),
    width: Math.max(defaultSize.width, draggedWidth),
    height: Math.max(defaultSize.height, draggedHeight)
  }, floor, snapSize);
  return createRoomPreview({ editor, floor, template, geometry, rotation });
}
