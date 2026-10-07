import { useDraggable, useDroppable } from "@dnd-kit/core";

// Destino de soltura e alca de arraste do segmento (padrao nao movel nem sem permissao).
export default function useSegmentCardDnd({ segment, canManage }) {
  const { isOver, setNodeRef: setDropNodeRef } = useDroppable({
    id: `segment-drop-${segment.id}`,
    data: { type: "segment", segmentId: segment.id }
  });
  const {
    attributes: dragAttributes,
    listeners: dragListeners,
    setNodeRef: setDragNodeRef,
    isDragging
  } = useDraggable({
    id: `segment-drag-${segment.id}`,
    data: { type: "segment", segmentId: segment.id, origin: "board" },
    disabled: segment.isDefault || !canManage
  });
  return { isOver, setDropNodeRef, dragAttributes, dragListeners, setDragNodeRef, isDragging };
}
