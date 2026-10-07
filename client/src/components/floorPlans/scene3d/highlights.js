import * as THREE from "three";

function removeHelper(scene, helper) {
  scene.remove(helper);
  helper.geometry?.dispose?.();
  helper.material?.dispose?.();
}

function createBoxHelper(root, color, opacity) {
  const helper = new THREE.BoxHelper(root, color);
  helper.material.transparent = true;
  helper.material.opacity = opacity;
  return helper;
}

/**
 * Contornos de selecao (azul) e de hover (verde) dos objetos da cena e o
 * `render` que os mantem atualizados. `objectGroups` mapeia id -> grupo.
 */
export function createHighlights({ scene, camera, renderer, objectGroups }) {
  let selectionHelper = null;
  let hoverHelper = null;
  let hoveredObjectId = null;

  const render = () => {
    selectionHelper?.update();
    hoverHelper?.update();
    renderer.render(scene, camera);
  };

  const clearSelectionHelper = () => {
    if (!selectionHelper) return;
    removeHelper(scene, selectionHelper);
    selectionHelper = null;
  };

  const applySelection = (nextSelection) => {
    clearSelectionHelper();
    const selectedGroup = nextSelection?.type === "object" ? objectGroups.get(nextSelection.id) : null;
    if (selectedGroup) {
      selectionHelper = createBoxHelper(selectedGroup, "#16a3c7", 0.96);
      scene.add(selectionHelper);
    }
    render();
  };

  const clearHover = () => {
    if (hoverHelper) {
      removeHelper(scene, hoverHelper);
      hoverHelper = null;
    }
    hoveredObjectId = null;
    renderer.domElement.classList.remove("is-object-hovered");
  };

  const applyHover = (objectId) => {
    if (objectId === hoveredObjectId) return;
    clearHover();
    const root = objectGroups.get(objectId);
    if (!root) {
      render();
      return;
    }
    hoveredObjectId = objectId;
    hoverHelper = createBoxHelper(root, "#50bfa5", 0.58);
    scene.add(hoverHelper);
    renderer.domElement.classList.add("is-object-hovered");
    render();
  };

  return { render, applySelection, applyHover, clearHover };
}
