import { describe, expect, it } from "vitest";
import { buildDesk, buildEditor, createIdSequence } from "../test/fixtures.js";
import { addCatalogEntityToDraft, resolveCatalogHeight3d } from "./catalogPlacement.js";
import { cloneEditor } from "./editorGeometry.js";

describe("resolveCatalogHeight3d", () => {
  it("prioriza a altura declarada e cai para a categoria", () => {
    expect(resolveCatalogHeight3d({ height3d: 77 })).toBe(77);
    expect(resolveCatalogHeight3d({ category: "asset", id: "sem-biblioteca" })).toBe(56);
    expect(resolveCatalogHeight3d({ category: "structure", id: "sem-biblioteca" })).toBe(92);
    expect(resolveCatalogHeight3d({ category: "furniture", id: "sem-biblioteca" })).toBe(42);
  });

  it("ignora alturas invalidas", () => {
    expect(resolveCatalogHeight3d({ height3d: 0, category: "asset", id: "x" })).toBe(56);
    expect(resolveCatalogHeight3d({ height3d: "abc", category: "structure", id: "x" })).toBe(92);
  });
});

describe("addCatalogEntityToDraft", () => {
  const floor = buildEditor().floors[0];

  it("cria um ponto de conexao vinculado ao comodo sob o cursor", () => {
    const draft = cloneEditor(buildEditor());
    const item = { id: "outlet", category: "point", pointType: "power", label: "Tomada" };
    const { target } = addCatalogEntityToDraft({
      draft,
      item,
      floor,
      targetPoint: { x: 300, y: 300 },
      candidate: null,
      createId: createIdSequence()
    });
    expect(target).toEqual({ type: "point", id: "point-1" });
    expect(draft.connectionPoints).toHaveLength(1);
    expect(draft.connectionPoints[0]).toMatchObject({
      pointType: "power",
      label: "Tomada",
      x: 300,
      y: 300,
      planId: "plan-1",
      floorId: "floor-1",
      metadata: { parentRoomId: "room-1" }
    });
  });

  it("cria uma rota usando o trecho da pre-visualizacao ou um padrao de 180 px", () => {
    const item = { id: "cable", category: "route", routeType: "network", label: "Cabo", color: "#2563eb" };
    const withPath = cloneEditor(buildEditor());
    addCatalogEntityToDraft({
      draft: withPath,
      item,
      floor,
      targetPoint: { x: 400, y: 300 },
      candidate: {
        path: [
          { x: 1, y: 2 },
          { x: 3, y: 4 }
        ]
      },
      createId: createIdSequence()
    });
    expect(withPath.cableRoutes[0].path).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 }
    ]);

    const fallback = cloneEditor(buildEditor());
    const { target } = addCatalogEntityToDraft({
      draft: fallback,
      item,
      floor,
      targetPoint: { x: 400, y: 300 },
      candidate: null,
      createId: createIdSequence()
    });
    expect(target).toEqual({ type: "route", id: "route-1" });
    expect(fallback.cableRoutes[0].path).toEqual([
      { x: 310, y: 300 },
      { x: 490, y: 300 }
    ]);
  });

  it("cria um objeto restrito ao comodo e com altura 3D do catalogo", () => {
    const draft = cloneEditor(buildEditor({ objects: [] }));
    const item = { id: "cabinet", objectType: "cabinet", category: "furniture", label: "Armário", width: 60, height: 40, color: "#b08968" };
    const { target } = addCatalogEntityToDraft({
      draft,
      item,
      floor,
      targetPoint: { x: 300, y: 300 },
      candidate: null,
      createId: createIdSequence()
    });
    expect(target).toEqual({ type: "object", id: "object-1" });
    expect(draft.objects.find((object) => object.id === "object-1")).toMatchObject({
      objectType: "cabinet",
      label: "Armário",
      x: 270,
      y: 280,
      width: 60,
      height: 40,
      height3d: resolveCatalogHeight3d(item),
      linkedAssetId: null,
      metadata: { parentRoomId: "room-1" }
    });
  });

  it("ancora equipamentos de mesa na mesa mais proxima", () => {
    const draft = cloneEditor(buildEditor({ objects: [buildDesk()] }));
    const item = { id: "pc", objectType: "pc", category: "asset", label: "PC", width: 60, height: 40 };
    addCatalogEntityToDraft({ draft, item, floor, targetPoint: { x: 280, y: 240 }, candidate: null, createId: createIdSequence() });
    const created = draft.objects.find((object) => object.objectType === "pc");
    expect(created.metadata.anchorObjectId).toBe("desk-1");
    expect(created.x).toBe(250);
    expect(created.y).toBe(220);
  });

  it("usa a posicao validada da pre-visualizacao quando existe", () => {
    const draft = cloneEditor(buildEditor({ objects: [] }));
    const item = { id: "cabinet", objectType: "cabinet", category: "furniture", label: "Armário", width: 60, height: 40 };
    addCatalogEntityToDraft({
      draft,
      item,
      floor,
      targetPoint: { x: 300, y: 300 },
      candidate: { object: { x: 150, y: 150 } },
      createId: createIdSequence()
    });
    expect(draft.objects.find((object) => object.id === "object-1")).toMatchObject({ x: 150, y: 150 });
  });
});
