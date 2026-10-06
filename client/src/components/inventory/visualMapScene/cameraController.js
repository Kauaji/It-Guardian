import * as THREE from "three";
import { normalizeNumber } from "./sceneHelpers.js";

// Acoes de camera da cena: enquadrar mapa, centralizar objeto e redefinir.
export function createCameraController({ camera, controls, maxMapDimension, initialCameraPosition, getSelectedObject, render }) {
  function resetCamera() {
    controls.target.set(0, 0, 0);
    camera.position.copy(initialCameraPosition);
    camera.near = 0.1;
    camera.far = Math.max(1000, maxMapDimension * 10);
    camera.updateProjectionMatrix();
    controls.update();
    render();
  }

  function fitMap() {
    const distance = Math.max(8, maxMapDimension * 1.35);
    controls.target.set(0, 0, 0);
    camera.position.set(distance * 0.48, distance * 0.72, distance * 0.88);
    camera.lookAt(controls.target);
    controls.update();
    render();
  }

  function focusSelection() {
    const selected = getSelectedObject();
    if (!selected) return;
    const target = new THREE.Vector3(
      normalizeNumber(selected.positionX, 0),
      normalizeNumber(selected.positionY, 0) + normalizeNumber(selected.height, 1) / 2,
      normalizeNumber(selected.positionZ, 0)
    );
    const direction = camera.position.clone().sub(controls.target).normalize();
    const objectSize = Math.max(
      normalizeNumber(selected.width, 1),
      normalizeNumber(selected.depth, 1),
      normalizeNumber(selected.height, 1)
    );
    controls.target.copy(target);
    camera.position.copy(target).add(direction.multiplyScalar(Math.max(4, objectSize * 4)));
    camera.lookAt(target);
    controls.update();
    render();
  }

  return { fitMap, focusSelection, resetCamera };
}
