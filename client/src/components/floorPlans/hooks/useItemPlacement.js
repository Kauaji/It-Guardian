import { getActiveFloor, getFineSnapSize } from "../utils/editorGeometry.js";
import { addCatalogEntityToDraft } from "../utils/catalogPlacement.js";
import { createId } from "../utils/ids.js";
import { resolvePlacementPointerMove } from "../utils/placementPointer.js";
import { buildCatalogPlacementPreview } from "../utils/placementPreview.js";
import { isOpeningObject, isWallObject } from "../utils/wallGeometry.js";
import { usePlacementConfirmations } from "./usePlacementConfirmations.js";

/**
 * Posicionamento de itens do catalogo, paredes, aberturas e medidas: escolher o
 * item, acompanhar o ponteiro (pre-visualizacao) e confirmar nos cliques
 * (confirmacoes em usePlacementConfirmations).
 */
export function useItemPlacement({ doc, ui, notify, viewport, paint }) {
  const { editor, activeFloorId, commitEditor } = doc;
  const {
    placement, setPlacement, setMode, setSelectedTool, setSelected, setSelectedObjectIds
  } = ui;
  const { getSvgPoint } = viewport;
  const confirmations = usePlacementConfirmations({ doc, ui, notify });

  const getFloor = () => getActiveFloor(editor, activeFloorId);

  /** Prepara o modo 2D com a ferramenta de selecao e um novo posicionamento. */
  const beginPlacement = (nextPlacement, { clearObjectIds = false } = {}) => {
    setMode("2d");
    setSelectedTool("select");
    setSelected(null);
    if (clearObjectIds) setSelectedObjectIds([]);
    setPlacement(nextPlacement);
  };

  const addCatalogItem = (item) => {
    const floor = getFloor();
    if (!floor) return;
    if (item.category === "zone") {
      paint.handleToolChange(item.zoneType === "segment" ? "segment-brush" : "group-brush");
    } else if (isWallObject(item)) {
      beginPlacement({ kind: "wall", item, start: null, end: null, gridSize: getFineSnapSize(editor) });
    } else if (isOpeningObject(item)) {
      const hasWall = (editor.objects || []).some((object) => object.floorId === floor.id && isWallObject(object));
      if (!hasWall) {
        notify?.("Crie uma parede antes de posicionar portas ou janelas.", "warning");
        return;
      }
      beginPlacement({ kind: "opening", item });
    } else {
      beginPlacement({ kind: "catalog", item }, { clearObjectIds: true });
    }
  };

  const startMeasurementTool = () => {
    if (!getFloor()) return;
    beginPlacement({ kind: "measurement", start: null, end: null, constrainAngle: false, lengthBuffer: "" });
  };

  const buildCatalogPreview = (item, point) => (
    buildCatalogPlacementPreview({ editor, floor: getFloor(), item, point })
  );

  const commitCatalogPlacement = (item, point, preview = null) => {
    const floor = getFloor();
    if (!floor || !item) return;
    const candidate = preview || buildCatalogPreview(item, point);
    if (candidate && !candidate.valid) {
      notify?.(candidate.reason || "Escolha outra posição para o item.", "warning");
      return;
    }
    const targetPoint = candidate?.point || point;
    let createdTarget = null;
    commitEditor((draft) => {
      const result = addCatalogEntityToDraft({ draft, item, floor, targetPoint, candidate, createId });
      createdTarget = result.target;
      return result.draft;
    });
    if (createdTarget) {
      setSelected(createdTarget);
      setSelectedObjectIds(createdTarget.type === "object" ? [createdTarget.id] : []);
    }
    setPlacement(null);
    notify?.(`${item.label} adicionado a planta.`, "ok");
  };

  /** Acompanha o ponteiro: atualiza a pre-visualizacao. Retorna true se tratou o evento. */
  const handlePointerMove = (event) => {
    const update = resolvePlacementPointerMove({
      placement, event, editor, activeFloorId, getSvgPoint, buildCatalogPreview
    });
    if (!update) return false;
    setPlacement(update);
    return true;
  };

  return {
    addCatalogItem,
    startMeasurementTool,
    commitCatalogPlacement,
    ...confirmations,
    handlePointerMove
  };
}
