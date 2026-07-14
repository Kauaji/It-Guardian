import test from "node:test";
import assert from "node:assert/strict";
import { validateFloorPlanEditorData } from "./floorPlanValidation.js";

const validEditorData = {
  floors: [{ id: "floor-1", name: "Planta 1", width: 1280, height: 820 }],
  zones: [
    {
      id: "zone-1",
      floorId: "floor-1",
      name: "Sala",
      geometry: { x: 20, y: 20, width: 300, height: 220 }
    }
  ],
  objects: [
    {
      id: "object-1",
      floorId: "floor-1",
      objectType: "pc",
      x: 80,
      y: 80,
      width: 60,
      height: 44
    }
  ],
  connectionPoints: [
    {
      id: "point-1",
      floorId: "floor-1",
      pointType: "network",
      linkedObjectId: "object-1",
      x: 120,
      y: 120
    }
  ],
  cableRoutes: [
    {
      id: "route-1",
      floorId: "floor-1",
      routeType: "network",
      sourcePointId: "point-1",
      targetPointId: "point-1",
      path: [{ x: 120, y: 120 }]
    }
  ]
};

test("accepts a valid floor plan editor payload", () => {
  assert.equal(validateFloorPlanEditorData(validEditorData), true);
});

test("rejects editor data without floors", () => {
  assert.throws(
    () => validateFloorPlanEditorData({ ...validEditorData, floors: [] }),
    /pelo menos um andar/
  );
});

test("rejects duplicated entity ids before persistence", () => {
  const duplicateObjects = {
    ...validEditorData,
    objects: [validEditorData.objects[0], { ...validEditorData.objects[0] }]
  };
  assert.throws(
    () => validateFloorPlanEditorData(duplicateObjects),
    /Objeto duplicado: object-1/
  );
});

test("rejects connection points linked to missing objects", () => {
  const brokenLink = {
    ...validEditorData,
    connectionPoints: [{ ...validEditorData.connectionPoints[0], linkedObjectId: "missing-object" }]
  };
  assert.throws(
    () => validateFloorPlanEditorData(brokenLink),
    /referencia um objeto inexistente/
  );
});

test("rejects cable routes linked to missing points", () => {
  const brokenRoute = {
    ...validEditorData,
    cableRoutes: [{ ...validEditorData.cableRoutes[0], targetPointId: "missing-point" }]
  };
  assert.throws(
    () => validateFloorPlanEditorData(brokenRoute),
    /referencia ponto de destino inexistente/
  );
});

test("accepts a door anchored to a wall", () => {
  const anchored = {
    ...validEditorData,
    objects: [
      ...validEditorData.objects,
      { id: "wall-1", floorId: "floor-1", objectType: "wall", x: 20, y: 20, width: 240, height: 12 },
      {
        id: "door-1",
        floorId: "floor-1",
        objectType: "door",
        x: 80,
        y: 18,
        width: 72,
        height: 16,
        metadata: { anchorType: "wall", parentObjectId: "wall-1", anchorOffset: 0.4 }
      }
    ]
  };

  assert.equal(validateFloorPlanEditorData(anchored), true);
});

test("rejects an anchored opening with a missing parent wall", () => {
  const brokenAnchor = {
    ...validEditorData,
    objects: [
      ...validEditorData.objects,
      {
        id: "door-1",
        floorId: "floor-1",
        objectType: "door",
        x: 80,
        y: 18,
        width: 72,
        height: 16,
        metadata: { anchorType: "wall", parentObjectId: "missing-wall", anchorOffset: 0.4 }
      }
    ]
  };

  assert.throws(() => validateFloorPlanEditorData(brokenAnchor), /parede inexistente/);
});
