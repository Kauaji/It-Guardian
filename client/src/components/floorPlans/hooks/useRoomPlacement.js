import { getActiveFloor } from "../utils/editorGeometry.js";
import { createId } from "../utils/ids.js";
import { buildDraggedRoomPreview, buildRoomPlacementPreview } from "../utils/placementPreview.js";
import { addRoomFromPlacementToDraft } from "../utils/roomMutations.js";

/**
 * Posicionamento de comodos a partir dos modelos: clique (modelo no tamanho
 * padrao) ou arrasto (tamanho livre), com pre-visualizacao e rotacao.
 */
export function useRoomPlacement({ doc, ui, notify, viewport }) {
  const { editor, activeFloorId, commitEditor } = doc;
  const { placement, setPlacement, setMode, setSelectedTool, setActiveCatalog, setSelected } = ui;
  const { getSvgPoint } = viewport;

  const getFloor = () => getActiveFloor(editor, activeFloorId);

  const buildClickPreview = (template, point, rotation = 0) =>
    buildRoomPlacementPreview({ editor, floor: getFloor(), template, point, rotation });

  const buildDragPreview = (template, start, end, rotation = 0) =>
    buildDraggedRoomPreview({ editor, floor: getFloor(), template, start, end, rotation });

  const beginRoomPlacement = (template) => {
    if (!editor) return;
    setMode("2d");
    setSelectedTool("select");
    setActiveCatalog("rooms");
    setSelected(null);
    setPlacement({ kind: "room", template, rotation: 0, preview: null });
  };

  /** Acompanha o ponteiro. Retorna true se ha um comodo sendo posicionado. */
  const handlePointerMove = (event) => {
    if (placement?.kind !== "room") return false;
    const point = getSvgPoint(event);
    const preview = placement.start
      ? buildDragPreview(placement.template, placement.start, point, placement.rotation)
      : buildClickPreview(placement.template, point, placement.rotation);
    setPlacement((current) => (current ? { ...current, preview } : current));
    return true;
  };

  const commitRoomPlacement = (placementState, preview) => {
    if (!placementState?.template || !preview?.valid) {
      notify?.("Escolha uma área livre da planta para posicionar o cômodo.", "warning");
      return false;
    }
    const floor = getFloor();
    if (!floor) return false;
    let createdRoomId = null;
    commitEditor((draft) => {
      createdRoomId = addRoomFromPlacementToDraft({ draft, floor, placement: placementState, preview, createId });
      return draft;
    });
    if (createdRoomId) setSelected({ type: "zone", id: createdRoomId });
    setPlacement(null);
    return Boolean(createdRoomId);
  };

  /** Primeiro clique: marca o ponto inicial do comodo (arrasto ou clique simples). */
  const confirmRoomPoint = (point) => {
    const preview = placement.preview || buildClickPreview(placement.template, point, placement.rotation);
    setPlacement((current) => (current ? { ...current, start: point, preview } : current));
  };

  /** Soltar o ponteiro: cria o comodo com o retangulo desenhado. */
  const finishRoomPlacement = (event) => {
    if (placement?.kind !== "room" || !placement.start) return;
    const point = event ? getSvgPoint(event) : placement.start;
    const preview = buildDragPreview(placement.template, placement.start, point, placement.rotation) || placement.preview;
    commitRoomPlacement(placement, preview);
  };

  return { beginRoomPlacement, handlePointerMove, confirmRoomPoint, finishRoomPlacement };
}
