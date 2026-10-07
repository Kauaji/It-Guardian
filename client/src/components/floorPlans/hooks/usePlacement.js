import { getActiveFloor } from "../utils/editorGeometry.js";
import { useItemPlacement } from "./useItemPlacement.js";
import { useRoomPlacement } from "./useRoomPlacement.js";

/**
 * Posicionamento de itens, paredes, aberturas, medidas e comodos. Reune os
 * dois hooks especializados e despacha o clique/movimento conforme o tipo.
 */
export function usePlacement({ doc, ui, notify, viewport, paint }) {
  const { editor, activeFloorId } = doc;
  const { placement } = ui;
  const items = useItemPlacement({ doc, ui, notify, viewport, paint });
  const rooms = useRoomPlacement({ doc, ui, notify, viewport });

  /** Clique no canvas com um posicionamento ativo. */
  const confirmPlacement = (event) => {
    if (!placement) return;
    event.preventDefault();
    event.stopPropagation();
    const floor = getActiveFloor(editor, activeFloorId);
    if (!floor) return;
    const point = viewport.getSvgPoint(event);
    if (placement.kind === "catalog") items.commitCatalogPlacement(placement.item, point, placement.preview);
    else if (placement.kind === "wall") items.confirmWallPoint(point, floor);
    else if (placement.kind === "measurement") items.confirmMeasurementPoint(point, floor);
    else if (placement.kind === "opening") items.confirmOpeningPoint(point, floor);
    else if (placement.kind === "room") rooms.confirmRoomPoint(point);
  };

  /** Movimento do ponteiro: retorna true quando a pre-visualizacao tratou o evento. */
  const handlePointerMove = (event) => rooms.handlePointerMove(event) || items.handlePointerMove(event);

  return {
    addCatalogItem: items.addCatalogItem,
    startMeasurementTool: items.startMeasurementTool,
    commitMeasurementFromKeyboard: items.commitMeasurementFromKeyboard,
    beginRoomPlacement: rooms.beginRoomPlacement,
    finishRoomPlacement: rooms.finishRoomPlacement,
    confirmPlacement,
    handlePointerMove
  };
}
