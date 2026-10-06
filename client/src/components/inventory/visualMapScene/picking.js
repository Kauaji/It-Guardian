import * as THREE from "three";

// Seleciona objeto/conexao por raio a partir de um pointerdown no canvas.
export function createPicker({ renderer, camera, selectableRef, onSelectObjectRef, onSelectConnectionRef }) {
  const raycaster = new THREE.Raycaster();
  raycaster.params.Line = { threshold: 0.28 };
  const pointer = new THREE.Vector2();

  return function handlePointerDown(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1);
    raycaster.setFromCamera(pointer, camera);
    const [hit] = raycaster.intersectObjects(selectableRef.current, false);
    const connectionId = hit?.object?.userData?.connectionId || null;
    if (connectionId) {
      onSelectConnectionRef.current?.(connectionId);
      return;
    }
    onSelectObjectRef.current?.(hit?.object?.userData?.objectId || null);
  };
}
