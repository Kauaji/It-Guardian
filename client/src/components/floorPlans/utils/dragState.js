import { isEditorObjectLocked } from "./editorGeometry.js";
import { getRoomGeometry, isRoomZone } from "./roomGeometry.js";

/** Estado de um arrasto de pan (botao do meio/direito ou espaco + clique). */
export function createPanDrag({ clientX, clientY, viewBox }) {
  return { type: "pan", clientX, clientY, viewBox };
}

/** Estado de um arrasto de selecao por retangulo. */
export function createMarqueeDrag(point, additive) {
  return { type: "marquee", startX: point.x, startY: point.y, additive };
}

function copyEntities(entities, predicate) {
  return (entities || []).filter(predicate).map((entry) => ({ ...entry }));
}

function getDragChildren(editor, zoneId) {
  return {
    childObjects: copyEntities(editor.objects, (object) => object.metadata?.parentRoomId === zoneId),
    childPoints: copyEntities(editor.connectionPoints, (point) => point.metadata?.parentRoomId === zoneId)
  };
}

/** Entidade (objeto, comodo ou ponto) que sera arrastada, ou undefined. */
export function findDraggableEntity(editor, type, id) {
  const collection = type === "object" ? editor.objects : type === "zone" ? editor.zones : editor.connectionPoints;
  return collection.find((entry) => entry.id === id);
}

/** Ids dos objetos que acompanham o arrasto (a selecao atual ou so o objeto clicado). */
export function getDragObjectIds(type, id, selectedObjectIds) {
  if (type !== "object") return [];
  return selectedObjectIds.includes(id) ? selectedObjectIds : [id];
}

/** Estado de arrasto de um objeto, comodo ou ponto (com origens para mover em grupo). */
export function createEntityDrag({ editor, type, id, entity, point, objectIds }) {
  const origin = type === "zone" ? entity.geometry || {} : entity;
  const isRoom = type === "zone" && isRoomZone(entity);
  const children = isRoom ? getDragChildren(editor, id) : { childObjects: [], childPoints: [] };
  return {
    id,
    type,
    startX: point.x,
    startY: point.y,
    originX: origin.x || 0,
    originY: origin.y || 0,
    originObject: type === "object" ? { ...entity } : null,
    selectedObjectOrigins:
      type === "object" ? copyEntities(editor.objects, (object) => objectIds.includes(object.id) && !isEditorObjectLocked(object)) : [],
    originGeometry: type === "zone" ? getRoomGeometry(entity) : null,
    ...children
  };
}

/** Estado de redimensionamento de um comodo pela alca `side`. */
export function createRoomResizeDrag({ editor, zone, side, point }) {
  return {
    id: zone.id,
    type: "room-resize",
    side,
    startX: point.x,
    startY: point.y,
    originX: zone.geometry?.x || 0,
    originY: zone.geometry?.y || 0,
    originGeometry: getRoomGeometry(zone),
    ...getDragChildren(editor, zone.id)
  };
}

/** Estado de redimensionamento de um objeto pela alca `side`. */
export function createObjectResizeDrag({ object, side, point }) {
  return {
    id: object.id,
    type: "object-resize",
    side,
    startX: point.x,
    startY: point.y,
    originX: object.x || 0,
    originY: object.y || 0,
    originObject: { ...object }
  };
}
