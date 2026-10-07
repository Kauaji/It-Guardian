import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { getFloorPlanCameraPreset, getFloorPlanContentFrame } from "./cameraPresets.js";

const FIELD_OF_VIEW = 42;
const MIN_CONTAINER_HEIGHT = 260;

/** Pavimento ativo (ou o primeiro) e suas dimensoes, com padrao 1280 x 820. */
export function getSceneFloor(data, activeFloorId) {
  const floor = data.floors?.find((entry) => entry.id === activeFloorId) || data.floors?.[0];
  return {
    floor,
    floorWidth: Number(floor?.width || data.plan?.width || 1280),
    floorHeight: Number(floor?.height || data.plan?.height || 820)
  };
}

/**
 * Medidas da cena: tamanho do container, do pavimento, o "vao" da cena e o
 * enquadramento do conteudo (usado pela camera e pelos limites de zoom).
 */
export function computeSceneMetrics({ container, data, activeFloorId }) {
  const width = Math.max(container.clientWidth || 0, 1);
  const height = Math.max(container.clientHeight || 0, MIN_CONTAINER_HEIGHT);
  const { floorWidth, floorHeight } = getSceneFloor(data, activeFloorId);
  const sceneSpan = Math.max(floorWidth, floorHeight, 420);
  const contentFrame = getFloorPlanContentFrame(data, activeFloorId, floorWidth, floorHeight);
  const frameSpan = Math.max(contentFrame.width, contentFrame.height, 320);
  return { width, height, floorWidth, floorHeight, sceneSpan, contentFrame, frameSpan };
}

function createRenderer({ container, width, height, preview }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(preview ? 1 : Math.min(window.devicePixelRatio || 1, width < 700 ? 1.5 : 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  return renderer;
}

function createEnvironment(renderer) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environmentTexture = pmremGenerator.fromScene(room, 0.04).texture;
  room.dispose();
  return { pmremGenerator, environmentTexture };
}

function createControls({ camera, renderer, preview, metrics, target, reducedMotion }) {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !reducedMotion;
  controls.dampingFactor = 0.075;
  controls.enabled = !preview;
  controls.enableZoom = !preview;
  controls.zoomSpeed = 0.62;
  controls.rotateSpeed = 0.58;
  controls.panSpeed = 0.72;
  controls.screenSpacePanning = true;
  controls.minDistance = Math.max(140, metrics.frameSpan * 0.2);
  controls.maxDistance = Math.max(1900, metrics.sceneSpan * 2.4);
  controls.maxPolarAngle = Math.PI / 2.06;
  controls.target.copy(target);
  return controls;
}

/**
 * Cria cena, camera, renderer (anexado ao container), ambiente de iluminacao
 * (PMREM) e controles de orbita. `initialView` e a vista inicial da camera.
 */
export function createStage({ container, metrics, preview, initialView }) {
  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.Fog("#c8d6de", metrics.sceneSpan * 1.9, metrics.sceneSpan * 4.2);

  const view = getFloorPlanCameraPreset(
    initialView,
    metrics.contentFrame.width,
    metrics.contentFrame.height,
    metrics.width / metrics.height,
    FIELD_OF_VIEW,
    metrics.contentFrame.centerX,
    metrics.contentFrame.centerZ
  );
  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, metrics.width / metrics.height, 0.5, Math.max(5000, metrics.sceneSpan * 6));
  camera.position.copy(view.position);
  camera.lookAt(view.target);

  const renderer = createRenderer({ container, width: metrics.width, height: metrics.height, preview });
  const { pmremGenerator, environmentTexture } = createEnvironment(renderer);
  scene.environment = environmentTexture;

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const controls = createControls({ camera, renderer, preview, metrics, target: view.target, reducedMotion });

  return { scene, camera, renderer, controls, pmremGenerator, environmentTexture, reducedMotion };
}

/** Libera cena (geometrias e materiais, sem repetir), ambiente, controles e renderer; remove o canvas. */
export function disposeStage({ stage, container, textures }) {
  const { scene, renderer, controls, pmremGenerator, environmentTexture } = stage;
  controls.dispose();
  environmentTexture.dispose();
  pmremGenerator.dispose();
  const disposedGeometries = new Set();
  const disposedMaterials = new Set();
  scene.traverse((item) => {
    if (item.geometry && !disposedGeometries.has(item.geometry)) {
      disposedGeometries.add(item.geometry);
      item.geometry.dispose?.();
    }
    const materials = Array.isArray(item.material) ? item.material : item.material ? [item.material] : [];
    materials.forEach((material) => {
      if (disposedMaterials.has(material)) return;
      disposedMaterials.add(material);
      material.dispose?.();
    });
  });
  textures.dispose();
  renderer.dispose();
  if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
}
