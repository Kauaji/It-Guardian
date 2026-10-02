import * as THREE from "three";
import { CAMERA_DRAG_THRESHOLD } from "./constants.js";

/**
 * Selecao e arrasto de objetos com o ponteiro: raycast nos grupos da cena,
 * hover, arrasto sobre o plano do chao (com limiar para nao confundir com
 * orbitar a camera) e cancelamento. Os ouvintes sao registrados no canvas e
 * removidos em `dispose`.
 */
export function createPicking({
  renderer,
  camera,
  controls,
  objectGroups,
  activeObjects,
  offsets,
  callbacksRef,
  editableRef,
  highlights
}) {
  const canvas = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const { render, applyHover, clearHover } = highlights;
  let dragState = null;

  const setPointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  };

  const hitObject = () => {
    const hits = raycaster.intersectObjects([...objectGroups.values()], true);
    return hits.find((entry) => entry.object?.userData?.objectId) || null;
  };

  const endDrag = (event) => {
    dragState = null;
    controls.enabled = true;
    canvas.releasePointerCapture?.(event.pointerId);
    canvas.classList.remove("is-object-dragging");
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    setPointer(event);
    const hit = hitObject();
    if (!hit) return;
    const objectId = hit.object.userData.objectId;
    const object = activeObjects.find((entry) => entry.id === objectId);
    const root = objectGroups.get(objectId);
    if (!object || !root) return;
    callbacksRef.current.onSelect?.({ type: "object", id: object.id });
    event.stopPropagation();
    event.preventDefault();
    if (!editableRef.current || object.metadata?.locked) return;
    const groundPoint = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, groundPoint)) return;
    dragState = {
      object,
      root,
      start: groundPoint.clone(),
      origin: root.position.clone(),
      pointerX: event.clientX,
      pointerY: event.clientY,
      moved: false
    };
    canvas.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    setPointer(event);
    if (!dragState) {
      applyHover(hitObject()?.object?.userData?.objectId || null);
      return;
    }
    event.stopPropagation();
    const pointerDistance = Math.hypot(event.clientX - dragState.pointerX, event.clientY - dragState.pointerY);
    if (!dragState.moved && pointerDistance < CAMERA_DRAG_THRESHOLD) return;
    if (!dragState.moved) {
      dragState.moved = true;
      controls.enabled = false;
      canvas.classList.add("is-object-dragging");
    }
    const groundPoint = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, groundPoint)) return;
    dragState.root.position.x = dragState.origin.x + groundPoint.x - dragState.start.x;
    dragState.root.position.z = dragState.origin.z + groundPoint.z - dragState.start.z;
    render();
  };

  const handlePointerUp = (event) => {
    if (!dragState) return;
    const { object, root, moved } = dragState;
    callbacksRef.current.onSelect?.({ type: "object", id: object.id });
    if (moved) {
      callbacksRef.current.onMoveObject?.(object.id, {
        x: root.position.x + offsets.x - Number(object.width || 0) / 2,
        y: root.position.z + offsets.y - Number(object.height || 0) / 2
      });
    }
    endDrag(event);
    render();
  };

  const handlePointerCancel = (event) => {
    if (!dragState) return;
    dragState.root.position.copy(dragState.origin);
    endDrag(event);
    render();
  };

  const handlePointerLeave = () => {
    if (!dragState) clearHover();
  };

  const listeners = [
    ["pointerdown", handlePointerDown, true],
    ["pointermove", handlePointerMove, true],
    ["pointerup", handlePointerUp],
    ["pointercancel", handlePointerCancel],
    ["pointerleave", handlePointerLeave]
  ];

  return {
    attach() {
      listeners.forEach(([type, handler, capture]) => canvas.addEventListener(type, handler, capture));
    },
    dispose() {
      listeners.forEach(([type, handler, capture]) => canvas.removeEventListener(type, handler, capture));
    }
  };
}
