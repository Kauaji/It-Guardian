import { describe, expect, it } from "vitest";
import { buildDesk, buildEditor, buildPc } from "../test/fixtures.js";
import { cloneEditor } from "./editorGeometry.js";
import {
  expandFloorInDraft,
  duplicateObjectInDraft,
  filterUnlockedObjectIds,
  getCollectionKey,
  moveObjectInDraft,
  patchEntityInDraft,
  removeEntityFromDraft,
  removeObjectsFromDraft,
  rotateObjectsInDraft,
  setBackgroundSettingsInDraft,
  setObjectsLockedInDraft
} from "./entityMutations.js";

function draftWith(overrides) {
  return cloneEditor(buildEditor(overrides));
}

describe("getCollectionKey", () => {
  it("mapeia o tipo da entidade para a colecao do editor", () => {
    expect(getCollectionKey("object")).toBe("objects");
    expect(getCollectionKey("zone")).toBe("zones");
    expect(getCollectionKey("point")).toBe("connectionPoints");
    expect(getCollectionKey("route")).toBe("cableRoutes");
  });
});

describe("removeEntityFromDraft", () => {
  it("remove um objeto e as aberturas penduradas nele", () => {
    const wall = { id: "wall-1", floorId: "floor-1", objectType: "wall", x: 0, y: 0, width: 100, height: 10, metadata: {} };
    const door = {
      id: "door-1",
      floorId: "floor-1",
      objectType: "door",
      x: 20,
      y: 0,
      width: 40,
      height: 10,
      metadata: { parentObjectId: "wall-1" }
    };
    const draft = draftWith({ zones: [], objects: [wall, door, buildDesk()] });
    removeEntityFromDraft(draft, { type: "object", id: "wall-1" });
    expect(draft.objects.map((object) => object.id)).toEqual(["desk-1"]);
  });

  it("remove um comodo com seus objetos e pontos", () => {
    const draft = draftWith({
      connectionPoints: [
        { id: "p1", floorId: "floor-1", metadata: { parentRoomId: "room-1" } },
        { id: "p2", floorId: "floor-1", metadata: {} }
      ]
    });
    removeEntityFromDraft(draft, { type: "zone", id: "room-1" });
    expect(draft.zones).toHaveLength(0);
    expect(draft.objects.filter((object) => object.metadata?.parentRoomId === "room-1")).toHaveLength(0);
    expect(draft.connectionPoints.map((point) => point.id)).toEqual(["p2"]);
  });

  it("remove pontos e rotas pelo id", () => {
    const draft = draftWith({ connectionPoints: [{ id: "p1" }, { id: "p2" }], cableRoutes: [{ id: "r1" }, { id: "r2" }] });
    removeEntityFromDraft(draft, { type: "point", id: "p1" });
    removeEntityFromDraft(draft, { type: "route", id: "r2" });
    expect(draft.connectionPoints.map((point) => point.id)).toEqual(["p2"]);
    expect(draft.cableRoutes.map((route) => route.id)).toEqual(["r1"]);
  });

  it("remove varios objetos em cascata", () => {
    const draft = draftWith({ zones: [], objects: [buildDesk(), buildPc(), buildDesk({ id: "desk-2" })] });
    removeObjectsFromDraft(draft, ["desk-1", "pc-1"]);
    expect(draft.objects.map((object) => object.id)).toEqual(["desk-2"]);
  });
});

describe("patchEntityInDraft", () => {
  it("aplica o patch ao objeto respeitando os limites do comodo", () => {
    const draft = draftWith();
    patchEntityInDraft(draft, { type: "object", id: "desk-1" }, { x: 9999, label: "Mesa nova" }, "floor-1");
    const desk = draft.objects.find((object) => object.id === "desk-1");
    expect(desk.label).toBe("Mesa nova");
    expect(desk.x).toBe(600 - 10 - desk.width);
  });

  it("recalcula a geometria normalizada de um comodo", () => {
    const draft = draftWith();
    patchEntityInDraft(draft, { type: "zone", id: "room-1" }, { width: 640 }, "floor-1");
    expect(draft.zones[0].geometry).toMatchObject({ x: 100, y: 100, width: 640, height: 400 });
  });

  it("aplica patches simples a zonas nao-comodo, pontos e rotas", () => {
    const draft = draftWith({
      zones: [{ id: "z1", floorId: "floor-1", zoneType: "group", name: "A" }],
      connectionPoints: [{ id: "p1", label: "A" }],
      cableRoutes: [{ id: "r1", label: "A" }]
    });
    patchEntityInDraft(draft, { type: "zone", id: "z1" }, { name: "B" }, "floor-1");
    patchEntityInDraft(draft, { type: "point", id: "p1" }, { label: "B" }, "floor-1");
    patchEntityInDraft(draft, { type: "route", id: "r1" }, { label: "B" }, "floor-1");
    expect(draft.zones[0].name).toBe("B");
    expect(draft.connectionPoints[0].label).toBe("B");
    expect(draft.cableRoutes[0].label).toBe("B");
  });

  it("reposiciona aberturas ancoradas pela parede ao mudar a posicao na parede", () => {
    const wall = {
      id: "wall-1",
      floorId: "floor-1",
      objectType: "wall",
      x: 100,
      y: 100,
      width: 200,
      height: 10,
      rotation: 0,
      metadata: {}
    };
    const door = {
      id: "door-1",
      floorId: "floor-1",
      objectType: "door",
      x: 0,
      y: 0,
      width: 40,
      height: 10,
      rotation: 0,
      metadata: { anchorType: "wall", parentObjectId: "wall-1", anchorOffset: 0.5 }
    };
    const draft = draftWith({ zones: [], objects: [wall, door] });
    patchEntityInDraft(draft, { type: "object", id: "door-1" }, { metadata: { ...door.metadata, anchorOffset: 0.25 } }, "floor-1");
    const moved = draft.objects.find((object) => object.id === "door-1");
    expect(moved.x + moved.width / 2).toBeCloseTo(150);
  });
});

describe("travar e girar objetos", () => {
  it("trava e destrava a selecao", () => {
    const draft = draftWith();
    setObjectsLockedInDraft(draft, ["desk-1"], true);
    expect(draft.objects.find((object) => object.id === "desk-1").metadata.locked).toBe(true);
    expect(filterUnlockedObjectIds(draft.objects, ["desk-1", "pc-1", "ausente"])).toEqual(["pc-1"]);
    setObjectsLockedInDraft(draft, ["desk-1"], false);
    expect(filterUnlockedObjectIds(draft.objects, ["desk-1"])).toEqual(["desk-1"]);
  });

  it("gira objetos 90 graus e alterna o sentido de portas", () => {
    const door = {
      id: "door-1",
      floorId: "floor-1",
      objectType: "door",
      x: 120,
      y: 120,
      width: 40,
      height: 10,
      rotation: 0,
      metadata: { swing: "inward" }
    };
    const draft = draftWith({ objects: [buildDesk(), door] });
    rotateObjectsInDraft(draft, ["desk-1", "door-1"], "floor-1");
    expect(draft.objects.find((object) => object.id === "desk-1").rotation).toBe(90);
    const rotatedDoor = draft.objects.find((object) => object.id === "door-1");
    expect(rotatedDoor.rotation).toBe(90);
    expect(rotatedDoor.metadata.swing).toBe("outward");
  });

  it("recentraliza equipamentos ao girar a mesa onde estao", () => {
    const draft = draftWith({ objects: [buildDesk(), buildPc({ metadata: { parentRoomId: "room-1", anchorObjectId: "desk-1" } })] });
    rotateObjectsInDraft(draft, ["desk-1"], "floor-1");
    const desk = draft.objects.find((object) => object.id === "desk-1");
    const pc = draft.objects.find((object) => object.id === "pc-1");
    expect(pc.x + pc.width / 2).toBeCloseTo(desk.x + desk.width / 2);
    expect(pc.y + pc.height / 2).toBeCloseTo(desk.y + desk.height / 2);
  });
});

describe("duplicar e mover", () => {
  it("duplica o objeto sem vinculo, deslocado e dentro do comodo", () => {
    const draft = draftWith({ objects: [buildDesk({ linkedAssetId: "asset-9", label: "Mesa" })] });
    duplicateObjectInDraft(
      draft,
      draft.objects.find((object) => object.id === "desk-1"),
      { id: "desk-copy", activeFloorId: "floor-1" }
    );
    const copy = draft.objects.find((object) => object.id === "desk-copy");
    expect(copy).toMatchObject({ label: "Mesa cópia", linkedAssetId: null, x: 205, y: 205 });
    expect(copy.metadata.duplicatedFromId).toBe("desk-1");
  });

  it("ignora a duplicacao sem objeto", () => {
    const draft = draftWith();
    const before = draft.objects.length;
    duplicateObjectInDraft(draft, null, { id: "x", activeFloorId: "floor-1" });
    expect(draft.objects).toHaveLength(before);
  });

  it("move um objeto vindo do 3D e arrasta os equipamentos da mesa", () => {
    const draft = draftWith({ objects: [buildDesk(), buildPc({ metadata: { parentRoomId: "room-1", anchorObjectId: "desk-1" } })] });
    moveObjectInDraft(draft, "desk-1", { x: 300, y: 300 }, "floor-1");
    const desk = draft.objects.find((object) => object.id === "desk-1");
    const pc = draft.objects.find((object) => object.id === "pc-1");
    expect(desk).toMatchObject({ x: 300, y: 300 });
    expect(pc.x + pc.width / 2).toBeCloseTo(desk.x + desk.width / 2);
  });
});

describe("pavimento e fundo", () => {
  it("expande largura ou altura e atualiza o tamanho do plano", () => {
    const draft = draftWith();
    expandFloorInDraft(draft, "floor-1", "width");
    expect(draft.floors[0]).toMatchObject({ width: 1600, height: 820 });
    expandFloorInDraft(draft, "floor-1", "height");
    expect(draft.floors[0]).toMatchObject({ width: 1600, height: 1025 });
    expect(draft.plan).toMatchObject({ width: 1600, height: 1025 });
  });

  it("ignora a expansao quando nao ha pavimento", () => {
    const draft = draftWith({ floors: [] });
    expandFloorInDraft(draft, "x", "width");
    expect(draft.floors).toEqual([]);
  });

  it("grava as configuracoes do fundo apenas no pavimento ativo", () => {
    const draft = draftWith({
      floors: [
        { id: "floor-1", width: 1280, height: 820 },
        { id: "floor-2", width: 1280, height: 820 }
      ]
    });
    setBackgroundSettingsInDraft(draft, "floor-2", { opacity: 0.5 });
    expect(draft.floors[0].metadata).toBeUndefined();
    expect(draft.floors[1].metadata.backgroundSettings).toEqual({ opacity: 0.5 });
  });
});
