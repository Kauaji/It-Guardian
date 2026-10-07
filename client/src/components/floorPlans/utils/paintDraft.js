import { getRoomGeometry, isRoomZone } from "./roomGeometry.js";
import {
  createPaintAreaZone,
  eraseCells,
  fillRoomCells,
  getBrushCells,
  getPaintCellSize,
  getPaintCells,
  paintCells
} from "./paintAreaGeometry.js";
import { isSegmentCompatibleWithGroup } from "./infrastructure.js";

export const DEFAULT_GROUP_COLOR = "#8b5cf6";
export const DEFAULT_SEGMENT_COLOR = "#22c55e";
const GROUP_CELL_SIZE = 20;

function findCompatibleSegment(segments, groupId) {
  return segments.find((segment) => isSegmentCompatibleWithGroup(segment, groupId)) || null;
}

/** Rascunho inicial do pincel de grupo (usa o primeiro grupo disponivel). */
export function createGroupPaintDraft(groups) {
  const group = groups[0] || null;
  return {
    areaType: "group",
    mode: "brush",
    brushSize: 1,
    cellSize: GROUP_CELL_SIZE,
    cells: [],
    groupId: group?.id || "",
    segmentId: "",
    parentAreaId: null,
    color: group?.color || DEFAULT_GROUP_COLOR
  };
}

/** Rascunho inicial do pincel de segmento dentro de uma area de grupo ja salva. */
export function createSegmentPaintDraft(parentArea, segments) {
  const compatibleSegment = findCompatibleSegment(segments, parentArea.groupId);
  return {
    areaType: "segment",
    mode: "brush",
    brushSize: 1,
    cellSize: getPaintCellSize(parentArea),
    cells: [],
    groupId: parentArea.groupId || "",
    segmentId: compatibleSegment?.id || "",
    parentAreaId: parentArea.id,
    color: compatibleSegment?.color || DEFAULT_SEGMENT_COLOR
  };
}

/** Aplica um patch ao rascunho mantendo cor, grupo, segmento e tamanho de celula coerentes. */
export function reducePaintDraftPatch(current, patch, { groups, segments, savedGroupAreas }) {
  const next = { ...current, ...patch };
  if (patch.groupId !== undefined && current.areaType === "group") {
    next.color = groups.find((group) => group.id === patch.groupId)?.color || next.color;
  }
  if (patch.parentAreaId !== undefined && current.areaType === "segment") {
    const parentArea = savedGroupAreas.find((area) => area.id === patch.parentAreaId);
    next.groupId = parentArea?.groupId || "";
    const compatible = findCompatibleSegment(segments, parentArea?.groupId);
    next.segmentId = compatible?.id || "";
    next.color = compatible?.color || DEFAULT_SEGMENT_COLOR;
    next.cellSize = parentArea ? getPaintCellSize(parentArea) : next.cellSize;
  }
  if (patch.segmentId !== undefined && current.areaType === "segment") {
    next.color = segments.find((segment) => segment.id === patch.segmentId)?.color || next.color;
  }
  return next;
}

function findRoomAtPoint(zones, activeFloorId, point) {
  return zones.find((zone) => {
    if (zone.floorId !== activeFloorId || !isRoomZone(zone)) return false;
    const geometry = getRoomGeometry(zone);
    return (
      point.x >= geometry.x && point.x <= geometry.x + geometry.width && point.y >= geometry.y && point.y <= geometry.y + geometry.height
    );
  });
}

/**
 * Aplica pincel, borracha ou balde ao rascunho no ponto. Retorna
 * `{ draft, warning }`; `warning` e preenchido quando o balde nao encontra comodo.
 */
export function applyPaintAtPoint(current, point, { savedGroupAreas, zones, activeFloorId }) {
  const parentArea = current.areaType === "segment" ? savedGroupAreas.find((area) => area.id === current.parentAreaId) : null;
  const allowedCells = parentArea ? getPaintCells(parentArea) : null;
  if (current.mode === "bucket") {
    const room = findRoomAtPoint(zones || [], activeFloorId, point);
    if (!room) {
      return {
        draft: current,
        warning: "Não foi possível completar a área. Verifique se o espaço está fechado por paredes."
      };
    }
    return {
      draft: { ...current, cells: paintCells(current.cells, fillRoomCells(room, current.cellSize, allowedCells), allowedCells) },
      warning: null
    };
  }
  const brushCells = getBrushCells(point, current.brushSize, current.cellSize);
  return {
    draft: {
      ...current,
      cells: current.mode === "eraser" ? eraseCells(current.cells, brushCells) : paintCells(current.cells, brushCells, allowedCells)
    },
    warning: null
  };
}

/**
 * Valida o rascunho antes de confirmar. Retorna `{ error }` com a mensagem de
 * aviso ou `{ group, segment, parentArea }` com as entidades resolvidas.
 */
export function resolvePaintConfirmation(paintDraft, { groups, segments, savedGroupAreas }) {
  if (!paintDraft?.cells?.length) return { error: "Nenhuma área foi demarcada." };
  const group = groups.find((entry) => entry.id === paintDraft.groupId) || null;
  const segment = segments.find((entry) => entry.id === paintDraft.segmentId) || null;
  if (paintDraft.areaType === "group" && !group) {
    return { error: "Selecione o grupo da área demarcada." };
  }
  const parentArea = paintDraft.areaType === "segment" ? savedGroupAreas.find((area) => area.id === paintDraft.parentAreaId) : null;
  if (paintDraft.areaType === "segment" && (!parentArea || !segment)) {
    return { error: "Selecione a área de grupo e o segmento antes de confirmar." };
  }
  if (parentArea?.groupId && segment?.groupId && parentArea.groupId !== segment.groupId) {
    return { error: "O segmento selecionado não pertence ao grupo desta área." };
  }
  return { group, segment, parentArea };
}

/** Adiciona ao rascunho do editor a area demarcada. Retorna o id da zona criada. */
export function addPaintAreaToDraft({ draft, paintDraft, activeFloorId, resolved, createId }) {
  const { group, segment, parentArea } = resolved;
  const area = createPaintAreaZone({
    id: createId("zone"),
    planId: draft.plan.id,
    floorId: activeFloorId,
    areaType: paintDraft.areaType,
    name: segment?.name || group?.name || "Área demarcada",
    color: segment?.color || group?.color || paintDraft.color,
    cells: paintDraft.cells,
    cellSize: paintDraft.cellSize,
    groupId: parentArea?.groupId || group?.id || null,
    segmentId: segment?.id || null,
    parentAreaId: parentArea?.id || null
  });
  area.orderIndex = (draft.zones || []).length;
  draft.zones = [...(draft.zones || []), area];
  return area.id;
}
