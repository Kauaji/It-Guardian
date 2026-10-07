import { snap } from "./editorGeometry.js";
import { attachOpeningToWall, createWallObjectFromPoints, snapPointToWallEndpoints } from "./wallGeometry.js";
import { createMeasurementObjectFromPoints, parseTypedLengthBuffer } from "./measurementGeometry.js";

const DEFAULT_WALL_GRID = 5;

/** Primeiro ponto de uma parede: grade fina + imas nas pontas de paredes existentes. */
export function getWallPlacementStart({ point, placement, objects, floorId }) {
  const gridSize = placement.gridSize || DEFAULT_WALL_GRID;
  const snappedPoint = { x: snap(point.x, gridSize), y: snap(point.y, gridSize) };
  return snapPointToWallEndpoints(snappedPoint, objects || [], floorId);
}

/** Ponto de uma medicao (inicio ou fim) imantado nas pontas das paredes. */
export function snapMeasurementPlacementPoint({ point, objects, floorId }) {
  return snapPointToWallEndpoints(point, objects || [], floorId);
}

/** Cria a parede entre o inicio e o ponto final e a adiciona ao rascunho. Retorna o id. */
export function addWallToDraft({ draft, floorId, placement, point, createId }) {
  const gridSize = placement.gridSize || DEFAULT_WALL_GRID;
  const snappedEnd = { x: snap(point.x, gridSize), y: snap(point.y, gridSize) };
  const end = snapPointToWallEndpoints(snappedEnd, draft.objects || [], floorId);
  const wall = createWallObjectFromPoints({
    id: createId("object"),
    planId: draft.plan.id,
    floorId,
    item: placement.item,
    start: placement.start,
    end,
    gridSize
  });
  draft.objects = [...(draft.objects || []), wall];
  return wall.id;
}

/**
 * Cria a medicao do inicio ate `end` (comprimento digitado tem prioridade) e a
 * adiciona ao rascunho. Retorna o id.
 */
export function addMeasurementToDraft({ draft, floorId, placement, end, createId }) {
  const overrideLengthPx = parseTypedLengthBuffer(placement.lengthBuffer, draft.plan);
  const measurement = createMeasurementObjectFromPoints({
    id: createId("object"),
    planId: draft.plan.id,
    floorId,
    start: placement.start,
    end,
    constrainAngle: placement.constrainAngle,
    overrideLengthPx
  });
  draft.objects = [...(draft.objects || []), measurement];
  return measurement.id;
}

/** Cria uma porta/janela encaixada na parede mais proxima e a adiciona ao rascunho. */
export function addOpeningToDraft({ draft, floorId, item, wall, point, createId }) {
  const opening = attachOpeningToWall(
    {
      id: createId("object"),
      planId: draft.plan.id,
      floorId,
      objectType: item.objectType,
      category: "structure",
      label: item.label,
      linkedAssetId: null,
      groupId: null,
      segmentId: null,
      x: point.x - Number(item.width || 72) / 2,
      y: point.y - Number(item.height || 16) / 2,
      width: item.width || 72,
      height: item.height || 16,
      rotation: 0,
      z: 0,
      height3d: item.objectType === "window" ? 48 : 96,
      color: item.color || "#64748b",
      metadata: { ...(item.metadata || {}), parentRoomId: wall.metadata?.parentRoomId || null }
    },
    wall,
    point
  );
  draft.objects = [...(draft.objects || []), opening];
  return opening.id;
}
