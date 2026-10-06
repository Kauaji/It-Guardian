import { isEditorObjectLocked } from "../utils/editorGeometry.js";
import {
  createEntityDrag,
  createObjectResizeDrag,
  createRoomResizeDrag,
  findDraggableEntity,
  getDragObjectIds
} from "../utils/dragState.js";
import { isRoomZone } from "../utils/roomGeometry.js";

function isMultiSelectModifier(event) {
  return Boolean(event.shiftKey || event.ctrlKey || event.metaKey);
}

/**
 * Inicio dos arrastos que mexem em entidades: mover objeto/comodo/ponto e
 * redimensionar comodo ou objeto. Grava o estado do arrasto em `dragRef`.
 */
export function useDragStarts({ doc, ui, viewport, entities, dragRef }) {
  const { editor, pushHistory } = doc;
  const { selectedTool, placement, paintDraft, selectedObjectIds, setSelected, setSelectedObjectIds } = ui;
  const { getSvgPoint } = viewport;

  /** Inicia o arrasto de um objeto, comodo ou ponto (ou apenas seleciona se travado/multisselecao). */
  const beginDrag = (event, type, id) => {
    if (selectedTool !== "select" || placement || paintDraft) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getSvgPoint(event);
    const entity = findDraggableEntity(editor, type, id);
    if (!entity) return;
    if (type === "object" && (isEditorObjectLocked(entity) || isMultiSelectModifier(event))) {
      entities.handleEntitySelect({ type, id }, event);
      return;
    }
    const objectIds = getDragObjectIds(type, id, selectedObjectIds);
    dragRef.current = createEntityDrag({ editor, type, id, entity, point, objectIds });
    pushHistory(editor);
    setSelected({ type, id });
    setSelectedObjectIds(objectIds);
  };

  const beginRoomResize = (event, zoneId, side) => {
    if (!editor) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getSvgPoint(event);
    const zone = (editor.zones || []).find((entry) => entry.id === zoneId);
    if (!zone || !isRoomZone(zone)) return;
    dragRef.current = createRoomResizeDrag({ editor, zone, side, point });
    pushHistory(editor);
    setSelected({ type: "zone", id: zoneId });
    setSelectedObjectIds([]);
  };

  const beginObjectResize = (event, objectId, side) => {
    if (!editor) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getSvgPoint(event);
    const object = (editor.objects || []).find((entry) => entry.id === objectId);
    if (!object || isEditorObjectLocked(object)) return;
    dragRef.current = createObjectResizeDrag({ object, side, point });
    pushHistory(editor);
    setSelected({ type: "object", id: objectId });
    setSelectedObjectIds([objectId]);
  };

  return { beginDrag, beginRoomResize, beginObjectResize };
}
