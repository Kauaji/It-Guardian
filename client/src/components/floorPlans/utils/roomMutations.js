import { DEFAULT_PLAN_SIZE, centerDesktopsOnTables } from "./editorGeometry.js";
import {
  clampRoomGeometry,
  getRoomGeometry,
  isRoomPlacementValid,
  normalizeRoomZone,
  rotateRoomSize,
  snapToGrid
} from "./roomGeometry.js";
import { createRoomEntitiesFromTemplate } from "./roomTemplates.js";
import { getRoomWallId, syncAnchoredOpenings } from "./wallGeometry.js";

/** Primeira posicao livre ao lado do comodo para colocar uma copia (ou undefined). */
export function findRoomDuplicateGeometry({ zone, floor, zones, snapSize }) {
  const baseGeometry = getRoomGeometry(zone);
  const offsets = [
    { x: snapSize * 4, y: snapSize * 4 },
    { x: baseGeometry.width + snapSize * 2, y: 0 },
    { x: 0, y: baseGeometry.height + snapSize * 2 },
    { x: -(baseGeometry.width + snapSize * 2), y: 0 },
    { x: 0, y: -(baseGeometry.height + snapSize * 2) }
  ];
  return offsets
    .map((offset) => clampRoomGeometry({
      ...baseGeometry,
      x: snapToGrid(baseGeometry.x + offset.x, snapSize),
      y: snapToGrid(baseGeometry.y + offset.y, snapSize)
    }, floor, snapSize))
    .find((candidate) => isRoomPlacementValid(candidate, floor, zones || []));
}

function offsetEntity(entity, deltaX, deltaY, overrides) {
  return {
    ...entity,
    x: (entity.x || 0) + deltaX,
    y: (entity.y || 0) + deltaY,
    ...overrides
  };
}

function duplicateRoomObjects({ draft, zone, duplicatedZone, deltaX, deltaY, createId }) {
  const sourceWalls = new Map((draft.objects || [])
    .filter((object) => object.metadata?.parentRoomId === zone.id && object.metadata?.generatedFromRoom)
    .map((object) => [object.id, object]));
  return (draft.objects || [])
    .filter((object) => object.metadata?.parentRoomId === zone.id && !object.metadata?.generatedFromRoom)
    .map((object) => {
      const parentWall = sourceWalls.get(object.metadata?.parentObjectId);
      return offsetEntity(object, deltaX, deltaY, {
        id: createId("object"),
        metadata: {
          ...(object.metadata || {}),
          parentRoomId: duplicatedZone.id,
          ...(parentWall?.metadata?.roomWallSide
            ? { parentObjectId: getRoomWallId(duplicatedZone.id, parentWall.metadata.roomWallSide) }
            : {})
        }
      });
    });
}

/**
 * Duplica o comodo (com objetos e pontos internos) na geometria informada.
 * Retorna o id do novo comodo.
 */
export function duplicateRoomInDraft({ draft, zone, geometry, createId }) {
  const baseGeometry = getRoomGeometry(zone);
  const deltaX = geometry.x - baseGeometry.x;
  const deltaY = geometry.y - baseGeometry.y;
  const duplicatedZone = normalizeRoomZone({
    ...zone,
    id: createId("zone"),
    name: `${zone.name} cópia`,
    geometry,
    orderIndex: (draft.zones || []).length
  }, draft.plan);
  const duplicatedObjects = duplicateRoomObjects({ draft, zone, duplicatedZone, deltaX, deltaY, createId });
  const duplicatedPoints = (draft.connectionPoints || [])
    .filter((pointEntry) => pointEntry.metadata?.parentRoomId === zone.id)
    .map((pointEntry) => offsetEntity(pointEntry, deltaX, deltaY, {
      id: createId("point"),
      metadata: { ...(pointEntry.metadata || {}), parentRoomId: duplicatedZone.id }
    }));
  draft.zones = [...(draft.zones || []), duplicatedZone];
  draft.objects = [...(draft.objects || []), ...duplicatedObjects];
  draft.connectionPoints = [...(draft.connectionPoints || []), ...duplicatedPoints];
  return duplicatedZone.id;
}

/** Geometria do comodo girado 90 graus em torno do centro (ajustada a grade e ao pavimento). */
export function getRotatedRoomGeometry({ zone, floor, snapSize = DEFAULT_PLAN_SIZE.snapSize }) {
  const geometry = getRoomGeometry(zone);
  const centerX = geometry.x + geometry.width / 2;
  const centerY = geometry.y + geometry.height / 2;
  const nextSize = rotateRoomSize(geometry.width, geometry.height, 90);
  return clampRoomGeometry({
    x: snapToGrid(centerX - nextSize.width / 2, snapSize),
    y: snapToGrid(centerY - nextSize.height / 2, snapSize),
    width: nextSize.width,
    height: nextSize.height
  }, floor, snapSize);
}

/** Aplica a rotacao ao comodo, deslocando objetos e pontos internos junto. */
export function rotateRoomInDraft({ draft, zone, nextGeometry }) {
  const geometry = getRoomGeometry(zone);
  const deltaX = nextGeometry.x - geometry.x;
  const deltaY = nextGeometry.y - geometry.y;
  draft.zones = (draft.zones || []).map((entry) => {
    if (entry.id !== zone.id) return entry;
    return normalizeRoomZone({
      ...entry,
      geometry: nextGeometry,
      metadata: {
        ...(entry.metadata || {}),
        room: {
          ...(entry.metadata?.room || {}),
          rotation: ((entry.metadata?.room?.rotation || 0) + 90) % 180
        }
      }
    }, draft.plan);
  });
  const shiftIfChild = (entity) => (
    entity.metadata?.parentRoomId === zone.id ? offsetEntity(entity, deltaX, deltaY) : entity
  );
  draft.objects = (draft.objects || []).map(shiftIfChild);
  draft.connectionPoints = (draft.connectionPoints || []).map(shiftIfChild);
  return draft;
}

/** Cria o comodo a partir do modelo e da pre-visualizacao confirmada. Retorna o id. */
export function addRoomFromPlacementToDraft({ draft, floor, placement, preview, createId }) {
  const template = {
    ...placement.template,
    width: preview.geometry.width,
    height: preview.geometry.height
  };
  const { zone, objects } = createRoomEntitiesFromTemplate({
    template,
    floor,
    planId: draft.plan.id,
    createId,
    x: preview.geometry.x,
    y: preview.geometry.y,
    rotation: placement.rotation
  });
  zone.orderIndex = (draft.zones || []).length;
  draft.zones = [...(draft.zones || []), normalizeRoomZone(zone, draft.plan)];
  draft.objects = syncAnchoredOpenings([
    ...(draft.objects || []),
    ...centerDesktopsOnTables(objects)
  ]);
  return zone.id;
}
