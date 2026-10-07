import * as THREE from "three";

/** Luz hemisferica, sol com sombras (resolucao menor em telas estreitas) e luz de preenchimento. */
export function addLights(scene, sceneSpan, viewportWidth) {
  const hemisphere = new THREE.HemisphereLight("#eef8fc", "#52625b", 0.82);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight("#fff1d8", 1.58);
  sun.position.set(-sceneSpan * 0.34, sceneSpan * 0.82, sceneSpan * 0.42);
  sun.castShadow = true;
  const shadowSize = viewportWidth < 700 ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.left = -sceneSpan;
  sun.shadow.camera.right = sceneSpan;
  sun.shadow.camera.top = sceneSpan;
  sun.shadow.camera.bottom = -sceneSpan;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = sceneSpan * 2.8;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);

  const fill = new THREE.DirectionalLight("#b9dcf4", 0.42);
  fill.position.set(sceneSpan * 0.52, sceneSpan * 0.38, -sceneSpan * 0.62);
  scene.add(fill);
}

/** Base do pavimento (laje com arestas) e plano que recebe a sombra no chao. */
export function addFloorBase({ scene, floorWidth, floorHeight, textures }) {
  const baseGeometry = new THREE.BoxGeometry(floorWidth, 10, floorHeight);
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: "#c8d2da",
    map: textures.getSurfaceTexture("concrete", "floor"),
    roughness: 0.88,
    metalness: 0
  });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.receiveShadow = true;
  scene.add(base);

  const baseEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(baseGeometry, 34),
    new THREE.LineBasicMaterial({ color: "#8fa1af", transparent: true, opacity: 0.58 })
  );
  baseEdges.position.copy(base.position);
  scene.add(baseEdges);

  const groundShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(floorWidth * 1.24, floorHeight * 1.24),
    new THREE.ShadowMaterial({ color: "#15283a", opacity: 0.13 })
  );
  groundShadow.rotation.x = -Math.PI / 2;
  groundShadow.position.y = -6;
  groundShadow.receiveShadow = true;
  scene.add(groundShadow);
}
