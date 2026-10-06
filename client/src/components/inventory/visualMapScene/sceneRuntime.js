import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildConnectionLine } from "./connectionBuilder.js";
import { createCameraController } from "./cameraController.js";
import { buildObjectMesh } from "./objectBuilder.js";
import { createPicker } from "./picking.js";
import { disposeScene, getInitialCameraPosition, getSavedCameraState, normalizeNumber } from "./sceneHelpers.js";

function createRenderer(host, width, height) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = false;
  host.replaceChildren(renderer.domElement);
  return renderer;
}

function createControls(camera, renderer, savedCameraState, maxMapDimension) {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.target.copy(savedCameraState?.target || new THREE.Vector3(0, 0, 0));
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 4;
  controls.maxDistance = maxMapDimension * 2.4;
  return controls;
}

function addLights(scene) {
  scene.add(new THREE.HemisphereLight("#ffffff", "#cbd5e1", 2.1));
  const directional = new THREE.DirectionalLight("#ffffff", 1.25);
  directional.position.set(10, 18, 8);
  scene.add(directional);
}

function addFloorAndGrid(scene, map, mapWidth, mapDepth, showGrid) {
  const maxMapDimension = Math.max(mapWidth, mapDepth);
  const floorGeometry = new THREE.BoxGeometry(mapWidth, 0.08, mapDepth);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.85 });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.position.y = -0.04;
  scene.add(floor);

  if (showGrid) {
    const gridScale = Math.max(0.1, normalizeNumber(map.scale, 1));
    const divisions = Math.min(400, Math.max(8, Math.round(maxMapDimension / gridScale)));
    const grid = new THREE.GridHelper(maxMapDimension, divisions);
    grid.material.opacity = 0.32;
    grid.material.transparent = true;
    scene.add(grid);
  }
}

// Adiciona objetos e conexoes visiveis e devolve os alvos selecionaveis por raio.
function addContent(scene, { visibleObjects, visibleConnections, selectedObjectId, selectedConnectionId }) {
  const selectableMeshes = [];
  for (const object of visibleObjects) {
    const { group, mesh } = buildObjectMesh(object, selectedObjectId);
    selectableMeshes.push(mesh);
    scene.add(group);
  }

  for (const connection of visibleConnections) {
    const builtConnection = buildConnectionLine(connection, selectedConnectionId);
    if (!builtConnection) continue;
    selectableMeshes.push(...builtConnection.selectable);
    scene.add(builtConnection.group);
  }
  return selectableMeshes;
}

/**
 * Monta a cena do mapa (renderer, camera, controles, objetos e conexoes) e
 * devolve { cameraApi, dispose }. Estado de camera persiste em cameraStateRef.
 */
export function createVisualMapRuntime({ host, map, content, showGrid, refs }) {
  const { selectableRef, cameraStateRef, onSelectObjectRef, onSelectConnectionRef } = refs;
  const width = host.clientWidth || 860;
  const height = host.clientHeight || 480;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f8fafc");

  const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 1000);
  const mapWidth = normalizeNumber(map.width, 30);
  const mapDepth = normalizeNumber(map.depth, 20);
  const maxMapDimension = Math.max(mapWidth, mapDepth);
  const initialCameraPosition = getInitialCameraPosition(mapWidth, mapDepth);
  const savedCameraState = getSavedCameraState(cameraStateRef.current, map.id);
  camera.position.copy(savedCameraState?.position || initialCameraPosition);

  const renderer = createRenderer(host, width, height);
  const controls = createControls(camera, renderer, savedCameraState, maxMapDimension);
  addLights(scene);
  addFloorAndGrid(scene, map, mapWidth, mapDepth, showGrid);
  selectableRef.current = addContent(scene, content);

  const handlePointerDown = createPicker({ renderer, camera, selectableRef, onSelectObjectRef, onSelectConnectionRef });
  renderer.domElement.addEventListener("pointerdown", handlePointerDown);

  const render = () => renderer.render(scene, camera);
  const cameraApi = createCameraController({
    camera,
    controls,
    maxMapDimension,
    initialCameraPosition,
    getSelectedObject: () => content.visibleObjects.find((object) => object.id === content.selectedObjectId),
    render
  });
  controls.addEventListener("change", render);
  render();

  const resizeObserver = new ResizeObserver(([entry]) => {
    const nextWidth = Math.max(320, Math.round(entry.contentRect.width));
    const nextHeight = Math.max(280, Math.round(entry.contentRect.height));
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(nextWidth, nextHeight);
    render();
  });
  resizeObserver.observe(host);

  function dispose() {
    resizeObserver.disconnect();
    cameraStateRef.current = {
      mapId: map.id,
      position: camera.position.clone(),
      target: controls.target.clone()
    };
    renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
    controls.removeEventListener("change", render);
    controls.dispose();
    disposeScene(scene);
    renderer.dispose();
    host.replaceChildren();
    selectableRef.current = [];
  }

  return { cameraApi, dispose };
}
