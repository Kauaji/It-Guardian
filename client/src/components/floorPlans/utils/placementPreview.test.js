import { describe, expect, it } from "vitest";
import { buildDesk, buildEditor, buildPc } from "../test/fixtures.js";
import { buildCatalogPlacementPreview, buildDraggedRoomPreview, buildRoomPlacementPreview } from "./placementPreview.js";

const editor = buildEditor();
const floor = editor.floors[0];

describe("buildCatalogPlacementPreview", () => {
  it("retorna null sem pavimento, item ou ponto", () => {
    const item = { id: "chair", width: 40, height: 40 };
    expect(buildCatalogPlacementPreview({ editor, floor: null, item, point: { x: 1, y: 1 } })).toBeNull();
    expect(buildCatalogPlacementPreview({ editor, floor, item: null, point: { x: 1, y: 1 } })).toBeNull();
    expect(buildCatalogPlacementPreview({ editor, floor, item, point: null })).toBeNull();
  });

  it("valida pontos de conexao dentro dos limites do pavimento", () => {
    const item = { id: "outlet", category: "point", color: "#f59e0b" };
    const inside = buildCatalogPlacementPreview({ editor, floor, item, point: { x: 300, y: 300 } });
    expect(inside).toMatchObject({ type: "point", valid: true, reason: "Clique para posicionar", color: "#f59e0b" });
    const outside = buildCatalogPlacementPreview({ editor, floor, item, point: { x: 5000, y: 300 } });
    expect(outside).toMatchObject({ valid: false, reason: "Fora dos limites da planta" });
  });

  it("monta o trecho de rota de 180 px e invalida o que ultrapassa a planta", () => {
    const item = { id: "cable", category: "route", color: "#2563eb" };
    const inside = buildCatalogPlacementPreview({ editor, floor, item, point: { x: 400, y: 300 } });
    expect(inside.type).toBe("route");
    expect(inside.path).toEqual([
      { x: 310, y: 300 },
      { x: 490, y: 300 }
    ]);
    expect(inside.valid).toBe(true);
    const outside = buildCatalogPlacementPreview({ editor, floor, item, point: { x: 20, y: 300 } });
    expect(outside).toMatchObject({ valid: false, reason: "O trecho ultrapassa a planta" });
  });

  it("aceita objeto dentro do comodo e sem colisao", () => {
    const item = { id: "cabinet", objectType: "cabinet", category: "furniture", width: 60, height: 40, label: "Armário" };
    const preview = buildCatalogPlacementPreview({ editor, floor, item, point: { x: 500, y: 420 } });
    expect(preview.type).toBe("object");
    expect(preview.valid).toBe(true);
    expect(preview.object.x).toBe(470);
    expect(preview.object.y).toBe(400);
  });

  it("rejeita objeto fora do pavimento, fora do comodo ou colidindo", () => {
    const item = { id: "cabinet", objectType: "cabinet", category: "furniture", width: 60, height: 40, label: "Armário" };
    const outsideFloor = buildCatalogPlacementPreview({ editor, floor, item, point: { x: -50, y: 300 } });
    expect(outsideFloor.reason).toBe("Fora dos limites da planta");
    const outsideRoom = buildCatalogPlacementPreview({ editor, floor, item, point: { x: 900, y: 300 } });
    expect(outsideRoom.reason).toBe("Posicione o item inteiramente dentro de um cômodo");
    const colliding = buildCatalogPlacementPreview({ editor, floor, item, point: { x: 280, y: 240 } });
    expect(colliding).toMatchObject({ valid: false, reason: "Este item colide com outro objeto" });
  });

  it("centraliza equipamentos sobre a mesa mais proxima sem acusar colisao com ela", () => {
    const item = { id: "pc", objectType: "pc", category: "asset", width: 60, height: 40, label: "PC" };
    const preview = buildCatalogPlacementPreview({
      editor: buildEditor({ objects: [buildDesk()] }),
      floor,
      item,
      point: { x: 280, y: 240 }
    });
    expect(preview.valid).toBe(true);
    expect(preview.object.x).toBe(250);
    expect(preview.object.y).toBe(220);
    expect(preview.object.metadata.anchorObjectId).toBe("desk-1");
  });

  it("permite colocar objetos em planta sem comodos apenas respeitando os limites", () => {
    const bare = buildEditor({ zones: [], objects: [buildPc({ x: 10, y: 10 })] });
    const item = { id: "cabinet", objectType: "cabinet", category: "furniture", width: 60, height: 40, label: "Armário" };
    const preview = buildCatalogPlacementPreview({ editor: bare, floor, item, point: { x: 600, y: 500 } });
    expect(preview.valid).toBe(true);
  });
});

describe("previews de comodo", () => {
  const template = { id: "office", label: "Escritorio", color: "#bfdbfe", width: 200, height: 150 };

  it("centraliza o comodo no ponto, ajustado a grade", () => {
    const preview = buildRoomPlacementPreview({ editor, floor, template, point: { x: 900, y: 600 }, rotation: 0 });
    expect(preview.geometry).toEqual({ x: 800, y: 525, width: 200, height: 150 });
    expect(preview.valid).toBe(true);
    expect(preview.zone.zoneType).toBe("room");
    expect(preview.rotation).toBe(0);
  });

  it("troca largura e altura quando girado e invalida sobreposicao com outro comodo", () => {
    const rotated = buildRoomPlacementPreview({ editor, floor, template, point: { x: 900, y: 600 }, rotation: 90 });
    expect(rotated.geometry).toMatchObject({ width: 150, height: 200 });
    const overlapping = buildRoomPlacementPreview({ editor, floor, template, point: { x: 300, y: 300 }, rotation: 0 });
    expect(overlapping.valid).toBe(false);
  });

  it("retorna null sem pavimento ou modelo", () => {
    expect(buildRoomPlacementPreview({ editor, floor: null, template, point: { x: 1, y: 1 } })).toBeNull();
    expect(buildRoomPlacementPreview({ editor, floor, template: null, point: { x: 1, y: 1 } })).toBeNull();
    expect(buildDraggedRoomPreview({ editor, floor, template, start: null, end: { x: 1, y: 1 } })).toBeNull();
  });

  it("usa o retangulo arrastado, nunca menor que o modelo", () => {
    const dragged = buildDraggedRoomPreview({
      editor,
      floor,
      template,
      start: { x: 800, y: 500 },
      end: { x: 1200, y: 700 },
      rotation: 0
    });
    expect(dragged.geometry).toEqual({ x: 800, y: 500, width: 400, height: 200 });
    expect(dragged.valid).toBe(true);
  });

  it("trata um arrasto curto como clique simples", () => {
    const click = buildDraggedRoomPreview({
      editor,
      floor,
      template,
      start: { x: 900, y: 600 },
      end: { x: 910, y: 605 },
      rotation: 0
    });
    expect(click.geometry).toEqual(buildRoomPlacementPreview({ editor, floor, template, point: { x: 900, y: 600 } }).geometry);
  });
});
