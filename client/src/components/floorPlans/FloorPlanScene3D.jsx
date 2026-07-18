import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getRoomGeometry, getRoomInterior, isRoomZone } from "./utils/roomGeometry.js";
import { isWallObject, syncAnchoredOpenings } from "./utils/wallGeometry.js";
import { getPaintCellSize, getPaintCells, getPaintRuns, isPaintAreaZone } from "./utils/paintAreaGeometry.js";
import { getSceneBaseElevation, resolveSceneObjectType } from "./utils/sceneObjectPlacement.js";
import {
  MODEL_QUALITY_DETAILED,
  resolveInventoryMapAssetMode
} from "./assets/inventoryMapAssetRegistry.js";

function toColor(value, fallback = "#1f7a61") {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback;
}

const FLOOR_TEXTURE_COLORS = {
  ceramic: "#e8edf2",
  concrete: "#cbd5e1",
  wood: "#c9a97b",
  carpet: "#94a3b8",
  technical: "#a7b6c6"
};

const WALL_TEXTURE_COLORS = {
  paint: "#e2e8f0",
  concrete: "#a8b2bf",
  brick: "#a56b55",
  glass: "#bfdbfe",
  wood: "#b58b62"
};

const PHYSICAL_TEXTURE_URLS = {
  wood: {
    map: "/assets/inventory-map-3d/textures/polyhaven/wood_floor_diff_1k.jpg",
    normalMap: "/assets/inventory-map-3d/textures/polyhaven/wood_floor_nor_gl_1k.jpg",
    roughnessMap: "/assets/inventory-map-3d/textures/polyhaven/wood_floor_rough_1k.jpg"
  },
  brick: {
    map: "/assets/inventory-map-3d/textures/polyhaven/brick_wall_003_diffuse_1k.jpg",
    normalMap: "/assets/inventory-map-3d/textures/polyhaven/brick_wall_003_nor_gl_1k.jpg",
    roughnessMap: "/assets/inventory-map-3d/textures/polyhaven/brick_wall_003_rough_1k.jpg"
  }
};

function seededNoise(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function createSurfaceTexture(preset, kind = "floor") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const baseColor = kind === "wall"
    ? WALL_TEXTURE_COLORS[preset] || WALL_TEXTURE_COLORS.paint
    : FLOOR_TEXTURE_COLORS[preset] || FLOOR_TEXTURE_COLORS.ceramic;
  context.fillStyle = baseColor;
  context.fillRect(0, 0, 256, 256);

  if (preset === "wood") {
    context.strokeStyle = kind === "wall" ? "rgba(72, 42, 24, 0.34)" : "rgba(89, 54, 31, 0.3)";
    context.lineWidth = 2;
    const plankSize = kind === "wall" ? 32 : 48;
    for (let offset = 0; offset <= 256; offset += plankSize) {
      context.beginPath();
      if (kind === "wall") {
        context.moveTo(offset, 0);
        context.lineTo(offset, 256);
      } else {
        context.moveTo(0, offset);
        context.lineTo(256, offset);
      }
      context.stroke();
    }
    context.strokeStyle = "rgba(255, 255, 255, 0.14)";
    for (let line = 0; line < 20; line += 1) {
      const axis = seededNoise(line + 1) * 256;
      context.beginPath();
      if (kind === "wall") {
        context.moveTo(axis, 0);
        context.bezierCurveTo(axis + 7, 72, axis - 8, 164, axis + 4, 256);
      } else {
        context.moveTo(0, axis);
        context.bezierCurveTo(72, axis + 5, 164, axis - 7, 256, axis + 3);
      }
      context.stroke();
    }
  } else if (preset === "brick") {
    context.strokeStyle = "rgba(71, 35, 25, 0.42)";
    context.lineWidth = 3;
    for (let row = 0; row < 8; row += 1) {
      const y = row * 32;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(256, y);
      context.stroke();
      const offset = row % 2 ? 32 : 0;
      for (let x = offset; x < 256; x += 64) {
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x, y + 32);
        context.stroke();
      }
    }
  } else if (preset === "ceramic" || preset === "technical") {
    context.strokeStyle = preset === "technical" ? "rgba(50, 74, 92, 0.28)" : "rgba(91, 110, 124, 0.2)";
    context.lineWidth = 2;
    const tileSize = preset === "technical" ? 32 : 64;
    for (let offset = 0; offset <= 256; offset += tileSize) {
      context.beginPath();
      context.moveTo(offset, 0);
      context.lineTo(offset, 256);
      context.moveTo(0, offset);
      context.lineTo(256, offset);
      context.stroke();
    }
  } else {
    for (let index = 0; index < 900; index += 1) {
      const alpha = preset === "carpet" ? 0.16 : 0.08;
      const shade = seededNoise(index + 7) > 0.5 ? 255 : 24;
      context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${alpha})`;
      context.fillRect(seededNoise(index * 3 + 1) * 256, seededNoise(index * 5 + 2) * 256, 1.5, 1.5);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === "wall" ? 3 : 5, kind === "wall" ? 2 : 5);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export default function FloorPlanScene3D({ data, activeFloorId, selected, onSelect, onMoveObject, preview = false }) {
  const containerRef = useRef(null);
  const modelQuality = MODEL_QUALITY_DETAILED;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data) return undefined;

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 260);
    const floor = data.floors?.find((entry) => entry.id === activeFloorId) || data.floors?.[0];
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e8eef4");
    scene.fog = new THREE.Fog("#e8eef4", 1250, 2500);

    const camera = new THREE.PerspectiveCamera(44, width / height, 1, 5000);
    camera.position.set(0, 720, 780);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(preview ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const environmentTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environmentTexture;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.enabled = !preview;
    controls.enableZoom = false;
    controls.minDistance = 360;
    controls.maxDistance = 1900;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.target.set(0, 0, 0);

    const hemisphere = new THREE.HemisphereLight("#eaf4ff", "#63705f", 1.05);
    scene.add(hemisphere);

    const sun = new THREE.DirectionalLight("#fff4df", 2.1);
    sun.position.set(-360, 720, 420);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -900;
    sun.shadow.camera.right = 900;
    sun.shadow.camera.top = 900;
    sun.shadow.camera.bottom = -900;
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 1800;
    sun.shadow.bias = -0.0004;
    scene.add(sun);

    const floorWidth = Number(floor?.width || data.plan?.width || 1280);
    const floorHeight = Number(floor?.height || data.plan?.height || 820);
    const surfaceTextures = new Map();
    const physicalTextures = new Map();
    const textureLoader = new THREE.TextureLoader();
    const getSurfaceTexture = (preset, kind) => {
      const key = `${kind}:${preset || "default"}`;
      if (!surfaceTextures.has(key)) surfaceTextures.set(key, createSurfaceTexture(preset, kind));
      return surfaceTextures.get(key);
    };
    const getPhysicalTexture = (preset, channel, kind) => {
      const url = PHYSICAL_TEXTURE_URLS[preset]?.[channel];
      if (!url) return null;
      const key = `${kind}:${preset}:${channel}`;
      if (!physicalTextures.has(key)) {
        const texture = textureLoader.load(url, () => renderer.render(scene, camera));
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(kind === "wall" ? 3 : 5, kind === "wall" ? 2 : 5);
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        if (channel === "map") texture.colorSpace = THREE.SRGBColorSpace;
        physicalTextures.set(key, texture);
      }
      return physicalTextures.get(key);
    };
    const getMaterialTextureMaps = (preset, kind) => ({
      map: getPhysicalTexture(preset, "map", kind) || getSurfaceTexture(preset, kind),
      normalMap: getPhysicalTexture(preset, "normalMap", kind),
      roughnessMap: getPhysicalTexture(preset, "roughnessMap", kind)
    });
    const baseGeometry = new THREE.BoxGeometry(floorWidth, 10, floorHeight);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: "#d8e0e7",
      map: getSurfaceTexture("concrete", "floor"),
      roughness: 0.88,
      metalness: 0
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.receiveShadow = true;
    scene.add(base);

    const offsetX = floorWidth / 2;
    const offsetY = floorHeight / 2;
    const activeZones = (data.zones || []).filter((zone) => !activeFloorId || zone.floorId === activeFloorId);
    const activeObjects = syncAnchoredOpenings(data.objects || []).filter((object) => !activeFloorId || object.floorId === activeFloorId);
    const activeRoutes = (data.cableRoutes || []).filter((route) => !activeFloorId || route.floorId === activeFloorId);
    const objectGroups = new Map();
    const modelLoader = !preview && modelQuality === MODEL_QUALITY_DETAILED ? new GLTFLoader() : null;
    const modelScenePromises = new Map();
    const warnedModelUrls = new Set();
    let disposed = false;

    const loadModelScene = (url) => {
      if (!modelLoader) return Promise.reject(new Error("Model loader is disabled"));
      if (!modelScenePromises.has(url)) {
        const promise = modelLoader.loadAsync(url)
          .then((gltf) => gltf?.scene || null)
          .catch((error) => {
            modelScenePromises.delete(url);
            throw error;
          });
        modelScenePromises.set(url, promise);
      }
      return modelScenePromises.get(url);
    };

    const disposeObject3D = (root) => {
      root?.traverse?.((child) => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
        else child.material?.dispose?.();
      });
    };

    const addBox = ({
      x,
      y,
      width: boxWidth,
      depth,
      height: boxHeight,
      color,
      opacity = 1,
      verticalOffset = 0,
      metalness = 0.02,
      texturePreset = null,
      textureKind = "floor"
    }) => {
      const textureMaps = texturePreset
        ? getMaterialTextureMaps(texturePreset, textureKind)
        : {};
      const material = new THREE.MeshStandardMaterial({
        color: toColor(color, "#dbeafe"),
        ...textureMaps,
        transparent: opacity < 1,
        opacity,
        roughness: textureKind === "wall" ? 0.7 : 0.82,
        metalness,
        normalScale: textureMaps.normalMap ? new THREE.Vector2(0.42, 0.42) : undefined
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(boxWidth, boxHeight, depth), material);
      mesh.position.set(Number(x || 0) + boxWidth / 2 - offsetX, boxHeight / 2 + verticalOffset, Number(y || 0) + depth / 2 - offsetY);
      mesh.castShadow = boxHeight > 8;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };

    const createMaterial = (color, opacity = 1, metalness = 0.04, texturePreset = null, textureKind = "object") => {
      const normalizedTextureKind = textureKind === "wall" ? "wall" : "floor";
      const textureMaps = texturePreset
        ? getMaterialTextureMaps(texturePreset, normalizedTextureKind)
        : {};
      return new THREE.MeshStandardMaterial({
        color: toColor(color, "#1f7a61"),
        ...textureMaps,
        transparent: opacity < 1,
        opacity,
        roughness: metalness > 0.2 ? 0.34 : 0.64,
        metalness,
        normalScale: textureMaps.normalMap ? new THREE.Vector2(0.38, 0.38) : undefined
      });
    };

    const addModelPart = (group, {
      x = 0,
      z = 0,
      y = 0,
      width: partWidth = 12,
      depth: partDepth = 12,
      height: partHeight = 12,
      color = "#1f7a61",
      opacity = 1,
      metalness = 0.04,
      texturePreset = null,
      textureKind = "object"
    }) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(partWidth, partHeight, partDepth),
        createMaterial(color, opacity, metalness, texturePreset, textureKind)
      );
      mesh.position.set(x, y + partHeight / 2, z);
      mesh.castShadow = opacity >= 0.5;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };

    const addCylinderPart = (group, { x = 0, z = 0, y = 0, radius = 8, height: partHeight = 12, color = "#1f7a61", opacity = 1 }) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, partHeight, 24), createMaterial(color, opacity, 0.08));
      mesh.position.set(x, y + partHeight / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };

    const fitModelToTarget = (sourceScene, {
      width: targetWidth,
      depth: targetDepth,
      height: targetHeight,
      x = 0,
      z = 0,
      y = 0,
      rotationY = 0,
      objectId
    }) => {
      const model = sourceScene.clone(true);
      model.rotation.y = THREE.MathUtils.degToRad(rotationY);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const scale = Math.min(
        targetWidth / Math.max(size.x, 0.001),
        targetHeight / Math.max(size.y, 0.001),
        targetDepth / Math.max(size.z, 0.001)
      );
      model.scale.setScalar(scale);
      const scaledBounds = new THREE.Box3().setFromObject(model);
      const center = scaledBounds.getCenter(new THREE.Vector3());
      model.position.set(x - center.x, y - scaledBounds.min.y, z - center.z);
      model.traverse((child) => {
        child.userData.objectId = objectId;
        child.castShadow = child.isMesh;
        child.receiveShadow = child.isMesh;
        if (child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => {
            if ("roughness" in material) material.roughness = Math.min(0.72, material.roughness ?? 0.58);
            if ("metalness" in material) material.metalness = Math.min(0.48, material.metalness ?? 0.08);
            material.needsUpdate = true;
          });
        }
      });
      return model;
    };

    const addObjectModel = (object) => {
      const objectWidth = Number(object.width || 72);
      const objectDepth = Number(object.height || 52);
      const type = resolveSceneObjectType(object);
      const color = toColor(object.color, "#1f7a61");
      const accent = "#0f172a";
      const neutral = "#f8fafc";
      const group = new THREE.Group();
      const baseElevation = getSceneBaseElevation(object, activeObjects);
      group.position.set(
        Number(object.x || 0) + objectWidth / 2 - offsetX,
        5 + baseElevation,
        Number(object.y || 0) + objectDepth / 2 - offsetY
      );
      group.rotation.y = THREE.MathUtils.degToRad(Number(object.rotation || 0));
      group.userData.objectId = object.id;
      group.userData.object = object;
      const assetMode = resolveInventoryMapAssetMode(type, modelQuality);

      if (isWallObject(object)) {
        const wallOpenings = activeObjects
          .filter((candidate) => candidate.metadata?.parentObjectId === object.id && ["door", "window"].includes(candidate.objectType))
          .map((opening) => {
            const openingWidth = Math.min(objectWidth, Math.max(12, Number(opening.width || 0)));
            const center = Math.max(0, Math.min(objectWidth, Number(opening.metadata?.anchorOffset ?? 0.5) * objectWidth));
            return {
              start: Math.max(0, center - openingWidth / 2),
              end: Math.min(objectWidth, center + openingWidth / 2)
            };
          })
          .sort((a, b) => a.start - b.start);
        const wallSegments = [];
        let cursor = 0;
        wallOpenings.forEach((opening) => {
          if (opening.start > cursor) wallSegments.push({ start: cursor, end: opening.start });
          cursor = Math.max(cursor, opening.end);
        });
        if (cursor < objectWidth) wallSegments.push({ start: cursor, end: objectWidth });
        (wallOpenings.length ? wallSegments : [{ start: 0, end: objectWidth }]).forEach((segment) => {
          const segmentWidth = Math.max(0, segment.end - segment.start);
          addModelPart(group, {
            x: segment.start + segmentWidth / 2 - objectWidth / 2,
            width: segmentWidth,
            depth: Math.max(4, objectDepth),
            height: Number(object.height3d || (type === "divider" ? 82 : 110)),
            y: 0,
            color: WALL_TEXTURE_COLORS[object.metadata?.texturePreset] || object.color || "#64748b",
            opacity: type === "divider" ? 0.82 : 0.96,
            texturePreset: object.metadata?.texturePreset || "paint",
            textureKind: "wall"
          });
        });
      } else if (["desk", "table", "meeting_table", "meeting-table"].includes(type)) {
        const tableHeight = Math.max(20, Number(object.height3d || 46));
        const topThickness = Math.min(10, tableHeight * 0.24);
        const legHeight = tableHeight - topThickness;
        addModelPart(group, {
          width: objectWidth,
          depth: objectDepth,
          height: topThickness,
          y: legHeight,
          color: "#a9825c",
          texturePreset: "wood"
        });
        const legOffsetX = objectWidth / 2 - 8;
        const legOffsetZ = objectDepth / 2 - 8;
        [
          [-legOffsetX, -legOffsetZ],
          [legOffsetX, -legOffsetZ],
          [-legOffsetX, legOffsetZ],
          [legOffsetX, legOffsetZ]
        ].forEach(([x, z]) => addModelPart(group, { x, z, width: 7, depth: 7, height: legHeight, color: "#6b4f35" }));
      } else if (type === "chair") {
        addModelPart(group, { width: objectWidth * 0.72, depth: objectDepth * 0.72, height: 10, y: 22, color });
        addModelPart(group, { z: objectDepth * 0.22, width: objectWidth * 0.72, depth: 8, height: 42, y: 22, color });
        [
          [-objectWidth * 0.25, -objectDepth * 0.25],
          [objectWidth * 0.25, -objectDepth * 0.25],
          [-objectWidth * 0.25, objectDepth * 0.25],
          [objectWidth * 0.25, objectDepth * 0.25]
        ].forEach(([x, z]) => addModelPart(group, { x, z, width: 4, depth: 4, height: 24, color: "#334155" }));
      } else if (type === "cabinet") {
        addModelPart(group, { width: objectWidth * 0.9, depth: objectDepth * 0.84, height: Number(object.height3d || 96), color: "#b08968", texturePreset: "wood" });
        addModelPart(group, { x: -1, z: -objectDepth * 0.43, y: 6, width: 2, depth: 2, height: Number(object.height3d || 96) - 12, color: "#6b4f35" });
        addModelPart(group, { x: -objectWidth * 0.08, z: -objectDepth * 0.45, y: 48, width: 3, depth: 3, height: 8, color: "#e2e8f0", metalness: 0.45 });
        addModelPart(group, { x: objectWidth * 0.08, z: -objectDepth * 0.45, y: 48, width: 3, depth: 3, height: 8, color: "#e2e8f0", metalness: 0.45 });
      } else if (type === "shelf") {
        const shelfHeight = Number(object.height3d || 92);
        [-objectWidth * 0.43, objectWidth * 0.43].forEach((x) => {
          addModelPart(group, { x, width: 6, depth: objectDepth * 0.82, height: shelfHeight, color: "#8b5e3c" });
        });
        [4, 32, 60, 88].filter((y) => y < shelfHeight).forEach((y) => {
          addModelPart(group, { width: objectWidth * 0.88, depth: objectDepth * 0.82, height: 5, y, color: "#b08968", texturePreset: "wood" });
        });
      } else if (["pc", "notebook"].includes(type)) {
        if (type === "pc") {
          addModelPart(group, { x: -objectWidth * 0.15, width: objectWidth * 0.5, depth: 7, height: 32, y: 8, color: "#2563eb" });
          addModelPart(group, { x: -objectWidth * 0.15, z: -2, width: objectWidth * 0.62, depth: 4, height: 40, y: 6, color: "#111827", opacity: 0.92 });
          addModelPart(group, { x: objectWidth * 0.28, width: 13, depth: objectDepth * 0.42, height: 42, y: 0, color: "#1f2937", metalness: 0.18 });
          addModelPart(group, { x: -objectWidth * 0.15, z: objectDepth * 0.18, width: objectWidth * 0.35, depth: 12, height: 5, y: 0, color: "#475569" });
        } else {
          addModelPart(group, { width: objectWidth * 0.72, depth: objectDepth * 0.52, height: 5, y: 0, color: "#334155" });
          addModelPart(group, { z: -objectDepth * 0.18, width: objectWidth * 0.7, depth: 5, height: 30, y: 3, color: "#1d4ed8" });
        }
      } else if (type === "printer") {
        addModelPart(group, { width: objectWidth * 0.88, depth: objectDepth * 0.74, height: 24, y: 0, color: neutral, metalness: 0.1 });
        addModelPart(group, { z: -objectDepth * 0.34, width: objectWidth * 0.72, depth: 8, height: 5, y: 22, color: "#cbd5e1" });
      } else if (["rack", "server"].includes(type)) {
        addModelPart(group, { width: objectWidth * 0.72, depth: objectDepth * 0.72, height: 90, y: 0, color: "#111827", metalness: 0.22 });
        for (let index = 0; index < 5; index += 1) {
          addModelPart(group, { z: -objectDepth * 0.38, y: 12 + index * 14, width: objectWidth * 0.56, depth: 3, height: 5, color });
        }
        if (type === "rack" && object.metadata?.switchInstalled) {
          addModelPart(group, {
            z: -objectDepth * 0.39,
            y: 56,
            width: objectWidth * 0.58,
            depth: 4,
            height: 10,
            color: "#2563eb",
            metalness: 0.26
          });
          const totalPorts = Math.max(1, Math.min(48, Number(object.metadata?.switchTotalPorts || 24)));
          const workingPorts = Math.max(0, Math.min(totalPorts, Number(object.metadata?.switchWorkingPorts ?? totalPorts)));
          const visiblePorts = Math.min(12, totalPorts);
          for (let index = 0; index < visiblePorts; index += 1) {
            addModelPart(group, {
              x: -objectWidth * 0.23 + index * ((objectWidth * 0.46) / Math.max(visiblePorts - 1, 1)),
              z: -objectDepth * 0.43,
              y: 59,
              width: 2.4,
              depth: 2,
              height: 2.4,
              color: index < Math.ceil((workingPorts / totalPorts) * visiblePorts) ? "#22c55e" : "#ef4444",
              metalness: 0.12
            });
          }
        }
      } else if (["switch", "firewall", "router"].includes(type)) {
        addModelPart(group, { width: objectWidth * 0.88, depth: objectDepth * 0.64, height: 14, y: 18, color: "#334155", metalness: 0.18 });
        addModelPart(group, { z: -objectDepth * 0.32, width: objectWidth * 0.7, depth: 3, height: 4, y: 28, color });
      } else if (type === "access_point") {
        addCylinderPart(group, { radius: Math.min(objectWidth, objectDepth) * 0.28, height: 9, y: 22, color: neutral });
        addCylinderPart(group, { radius: Math.min(objectWidth, objectDepth) * 0.11, height: 11, y: 28, color });
      } else if (type === "camera") {
        addModelPart(group, { width: objectWidth * 0.62, depth: objectDepth * 0.42, height: 18, y: 28, color: neutral, metalness: 0.12 });
        const lens = addCylinderPart(group, { z: -objectDepth * 0.25, radius: Math.min(objectWidth, objectDepth) * 0.12, height: 10, y: 31, color: "#0f172a" });
        lens.rotation.x = Math.PI / 2;
        addModelPart(group, { z: objectDepth * 0.22, width: 8, depth: 16, height: 28, y: 4, color: "#64748b", metalness: 0.18 });
      } else if (type === "tv") {
        const screenHeight = Number(object.height3d || 52);
        addModelPart(group, {
          width: objectWidth * 0.9,
          depth: Math.max(5, objectDepth * 0.2),
          height: screenHeight * 0.72,
          y: screenHeight * 0.2,
          color: "#0f172a",
          metalness: 0.22
        });
        addModelPart(group, {
          z: -Math.max(3, objectDepth * 0.11),
          width: objectWidth * 0.8,
          depth: 2,
          height: screenHeight * 0.58,
          y: screenHeight * 0.27,
          color: "#2563eb",
          opacity: 0.88
        });
        addModelPart(group, { width: 5, depth: 5, height: screenHeight * 0.18, y: 2, color: "#334155", metalness: 0.45 });
        addModelPart(group, { width: objectWidth * 0.34, depth: objectDepth * 0.36, height: 4, y: 0, color: "#334155", metalness: 0.45 });
      } else if (type === "door") {
        const doorType = object.metadata?.doorType || "single";
        const doorHeight = Number(object.height3d || 92);
        const frameDepth = Math.max(6, objectDepth * 0.55);
        const panelDepth = Math.max(4, objectDepth * 0.28);
        const reverseSlide = object.metadata?.slideDirection === "left";
        [-objectWidth / 2 + 3, objectWidth / 2 - 3].forEach((x) => {
          addModelPart(group, { x, width: 6, depth: frameDepth, height: doorHeight + 6, color: "#6b4423", texturePreset: "wood" });
        });
        addModelPart(group, { y: doorHeight, width: objectWidth, depth: frameDepth, height: 6, color: "#6b4423", texturePreset: "wood" });

        if (doorType === "double") {
          const leafWidth = objectWidth * 0.46;
          const openAngle = object.metadata?.swing === "outward" ? -32 : 32;
          [-1, 1].forEach((side) => {
            const leaf = new THREE.Group();
            leaf.position.x = side * (objectWidth / 2 - 5);
            leaf.rotation.y = THREE.MathUtils.degToRad(openAngle * -side);
            addModelPart(leaf, {
              x: -side * leafWidth / 2,
              width: leafWidth,
              depth: panelDepth,
              height: doorHeight,
              color: "#b7793f",
              texturePreset: "wood"
            });
            addModelPart(leaf, {
              x: -side * leafWidth * 0.42,
              z: -panelDepth,
              y: doorHeight * 0.48,
              width: 4,
              depth: 4,
              height: 4,
              color: "#d6a923",
              metalness: 0.65
            });
            group.add(leaf);
          });
        } else if (doorType === "sliding" || doorType === "pocket") {
          const panelWidth = objectWidth * (doorType === "pocket" ? 0.52 : 0.58);
          const panelX = (reverseSlide ? -1 : 1) * objectWidth * 0.2;
          if (doorType === "pocket") {
            addModelPart(group, {
              x: -panelX,
              width: objectWidth * 0.46,
              depth: frameDepth,
              height: doorHeight + 2,
              color: "#7c5738",
              opacity: 0.9,
              texturePreset: "wood"
            });
          } else {
            addModelPart(group, { y: doorHeight + 5, width: objectWidth * 0.92, depth: 4, height: 5, color: "#64748b", metalness: 0.65 });
          }
          addModelPart(group, {
            x: panelX,
            z: doorType === "sliding" ? -panelDepth : 0,
            width: panelWidth,
            depth: panelDepth,
            height: doorHeight,
            color: "#b7793f",
            texturePreset: "wood"
          });
          addModelPart(group, {
            x: panelX - (reverseSlide ? -1 : 1) * panelWidth * 0.38,
            z: -panelDepth,
            y: doorHeight * 0.48,
            width: 4,
            depth: 4,
            height: 4,
            color: "#d6a923",
            metalness: 0.65
          });
        } else {
          const leaf = new THREE.Group();
          leaf.position.x = -objectWidth / 2 + 5;
          leaf.rotation.y = THREE.MathUtils.degToRad(object.metadata?.swing === "outward" ? -36 : 36);
          addModelPart(leaf, {
            x: objectWidth * 0.46,
            width: objectWidth * 0.92,
            depth: panelDepth,
            height: doorHeight,
            color: "#b7793f",
            texturePreset: "wood"
          });
          addModelPart(leaf, {
            x: objectWidth * 0.82,
            z: -panelDepth,
            y: doorHeight * 0.48,
            width: 5,
            depth: 5,
            height: 5,
            color: "#d6a923",
            metalness: 0.65
          });
          group.add(leaf);
        }
      } else if (type === "window") {
        addModelPart(group, { width: objectWidth, depth: 5, height: 42, y: 22, color: "#bfdbfe", opacity: 0.72 });
        addModelPart(group, { width: objectWidth, depth: 7, height: 5, y: 22, color: "#64748b" });
      } else if (["outlet", "power_cable", "stabilizer_600", "stabilizer_1000", "extension_cord", "power_strip"].includes(type)) {
        const isStrip = ["power_strip", "extension_cord", "power_cable"].includes(type);
        addModelPart(group, { width: isStrip ? objectWidth * 0.9 : objectWidth * 0.58, depth: isStrip ? 11 : objectDepth * 0.5, height: isStrip ? 8 : 22, y: 12, color: "#f59e0b" });
        addModelPart(group, { x: objectWidth * 0.18, width: 5, depth: 5, height: 5, y: 21, color: accent });
      } else {
        addModelPart(group, { width: objectWidth, depth: objectDepth, height: Number(object.height3d || 42), y: 0, color, metalness: object.category === "asset" ? 0.18 : 0.04 });
      }

      scene.add(group);
      group.traverse((child) => {
        child.userData.objectId = object.id;
        child.userData.objectRoot = group;
      });
      objectGroups.set(object.id, group);
      const preserveConfiguredRack = type === "rack" && object.metadata?.switchInstalled;
      const preserveDoorVariant = type === "door";
      if (assetMode.mode === "composite" && modelLoader) {
        Promise.all(assetMode.parts.map(async (part) => ({
          part,
          scene: await loadModelScene(part.url)
        }))).then((loadedParts) => {
          if (disposed) return;
          group.children.forEach(disposeObject3D);
          group.clear();
          loadedParts.forEach(({ part, scene: sourceScene }) => {
            if (!sourceScene) return;
            group.add(fitModelToTarget(sourceScene, {
              width: objectWidth * part.width,
              depth: objectDepth * part.depth,
              height: Number(object.height3d || 70) * part.height,
              x: objectWidth * part.x,
              z: objectDepth * part.z,
              y: 0,
              rotationY: Number(part.rotationY || 0),
              objectId: object.id
            }));
          });
          addModelPart(group, {
            x: objectWidth * 0.32,
            z: -objectDepth * 0.08,
            y: 0,
            width: objectWidth * 0.2,
            depth: objectDepth * 0.42,
            height: Number(object.height3d || 70) * 0.68,
            color: "#1c2734",
            metalness: 0.28
          });
          group.traverse((child) => {
            child.userData.objectId = object.id;
            child.userData.objectRoot = group;
          });
          render();
        }).catch((error) => {
          const compositeKey = assetMode.parts.map((part) => part.url).join(",");
          if (!warnedModelUrls.has(compositeKey)) {
            warnedModelUrls.add(compositeKey);
            console.warn("Modelos 3D compostos indisponiveis; usando fallback procedural.", error);
          }
        });
      } else if (assetMode.mode === "model" && modelLoader && !preserveConfiguredRack && !preserveDoorVariant) {
        loadModelScene(assetMode.url).then((sourceScene) => {
          if (disposed || !sourceScene) return;
          group.children.forEach(disposeObject3D);
          group.clear();
          const defaultModelHeights = {
            tv: 58,
            notebook: 28,
            pc: 56,
            chair: 82,
            desk: 46,
            table: 46,
            meeting_table: 48,
            "meeting-table": 48
          };
          const targetHeight = Math.max(
            8,
            Number(object.height3d || defaultModelHeights[type] || 70)
          );
          const model = fitModelToTarget(sourceScene, {
            width: objectWidth,
            depth: objectDepth,
            height: targetHeight,
            rotationY: Number(assetMode.definition.defaultRotationY || 0),
            objectId: object.id
          });
          model.traverse((child) => {
            child.userData.objectId = object.id;
            child.userData.objectRoot = group;
          });
          group.add(model);
          render();
        }).catch((error) => {
          if (!warnedModelUrls.has(assetMode.url)) {
            warnedModelUrls.add(assetMode.url);
            console.warn(`Modelo 3D local indisponivel; usando fallback procedural: ${assetMode.url}`, error);
          }
        });
      }
      return group;
    };

    activeZones.forEach((zone) => {
      const geometry = zone.geometry || {};
      if (isPaintAreaZone(zone)) {
        const cellSize = getPaintCellSize(zone);
        getPaintRuns(getPaintCells(zone)).forEach((run) => {
          addBox({
            x: run.startColumn * cellSize,
            y: run.row * cellSize,
            width: (run.endColumn - run.startColumn + 1) * cellSize,
            depth: cellSize,
            height: 2,
            color: zone.color,
            opacity: zone.zoneType === "segment" ? 0.42 : 0.28,
            verticalOffset: 6
          });
        });
        return;
      }
      if (isRoomZone(zone)) {
        const room = getRoomGeometry(zone);
        const interior = getRoomInterior(zone);
        const floorColor = FLOOR_TEXTURE_COLORS[zone.metadata?.floorTexture] || "#f8fafc";
        addBox({ x: room.x, y: room.y, width: room.width, depth: room.height, height: 4, color: zone.color, opacity: 0.2, verticalOffset: 5 });
        addBox({
          x: interior.x,
          y: interior.y,
          width: interior.width,
          depth: interior.height,
          height: 3,
          color: floorColor,
          opacity: 0.98,
          verticalOffset: 7,
          texturePreset: zone.metadata?.floorTexture || "ceramic",
          textureKind: "floor"
        });
        return;
      }
      const zoneWidth = Number(geometry.width || 180);
      const zoneHeight = Number(geometry.height || 120);
      addBox({ x: geometry.x || 0, y: geometry.y || 0, width: zoneWidth, depth: zoneHeight, height: 8, color: zone.color, opacity: 0.3, verticalOffset: 12 });
    });

    activeObjects.forEach(addObjectModel);

    activeRoutes.forEach((route) => {
      const path = Array.isArray(route.path) ? route.path : [];
      if (path.length < 2) return;
      const routeStyle = route.metadata?.routeStyle || "free";
      const routeHeight = routeStyle === "conduit" ? 14 : routeStyle === "channel" ? 10 : 8;
      const points = path.map((point) => new THREE.Vector3(
        Number(point.x || 0) - offsetX,
        routeHeight,
        Number(point.y || 0) - offsetY
      ));
      const routeColor = toColor(route.color, route.routeType === "power" ? "#f59e0b" : "#2563eb");
      if (routeStyle === "free") {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: routeColor }));
        line.userData.routeId = route.id;
        scene.add(line);
      } else {
        const curve = new THREE.CatmullRomCurve3(points);
        const radius = routeStyle === "conduit" ? 4 : 3;
        const conduit = new THREE.Mesh(
          new THREE.TubeGeometry(curve, Math.max(8, points.length * 8), radius, 8, false),
          createMaterial(routeColor, 1, routeStyle === "conduit" ? 0.28 : 0.08)
        );
        conduit.userData.routeId = route.id;
        scene.add(conduit);
      }
    });

    const grid = new THREE.GridHelper(Math.max(floorWidth, floorHeight), 32, "#94a3b8", "#cbd5e1");
    grid.position.y = 6;
    grid.material.transparent = true;
    grid.material.opacity = 0.34;
    scene.add(grid);

    let selectionHelper = null;
    const selectedGroup = selected?.type === "object" ? objectGroups.get(selected.id) : null;
    if (selectedGroup) {
      selectionHelper = new THREE.BoxHelper(selectedGroup, "#2563eb");
      scene.add(selectionHelper);
    }

    const render = () => {
      selectionHelper?.update();
      renderer.render(scene, camera);
    };
    controls.addEventListener("change", render);

    const handleWheel = (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const offset = camera.position.clone().sub(controls.target);
      const zoomFactor = event.deltaY < 0 ? 0.88 : 1.12;
      const nextDistance = THREE.MathUtils.clamp(
        offset.length() * zoomFactor,
        controls.minDistance,
        controls.maxDistance
      );
      offset.setLength(nextDistance);
      camera.position.copy(controls.target).add(offset);
      camera.updateProjectionMatrix();
      controls.update();
      render();
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let dragState = null;

    const setPointer = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    };

    const handlePointerDown = (event) => {
      if (event.button !== 0) return;
      setPointer(event);
      const hits = raycaster.intersectObjects([...objectGroups.values()], true);
      const hit = hits.find((entry) => entry.object?.userData?.objectId);
      if (!hit) return;
      const objectId = hit.object.userData.objectId;
      const object = activeObjects.find((entry) => entry.id === objectId);
      const root = objectGroups.get(objectId);
      if (!object || !root) return;
      const groundPoint = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, groundPoint)) return;
      dragState = {
        object,
        root,
        start: groundPoint.clone(),
        origin: root.position.clone()
      };
      controls.enabled = false;
      renderer.domElement.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };

    const handlePointerMove = (event) => {
      if (!dragState) return;
      setPointer(event);
      const groundPoint = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, groundPoint)) return;
      dragState.root.position.x = dragState.origin.x + groundPoint.x - dragState.start.x;
      dragState.root.position.z = dragState.origin.z + groundPoint.z - dragState.start.z;
      render();
    };

    const handlePointerUp = (event) => {
      if (!dragState) return;
      const { object, root } = dragState;
      onSelect?.({ type: "object", id: object.id });
      onMoveObject?.(object.id, {
        x: root.position.x + offsetX - Number(object.width || 0) / 2,
        y: root.position.z + offsetY - Number(object.height || 0) / 2
      });
      dragState = null;
      controls.enabled = true;
      renderer.domElement.releasePointerCapture?.(event.pointerId);
      render();
    };

    if (!preview) {
      renderer.domElement.addEventListener("pointerdown", handlePointerDown);
      renderer.domElement.addEventListener("pointermove", handlePointerMove);
      renderer.domElement.addEventListener("pointerup", handlePointerUp);
      renderer.domElement.addEventListener("pointercancel", handlePointerUp);
      renderer.domElement.addEventListener("wheel", handleWheel, { passive: false });
    }

    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = Math.max(container.clientWidth, 320);
      const nextHeight = Math.max(container.clientHeight, 260);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
      render();
    });
    resizeObserver.observe(container);
    render();

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      controls.removeEventListener("change", render);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointercancel", handlePointerUp);
      renderer.domElement.removeEventListener("wheel", handleWheel);
      controls.dispose();
      environmentTexture.dispose();
      pmremGenerator.dispose();
      surfaceTextures.forEach((texture) => texture.dispose());
      physicalTextures.forEach((texture) => texture.dispose());
      renderer.dispose();
      container.removeChild(renderer.domElement);
      scene.traverse((item) => {
        if (item.geometry) item.geometry.dispose();
        if (Array.isArray(item.material)) item.material.forEach((material) => material.dispose?.());
        else if (item.material) item.material.dispose?.();
      });
    };
  }, [activeFloorId, data, modelQuality, onMoveObject, onSelect, preview, selected]);

  return (
    <div className={`floor-plan-scene-shell ${preview ? "preview" : ""}`}>
      <div className="floor-plan-scene-3d" ref={containerRef} aria-label="Visualizacao 3D interativa da planta" />
    </div>
  );
}
