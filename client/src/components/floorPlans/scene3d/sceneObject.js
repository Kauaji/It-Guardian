import * as THREE from "three";
import { resolveInventoryMapAssetMode } from "../assets/inventoryMapAssetRegistry.js";
import { getSceneBaseElevation, getSceneFloorElevation, resolveSceneObjectType } from "../utils/sceneObjectPlacement.js";
import { buildProceduralObject } from "./proceduralObject.js";
import { toColor } from "./resources.js";

/**
 * Cria o grupo 3D de um objeto da planta: posicao (com elevacao sobre mesas e
 * piso do comodo), rotacao, geometria procedural e, se houver, o pedido do
 * modelo GLB detalhado. O grupo e registrado em `objectGroups`.
 */
export function createSceneObject({ object, scene, objectGroups, activeObjects, activeZones, offsets, parts, models, modelQuality }) {
  const width = Number(object.width || 72);
  const depth = Number(object.height || 52);
  const type = resolveSceneObjectType(object);
  const group = new THREE.Group();
  group.position.set(
    Number(object.x || 0) + width / 2 - offsets.x,
    getSceneFloorElevation(object, activeZones) + getSceneBaseElevation(object, activeObjects),
    Number(object.y || 0) + depth / 2 - offsets.y
  );
  group.rotation.y = THREE.MathUtils.degToRad(Number(object.rotation || 0));
  group.userData.objectId = object.id;
  group.userData.object = object;

  buildProceduralObject({ group, object, type, width, depth, color: toColor(object.color, "#1f7a61"), parts, activeObjects });

  scene.add(group);
  group.traverse((child) => {
    child.userData.objectId = object.id;
    child.userData.objectRoot = group;
  });
  objectGroups.set(object.id, group);
  models.attachDetailedModel(group, object, type, resolveInventoryMapAssetMode(type, modelQuality), { width, depth });
  return group;
}
