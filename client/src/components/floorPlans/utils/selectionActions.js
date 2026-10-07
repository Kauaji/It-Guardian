import { isEditorObjectLocked } from "./editorGeometry.js";
import { isAnchoredOpening } from "./wallGeometry.js";

/** Ids dos objetos alvo das acoes da selecao (multipla selecao ou o objeto selecionado). */
export function getActionObjectIds(selected, selectedObjectIds) {
  if (selectedObjectIds.length > 0) return selectedObjectIds;
  return selected?.type === "object" ? [selected.id] : [];
}

/**
 * Estado derivado da selecao usado pela barra de acoes: o que pode ser
 * duplicado, girado, excluido ou travado.
 */
export function getSelectionActionState({ editor, selected, selectedObjectIds }) {
  const actionObjectIds = getActionObjectIds(selected, selectedObjectIds);
  const actionObjects = (editor?.objects || []).filter((object) => actionObjectIds.includes(object.id));
  const objectSelectionActive = selected?.type === "object" && actionObjects.length > 0;
  const allLocked = objectSelectionActive && actionObjects.every(isEditorObjectLocked);
  const hasUnlocked = objectSelectionActive && actionObjects.some((object) => !isEditorObjectLocked(object));
  const singleObject = actionObjects.length === 1 ? actionObjects[0] : null;
  return {
    actionObjects,
    objectSelectionActive,
    allLocked,
    canDuplicate: selected?.type === "zone" || Boolean(singleObject && !isAnchoredOpening(singleObject)),
    canRotate: selected?.type === "zone" || hasUnlocked,
    canDelete: selected?.type !== "object" || hasUnlocked
  };
}

/** Alterna um id na selecao multipla (Shift/Ctrl/Cmd + clique). */
export function toggleIdInSelection(current, id) {
  return current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
}

/** Resultado da selecao por retangulo: acrescenta (Ctrl/Cmd) ou substitui a selecao. */
export function mergeMarqueeSelection(current, ids, additive) {
  return additive ? [...new Set([...current, ...ids])] : ids;
}

/** Entidade "principal" da selecao multipla: o ultimo objeto marcado. */
export function getPrimarySelection(objectIds) {
  return objectIds.length ? { type: "object", id: objectIds[objectIds.length - 1] } : null;
}
