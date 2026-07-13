import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  centerAssetOnTable,
  constrainObjectToBounds,
  normalizeResponsePlan,
  resizeObjectGeometry
} from "../../../client/src/components/floorPlans/utils/editorGeometry.js";

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
});
