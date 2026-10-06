import { useRef } from "react";
import {
  findObjectsInSelectionRect,
  getActiveFloor,
  normalizeSelectionRect
} from "../utils/editorGeometry.js";
import { createMarqueeDrag } from "../utils/dragState.js";
import { applyDragToDraft, computeDragDeltas, computeObjectDragAlignment, getDragSnapSize } from "../utils/dragOperations.js";
import { getPrimarySelection, mergeMarqueeSelection } from "../utils/selectionActions.js";
import { useDragStarts } from "./useDragStarts.js";

function isPanGesture(event, spacePressed) {
  return event.button === 1 || event.button === 2 || (spacePressed && event.button === 0);
}

/**
 * Interacoes de ponteiro no canvas 2D: pan, zoom por clique, pincel,
 * posicionamento, selecao por retangulo, arrasto e redimensionamento
 * (inicio dos arrastos em useDragStarts).
 * O estado do arrasto em andamento fica em `dragRef`.
 */
export function useCanvasInteractions({ doc, ui, viewport, paint, placementApi, entities, isEditing }) {
  const { editor, activeFloorId, commitEditor } = doc;
  const {
    selectedTool, placement, paintDraft, zoomMode,
    setSelected, setSelectedObjectIds, setSelectionBox, setAlignmentGuides
  } = ui;
  const { getSvgPoint, spacePressed } = viewport;
  const dragRef = useRef(null);
  const { beginDrag, beginRoomResize, beginObjectResize } = useDragStarts({ doc, ui, viewport, entities, dragRef });

  const handleCanvasPointerDown = (event) => {
    if (isPanGesture(event, spacePressed)) {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget?.setPointerCapture?.(event.pointerId);
      dragRef.current = viewport.beginPan(event);
      return;
    }
    if (zoomMode && event.button === 0) {
      event.preventDefault();
      event.stopPropagation();
      viewport.zoomAtClick(event);
      return;
    }
    if (!isEditing) return;
    if (paintDraft) {
      event.preventDefault();
      event.stopPropagation();
      paint.applyPaint(getSvgPoint(event));
      paint.paintPointerRef.current = paintDraft.mode !== "bucket";
      return;
    }
    if (placement) {
      placementApi.confirmPlacement(event);
      return;
    }
    if (selectedTool !== "select") return;
    event.preventDefault();
    event.stopPropagation();
    const point = getSvgPoint(event);
    const additive = Boolean(event.ctrlKey || event.metaKey);
    dragRef.current = createMarqueeDrag(point, additive);
    setSelectionBox({ x: point.x, y: point.y, width: 0, height: 0 });
    if (!additive) {
      setSelected(null);
      setSelectedObjectIds([]);
    }
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.type === "pan") {
      event.preventDefault();
      viewport.movePan(event, drag);
      return;
    }
    const point = getSvgPoint(event);
    if (drag.type === "marquee") {
      setSelectionBox(normalizeSelectionRect({ x: drag.startX, y: drag.startY }, point));
      return;
    }
    const floor = getActiveFloor(editor, activeFloorId);
    const snapSize = getDragSnapSize(drag, editor);
    const deltas = computeDragDeltas(drag, point, snapSize);
    const alignment = computeObjectDragAlignment({ drag, deltas, editor, floor, snapSize, altKey: event.altKey });
    setAlignmentGuides(alignment.guides);
    commitEditor((draft) => applyDragToDraft(draft, drag, {
      ...deltas,
      ...alignment,
      point,
      floor,
      snapSize,
      activeFloorId,
      shiftKey: event.shiftKey
    }), { track: false });
  };

  const finishMarquee = (drag, event) => {
    const point = event ? getSvgPoint(event) : { x: drag.startX, y: drag.startY };
    const rectangle = normalizeSelectionRect({ x: drag.startX, y: drag.startY }, point);
    const ids = findObjectsInSelectionRect(editor?.objects || [], rectangle, activeFloorId).map((object) => object.id);
    setSelectedObjectIds((current) => {
      const nextIds = mergeMarqueeSelection(current, ids, Boolean(drag.additive));
      setSelected(getPrimarySelection(nextIds));
      return nextIds;
    });
    setSelectionBox(null);
  };

  const endDrag = (event) => {
    paint.paintPointerRef.current = false;
    setAlignmentGuides([]);
    const drag = dragRef.current;
    if (drag?.type === "pan") {
      viewport.endPan(event);
    } else if (drag?.type === "marquee") {
      finishMarquee(drag, event);
    } else if (!paintDraft) {
      placementApi.finishRoomPlacement(event);
    }
    dragRef.current = null;
  };

  const handleCanvasPointerMove = (event) => {
    if (dragRef.current?.type === "pan") {
      moveDrag(event);
    } else if (paintDraft && paint.paintPointerRef.current) {
      paint.applyPaint(getSvgPoint(event));
    } else if (!placementApi.handlePointerMove(event)) {
      moveDrag(event);
    }
  };

  return { handleCanvasPointerDown, beginDrag, handleCanvasPointerMove, endDrag, beginRoomResize, beginObjectResize };
}
