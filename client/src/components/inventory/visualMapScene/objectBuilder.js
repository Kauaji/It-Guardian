import * as THREE from "three";
import { normalizeNumber } from "./sceneHelpers.js";
import { createTextSprite } from "./textSprite.js";

export function buildObjectMesh(object, selectedId) {
  const width = normalizeNumber(object.width, 1);
  const depth = normalizeNumber(object.depth, 1);
  const height = normalizeNumber(object.height, 1);
  const color = object.color || (object.layer === "structure" ? "#64748b" : "#2563eb");
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: object.presetType === "rack" || object.presetType === "server" ? 0.12 : 0.02,
    transparent: object.presetType === "room" || object.presetType === "corridor",
    opacity: object.presetType === "room" || object.presetType === "corridor" ? 0.5 : 1
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(
    normalizeNumber(object.positionX, 0),
    normalizeNumber(object.positionY, 0) + height / 2,
    normalizeNumber(object.positionZ, 0)
  );
  mesh.rotation.set(
    THREE.MathUtils.degToRad(normalizeNumber(object.rotationX, 0)),
    THREE.MathUtils.degToRad(normalizeNumber(object.rotationY, 0)),
    THREE.MathUtils.degToRad(normalizeNumber(object.rotationZ, 0))
  );
  mesh.userData.objectId = object.id;

  const outline = new THREE.BoxHelper(mesh, selectedId === object.id ? "#0ea5e9" : "#0f172a");
  outline.material.transparent = true;
  outline.material.opacity = selectedId === object.id ? 0.95 : 0.18;

  const group = new THREE.Group();
  group.add(mesh);
  group.add(outline);

  if (object.layer === "assets") {
    const label = createTextSprite(object.label);
    label.position.set(mesh.position.x, mesh.position.y + height / 2 + 0.45, mesh.position.z);
    group.add(label);
  }

  return { group, mesh };
}
