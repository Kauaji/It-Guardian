import { describe, expect, it } from "vitest";
import { buildEditor, createIdSequence } from "../test/fixtures.js";
import { cloneEditor } from "./editorGeometry.js";
import {
  addMeasurementToDraft,
  addOpeningToDraft,
  addWallToDraft,
  getWallPlacementStart,
  snapMeasurementPlacementPoint
} from "./placementCommits.js";
import { createWallObjectFromPoints, isAnchoredOpening } from "./wallGeometry.js";

const wallItem = { id: "wall", objectType: "wall", label: "Parede", color: "#64748b" };

describe("getWallPlacementStart", () => {
  it("ajusta a grade fina de 5 px por padrao", () => {
    const start = getWallPlacementStart({ point: { x: 103, y: 207 }, placement: {}, objects: [], floorId: "floor-1" });
    expect(start).toEqual({ x: 105, y: 205 });
  });

  it("imanta na ponta de uma parede existente", () => {
    const wall = createWallObjectFromPoints({
      id: "wall-a",
      planId: "plan-1",
      floorId: "floor-1",
      item: wallItem,
      start: { x: 100, y: 100 },
      end: { x: 300, y: 100 },
      gridSize: 5
    });
    const start = getWallPlacementStart({ point: { x: 302, y: 104 }, placement: { gridSize: 5 }, objects: [wall], floorId: "floor-1" });
    expect(Math.round(start.x)).toBe(300);
    expect(Math.round(start.y)).toBe(100);
  });
});

describe("addWallToDraft", () => {
  it("adiciona a parede entre o inicio e o ponto final e devolve o id", () => {
    const draft = cloneEditor(buildEditor({ zones: [], objects: [] }));
    const id = addWallToDraft({
      draft,
      floorId: "floor-1",
      placement: { item: wallItem, start: { x: 100, y: 100 }, gridSize: 5 },
      point: { x: 300, y: 101 },
      createId: createIdSequence()
    });
    expect(id).toBe("object-1");
    expect(draft.objects).toHaveLength(1);
    expect(draft.objects[0]).toMatchObject({ id: "object-1", objectType: "wall", floorId: "floor-1", planId: "plan-1" });
    expect(Math.round(draft.objects[0].width)).toBe(200);
  });
});

describe("addMeasurementToDraft", () => {
  const placement = { start: { x: 100, y: 100 }, constrainAngle: false, lengthBuffer: "" };

  it("cria a medicao entre dois pontos", () => {
    const draft = cloneEditor(buildEditor({ zones: [], objects: [] }));
    const id = addMeasurementToDraft({ draft, floorId: "floor-1", placement, end: { x: 300, y: 100 }, createId: createIdSequence() });
    expect(id).toBe("object-1");
    expect(draft.objects[0].objectType).toBe("measurement");
    expect(Math.round(draft.objects[0].width)).toBe(200);
  });

  it("prioriza o comprimento digitado em metros", () => {
    const draft = cloneEditor(buildEditor({ zones: [], objects: [] }));
    addMeasurementToDraft({ draft, floorId: "floor-1", placement: { ...placement, lengthBuffer: "2,5" }, end: { x: 300, y: 100 }, createId: createIdSequence() });
    // 0.5 m por celula de 25 px => 2,5 m = 125 px
    expect(Math.round(draft.objects[0].width)).toBe(125);
  });

  it("imanta o ponto nas pontas das paredes", () => {
    expect(snapMeasurementPlacementPoint({ point: { x: 12.3, y: 45.6 }, objects: [], floorId: "floor-1" })).toEqual({ x: 12.3, y: 45.6 });
  });
});

describe("addOpeningToDraft", () => {
  it("encaixa a abertura na parede e herda o comodo", () => {
    const wall = createWallObjectFromPoints({
      id: "wall-a",
      planId: "plan-1",
      floorId: "floor-1",
      item: wallItem,
      start: { x: 100, y: 100 },
      end: { x: 300, y: 100 },
      gridSize: 5
    });
    wall.metadata = { ...(wall.metadata || {}), parentRoomId: "room-1" };
    const draft = cloneEditor(buildEditor({ objects: [wall] }));
    const id = addOpeningToDraft({
      draft,
      floorId: "floor-1",
      item: { objectType: "door", label: "Porta", width: 74, height: 24, metadata: { doorType: "single" } },
      wall,
      point: { x: 200, y: 105 },
      createId: createIdSequence()
    });
    const opening = draft.objects.find((object) => object.id === id);
    expect(isAnchoredOpening(opening)).toBe(true);
    expect(opening.metadata.parentObjectId).toBe("wall-a");
    expect(opening.metadata.parentRoomId).toBe("room-1");
    expect(opening.height3d).toBe(96);
  });

  it("usa altura 3D menor para janelas", () => {
    const wall = createWallObjectFromPoints({ id: "wall-a", planId: "plan-1", floorId: "floor-1", item: wallItem, start: { x: 100, y: 100 }, end: { x: 300, y: 100 }, gridSize: 5 });
    const draft = cloneEditor(buildEditor({ objects: [wall] }));
    const id = addOpeningToDraft({ draft, floorId: "floor-1", item: { objectType: "window", label: "Janela" }, wall, point: { x: 200, y: 100 }, createId: createIdSequence() });
    expect(draft.objects.find((object) => object.id === id).height3d).toBe(48);
  });
});
