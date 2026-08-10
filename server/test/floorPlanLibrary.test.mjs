import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { FLOOR_PLAN_CATALOG } from "../../client/src/components/floorPlans/floorPlanCatalog.js";
import {
  FLOOR_PLAN_LIBRARY,
  FLOOR_PLAN_LIBRARY_BY_ID
} from "../../client/src/components/floorPlans/assets/floorPlanLibrary.js";
import {
  MODEL_QUALITY_DETAILED,
  resolveInventoryMapAssetMode
} from "../../client/src/components/floorPlans/assets/inventoryMapAssetRegistry.js";
import { searchCatalogItems } from "../../client/src/components/floorPlans/utils/catalogSearch.js";
import {
  duplicateEditorObject,
  getInventoryLinkPatch,
  isEditorObjectLocked,
  normalizeEditorData,
  rotateEditorObject
} from "../../client/src/components/floorPlans/utils/editorGeometry.js";
import { ROOM_TEMPLATES, createRoomEntitiesFromTemplate } from "../../client/src/components/floorPlans/utils/roomTemplates.js";
import {
  BASE_FLOOR_SURFACE_ELEVATION,
  ROOM_FLOOR_SURFACE_ELEVATION,
  findSupportingFurniture,
  getSceneBaseElevation,
  getSceneFloorElevation,
  resolveSceneObjectType
} from "../../client/src/components/floorPlans/utils/sceneObjectPlacement.js";
import { removeObjectCascade } from "../../client/src/components/floorPlans/utils/wallGeometry.js";

const root = resolve(import.meta.dirname, "../..");
const manifestPath = resolve(root, "client/public/assets/3d-library/manifest.json");
const attributionsPath = resolve(root, "client/public/assets/3d-library/ATTRIBUTIONS.md");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const REQUIRED_ASSETS = [
  "wall", "simple_door", "double_door", "window", "stairs", "divider", "corridor", "room", "label",
  "desk", "chair", "cabinet", "counter", "drawer_unit", "sofa", "meeting_table",
  "pc", "notebook", "monitor", "printer", "rack", "server", "switch", "router", "access_point", "ups", "ip_phone", "camera",
  "hospital_bed", "stretcher", "nurse_station", "waiting_chair", "reception_counter", "medical_cart", "generic_medical_equipment",
  "power_outlet", "network_point", "patch_panel", "energy_panel", "junction_box", "wall_rack"
];

function publicAssetPath(modelPath) {
  return resolve(root, "client/public", String(modelPath).replace(/^[/\\]+/, ""));
}

test("floor plan manifest is synchronized with the runtime library", () => {
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.assetCount, manifest.assets.length);
  assert.equal(manifest.assets.length, FLOOR_PLAN_LIBRARY.length);
  assert.ok(manifest.assets.length >= 60);
  assert.equal(new Set(manifest.assets.map((asset) => asset.id)).size, manifest.assets.length);

  for (const asset of manifest.assets) {
    const runtimeAsset = FLOOR_PLAN_LIBRARY_BY_ID[asset.id];
    assert.ok(runtimeAsset, `runtime asset missing: ${asset.id}`);
    assert.equal(asset.name, runtimeAsset.label);
    assert.equal(asset.category, runtimeAsset.category);
    assert.equal(asset.modelPath, runtimeAsset.modelPath);
    assert.deepEqual(asset.dimensions, runtimeAsset.dimensions);
  }
});

test("library covers every required operational category and object", () => {
  const categories = new Set(manifest.assets.map((asset) => asset.category));
  for (const category of ["structure", "office", "it", "hospital", "network", "energy"]) {
    assert.ok(categories.has(category), `category missing: ${category}`);
  }
  for (const assetId of REQUIRED_ASSETS) {
    assert.ok(FLOOR_PLAN_LIBRARY_BY_ID[assetId], `required asset missing: ${assetId}`);
  }
});

test("every asset has dimensions and complete provenance metadata", () => {
  for (const asset of manifest.assets) {
    assert.ok(asset.id && asset.name && asset.category && asset.assetType);
    assert.ok(asset.license && asset.source && asset.author && asset.consultedAt);
    assert.ok(asset.originalFormat && asset.finalFormat && asset.conversion);
    assert.ok(asset.dimensions?.width > 0);
    assert.ok(asset.dimensions?.depth > 0);
    assert.ok(asset.dimensions?.height > 0);
    assert.equal(typeof asset.linkableToInventory, "boolean");
    assert.equal(typeof asset.canShowStatus, "boolean");

    if (asset.modelPath) {
      assert.equal(asset.license, "CC0-1.0");
      assert.match(asset.licenseUrl, /creativecommons\.org\/publicdomain\/zero/);
      assert.ok(asset.sourceUrl?.startsWith("https://"));
      assert.equal(asset.originalFormat, "GLB");
      assert.equal(asset.finalFormat, "GLB");
    } else {
      assert.equal(asset.license, "IT-Guardian-Project");
      assert.equal(asset.render3d, "procedural");
    }
  }
});

test("all referenced GLB files exist, match the manifest and stay under 5 MB", () => {
  const attributions = readFileSync(attributionsPath, "utf8");
  for (const asset of manifest.assets.filter((entry) => entry.modelPath)) {
    const filePath = publicAssetPath(asset.modelPath);
    assert.ok(existsSync(filePath), `missing model: ${asset.modelPath}`);
    const fileBytes = statSync(filePath).size;
    assert.equal(asset.fileBytes, fileBytes, `stale file size: ${asset.modelPath}`);
    assert.ok(fileBytes <= manifest.maximumModelBytes, `model exceeds 5 MB: ${asset.modelPath}`);
    assert.ok(attributions.includes(asset.modelPath), `attribution missing model path: ${asset.modelPath}`);
    assert.ok(attributions.includes(asset.sourceUrl), `attribution missing source URL: ${asset.sourceUrl}`);
  }
});

test("global catalog search is accent-insensitive and returns its source section", () => {
  const meetingResults = searchCatalogItems(FLOOR_PLAN_CATALOG, "reuniao");
  assert.ok(meetingResults.some((item) => item.id === "meeting-table"));
  assert.ok(meetingResults.every((item) => item.sectionId && item.sectionLabel));

  const medicalResults = searchCatalogItems(FLOOR_PLAN_CATALOG, "médico");
  assert.ok(medicalResults.some((item) => item.id === "medical-equipment"));

  const televisionResults = searchCatalogItems(FLOOR_PLAN_CATALOG, "televisão");
  assert.ok(televisionResults.some((item) => item.id === "tv"));
});

test("room template creation remains compatible with the current editor payload", () => {
  let sequence = 0;
  const template = ROOM_TEMPLATES.find((entry) => entry.id === "office-small");
  const result = createRoomEntitiesFromTemplate({
    template,
    floor: { id: "floor-1" },
    planId: "plan-1",
    createId: (prefix) => `${prefix}-${++sequence}`,
    x: 100,
    y: 150
  });

  assert.equal(result.zone.zoneType, "room");
  assert.equal(result.zone.floorId, "floor-1");
  assert.ok(result.objects.length >= 2);
  assert.ok(result.objects.every((object) => object.metadata.parentRoomId === result.zone.id));
});

test("legacy plans normalize without losing identifiers or inventory links", () => {
  const legacyEditor = {
    plan: { id: "plan-legacy", width: 900, height: 600, snapSize: 25 },
    floors: [{ id: "floor-legacy", width: 900, height: 600 }],
    zones: [{
      id: "room-legacy",
      floorId: "floor-legacy",
      zoneType: "room",
      name: "Sala antiga",
      geometry: { x: 50, y: 50, width: 320, height: 220 },
      metadata: { room: { wallThickness: 10, wallHeight: 110 } }
    }],
    objects: [{
      id: "pc-legacy",
      floorId: "floor-legacy",
      objectType: "pc",
      label: "Estacao antiga",
      linkedAssetId: "asset-123",
      x: 120,
      y: 120,
      width: 54,
      height: 38,
      metadata: { parentRoomId: "room-legacy" }
    }],
    connectionPoints: [],
    cableRoutes: []
  };

  const normalized = normalizeEditorData(legacyEditor);
  const legacyObject = normalized.objects.find((object) => object.id === "pc-legacy");
  assert.equal(normalized.plan.id, "plan-legacy");
  assert.equal(normalized.zones[0].id, "room-legacy");
  assert.equal(legacyObject.linkedAssetId, "asset-123");
  assert.equal(legacyObject.label, "Estacao antiga");
  assert.equal(normalized.objects.filter((object) => object.metadata?.generatedFromRoom).length, 4);
});

test("object actions duplicate, rotate, link and remove predictably", () => {
  const source = {
    id: "pc-1",
    floorId: "floor-1",
    objectType: "pc",
    label: "Financeiro",
    linkedAssetId: "asset-old",
    x: 100,
    y: 120,
    width: 54,
    height: 38,
    rotation: 0,
    metadata: { parentRoomId: "room-1", anchorObjectId: "desk-1", locked: true }
  };
  assert.equal(isEditorObjectLocked(source), true);
  const copy = duplicateEditorObject(source, { id: "pc-2", offset: 10 });
  assert.equal(copy.id, "pc-2");
  assert.equal(copy.x, 110);
  assert.equal(copy.y, 130);
  assert.equal(copy.linkedAssetId, null);
  assert.equal(copy.metadata.anchorObjectId, null);
  assert.equal(copy.metadata.duplicatedFromId, "pc-1");
  assert.equal(isEditorObjectLocked(copy), false);
  assert.equal(rotateEditorObject(copy).rotation, 90);
  assert.equal(rotateEditorObject({ ...copy, rotation: 0 }, -90).rotation, 270);

  const linkPatch = getInventoryLinkPatch({ id: "asset-2", groupId: "group-1", segmentId: "segment-1" }, "PC Financeiro");
  assert.deepEqual(linkPatch, {
    linkedAssetId: "asset-2",
    label: "PC Financeiro",
    groupId: "group-1",
    segmentId: "segment-1"
  });

  const objects = [
    { id: "wall-1", objectType: "wall" },
    { id: "door-1", objectType: "door", metadata: { parentObjectId: "wall-1" } },
    { id: "desk-1", objectType: "desk" }
  ];
  assert.deepEqual(removeObjectCascade(objects, "wall-1").map((object) => object.id), ["desk-1"]);
});

test("3D placement keeps supported equipment above furniture and rooms above the base floor", () => {
  const table = {
    id: "desk-1",
    floorId: "floor-1",
    objectType: "desk",
    x: 100,
    y: 100,
    width: 100,
    height: 60,
    height3d: 46,
    metadata: { parentRoomId: "room-1" }
  };
  const pc = {
    id: "pc-1",
    floorId: "floor-1",
    objectType: "pc",
    label: "Computador",
    x: 120,
    y: 112,
    width: 54,
    height: 38,
    metadata: { parentRoomId: "room-1", anchorObjectId: "desk-1" }
  };
  const room = {
    id: "room-1",
    floorId: "floor-1",
    zoneType: "room",
    geometry: { x: 50, y: 50, width: 260, height: 200 },
    metadata: { room: { wallThickness: 10 } }
  };

  assert.equal(findSupportingFurniture(pc, [pc, table])?.id, "desk-1");
  assert.equal(getSceneBaseElevation(pc, [pc, table]), 48);
  assert.equal(getSceneFloorElevation(pc, [room]), ROOM_FLOOR_SURFACE_ELEVATION);
  assert.equal(getSceneFloorElevation({ ...pc, x: 500, y: 500, metadata: {} }, [room]), BASE_FLOOR_SURFACE_ELEVATION);
  assert.equal(resolveSceneObjectType({ objectType: "camera", label: "Televisao da sala" }), "tv");
});

test("detailed 3D mode loads legal models lazily and unknown items keep a fallback", () => {
  const television = resolveInventoryMapAssetMode("tv", MODEL_QUALITY_DETAILED);
  assert.equal(television.mode, "model");
  assert.match(television.url, /televisionModern\.glb$/);

  const desktop = resolveInventoryMapAssetMode("pc", MODEL_QUALITY_DETAILED);
  assert.equal(desktop.mode, "composite");
  assert.ok(desktop.parts.length >= 4);

  const unknown = resolveInventoryMapAssetMode("legacy-unknown", MODEL_QUALITY_DETAILED);
  assert.equal(unknown.mode, "fallback");
  assert.equal(unknown.definition.fallback, "box");
});
