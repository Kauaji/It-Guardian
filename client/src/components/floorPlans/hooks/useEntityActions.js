import { isEditorObjectLocked } from "../utils/editorGeometry.js";
import {
  filterUnlockedObjectIds,
  moveObjectInDraft,
  patchEntityInDraft,
  removeEntityFromDraft,
  removeObjectsFromDraft,
  setObjectsLockedInDraft
} from "../utils/entityMutations.js";
import {
  getActionObjectIds,
  getPrimarySelection,
  toggleIdInSelection
} from "../utils/selectionActions.js";

function isMultiSelectModifier(event) {
  return Boolean(event?.shiftKey || event?.ctrlKey || event?.metaKey);
}

/**
 * Acoes sobre a selecao: selecionar (com multipla selecao), alterar, remover,
 * excluir, travar/destravar e mover objetos arrastados na cena 3D.
 */
export function useEntityActions({ doc, ui, notify }) {
  const { editor, activeFloorId, commitEditor } = doc;
  const {
    selected, setSelected, selectedObjectIds, setSelectedObjectIds, selectedTool, paintDraft
  } = ui;

  const removeEntity = (target) => {
    if (!target) return;
    if (target.type === "object") {
      const targetObject = (editor?.objects || []).find((object) => object.id === target.id);
      if (isEditorObjectLocked(targetObject)) {
        notify?.("Destrave o objeto antes de exclui-lo.", "warning");
        return;
      }
    }
    commitEditor((draft) => removeEntityFromDraft(draft, target));
    setSelected((current) => current?.type === target.type && current?.id === target.id ? null : current);
    if (target.type === "object") {
      setSelectedObjectIds((current) => current.filter((id) => id !== target.id));
    }
  };

  const updateSelectedEntity = (patch) => {
    if (!selected) return;
    if (patch.remove) {
      removeEntity(selected);
      return;
    }
    commitEditor((draft) => patchEntityInDraft(draft, selected, patch, activeFloorId));
  };

  const handleEntitySelect = (target, event) => {
    if (paintDraft) return;
    if (!target) {
      if (selectedTool !== "delete") ui.clearSelection();
      return;
    }
    if (selectedTool === "delete") {
      removeEntity(target);
      return;
    }
    if (target.type === "object") {
      if (isMultiSelectModifier(event)) {
        setSelectedObjectIds((current) => {
          const next = toggleIdInSelection(current, target.id);
          setSelected(getPrimarySelection(next));
          return next;
        });
        return;
      }
      setSelectedObjectIds((current) => current.includes(target.id) ? current : [target.id]);
    } else {
      setSelectedObjectIds([]);
    }
    setSelected(target);
  };

  const deleteSelectedEntity = () => {
    if (selectedObjectIds.length > 1) {
      const removableIds = filterUnlockedObjectIds(editor?.objects, selectedObjectIds);
      if (removableIds.length === 0) {
        notify?.("Destrave a seleção antes de excluí-la.", "warning");
        return;
      }
      commitEditor((draft) => removeObjectsFromDraft(draft, removableIds));
      const remainingIds = selectedObjectIds.filter((objectId) => !removableIds.includes(objectId));
      setSelected(remainingIds[0] ? { type: "object", id: remainingIds[0] } : null);
      setSelectedObjectIds(remainingIds);
      return;
    }
    if (!selected) return;
    updateSelectedEntity({ remove: true });
  };

  const toggleSelectedObjectLock = () => {
    const targetIds = getActionObjectIds(selected, selectedObjectIds);
    if (targetIds.length === 0) return;
    const targetObjects = (editor?.objects || []).filter((object) => targetIds.includes(object.id));
    if (targetObjects.length === 0) return;
    const nextLocked = !targetObjects.every(isEditorObjectLocked);
    commitEditor((draft) => setObjectsLockedInDraft(draft, targetIds, nextLocked));
    notify?.(nextLocked ? "Seleção travada no mapa." : "Seleção destravada.", "success");
  };

  const moveObjectFrom3D = (objectId, position) => {
    const sourceObject = (editor?.objects || []).find((object) => object.id === objectId);
    if (isEditorObjectLocked(sourceObject)) return;
    commitEditor((draft) => moveObjectInDraft(draft, objectId, position, activeFloorId));
  };

  return {
    removeEntity,
    updateSelectedEntity,
    handleEntitySelect,
    deleteSelectedEntity,
    toggleSelectedObjectLock,
    moveObjectFrom3D
  };
}
