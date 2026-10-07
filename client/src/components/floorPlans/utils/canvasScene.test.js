import { describe, expect, it } from "vitest";
import { buildDesk, buildEditor } from "../test/fixtures.js";
import { getCanvasScene, getPowerLinks } from "./canvasScene.js";
import { DEFAULT_FLOOR_PLAN_LAYERS } from "./layers.js";

const extras = {
  objects: [
    buildDesk(),
    {
      id: "strip-1",
      floorId: "floor-1",
      objectType: "power_strip",
      x: 210,
      y: 200,
      width: 40,
      height: 10,
      metadata: { parentRoomId: "room-1" }
    },
    { id: "pc-1", floorId: "floor-1", objectType: "pc", x: 260, y: 210, width: 60, height: 40, metadata: { parentRoomId: "room-1" } },
    { id: "other", floorId: "floor-2", objectType: "desk", x: 0, y: 0, width: 10, height: 10, metadata: {} }
  ],
  zones: [
    { id: "room-1", floorId: "floor-1", zoneType: "room", name: "Sala", geometry: { x: 100, y: 100, width: 500, height: 400 } },
    { id: "area-1", floorId: "floor-1", zoneType: "group", name: "Grupo" },
    { id: "room-2", floorId: "floor-2", zoneType: "room", name: "Outro", geometry: { x: 0, y: 0, width: 100, height: 100 } }
  ],
  connectionPoints: [
    { id: "net", floorId: "floor-1", pointType: "network" },
    { id: "pow", floorId: "floor-1", pointType: "power" }
  ],
  cableRoutes: [
    { id: "r-net", floorId: "floor-1", routeType: "network" },
    { id: "r-pow", floorId: "floor-1", routeType: "power" }
  ]
};

describe("getCanvasScene", () => {
  const editor = buildEditor(extras);

  it("filtra as entidades pelo pavimento ativo", () => {
    const scene = getCanvasScene({ editor, activeFloorId: "floor-1", visibleLayers: DEFAULT_FLOOR_PLAN_LAYERS });
    expect(scene.floor.id).toBe("floor-1");
    expect(scene.roomZones.map((zone) => zone.id)).toEqual(["room-1"]);
    expect(scene.areaZones.map((zone) => zone.id)).toEqual(["area-1"]);
    expect(scene.objects.some((object) => object.id === "other")).toBe(false);
    expect(scene.points.map((point) => point.id)).toEqual(["net", "pow"]);
    expect(scene.routes.map((route) => route.id)).toEqual(["r-net", "r-pow"]);
    expect(scene).toMatchObject({ width: 1280, height: 820 });
  });

  it("oculta entidades das camadas desligadas", () => {
    const scene = getCanvasScene({
      editor,
      activeFloorId: "floor-1",
      visibleLayers: { rooms: false, areas: false, objects: false, network: false, energy: true, labels: false }
    });
    expect(scene.roomZones).toEqual([]);
    expect(scene.areaZones).toEqual([]);
    expect(scene.objects).toEqual([]);
    expect(scene.points.map((point) => point.id)).toEqual(["pow"]);
    expect(scene.routes.map((route) => route.id)).toEqual(["r-pow"]);
    expect(scene.zones).toHaveLength(2);
  });

  it("considera visiveis as camadas nao informadas", () => {
    const scene = getCanvasScene({ editor, activeFloorId: "floor-1", visibleLayers: { network: false } });
    expect(scene.roomZones).toHaveLength(1);
    expect(scene.points.map((point) => point.id)).toEqual(["pow"]);
  });

  it("liga acessorios de energia ao equipamento mais proximo", () => {
    const scene = getCanvasScene({ editor, activeFloorId: "floor-1", visibleLayers: undefined });
    expect(scene.powerLinks).toHaveLength(1);
    expect(scene.powerLinks[0].accessory.id).toBe("strip-1");
    expect(scene.powerLinks[0].target.id).toBe("pc-1");
    expect(getPowerLinks([])).toEqual([]);
  });

  it("devolve cena vazia para editor sem pavimento", () => {
    const scene = getCanvasScene({ editor: { plan: { width: 500, height: 400 } }, activeFloorId: "x", visibleLayers: {} });
    expect(scene.floor).toBeNull();
    expect(scene.objects).toEqual([]);
    expect(scene).toMatchObject({ width: 500, height: 400 });
  });
});
