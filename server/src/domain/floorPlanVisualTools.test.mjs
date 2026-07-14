import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MODEL_QUALITY_DETAILED,
  MODEL_QUALITY_SIMPLE,
  getInventoryMapAssetDefinition,
  resolveInventoryMapAssetMode
} from "../../../client/src/components/floorPlans/assets/inventoryMapAssetRegistry.js";
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
  it("uses procedural fallback in simple mode and when no local model exists", () => {
    assert.equal(resolveInventoryMapAssetMode("pc", MODEL_QUALITY_SIMPLE).mode, "fallback");
    assert.equal(resolveInventoryMapAssetMode("pc", MODEL_QUALITY_DETAILED).mode, "fallback");
  });

  it("provides a safe fallback for unknown object types", () => {
    const definition = getInventoryMapAssetDefinition("custom-device");

    assert.equal(definition.fallback, "box");
    assert.equal(resolveInventoryMapAssetMode("custom-device", MODEL_QUALITY_DETAILED).url, null);
  });
});
