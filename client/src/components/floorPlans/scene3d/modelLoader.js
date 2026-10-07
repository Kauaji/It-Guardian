import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const DEFAULT_MODEL_HEIGHTS = {
  tv: 58,
  notebook: 28,
  pc: 56,
  chair: 82,
  desk: 46,
  table: 46,
  meeting_table: 48,
  "meeting-table": 48
};

/** Escala e posiciona o modelo carregado para caber no alvo (largura/profundidade/altura), apoiado em y. */
export function fitModelToTarget(
  sourceScene,
  { width: targetWidth, depth: targetDepth, height: targetHeight, x = 0, z = 0, y = 0, rotationY = 0, objectId }
) {
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
}

/** Altura alvo de um modelo unico: altura do objeto, da biblioteca, padrao do tipo ou 70. */
export function resolveModelTargetHeight(object, assetMode, type) {
  return Math.max(8, Number(object.height3d || assetMode.definition?.dimensions?.height || DEFAULT_MODEL_HEIGHTS[type] || 70));
}

function markObjectTree(root, object, group) {
  root.traverse((child) => {
    child.userData.objectId = object.id;
    child.userData.objectRoot = group;
  });
}

/**
 * Carregamento sob demanda dos modelos GLB (um por URL, com cache de
 * promessas). Desativado (`null`) no modo preview. Os modelos substituem a
 * geometria procedural do objeto quando chegam; se falharem, o procedural fica.
 */
export function createModelController({ enabled, resources, parts, lifecycle, render, onPendingChange }) {
  const loader = enabled ? new GLTFLoader() : null;
  const scenePromises = new Map();
  const warnedUrls = new Set();
  let pendingCount = 0;

  const updatePending = (delta) => {
    pendingCount = Math.max(0, pendingCount + delta);
    if (!lifecycle.disposed) onPendingChange(pendingCount);
  };

  const loadModelScene = (url) => {
    if (!loader) return Promise.reject(new Error("Model loader is disabled"));
    if (!scenePromises.has(url)) {
      const promise = loader
        .loadAsync(url)
        .then((gltf) => gltf?.scene || null)
        .catch((error) => {
          scenePromises.delete(url);
          throw error;
        });
      scenePromises.set(url, promise);
    }
    return scenePromises.get(url);
  };

  const warnOnce = (key, message, error) => {
    if (warnedUrls.has(key)) return;
    warnedUrls.add(key);
    console.warn(message, error);
  };

  const clearGroup = (group) => {
    group.children.forEach(resources.disposeObject3D);
    group.clear();
  };

  const attachComposite = (group, object, assetMode, { width, depth }) => {
    updatePending(1);
    Promise.all(
      assetMode.parts.map(async (part) => ({
        part,
        scene: await loadModelScene(part.url)
      }))
    )
      .then((loadedParts) => {
        if (lifecycle.disposed) return;
        clearGroup(group);
        const height = Number(object.height3d || 70);
        loadedParts.forEach(({ part, scene: sourceScene }) => {
          if (!sourceScene) return;
          group.add(
            fitModelToTarget(sourceScene, {
              width: width * part.width,
              depth: depth * part.depth,
              height: height * part.height,
              x: width * part.x,
              z: depth * part.z,
              y: 0,
              rotationY: Number(part.rotationY || 0),
              objectId: object.id
            })
          );
        });
        parts.addModelPart(group, {
          x: width * 0.32,
          z: -depth * 0.08,
          y: 0,
          width: width * 0.2,
          depth: depth * 0.42,
          height: height * 0.68,
          color: "#1c2734",
          metalness: 0.28
        });
        markObjectTree(group, object, group);
        render();
      })
      .catch((error) => {
        warnOnce(
          assetMode.parts.map((part) => part.url).join(","),
          "Modelos 3D compostos indisponíveis; usando fallback procedural.",
          error
        );
      })
      .finally(() => updatePending(-1));
  };

  const attachSingle = (group, object, type, assetMode, { width, depth }) => {
    updatePending(1);
    loadModelScene(assetMode.url)
      .then((sourceScene) => {
        if (lifecycle.disposed || !sourceScene) return;
        clearGroup(group);
        const model = fitModelToTarget(sourceScene, {
          width,
          depth,
          height: resolveModelTargetHeight(object, assetMode, type),
          rotationY: Number(assetMode.definition.defaultRotationY ?? assetMode.definition.defaultRotation ?? 0),
          objectId: object.id
        });
        markObjectTree(model, object, group);
        group.add(model);
        render();
      })
      .catch((error) => {
        warnOnce(assetMode.url, `Modelo 3D local indisponível; usando fallback procedural: ${assetMode.url}`, error);
      })
      .finally(() => updatePending(-1));
  };

  /**
   * Pede o modelo detalhado do objeto (composto ou unico). Racks com switch e
   * portas mantem a geometria procedural, que reflete a configuracao.
   */
  const attachDetailedModel = (group, object, type, assetMode, size) => {
    if (!loader) return;
    const keepProcedural = (type === "rack" && object.metadata?.switchInstalled) || type === "door";
    if (assetMode.mode === "composite") attachComposite(group, object, assetMode, size);
    else if (assetMode.mode === "model" && !keepProcedural) attachSingle(group, object, type, assetMode, size);
  };

  return { attachDetailedModel };
}
