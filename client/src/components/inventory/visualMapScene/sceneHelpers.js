import * as THREE from "three";

export function normalizeNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function normalizePoint(point) {
  if (!point) return null;
  return new THREE.Vector3(normalizeNumber(point.x, 0), normalizeNumber(point.y, 0.12), normalizeNumber(point.z, 0));
}

export function getConnectionLabel(connection) {
  return connection.label || connection.connectionType || "Conexão";
}

// Posicao inicial da camera para um mapa de largura x profundidade.
export function getInitialCameraPosition(mapWidth, mapDepth) {
  return new THREE.Vector3(mapWidth * 0.35, Math.max(mapDepth, 14), mapDepth * 0.82);
}

// Pose da camera restaurada somente para o mesmo mapa.
export function getSavedCameraState(saved, mapId) {
  return saved?.mapId === mapId ? saved : null;
}

// Libera geometrias, materiais e texturas da cena.
export function disposeScene(scene) {
  scene.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const disposeMaterial = (material) => {
        if (material.map) material.map.dispose();
        material.dispose();
      };
      if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
      else disposeMaterial(child.material);
    }
  });
}
