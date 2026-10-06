import { DEFAULT_PLAN_SIZE, getActiveFloor, getFineSnapSize } from "../utils/editorGeometry.js";
import { addCatalogEntityToDraft } from "../utils/catalogPlacement.js";
import { createId } from "../utils/ids.js";
import { buildCatalogPlacementPreview } from "../utils/placementPreview.js";
import {
  addMeasurementToDraft,
  addOpeningToDraft,
  addWallToDraft,
  getWallPlacementStart,
  snapMeasurementPlacementPoint
} from "../utils/placementCommits.js";
import { snapToGrid } from "../utils/roomGeometry.js";
import { findNearestWall, isOpeningObject, isWallObject, snapPointToWallEndpoints } from "../utils/wallGeometry.js";

const JUST_PLACED_HIGHLIGHT_MS = 1400;
const MIN_ENDPOINT_SNAP_DISTANCE = 18;

/**
 * Posicionamento de itens do catalogo, paredes, aberturas e medidas: escolher o
 * item, acompanhar o ponteiro (pre-visualizacao) e confirmar nos cliques.
 */
export function useItemPlacement({ doc, ui, notify, viewport, paint }) {
  const { editor, activeFloorId, commitEditor } = doc;
  const {
    placement, setPlacement, setMode, setSelectedTool, setSelected, setSelectedObjectIds, setJustPlacedObjectId
  } = ui;
  const { getSvgPoint } = viewport;

  const getFloor = () => getActiveFloor(editor, activeFloorId);
  const getEndpointSnapDistance = () => Math.max(MIN_ENDPOINT_SNAP_DISTANCE, editor?.plan?.snapSize || DEFAULT_PLAN_SIZE.snapSize);

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

  /** Seleciona a medida criada, destaca-a por um instante e reinicia o desenho. */
  const finishMeasurement = (createdId) => {
    if (createdId) {
      setSelected({ type: "object", id: createdId });
      setJustPlacedObjectId(createdId);
      window.setTimeout(() => setJustPlacedObjectId((current) => (current === createdId ? null : current)), JUST_PLACED_HIGHLIGHT_MS);
    }
    setPlacement((current) => current ? { ...current, start: null, end: null, lengthBuffer: "" } : current);
  };

  const confirmWallPoint = (point, floor) => {
    if (!placement.start) {
      const start = getWallPlacementStart({ point, placement, objects: editor.objects, floorId: floor.id });
      setPlacement((current) => current ? { ...current, start, end: start } : current);
      return;
    }
    let createdWallId = null;
    commitEditor((draft) => {
      createdWallId = addWallToDraft({ draft, floorId: floor.id, placement, point, createId });
      return draft;
    });
    if (createdWallId) setSelected({ type: "object", id: createdWallId });
    setPlacement((current) => current ? { ...current, start: null, end: null } : current);
  };

  const confirmMeasurementPoint = (point, floor) => {
    if (!placement.start) {
      const start = snapMeasurementPlacementPoint({ point, objects: editor.objects, floorId: floor.id });
      setPlacement((current) => current ? { ...current, start, end: start } : current);
      return;
    }
    let createdMeasurementId = null;
    commitEditor((draft) => {
      const end = snapMeasurementPlacementPoint({ point, objects: draft.objects, floorId: floor.id });
      createdMeasurementId = addMeasurementToDraft({ draft, floorId: floor.id, placement, end, createId });
      return draft;
    });
    finishMeasurement(createdMeasurementId);
  };

  const confirmOpeningPoint = (point, floor) => {
    const nearest = findNearestWall(point, editor.objects || [], floor.id);
    if (!nearest) {
      notify?.("Clique sobre uma parede para encaixar a abertura.", "warning");
      return;
    }
    let createdOpeningId = null;
    commitEditor((draft) => {
      createdOpeningId = addOpeningToDraft({ draft, floorId: floor.id, item: placement.item, wall: nearest.wall, point, createId });
      return draft;
    });
    if (createdOpeningId) setSelected({ type: "object", id: createdOpeningId });
  };

  /** Enter durante a medicao: confirma no ultimo ponto acompanhado pelo cursor. */
  const commitMeasurementFromKeyboard = () => {
    const floor = getFloor();
    if (!floor || !placement.end) return;
    let createdMeasurementId = null;
    commitEditor((draft) => {
      createdMeasurementId = addMeasurementToDraft({ draft, floorId: floor.id, placement, end: placement.end, createId });
      return draft;
    });
    finishMeasurement(createdMeasurementId);
  };

  /** Acompanha o ponteiro: atualiza a pre-visualizacao. Retorna true se tratou o evento. */
  const handlePointerMove = (event) => {
    if (placement?.kind === "catalog") {
      const preview = buildCatalogPreview(placement.item, getSvgPoint(event));
      setPlacement((current) => current?.kind === "catalog" ? { ...current, preview } : current);
      return true;
    }
    if (placement?.kind === "wall" && placement.start) {
      const snapSize = editor?.plan?.snapSize || DEFAULT_PLAN_SIZE.snapSize;
      const point = getSvgPoint(event);
      const gridPoint = { x: snapToGrid(point.x, snapSize), y: snapToGrid(point.y, snapSize) };
      const endpoint = snapPointToWallEndpoints(gridPoint, editor?.objects || [], activeFloorId, null, getEndpointSnapDistance());
      setPlacement((current) => current ? { ...current, end: endpoint } : current);
      return true;
    }
    if (placement?.kind === "measurement" && placement.start) {
      const endpoint = snapPointToWallEndpoints(getSvgPoint(event), editor?.objects || [], activeFloorId, null, getEndpointSnapDistance());
      setPlacement((current) => current ? { ...current, end: endpoint, constrainAngle: event.shiftKey } : current);
      return true;
    }
    return false;
  };

  return {
    addCatalogItem,
    startMeasurementTool,
    commitCatalogPlacement,
    confirmWallPoint,
    confirmMeasurementPoint,
    confirmOpeningPoint,
    commitMeasurementFromKeyboard,
    handlePointerMove
  };
}
