import { DEFAULT_PLAN_SIZE } from "./editorGeometry.js";
import { snapToGrid } from "./roomGeometry.js";
import { snapPointToWallEndpoints } from "./wallGeometry.js";

const MIN_ENDPOINT_SNAP_DISTANCE = 18;

export function getEndpointSnapDistance(editor) {
  return Math.max(MIN_ENDPOINT_SNAP_DISTANCE, editor?.plan?.snapSize || DEFAULT_PLAN_SIZE.snapSize);
}

/**
 * Como o movimento do ponteiro atualiza o posicionamento ativo. Devolve a função
 * atualizadora de `setPlacement`, ou null quando o evento não é tratado
 * (sem posicionamento, ou parede/medida ainda sem ponto inicial).
 */
export function resolvePlacementPointerMove({ placement, event, editor, activeFloorId, getSvgPoint, buildCatalogPreview }) {
  if (placement?.kind === "catalog") {
    const preview = buildCatalogPreview(placement.item, getSvgPoint(event));
    return (current) => (current?.kind === "catalog" ? { ...current, preview } : current);
  }
  if (placement?.kind === "wall" && placement.start) {
    const snapSize = editor?.plan?.snapSize || DEFAULT_PLAN_SIZE.snapSize;
    const point = getSvgPoint(event);
    const gridPoint = { x: snapToGrid(point.x, snapSize), y: snapToGrid(point.y, snapSize) };
    const endpoint = snapPointToWallEndpoints(gridPoint, editor?.objects || [], activeFloorId, null, getEndpointSnapDistance(editor));
    return (current) => (current ? { ...current, end: endpoint } : current);
  }
  if (placement?.kind === "measurement" && placement.start) {
    const endpoint = snapPointToWallEndpoints(
      getSvgPoint(event),
      editor?.objects || [],
      activeFloorId,
      null,
      getEndpointSnapDistance(editor)
    );
    return (current) => (current ? { ...current, end: endpoint, constrainAngle: event.shiftKey } : current);
  }
  return null;
}
