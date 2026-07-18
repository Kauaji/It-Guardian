import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MODEL_QUALITY_DETAILED,
  MODEL_QUALITY_SIMPLE,
  getInventoryMapAssetDefinition,
  resolveInventoryMapAssetMode
} from "../../../client/src/components/floorPlans/assets/inventoryMapAssetRegistry.js";
import { getCatalogItem } from "../../../client/src/components/floorPlans/floorPlanCatalog.js";
import {
  createPaintAreaZone,
  eraseCells,
  fillRoomCells,
  findPaintAreaAtPoint,
  getBrushCells,
  getPaintCells,
  getPaintRuns,
  paintCells
} from "../../../client/src/components/floorPlans/utils/paintAreaGeometry.js";
import {
  createRoomWallObjects,
  ensureRoomWallObjects,
  getRoomWallId,
  removeRoomCascade,
  syncAnchoredOpenings
} from "../../../client/src/components/floorPlans/utils/wallGeometry.js";
import {
  findSupportingFurniture,
  getSceneBaseElevation,
  resolveSceneObjectType
} from "../../../client/src/components/floorPlans/utils/sceneObjectPlacement.js";

const room = {
  id: "room-1",
  planId: "plan-1",
  floorId: "floor-1",
  zoneType: "room",
  geometry: { x: 20, y: 40, width: 200, height: 120 },
  metadata: { room: { wallThickness: 10, wallHeight: 115 } }
};

describe("floor plan paint areas", () => {
  it("paints, erases and consolidates brush cells", () => {
    const firstStroke = getBrushCells({ x: 40, y: 40 }, 1, 20);
    const secondStroke = getBrushCells({ x: 60, y: 40 }, 1, 20);
    const painted = paintCells(firstStroke, secondStroke);

    assert.deepEqual(painted, ["2:2", "3:2"]);
    assert.deepEqual(eraseCells(painted, secondStroke), ["2:2"]);
    assert.deepEqual(getPaintRuns(painted), [{ row: 2, startColumn: 2, endColumn: 3 }]);
  });

  it("fills a known room and clips a segment to its parent group", () => {
    const roomCells = fillRoomCells(room, 20);
    const allowed = roomCells.slice(0, 3);
    const clipped = paintCells([], roomCells, allowed);

    assert.ok(roomCells.length > allowed.length);
    assert.deepEqual(clipped, allowed);
  });

  it("creates a persistent area that can be found after reload", () => {
    const area = createPaintAreaZone({
      id: "area-1",
      planId: "plan-1",
      floorId: "floor-1",
      areaType: "group",
      name: "Infraestrutura",
      color: "#8b5cf6",
      cells: ["2:2", "3:2"],
      groupId: "group-1"
    });

    const reloaded = JSON.parse(JSON.stringify(area));
    assert.deepEqual(getPaintCells(reloaded), ["2:2", "3:2"]);
    assert.equal(findPaintAreaAtPoint([reloaded], { x: 45, y: 45 })?.id, "area-1");
  });
});

describe("room wall generation", () => {
  it("creates four deterministic selectable walls for a room", () => {
    const walls = createRoomWallObjects(room);
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    assert.equal(walls.length, 4);
    assert.deepEqual(walls.map((wall) => wall.id), [
      getRoomWallId(room.id, "top"),
      getRoomWallId(room.id, "right"),
      getRoomWallId(room.id, "bottom"),
      getRoomWallId(room.id, "left")
    ]);
    assert.equal(new Set(walls.map((wall) => wall.id)).size, 4);
    assert.ok(walls.every((wall) => uuidPattern.test(wall.id)));
    assert.deepEqual(createRoomWallObjects(room).map((wall) => wall.id), walls.map((wall) => wall.id));
    assert.ok(walls.every((wall) => wall.metadata.generatedFromRoom && wall.metadata.startPoint && wall.metadata.endPoint));
  });

  it("keeps an anchored opening synchronized and removes it with the room", () => {
    const walls = ensureRoomWallObjects([], [room]);
    const topWall = walls.find((wall) => wall.id === getRoomWallId(room.id, "top"));
    const door = {
      id: "door-1",
      planId: "plan-1",
      floorId: "floor-1",
      objectType: "door",
      width: 60,
      height: 16,
      metadata: { anchorType: "wall", parentObjectId: topWall.id, anchorOffset: 0.5 }
    };
    const syncedDoor = syncAnchoredOpenings([...walls, door]).find((object) => object.id === door.id);
    const removed = removeRoomCascade([...walls, syncedDoor], [room], room.id);

    assert.equal(syncedDoor.metadata.parentObjectId, topWall.id);
    assert.equal(removed.objects.length, 0);
    assert.equal(removed.zones.length, 0);
  });
});

describe("local 3D asset registry", () => {
  it("uses procedural fallback in simple mode and a Kenney composite PC in detailed mode", () => {
    assert.equal(resolveInventoryMapAssetMode("pc", MODEL_QUALITY_SIMPLE).mode, "fallback");
    assert.equal(resolveInventoryMapAssetMode("pc", MODEL_QUALITY_DETAILED).mode, "composite");
    assert.equal(resolveInventoryMapAssetMode("pc", MODEL_QUALITY_DETAILED).parts.length, 3);
  });

  it("provides a safe fallback for unknown object types", () => {
    const definition = getInventoryMapAssetDefinition("custom-device");

    assert.equal(definition.fallback, "box");
    assert.equal(resolveInventoryMapAssetMode("custom-device", MODEL_QUALITY_DETAILED).url, null);
  });

  it("registers optimized Quaternius furniture only for detailed mode", async () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const expectedModels = ["desk", "table", "chair", "cabinet", "shelf", "door"];

    for (const type of expectedModels) {
      const definition = getInventoryMapAssetDefinition(type);
      const detailed = resolveInventoryMapAssetMode(type, MODEL_QUALITY_DETAILED);
      const simple = resolveInventoryMapAssetMode(type, MODEL_QUALITY_SIMPLE);
      const modelPath = path.join(repoRoot, "client/public", detailed.url.replace(/^\//, ""));
      const modelStat = await stat(modelPath);

      assert.equal(detailed.mode, "model");
      assert.equal(simple.mode, "fallback");
      assert.equal(definition.source, "Quaternius Ultimate Furniture Pack");
      assert.equal(definition.license, "CC0");
      assert.ok(modelStat.size > 0 && modelStat.size <= 5_000_000);
    }
  });

  it("registers the local Kenney computer assets under the 5 MB limit", async () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const detailedPc = resolveInventoryMapAssetMode("pc", MODEL_QUALITY_DETAILED);
    const detailedNotebook = resolveInventoryMapAssetMode("notebook", MODEL_QUALITY_DETAILED);
    const modelUrls = [...detailedPc.parts.map((part) => part.url), detailedNotebook.url];

    assert.equal(detailedNotebook.definition.source, "Kenney Furniture Kit");
    assert.equal(detailedNotebook.definition.license, "CC0");
    for (const modelUrl of modelUrls) {
      const modelPath = path.join(repoRoot, "client/public", modelUrl.replace(/^\//, ""));
      const modelStat = await stat(modelPath);
      assert.ok(modelStat.size > 0 && modelStat.size <= 5_000_000);
    }
  });

  it("registers a local Kenney TV model and keeps legacy TV objects compatible", async () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const detailedTv = resolveInventoryMapAssetMode("tv", MODEL_QUALITY_DETAILED);
    const modelPath = path.join(repoRoot, "client/public", detailedTv.url.replace(/^\//, ""));
    const modelStat = await stat(modelPath);

    assert.equal(detailedTv.mode, "model");
    assert.equal(detailedTv.definition.source, "Kenney Furniture Kit");
    assert.equal(detailedTv.definition.license, "CC0");
    assert.equal(resolveSceneObjectType({ objectType: "camera", label: "TV" }), "tv");
    assert.equal(resolveSceneObjectType({ objectType: "camera", label: "Televisao da sala" }), "tv");
    assert.equal(resolveSceneObjectType({ objectType: "desktop", label: "PC legado" }), "pc");
    assert.equal(resolveSceneObjectType({ objectType: "laptop", label: "Notebook legado" }), "notebook");
    assert.equal(resolveSceneObjectType({ objectType: "camera", label: "Camera" }), "camera");
    assert.ok(modelStat.size > 0 && modelStat.size <= 5_000_000);
  });
});

describe("3D object placement", () => {
  it("rests anchored computers on the top surface of their table", () => {
    const table = {
      id: "table-1",
      objectType: "desk",
      floorId: "floor-1",
      x: 100,
      y: 100,
      width: 120,
      height: 60,
      height3d: 46,
      metadata: { parentRoomId: "room-1" }
    };
    const pc = {
      id: "pc-1",
      objectType: "pc",
      floorId: "floor-1",
      x: 140,
      y: 115,
      width: 40,
      height: 30,
      metadata: { parentRoomId: "room-1", anchorObjectId: "table-1" }
    };

    assert.equal(findSupportingFurniture(pc, [table, pc])?.id, "table-1");
    assert.equal(getSceneBaseElevation(pc, [table, pc]), 48);
  });

  it("keeps a slightly displaced computer on an overlapping meeting table", () => {
    const table = {
      id: "meeting-table-1",
      objectType: "meeting-table",
      floorId: "floor-1",
      x: 100,
      y: 100,
      width: 150,
      height: 78,
      height3d: 48,
      metadata: { parentRoomId: "room-1" }
    };
    const pc = {
      id: "pc-1",
      objectType: "pc",
      floorId: "floor-1",
      x: 232,
      y: 118,
      width: 44,
      height: 34,
      metadata: { parentRoomId: "room-1" }
    };

    assert.equal(findSupportingFurniture(pc, [table, pc])?.id, "meeting-table-1");
    assert.equal(getSceneBaseElevation(pc, [table, pc]), 50);
  });

  it("keeps unsupported devices on the floor", () => {
    const pc = { id: "pc-1", objectType: "pc", x: 20, y: 20, width: 40, height: 30 };

    assert.equal(findSupportingFurniture(pc, [pc]), null);
    assert.equal(getSceneBaseElevation(pc, [pc]), 0);
  });
});

describe("door catalog variants", () => {
  it("keeps four compatible door designs with distinct metadata", () => {
    const expected = [
      ["door", "single"],
      ["door-double", "double"],
      ["door-sliding", "sliding"],
      ["door-pocket", "pocket"]
    ];

    for (const [id, doorType] of expected) {
      const item = getCatalogItem(id);
      assert.equal(item.objectType, "door");
      assert.equal(item.metadata.doorType, doorType);
    }
  });
});
