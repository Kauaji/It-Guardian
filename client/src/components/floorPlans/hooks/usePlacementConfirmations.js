import { getActiveFloor } from "../utils/editorGeometry.js";
import { createId } from "../utils/ids.js";
import {
  addMeasurementToDraft,
  addOpeningToDraft,
  addWallToDraft,
  getWallPlacementStart,
  snapMeasurementPlacementPoint
} from "../utils/placementCommits.js";
import { findNearestWall } from "../utils/wallGeometry.js";

const JUST_PLACED_HIGHLIGHT_MS = 1400;

/**
 * Confirmação dos cliques de parede, medida e abertura (primeiro clique fixa o
 * início, o seguinte grava no rascunho) e Enter durante a medição.
 */
export function usePlacementConfirmations({ doc, ui, notify }) {
  const { editor, activeFloorId, commitEditor } = doc;
  const { placement, setPlacement, setSelected, setJustPlacedObjectId } = ui;

  /** Seleciona a medida criada, destaca-a por um instante e reinicia o desenho. */
  const finishMeasurement = (createdId) => {
    if (createdId) {
      setSelected({ type: "object", id: createdId });
      setJustPlacedObjectId(createdId);
      window.setTimeout(() => setJustPlacedObjectId((current) => (current === createdId ? null : current)), JUST_PLACED_HIGHLIGHT_MS);
    }
    setPlacement((current) => (current ? { ...current, start: null, end: null, lengthBuffer: "" } : current));
  };

  const confirmWallPoint = (point, floor) => {
    if (!placement.start) {
      const start = getWallPlacementStart({ point, placement, objects: editor.objects, floorId: floor.id });
      setPlacement((current) => (current ? { ...current, start, end: start } : current));
      return;
    }
    let createdWallId = null;
    commitEditor((draft) => {
      createdWallId = addWallToDraft({ draft, floorId: floor.id, placement, point, createId });
      return draft;
    });
    if (createdWallId) setSelected({ type: "object", id: createdWallId });
    setPlacement((current) => (current ? { ...current, start: null, end: null } : current));
  };

  const confirmMeasurementPoint = (point, floor) => {
    if (!placement.start) {
      const start = snapMeasurementPlacementPoint({ point, objects: editor.objects, floorId: floor.id });
      setPlacement((current) => (current ? { ...current, start, end: start } : current));
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
    const floor = getActiveFloor(editor, activeFloorId);
    if (!floor || !placement.end) return;
    let createdMeasurementId = null;
    commitEditor((draft) => {
      createdMeasurementId = addMeasurementToDraft({ draft, floorId: floor.id, placement, end: placement.end, createId });
      return draft;
    });
    finishMeasurement(createdMeasurementId);
  };

  return { confirmWallPoint, confirmMeasurementPoint, confirmOpeningPoint, commitMeasurementFromKeyboard };
}
