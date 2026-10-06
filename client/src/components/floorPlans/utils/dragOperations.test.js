import { describe, expect, it } from "vitest";
import { buildDesk, buildEditor, buildPc } from "../test/fixtures.js";
import { cloneEditor } from "./editorGeometry.js";
import {
  createEntityDrag,
  createMarqueeDrag,
  createObjectResizeDrag,
  createPanDrag,
  createRoomResizeDrag,
  findDraggableEntity,
  getDragObjectIds
} from "./dragState.js";
import { applyDragToDraft, computeDragDeltas, computeObjectDragAlignment, getDragSnapSize } from "./dragOperations.js";

const editor = buildEditor({
  objects: [buildDesk(), buildPc({ metadata: { parentRoomId: "room-1", anchorObjectId: "desk-1" } })],
  connectionPoints: [{ id: "p1", floorId: "floor-1", x: 150, y: 150, metadata: { parentRoomId: "room-1" } }]
});
const floor = editor.floors[0];

function runDrag(drag, point, { altKey = false, shiftKey = false } = {}) {
  const snapSize = getDragSnapSize(drag, editor);
  const deltas = computeDragDeltas(drag, point, snapSize);
  const alignment = computeObjectDragAlignment({ drag, deltas, editor, floor, snapSize, altKey });
  const draft = cloneEditor(editor);
  applyDragToDraft(draft, drag, { ...deltas, ...alignment, point, floor, snapSize, activeFloorId: "floor-1", shiftKey });
  return { draft, alignment, deltas, snapSize };
}

describe("estados de arrasto", () => {
  it("cria estados de pan e de selecao por retangulo", () => {
    expect(createPanDrag({ clientX: 1, clientY: 2, viewBox: { x: 0 } })).toEqual({
      type: "pan",
      clientX: 1,
      clientY: 2,
      viewBox: { x: 0 }
    });
    expect(createMarqueeDrag({ x: 3, y: 4 }, true)).toEqual({ type: "marquee", startX: 3, startY: 4, additive: true });
  });

  it("localiza a entidade arrastavel por tipo", () => {
    expect(findDraggableEntity(editor, "object", "desk-1").id).toBe("desk-1");
    expect(findDraggableEntity(editor, "zone", "room-1").id).toBe("room-1");
    expect(findDraggableEntity(editor, "point", "p1").id).toBe("p1");
    expect(findDraggableEntity(editor, "object", "nada")).toBeUndefined();
  });

  it("arrasta toda a selecao quando o objeto clicado ja faz parte dela", () => {
    expect(getDragObjectIds("object", "a", ["a", "b"])).toEqual(["a", "b"]);
    expect(getDragObjectIds("object", "c", ["a", "b"])).toEqual(["c"]);
    expect(getDragObjectIds("zone", "z", ["a"])).toEqual([]);
  });

  it("guarda origens, ignorando objetos travados", () => {
    const locked = cloneEditor(editor);
    locked.objects.find((object) => object.id === "pc-1").metadata.locked = true;
    const drag = createEntityDrag({
      editor: locked,
      type: "object",
      id: "desk-1",
      entity: locked.objects[0],
      point: { x: 210, y: 210 },
      objectIds: ["desk-1", "pc-1"]
    });
    expect(drag.selectedObjectOrigins.map((object) => object.id)).toEqual(["desk-1"]);
    expect(drag).toMatchObject({ startX: 210, originX: 200, originY: 200, childObjects: [], childPoints: [] });
  });

  it("guarda filhos ao arrastar um comodo", () => {
    const zone = editor.zones[0];
    const drag = createEntityDrag({ editor, type: "zone", id: "room-1", entity: zone, point: { x: 120, y: 120 }, objectIds: [] });
    expect(drag.originGeometry).toEqual({ x: 100, y: 100, width: 500, height: 400 });
    expect(drag.childObjects.length).toBeGreaterThan(0);
    expect(drag.childPoints.map((point) => point.id)).toEqual(["p1"]);
    expect(drag.originObject).toBeNull();
  });

  it("cria estados de redimensionamento", () => {
    const roomResize = createRoomResizeDrag({ editor, zone: editor.zones[0], side: "east", point: { x: 600, y: 300 } });
    expect(roomResize).toMatchObject({ type: "room-resize", side: "east", id: "room-1", originX: 100 });
    const objectResize = createObjectResizeDrag({ object: editor.objects[0], side: "south", point: { x: 1, y: 2 } });
    expect(objectResize).toMatchObject({ type: "object-resize", side: "south", startX: 1, originObject: { id: "desk-1" } });
  });
});

describe("deslocamento e alinhamento", () => {
  it("usa grade fina para objetos e a grade do plano para comodos", () => {
    expect(getDragSnapSize({ type: "object" }, editor)).toBe(5);
    expect(getDragSnapSize({ type: "point" }, editor)).toBe(5);
    expect(getDragSnapSize({ type: "zone" }, editor)).toBe(25);
  });

  it("arredonda o deslocamento a grade", () => {
    expect(computeDragDeltas({ originX: 200, originY: 200, startX: 0, startY: 0 }, { x: 33, y: -12 }, 5)).toEqual({
      nextX: 235,
      nextY: 190,
      deltaX: 35,
      deltaY: -10
    });
  });

  it("imanta objetos em alinhamentos e devolve guias, exceto com Alt", () => {
    const drag = createEntityDrag({
      editor,
      type: "object",
      id: "desk-1",
      entity: editor.objects.find((object) => object.id === "desk-1"),
      point: { x: 0, y: 0 },
      objectIds: ["desk-1"]
    });
    const deltas = { deltaX: 2, deltaY: 0 };
    const aligned = computeObjectDragAlignment({ drag, deltas, editor, floor, snapSize: 5, altKey: false });
    expect(aligned.guides.length).toBeGreaterThan(0);
    const free = computeObjectDragAlignment({ drag, deltas, editor, floor, snapSize: 5, altKey: true });
    expect(free).toEqual({ objectDeltaX: 2, objectDeltaY: 0, guides: [] });
  });
});

describe("applyDragToDraft", () => {
  it("move objetos selecionados e recentraliza equipamentos da mesa", () => {
    const drag = createEntityDrag({
      editor,
      type: "object",
      id: "desk-1",
      entity: editor.objects.find((object) => object.id === "desk-1"),
      point: { x: 0, y: 0 },
      objectIds: ["desk-1"]
    });
    const { draft } = runDrag(drag, { x: 50, y: 30 }, { altKey: true });
    const desk = draft.objects.find((object) => object.id === "desk-1");
    const pc = draft.objects.find((object) => object.id === "pc-1");
    expect(desk).toMatchObject({ x: 250, y: 230 });
    expect(pc.x + pc.width / 2).toBeCloseTo(desk.x + desk.width / 2);
  });

  it("move um comodo junto com objetos e pontos internos", () => {
    const drag = createEntityDrag({ editor, type: "zone", id: "room-1", entity: editor.zones[0], point: { x: 0, y: 0 }, objectIds: [] });
    const { draft } = runDrag(drag, { x: 50, y: 25 });
    expect(draft.zones[0].geometry).toMatchObject({ x: 150, y: 125 });
    expect(draft.objects.find((object) => object.id === "desk-1")).toMatchObject({ x: 250, y: 225 });
    expect(draft.connectionPoints[0]).toMatchObject({ x: 200, y: 175 });
  });

  it("limita o comodo ao pavimento", () => {
    const drag = createEntityDrag({ editor, type: "zone", id: "room-1", entity: editor.zones[0], point: { x: 0, y: 0 }, objectIds: [] });
    const { draft } = runDrag(drag, { x: 5000, y: 5000 });
    expect(draft.zones[0].geometry).toMatchObject({ x: 780, y: 420 });
  });

  it("redimensiona o comodo pela lateral e acompanha os filhos", () => {
    const drag = createRoomResizeDrag({ editor, zone: editor.zones[0], side: "west", point: { x: 100, y: 300 } });
    const { draft } = runDrag(drag, { x: 50, y: 300 });
    expect(draft.zones[0].geometry).toMatchObject({ x: 50, width: 550 });
    expect(draft.objects.find((object) => object.id === "desk-1")).toMatchObject({ x: 150 });
  });

  it("redimensiona objetos preservando a proporcao com Shift", () => {
    const desk = editor.objects.find((object) => object.id === "desk-1");
    const drag = createObjectResizeDrag({ object: desk, side: "southeast", point: { x: 360, y: 280 } });
    const free = runDrag(drag, { x: 420, y: 280 }).draft.objects.find((object) => object.id === "desk-1");
    expect(free.width).toBe(220);
    expect(free.height).toBe(80);
    const locked = runDrag(drag, { x: 420, y: 280 }, { shiftKey: true }).draft.objects.find((object) => object.id === "desk-1");
    expect(locked.width / locked.height).toBeCloseTo(2);
  });

  it("move pontos limitados ao pavimento", () => {
    const point = editor.connectionPoints[0];
    const drag = createEntityDrag({ editor, type: "point", id: "p1", entity: point, point: { x: 150, y: 150 }, objectIds: [] });
    const { draft } = runDrag(drag, { x: 9999, y: -50 });
    expect(draft.connectionPoints[0]).toMatchObject({ x: 1280, y: 0 });
  });

  it("ignora tipos de arrasto desconhecidos", () => {
    const draft = cloneEditor(editor);
    expect(applyDragToDraft(draft, { type: "pan" }, {})).toBe(draft);
  });
});
