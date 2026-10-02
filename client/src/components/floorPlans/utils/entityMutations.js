import {
  DEFAULT_PLAN_SIZE,
  centerLinkedAssetsOnTable,
  constrainObjectToBounds,
  duplicateEditorObject,
  getActiveFloor,
  getFineSnapSize,
  isEditorObjectLocked,
  isTableObject,
  rotateEditorObject
} from "./editorGeometry.js";
import { isRoomZone, normalizeRoomZone } from "./roomGeometry.js";
import {
  attachOpeningToWall,
  isAnchoredOpening,
  removeObjectCascade,
  removeRoomCascade,
  resolveAnchoredOpening,
  syncAnchoredOpenings
} from "./wallGeometry.js";

const COLLECTION_KEYS = {
  object: "objects",
  zone: "zones",
  point: "connectionPoints"
};

/** Nome da colecao do editor que guarda entidades do tipo informado. */
export function getCollectionKey(type) {
  return COLLECTION_KEYS[type] || "cableRoutes";
}

/** Remove a entidade (e seus dependentes: aberturas de uma parede, objetos de um comodo). */
export function removeEntityFromDraft(draft, target) {
  if (target.type === "zone") {
    const cascade = removeRoomCascade(draft.objects || [], draft.zones || [], target.id);
    draft.objects = cascade.objects;
    draft.zones = cascade.zones;
    draft.connectionPoints = (draft.connectionPoints || []).filter((point) => point.metadata?.parentRoomId !== target.id);
    return draft;
  }
  const key = getCollectionKey(target.type);
  draft[key] = target.type === "object"
    ? removeObjectCascade(draft[key] || [], target.id)
    : (draft[key] || []).filter((entry) => entry.id !== target.id);
  return draft;
}

/** Remove varios objetos de uma vez (com dependentes). */
export function removeObjectsFromDraft(draft, objectIds) {
  let objects = draft.objects || [];
  for (const objectId of objectIds) objects = removeObjectCascade(objects, objectId);
  draft.objects = objects;
  return draft;
}

const GEOMETRY_KEYS = ["x", "y", "width", "height"];

function patchObject(entry, patch, draft, activeFloorId) {
  const floor = getActiveFloor(draft, activeFloorId);
  const updated = { ...entry, ...patch };
  if (isAnchoredOpening(updated)) {
    const parentWall = (draft.objects || []).find((object) => object.id === updated.metadata?.parentObjectId);
    return parentWall ? resolveAnchoredOpening(updated, parentWall) : updated;
  }
  return constrainObjectToBounds(updated, draft, floor);
}

/** Aplica um patch a entidade selecionada respeitando regras de comodo, abertura e limites. */
export function patchEntityInDraft(draft, selected, patch, activeFloorId) {
  const key = getCollectionKey(selected.type);
  draft[key] = (draft[key] || []).map((entry) => {
    if (entry.id !== selected.id) return entry;
    if (selected.type === "zone" && isRoomZone(entry) && GEOMETRY_KEYS.some((name) => patch[name] !== undefined)) {
      return normalizeRoomZone({ ...entry, geometry: { ...entry.geometry, ...patch } }, draft.plan);
    }
    if (selected.type === "object") return patchObject(entry, patch, draft, activeFloorId);
    return { ...entry, ...patch };
  });
  if (selected.type === "object") draft.objects = syncAnchoredOpenings(draft.objects || []);
  return draft;
}

/** Trava ou destrava os objetos indicados. */
export function setObjectsLockedInDraft(draft, targetIds, locked) {
  draft.objects = (draft.objects || []).map((object) => (targetIds.includes(object.id)
    ? { ...object, metadata: { ...(object.metadata || {}), locked } }
    : object));
  return draft;
}

/** Ids dos objetos que podem ser alterados (existem e nao estao travados). */
export function filterUnlockedObjectIds(objects, ids) {
  return ids.filter((objectId) => {
    const object = (objects || []).find((entry) => entry.id === objectId);
    return object && !isEditorObjectLocked(object);
  });
}

function toggledDoorMetadata(object) {
  const isSlidingDoor = ["sliding", "pocket"].includes(object.metadata?.doorType);
  return isSlidingDoor
    ? { slideDirection: object.metadata?.slideDirection === "left" ? "right" : "left" }
    : { swing: object.metadata?.swing === "outward" ? "inward" : "outward" };
}

function rotateOneObject(object, draft, draftFloor, rotatedTables) {
  const isDoor = object.objectType === "door";
  const doorMetadata = isDoor ? toggledDoorMetadata(object) : {};
  if (isAnchoredOpening(object)) {
    return isDoor ? { ...object, metadata: { ...(object.metadata || {}), ...doorMetadata } } : object;
  }
  const rotatedObject = constrainObjectToBounds({
    ...rotateEditorObject(object),
    metadata: { ...(object.metadata || {}), ...doorMetadata }
  }, draft, draftFloor);
  if (isTableObject(rotatedObject)) rotatedTables.push(rotatedObject);
  return rotatedObject;
}

/** Gira 90 graus os objetos indicados (portas alternam o sentido de abertura). */
export function rotateObjectsInDraft(draft, objectIds, activeFloorId) {
  const draftFloor = getActiveFloor(draft, activeFloorId);
  const rotatedTables = [];
  draft.objects = (draft.objects || []).map((object) => (
    objectIds.includes(object.id) ? rotateOneObject(object, draft, draftFloor, rotatedTables) : object
  ));
  for (const rotatedTable of rotatedTables) {
    draft.objects = centerLinkedAssetsOnTable(draft.objects, rotatedTable);
  }
  draft.objects = syncAnchoredOpenings(draft.objects);
  return draft;
}

/** Duplica um objeto (sem vinculo, deslocado pela grade fina) e retorna a copia no rascunho. */
export function duplicateObjectInDraft(draft, object, { id, activeFloorId }) {
  const floor = getActiveFloor(draft, activeFloorId);
  const copy = duplicateEditorObject(object, { id, offset: getFineSnapSize(draft) });
  if (!copy) return draft;
  draft.objects = [...(draft.objects || []), constrainObjectToBounds(copy, draft, floor)];
  return draft;
}

/** Move um objeto vindo da cena 3D respeitando aberturas ancoradas e mesas. */
export function moveObjectInDraft(draft, objectId, position, activeFloorId) {
  const draftFloor = getActiveFloor(draft, activeFloorId);
  let movedTable = null;
  draft.objects = (draft.objects || []).map((object) => {
    if (object.id !== objectId) return object;
    if (isAnchoredOpening(object)) {
      const parentWall = (draft.objects || []).find((entry) => entry.id === object.metadata.parentObjectId);
      if (parentWall) {
        return attachOpeningToWall(object, parentWall, {
          x: Number(position.x || 0) + Number(object.width || 0) / 2,
          y: Number(position.y || 0) + Number(object.height || 0) / 2
        });
      }
    }
    const moved = constrainObjectToBounds(object, draft, draftFloor, position);
    if (isTableObject(moved)) movedTable = moved;
    return moved;
  });
  if (movedTable) draft.objects = centerLinkedAssetsOnTable(draft.objects, movedTable);
  draft.objects = syncAnchoredOpenings(draft.objects);
  return draft;
}

export const CANVAS_EXPAND_STEP = { width: 320, height: 205 };

/** Aumenta a largura ou a altura do pavimento ativo e atualiza o tamanho do plano. */
export function expandFloorInDraft(draft, activeFloorId, axis) {
  const activeFloor = getActiveFloor(draft, activeFloorId);
  if (!activeFloor) return draft;
  const widthIncrement = axis === "width" ? CANVAS_EXPAND_STEP.width : 0;
  const heightIncrement = axis === "height" ? CANVAS_EXPAND_STEP.height : 0;
  draft.floors = (draft.floors || []).map((floorEntry) => (
    floorEntry.id === activeFloor.id
      ? {
        ...floorEntry,
        width: Number(floorEntry.width || draft.plan?.width || DEFAULT_PLAN_SIZE.width) + widthIncrement,
        height: Number(floorEntry.height || draft.plan?.height || DEFAULT_PLAN_SIZE.height) + heightIncrement
      }
      : floorEntry
  ));
  draft.plan = {
    ...draft.plan,
    width: Math.max(...draft.floors.map((floorEntry) => Number(floorEntry.width || DEFAULT_PLAN_SIZE.width))),
    height: Math.max(...draft.floors.map((floorEntry) => Number(floorEntry.height || DEFAULT_PLAN_SIZE.height)))
  };
  return draft;
}

/** Grava as configuracoes da imagem de fundo no pavimento ativo. */
export function setBackgroundSettingsInDraft(draft, activeFloorId, settings) {
  draft.floors = (draft.floors || []).map((entry) => (entry.id === activeFloorId
    ? { ...entry, metadata: { ...(entry.metadata || {}), backgroundSettings: settings } }
    : entry));
  return draft;
}
