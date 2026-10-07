import { closestCenter } from "@dnd-kit/core";

export const inventoryDropAnimation = {
  duration: 210,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)"
};

// Mantem o overlay do ativo/segmento arrastado ao lado do cursor, em vez de
// centralizado no elemento original.
export function keepDragOverlayNearCursor({ activatorEvent, active, activeNodeRect, overlayNodeRect, transform }) {
  const dragType = active?.data?.current?.type;

  if ((dragType !== "machine" && dragType !== "segment") || !activatorEvent || !activeNodeRect || !overlayNodeRect) {
    return transform;
  }

  const point = "touches" in activatorEvent ? activatorEvent.touches?.[0] : activatorEvent;

  if (!point || typeof point.clientX !== "number" || typeof point.clientY !== "number") {
    return transform;
  }

  const initialOffsetX = point.clientX - activeNodeRect.left;
  const initialOffsetY = point.clientY - activeNodeRect.top;
  const cursorGapX = dragType === "segment" ? 14 : Math.min(18, Math.max(12, overlayNodeRect.width * 0.06));
  const desiredOffsetY =
    dragType === "segment"
      ? Math.min(18, Math.max(10, overlayNodeRect.height * 0.4))
      : Math.min(24, Math.max(14, overlayNodeRect.height * 0.18));

  return {
    ...transform,
    x: transform.x + initialOffsetX + cursorGapX,
    y: transform.y + initialOffsetY - desiredOffsetY
  };
}

// Candidato da sidebar: so conta dentro de uma "zona magnetica" em volta do
// item; a distancia combina borda (72%) e centro (28%).
function sidebarCandidate(container, rect, pointer) {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = Math.max(rect.left - pointer.x, 0, pointer.x - rect.right);
  const dy = Math.max(rect.top - pointer.y, 0, pointer.y - rect.bottom);
  const edgeDistance = Math.hypot(dx, dy);
  const centerDistance = Math.hypot(pointer.x - centerX, pointer.y - centerY);
  const insideMagneticZone =
    pointer.x >= rect.left - 84 && pointer.x <= rect.right + 132 && pointer.y >= rect.top - 34 && pointer.y <= rect.bottom + 34;

  return insideMagneticZone
    ? {
        id: container.id,
        data: {
          droppableContainer: container,
          value: edgeDistance * 0.72 + centerDistance * 0.28
        }
      }
    : null;
}

// Segmento da area principal: o menor retangulo que contem o ponteiro.
function segmentCandidate(container, rect, pointer) {
  const inside = pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom;
  if (!inside) return null;

  return {
    id: container.id,
    data: {
      droppableContainer: container,
      value: rect.width * rect.height
    }
  };
}

function bestCandidate(containers, droppableRects, pointer, build) {
  return containers
    .map((container) => {
      const rect = droppableRects.get(container.id);
      return rect ? build(container, rect, pointer) : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.data.value - right.data.value)[0];
}

export function inventoryCollisionDetection(args) {
  const { active, pointerCoordinates, droppableContainers, droppableRects } = args;
  const activeType = active?.data?.current?.type;

  if (activeType === "segment") {
    const groupContainers = droppableContainers.filter(
      (container) => container.data.current?.type === "segment-group-drop" || container.data.current?.type === "sidebar-segment-group-drop"
    );
    return closestCenter({ ...args, droppableContainers: groupContainers });
  }

  const pointerNearSidebar = !pointerCoordinates || pointerCoordinates.x <= 400;
  const segmentContainers = droppableContainers.filter((container) => container.data.current?.type === "segment");
  const sidebarSegmentContainers = pointerNearSidebar
    ? droppableContainers.filter((container) => container.data.current?.type === "sidebar-segment")
    : [];
  const machineContainers = [...segmentContainers, ...sidebarSegmentContainers];

  if (pointerCoordinates) {
    const sidebarBest = bestCandidate(sidebarSegmentContainers, droppableRects, pointerCoordinates, sidebarCandidate);
    if (sidebarBest) return [sidebarBest];

    const segmentBest = bestCandidate(segmentContainers, droppableRects, pointerCoordinates, segmentCandidate);
    if (segmentBest) return [segmentBest];
  }

  return closestCenter({ ...args, droppableContainers: machineContainers });
}
