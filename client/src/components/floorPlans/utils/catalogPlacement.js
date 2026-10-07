import { getFloorPlanLibraryAsset } from "../assets/floorPlanLibrary.js";
import {
  centerAssetOnTable,
  constrainObjectToBounds,
  findNearestTable,
  getFineSnapSize,
  getRoomForObject,
  isDesktopObject,
  snap
} from "./editorGeometry.js";

/** Altura 3D padrao de um item do catalogo (biblioteca, categoria ou 42). */
export function resolveCatalogHeight3d(item = {}) {
  const libraryAsset = getFloorPlanLibraryAsset(item.objectType || item.id);
  const declaredHeight = Number(item.height3d ?? libraryAsset?.dimensions?.height);
  if (Number.isFinite(declaredHeight) && declaredHeight > 0) return declaredHeight;
  if (item.category === "asset") return 56;
  if (item.category === "structure") return 92;
  return 42;
}

function createConnectionPoint({ draft, floor, item, targetPoint, parentRoomId, fineSnapSize, createId }) {
  return {
    id: createId("point"),
    planId: draft.plan.id,
    floorId: floor.id,
    pointType: item.pointType,
    label: item.label,
    linkedObjectId: null,
    x: snap(targetPoint.x, fineSnapSize),
    y: snap(targetPoint.y, fineSnapSize),
    metadata: { parentRoomId }
  };
}

function createCableRoute({ draft, floor, item, targetPoint, candidate, parentRoomId, fineSnapSize, createId }) {
  return {
    id: createId("route"),
    planId: draft.plan.id,
    floorId: floor.id,
    routeType: item.routeType,
    label: item.label,
    sourcePointId: null,
    targetPointId: null,
    path: [
      ...(candidate?.path || [
        { x: snap(targetPoint.x - 90, fineSnapSize), y: snap(targetPoint.y, fineSnapSize) },
        { x: snap(targetPoint.x + 90, fineSnapSize), y: snap(targetPoint.y, fineSnapSize) }
      ])
    ],
    color: item.color,
    metadata: { ...(item.metadata || {}), parentRoomId }
  };
}

function createCatalogObject({ draft, floor, item, targetPoint, candidate, parentRoomId, fineSnapSize, createId }) {
  const object = {
    id: createId("object"),
    planId: draft.plan.id,
    floorId: floor.id,
    objectType: item.objectType || item.id,
    category: item.category || "asset",
    label: item.label,
    linkedAssetId: null,
    groupId: null,
    segmentId: null,
    x: candidate?.object?.x ?? snap(targetPoint.x - (item.width || 80) / 2, fineSnapSize),
    y: candidate?.object?.y ?? snap(targetPoint.y - (item.height || 56) / 2, fineSnapSize),
    width: item.width || 80,
    height: item.height || 56,
    rotation: 0,
    z: 0,
    height3d: resolveCatalogHeight3d(item),
    color: item.color || "#1f7a61",
    metadata: { ...(item.metadata || {}), parentRoomId }
  };
  const constrainedObject = constrainObjectToBounds(object, draft, floor);
  return isDesktopObject(constrainedObject)
    ? centerAssetOnTable(constrainedObject, findNearestTable(constrainedObject, draft.objects || []))
    : constrainedObject;
}

/**
 * Adiciona ao rascunho do editor a entidade (ponto, rota ou objeto) do item
 * do catalogo no ponto de destino. Retorna `{ draft, target }`, onde `target`
 * identifica a entidade criada para selecao.
 */
export function addCatalogEntityToDraft({ draft, item, floor, targetPoint, candidate, createId }) {
  const fineSnapSize = getFineSnapSize(draft);
  const room = getRoomForObject(
    draft,
    {
      x: targetPoint.x,
      y: targetPoint.y,
      width: 0,
      height: 0,
      metadata: {}
    },
    floor
  );
  const context = { draft, floor, item, targetPoint, candidate, parentRoomId: room?.id || null, fineSnapSize, createId };

  if (item.category === "point") {
    const connectionPoint = createConnectionPoint(context);
    draft.connectionPoints = [...(draft.connectionPoints || []), connectionPoint];
    return { draft, target: { type: "point", id: connectionPoint.id } };
  }
  if (item.category === "route") {
    const route = createCableRoute(context);
    draft.cableRoutes = [...(draft.cableRoutes || []), route];
    return { draft, target: { type: "route", id: route.id } };
  }
  const anchoredObject = createCatalogObject(context);
  draft.objects = [...(draft.objects || []), anchoredObject];
  return { draft, target: { type: "object", id: anchoredObject.id } };
}
