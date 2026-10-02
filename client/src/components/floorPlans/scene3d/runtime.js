import * as THREE from "three";
import { MODEL_QUALITY_DETAILED } from "../assets/inventoryMapAssetRegistry.js";
import { isMeasurementObject } from "../utils/measurementGeometry.js";
import { syncAnchoredOpenings } from "../utils/wallGeometry.js";
import { createCameraController } from "./cameraController.js";
import { createHighlights } from "./highlights.js";
import { addFloorBase, addLights } from "./lighting.js";
import { createModelController } from "./modelLoader.js";
import { createPartFactory } from "./parts.js";
import { createPicking } from "./picking.js";
import { createSharedResources } from "./resources.js";
import { createSceneObject } from "./sceneObject.js";
import { computeSceneMetrics, createStage, disposeStage } from "./stage.js";
import { createTextureCache } from "./textures.js";
import { addRoutes, addZones } from "./zonesAndRoutes.js";

const MIN_CONTAINER_HEIGHT = 260;

/** Zonas, objetos (sem medidas) e rotas do pavimento ativo. */
function selectActiveEntities(data, activeFloorId) {
  const onFloor = (entry) => !activeFloorId || entry.floorId === activeFloorId;
  return {
    zones: (data.zones || []).filter(onFloor),
    objects: syncAnchoredOpenings(data.objects || []).filter(onFloor).filter((object) => !isMeasurementObject(object)),
    routes: (data.cableRoutes || []).filter(onFloor)
  };
}

function addGrid({ scene, metrics, visible }) {
  const grid = new THREE.GridHelper(Math.max(metrics.floorWidth, metrics.floorHeight), 32, "#94a3b8", "#cbd5e1");
  grid.position.y = 6;
  grid.material.transparent = true;
  grid.material.opacity = 0.24;
  grid.visible = visible;
  scene.add(grid);
  return grid;
}

function observeResize({ container, camera, renderer, render }) {
  const resizeObserver = new ResizeObserver(() => {
    const nextWidth = Math.max(container.clientWidth || 0, 1);
    const nextHeight = Math.max(container.clientHeight || 0, MIN_CONTAINER_HEIGHT);
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(nextWidth, nextHeight);
    render();
  });
  resizeObserver.observe(container);
  return resizeObserver;
}

/**
 * Monta a cena 3D do pavimento dentro do container e devolve a API de controle
 * (`applySelection`, `render`, `setCameraView`, `setGridVisible`) e `dispose`,
 * que libera tudo (renderer, controles, texturas, geometrias, ouvintes).
 *
 * `options`: container, data, activeFloorId, preview, modelQuality, initialView,
 * showGrid, callbacksRef/editableRef (leitura mais recente de callbacks) e
 * onPendingModels (quantidade de modelos 3D ainda carregando).
 */
export function createSceneRuntime(options) {
  const { container, data, activeFloorId, preview, modelQuality, initialView, showGrid } = options;
  const lifecycle = { disposed: false };
  const metrics = computeSceneMetrics({ container, data, activeFloorId });
  const stage = createStage({ container, metrics, preview, initialView });
  const { scene, camera, renderer, controls } = stage;

  addLights(scene, metrics.sceneSpan, metrics.width);
  const textures = createTextureCache({ renderer, onLoad: () => renderer.render(scene, camera) });
  const resources = createSharedResources({ textures });
  addFloorBase({ scene, floorWidth: metrics.floorWidth, floorHeight: metrics.floorHeight, textures });

  const offsets = { x: metrics.floorWidth / 2, y: metrics.floorHeight / 2 };
  const parts = createPartFactory({ scene, textures, resources, offsets });
  const active = selectActiveEntities(data, activeFloorId);
  const objectGroups = new Map();
  const highlights = createHighlights({ scene, camera, renderer, objectGroups });
  const { render } = highlights;
  const models = createModelController({
    enabled: !preview && modelQuality === MODEL_QUALITY_DETAILED,
    resources,
    parts,
    lifecycle,
    render,
    onPendingChange: options.onPendingModels
  });

  addZones(active.zones, parts.addBox);
  active.objects.forEach((object) => createSceneObject({
    object,
    scene,
    objectGroups,
    activeObjects: active.objects,
    activeZones: active.zones,
    offsets,
    parts,
    models,
    modelQuality
  }));
  addRoutes({ routes: active.routes, scene, offsets, createMaterial: resources.createMaterial });
  const grid = addGrid({ scene, metrics, visible: showGrid });

  const cameraController = createCameraController({
    camera,
    controls,
    contentFrame: metrics.contentFrame,
    preview,
    reducedMotion: stage.reducedMotion,
    render,
    lifecycle
  });
  const picking = createPicking({
    renderer,
    camera,
    controls,
    objectGroups,
    activeObjects: active.objects,
    offsets,
    callbacksRef: options.callbacksRef,
    editableRef: options.editableRef,
    highlights
  });
  if (!preview) picking.attach();
  const resizeObserver = observeResize({ container, camera, renderer, render });

  return {
    api: {
      applySelection: highlights.applySelection,
      render,
      setCameraView: cameraController.setCameraView,
      setGridVisible(visible) {
        grid.visible = Boolean(visible);
        render();
      }
    },
    dispose() {
      lifecycle.disposed = true;
      resizeObserver.disconnect();
      cameraController.dispose();
      picking.dispose();
      disposeStage({ stage, container, textures });
    }
  };
}
