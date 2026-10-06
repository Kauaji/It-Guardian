import { DEFAULT_PLAN_SIZE, getActiveFloor } from "../utils/editorGeometry.js";
import {
  duplicateObjectInDraft,
  filterUnlockedObjectIds,
  rotateObjectsInDraft
} from "../utils/entityMutations.js";
import { createId } from "../utils/ids.js";
import { isRoomPlacementValid, isRoomZone } from "../utils/roomGeometry.js";
import {
  duplicateRoomInDraft,
  findRoomDuplicateGeometry,
  getRotatedRoomGeometry,
  rotateRoomInDraft
} from "../utils/roomMutations.js";
import { isAnchoredOpening } from "../utils/wallGeometry.js";

function findRoomZone(editor, selected) {
  const zone = (editor?.zones || []).find((entry) => entry.id === selected.id);
  return zone && isRoomZone(zone) ? zone : null;
}

/** Duplicar e girar a selecao (objetos, comodos ou o item que esta sendo posicionado). */
export function useSelectionTransforms({ doc, ui, notify }) {
  const { editor, activeFloorId, commitEditor } = doc;
  const { selected, setSelected, selectedObjectIds, setSelectedObjectIds, placement, setPlacement } = ui;

  const duplicateObject = () => {
    const object = (editor?.objects || []).find((entry) => entry.id === selected.id);
    if (!object || isAnchoredOpening(object)) return;
    const nextObjectId = createId("object");
    commitEditor((draft) => duplicateObjectInDraft(draft, object, { id: nextObjectId, activeFloorId }));
    setSelected({ type: "object", id: nextObjectId });
    setSelectedObjectIds([nextObjectId]);
  };

  const duplicateRoom = () => {
    const zone = findRoomZone(editor, selected);
    const floor = getActiveFloor(editor, activeFloorId);
    if (!zone || !floor) return;
    const snapSize = editor?.plan?.snapSize || DEFAULT_PLAN_SIZE.snapSize;
    const geometry = findRoomDuplicateGeometry({ zone, floor, zones: editor.zones || [], snapSize });
    if (!geometry) {
      notify?.("Não há espaço livre ao lado para duplicar este cômodo.", "warning");
      return;
    }
    let nextRoomId = null;
    commitEditor((draft) => {
      nextRoomId = duplicateRoomInDraft({ draft, zone, geometry, createId });
      return draft;
    });
    if (nextRoomId) setSelected({ type: "zone", id: nextRoomId });
  };

  const duplicateSelected = () => {
    if (selected?.type === "object") duplicateObject();
    else if (selected?.type === "zone") duplicateRoom();
  };

  const rotateObjects = () => {
    const targetIds = selectedObjectIds.length > 1 ? selectedObjectIds : [selected.id];
    const unlockedIds = filterUnlockedObjectIds(editor?.objects, targetIds);
    if (unlockedIds.length === 0) {
      notify?.("Destrave a seleção antes de girá-la.", "warning");
      return;
    }
    commitEditor((draft) => rotateObjectsInDraft(draft, unlockedIds, activeFloorId));
  };

  const rotateRoom = () => {
    const zone = findRoomZone(editor, selected);
    const floor = getActiveFloor(editor, activeFloorId);
    if (!zone || !floor) return;
    const snapSize = editor?.plan?.snapSize || DEFAULT_PLAN_SIZE.snapSize;
    const nextGeometry = getRotatedRoomGeometry({ zone, floor, snapSize });
    if (!isRoomPlacementValid(nextGeometry, floor, editor.zones || [], zone.id)) {
      notify?.("Não foi possível girar: o cômodo ocuparia uma área já usada.", "warning");
      return;
    }
    commitEditor((draft) => rotateRoomInDraft({ draft, zone, nextGeometry }));
  };

  const rotateSelected = () => {
    if (selected?.type === "object") {
      rotateObjects();
    } else if (selected?.type === "zone") {
      rotateRoom();
    } else if (placement) {
      setPlacement((current) => current ? { ...current, rotation: (current.rotation + 90) % 180, preview: null } : current);
    }
  };

  return { duplicateSelected, rotateSelected };
}
