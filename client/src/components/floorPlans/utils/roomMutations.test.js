import { describe, expect, it } from "vitest";
import { buildDesk, buildEditor, createIdSequence } from "../test/fixtures.js";
import { cloneEditor } from "./editorGeometry.js";
import {
  addRoomFromPlacementToDraft,
  duplicateRoomInDraft,
  findRoomDuplicateGeometry,
  getRotatedRoomGeometry,
  rotateRoomInDraft
} from "./roomMutations.js";
import { buildRoomPlacementPreview } from "./placementPreview.js";
import { ROOM_TEMPLATES } from "./roomTemplates.js";

const baseEditor = () => buildEditor({
  objects: [buildDesk()],
  connectionPoints: [{ id: "p1", floorId: "floor-1", x: 150, y: 150, metadata: { parentRoomId: "room-1" } }]
});

describe("findRoomDuplicateGeometry", () => {
  it("encontra a primeira posicao livre ao lado do comodo", () => {
    const editor = baseEditor();
    const geometry = findRoomDuplicateGeometry({ zone: editor.zones[0], floor: editor.floors[0], zones: editor.zones, snapSize: 25 });
    expect(geometry).toEqual({ x: 650, y: 100, width: 500, height: 400 });
  });

  it("retorna undefined quando nao ha espaco", () => {
    const editor = baseEditor();
    const big = { ...editor.zones[0], geometry: { x: 0, y: 0, width: 1280, height: 820 } };
    expect(findRoomDuplicateGeometry({ zone: big, floor: editor.floors[0], zones: [big], snapSize: 25 })).toBeUndefined();
  });
});

describe("duplicateRoomInDraft", () => {
  it("copia comodo, objetos internos e pontos deslocados", () => {
    const editor = baseEditor();
    const draft = cloneEditor(editor);
    const geometry = { x: 700, y: 100, width: 500, height: 400 };
    const id = duplicateRoomInDraft({ draft, zone: draft.zones[0], geometry, createId: createIdSequence() });
    expect(id).toBe("zone-1");
    const copy = draft.zones.find((zone) => zone.id === id);
    expect(copy.name).toBe("Sala cópia");
    expect(copy.geometry).toEqual(geometry);
    const copiedDesk = draft.objects.find((object) => object.metadata?.parentRoomId === id && object.objectType === "desk");
    expect(copiedDesk).toMatchObject({ x: 800, y: 200 });
    const copiedPoint = draft.connectionPoints.find((point) => point.metadata?.parentRoomId === id);
    expect(copiedPoint).toMatchObject({ x: 750, y: 150 });
    expect(draft.objects.find((object) => object.id === "desk-1")).toMatchObject({ x: 200, y: 200 });
  });
});

describe("rotacao de comodo", () => {
  it("troca largura e altura mantendo o centro e desloca os filhos", () => {
    const editor = baseEditor();
    const nextGeometry = getRotatedRoomGeometry({ zone: editor.zones[0], floor: editor.floors[0], snapSize: 25 });
    expect(nextGeometry).toEqual({ x: 150, y: 50, width: 400, height: 500 });
    const draft = cloneEditor(editor);
    rotateRoomInDraft({ draft, zone: draft.zones[0], nextGeometry });
    expect(draft.zones[0].geometry).toEqual(nextGeometry);
    expect(draft.zones[0].metadata.room.rotation).toBe(90);
    expect(draft.objects.find((object) => object.id === "desk-1")).toMatchObject({ x: 250, y: 150 });
    expect(draft.connectionPoints[0]).toMatchObject({ x: 200, y: 100 });
  });
});

describe("addRoomFromPlacementToDraft", () => {
  it("cria o comodo e seus objetos a partir do modelo", () => {
    const editor = buildEditor({ zones: [], objects: [] });
    const template = ROOM_TEMPLATES[0];
    const placement = { template, rotation: 0 };
    const preview = buildRoomPlacementPreview({ editor, floor: editor.floors[0], template, point: { x: 400, y: 300 }, rotation: 0 });
    const draft = cloneEditor(editor);
    const id = addRoomFromPlacementToDraft({ draft, floor: editor.floors[0], placement, preview, createId: createIdSequence() });
    expect(draft.zones).toHaveLength(1);
    expect(draft.zones[0].id).toBe(id);
    expect(draft.zones[0].geometry).toEqual(preview.geometry);
    expect(draft.zones[0].orderIndex).toBe(0);
    expect(draft.objects.length).toBeGreaterThan(0);
  });
});
