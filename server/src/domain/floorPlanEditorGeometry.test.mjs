import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  centerAssetOnTable,
  constrainObjectToBounds,
  findObjectsInSelectionRect,
  normalizeResponsePlan,
  normalizeSelectionRect,
  resizeObjectGeometry
} from "../../../client/src/components/floorPlans/utils/editorGeometry.js";
import {
  attachOpeningToWall,
  resizeWallEndpoint,
  removeObjectCascade,
  snapPointToWallEndpoints,
  snapWallEndPoint,
  syncAnchoredOpenings
} from "../../../client/src/components/floorPlans/utils/wallGeometry.js";

const floor = { id: "floor-1", width: 500, height: 400 };
const room = {
  id: "room-1",
  floorId: "floor-1",
  zoneType: "room",
  geometry: { x: 100, y: 100, width: 200, height: 150 },
  metadata: { room: { wallThickness: 10 } }
};

function createEditor(objects = []) {
  return {
    plan: { gridSize: 25, snapSize: 25, metersPerGridCell: 0.5 },
    floors: [floor],
    zones: [room],
    objects
  };
}

describe("floor plan editor geometry rules", () => {
  it("keeps desktop assets centered on their table", () => {
    const table = {
      id: "table-1",
      objectType: "desk",
      x: 100,
      y: 100,
      width: 120,
      height: 60,
      metadata: { parentRoomId: "room-1" }
    };
    const asset = { id: "pc-1", objectType: "pc", x: 0, y: 0, width: 40, height: 30, metadata: {} };

    const centered = centerAssetOnTable(asset, table);

    assert.equal(centered.x, 140);
    assert.equal(centered.y, 115);
    assert.equal(centered.metadata.parentRoomId, "room-1");
    assert.equal(centered.metadata.anchorObjectId, "table-1");
  });

  it("clamps objects into their parent room interior", () => {
    const editor = createEditor();
    const object = {
      id: "pc-1",
      objectType: "pc",
      x: 0,
      y: 0,
      width: 80,
      height: 50,
      metadata: { parentRoomId: "room-1" }
    };

    const constrained = constrainObjectToBounds(object, editor, floor);

    assert.equal(constrained.x, 110);
    assert.equal(constrained.y, 110);
    assert.equal(constrained.metadata.parentRoomId, "room-1");
  });

  it("resizes objects with snap and minimum dimensions", () => {
    const editor = createEditor();
    const object = {
      id: "desk-1",
      objectType: "desk",
      x: 120,
      y: 120,
      width: 80,
      height: 50,
      metadata: { parentRoomId: "room-1" }
    };

    const expanded = resizeObjectGeometry({ object, side: "east", deltaX: 7, deltaY: 0, editor, floor, snapSize: 5 });
    const shrunken = resizeObjectGeometry({ object, side: "west", deltaX: 70, deltaY: 0, editor, floor, snapSize: 5 });

    assert.equal(expanded.width, 85);
    assert.equal(expanded.height, 50);
    assert.equal(shrunken.width, 34);
    assert.equal(shrunken.height, 50);
  });

  it("normalizes loaded plans and recenters desktop assets", () => {
    const table = {
      id: "table-1",
      objectType: "desk",
      floorId: "floor-1",
      x: 120,
      y: 130,
      width: 120,
      height: 60,
      metadata: { parentRoomId: "room-1" }
    };
    const pc = {
      id: "pc-1",
      objectType: "pc",
      floorId: "floor-1",
      x: 180,
      y: 170,
      width: 40,
      height: 30,
      metadata: { parentRoomId: "room-1" }
    };

    const normalized = normalizeResponsePlan({ plan: createEditor([table, pc]) });
    const normalizedPc = normalized.objects.find((object) => object.id === "pc-1");

    assert.equal(normalized.plan.metersPerGridCell, 0.5);
    assert.equal(normalizedPc.x, 160);
    assert.equal(normalizedPc.y, 145);
    assert.equal(normalizedPc.metadata.anchorObjectId, "table-1");
  });

  it("snaps wall endpoints to 45 degree increments", () => {
    const endpoint = snapWallEndPoint({ x: 0, y: 0 }, { x: 93, y: 80 }, 5);

    assert.equal(endpoint.angle, 45);
    assert.equal(endpoint.length, 125);
  });

  it("keeps anchored openings attached when their wall moves", () => {
    const wall = { id: "wall-1", objectType: "wall", x: 50, y: 80, width: 200, height: 12, rotation: 0 };
    const door = attachOpeningToWall(
      { id: "door-1", objectType: "door", x: 0, y: 0, width: 60, height: 16, metadata: {} },
      wall,
      { x: 150, y: 86 }
    );
    const movedWall = { ...wall, x: 100, y: 120 };
    const syncedDoor = syncAnchoredOpenings([movedWall, door]).find((object) => object.id === "door-1");

    assert.equal(syncedDoor.x, 170);
    assert.equal(syncedDoor.y, 118);
    assert.equal(syncedDoor.metadata.parentObjectId, "wall-1");
  });

  it("removes anchored openings together with their parent wall", () => {
    const remaining = removeObjectCascade([
      { id: "wall-1", objectType: "wall" },
      { id: "door-1", objectType: "door", metadata: { parentObjectId: "wall-1" } },
      { id: "pc-1", objectType: "pc" }
    ], "wall-1");

    assert.deepEqual(remaining.map((object) => object.id), ["pc-1"]);
  });

  it("selects only objects intersecting the marquee on the active floor", () => {
    const rectangle = normalizeSelectionRect({ x: 90, y: 90 }, { x: 230, y: 190 });
    const selected = findObjectsInSelectionRect([
      { id: "desk-1", floorId: "floor-1", x: 100, y: 100, width: 100, height: 60, rotation: 0 },
      { id: "chair-1", floorId: "floor-1", x: 218, y: 170, width: 30, height: 30, rotation: 45 },
      { id: "pc-other-floor", floorId: "floor-2", x: 120, y: 120, width: 50, height: 40 }
    ], rectangle, "floor-1");

    assert.deepEqual(selected.map((object) => object.id), ["desk-1", "chair-1"]);
  });

  it("snaps new wall points to nearby wall endpoints", () => {
    const walls = [
      { id: "wall-1", floorId: "floor-1", objectType: "wall", x: 100, y: 100, width: 120, height: 10, rotation: 0 }
    ];

    const snapped = snapPointToWallEndpoints({ x: 216, y: 104 }, walls, "floor-1", null, 10);

    assert.deepEqual(snapped, { x: 220, y: 105 });
  });

  it("resizes walls through endpoints without generic box handles", () => {
    const wall = { id: "wall-1", objectType: "wall", x: 100, y: 100, width: 120, height: 10, rotation: 0 };
    const resized = resizeWallEndpoint(wall, "wall-end", { x: 220, y: 85 }, [], 5);

    assert.equal(resized.x, 100);
    assert.equal(resized.y, 100);
    assert.equal(resized.width, 120);
    assert.equal(Math.abs(resized.rotation), 0);
  });
});
