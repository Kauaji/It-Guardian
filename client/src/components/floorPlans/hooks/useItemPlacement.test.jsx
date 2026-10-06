import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildEditor } from "../test/fixtures.js";
import { cloneEditor } from "../utils/editorGeometry.js";
import { createWallObjectFromPoints } from "../utils/wallGeometry.js";
import { useItemPlacement } from "./useItemPlacement.js";

let counter = 0;
vi.mock("../utils/ids.js", () => ({ createId: (prefix) => `${prefix}-${++counter}` }));

const wallItem = { id: "wall", objectType: "wall", label: "Parede", color: "#64748b", category: "structure" };
const doorItem = { id: "door", objectType: "door", label: "Porta", category: "structure", width: 72, height: 16 };
const cabinet = { id: "cabinet", objectType: "cabinet", category: "furniture", width: 60, height: 40, label: "Armário" };
const outlet = { id: "outlet", category: "point", pointType: "power", label: "Tomada", color: "#f59e0b" };

function wallObject() {
  return createWallObjectFromPoints({
    id: "wall-a",
    planId: "plan-1",
    floorId: "floor-1",
    item: wallItem,
    start: { x: 100, y: 100 },
    end: { x: 300, y: 100 },
    gridSize: 5
  });
}

// "store" minimo: aceita valor ou updater, como o setState do React
function store(initial) {
  const box = { value: initial };
  const set = vi.fn((next) => {
    box.value = typeof next === "function" ? next(box.value) : next;
  });
  return { box, set };
}

const last = (ctx) => ctx.editorBox.current.objects.at(-1);

function setup({ editor = buildEditor(), placement = null, floors = true } = {}) {
  const editorBox = { current: floors ? editor : { ...editor, floors: [] } };
  const placementStore = store(placement);
  const selectedStore = store(null);
  const objectIdsStore = store(["old"]);
  const justPlacedStore = store(null);
  const commitEditor = vi.fn((mutate) => {
    const draft = cloneEditor(editorBox.current);
    const result = mutate(draft);
    editorBox.current = result || draft;
  });
  const deps = {
    doc: { editor: editorBox.current, activeFloorId: "floor-1", commitEditor },
    ui: {
      placement: placementStore.box.value,
      setPlacement: placementStore.set,
      setMode: vi.fn(),
      setSelectedTool: vi.fn(),
      setSelected: selectedStore.set,
      setSelectedObjectIds: objectIdsStore.set,
      setJustPlacedObjectId: justPlacedStore.set
    },
    notify: vi.fn(),
    viewport: { getSvgPoint: vi.fn((event) => ({ x: event.x ?? 0, y: event.y ?? 0 })) },
    paint: { handleToolChange: vi.fn() }
  };
  const { result } = renderHook(() => useItemPlacement(deps));
  return { ...deps, result, commitEditor, editorBox, placementStore, selectedStore, objectIdsStore, justPlacedStore };
}

beforeEach(() => {
  counter = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useItemPlacement.addCatalogItem", () => {
  it("zonas trocam para o pincel de segmento ou de grupo", () => {
    const ctx = setup();
    act(() => ctx.result.current.addCatalogItem({ category: "zone", zoneType: "segment" }));
    act(() => ctx.result.current.addCatalogItem({ category: "zone", zoneType: "group" }));
    expect(ctx.paint.handleToolChange).toHaveBeenNthCalledWith(1, "segment-brush");
    expect(ctx.paint.handleToolChange).toHaveBeenNthCalledWith(2, "group-brush");
    expect(ctx.ui.setPlacement).not.toHaveBeenCalled();
  });

  it("parede inicia o posicionamento em modo 2D com a grade fina", () => {
    const ctx = setup();
    act(() => ctx.result.current.addCatalogItem(wallItem));
    expect(ctx.ui.setMode).toHaveBeenCalledWith("2d");
    expect(ctx.ui.setSelectedTool).toHaveBeenCalledWith("select");
    expect(ctx.selectedStore.box.value).toBeNull();
    expect(ctx.placementStore.box.value).toMatchObject({ kind: "wall", item: wallItem, start: null, end: null, gridSize: 5 });
    expect(ctx.objectIdsStore.box.value).toEqual(["old"]);
  });

  it("abertura exige uma parede no andar ativo", () => {
    const empty = setup({ editor: buildEditor({ zones: [], objects: [] }) });
    act(() => empty.result.current.addCatalogItem(doorItem));
    expect(empty.notify).toHaveBeenCalledWith("Crie uma parede antes de posicionar portas ou janelas.", "warning");
    expect(empty.ui.setPlacement).not.toHaveBeenCalled();

    const withWall = setup({ editor: buildEditor({ zones: [], objects: [wallObject()] }) });
    act(() => withWall.result.current.addCatalogItem(doorItem));
    expect(withWall.placementStore.box.value).toEqual({ kind: "opening", item: doorItem });
  });

  it("itens comuns limpam a selecao de objetos e iniciam o posicionamento de catalogo", () => {
    const ctx = setup();
    act(() => ctx.result.current.addCatalogItem(cabinet));
    expect(ctx.placementStore.box.value).toEqual({ kind: "catalog", item: cabinet });
    expect(ctx.objectIdsStore.box.value).toEqual([]);
  });

  it("sem andar nao faz nada", () => {
    const ctx = setup({ floors: false });
    act(() => ctx.result.current.addCatalogItem(cabinet));
    act(() => ctx.result.current.startMeasurementTool());
    expect(ctx.ui.setPlacement).not.toHaveBeenCalled();
  });

  it("ferramenta de medicao inicia o posicionamento sem inicio/fim", () => {
    const ctx = setup();
    act(() => ctx.result.current.startMeasurementTool());
    expect(ctx.placementStore.box.value).toEqual({ kind: "measurement", start: null, end: null, constrainAngle: false, lengthBuffer: "" });
  });
});

describe("useItemPlacement.commitCatalogPlacement", () => {
  it("adiciona o item, seleciona o alvo, encerra o posicionamento e avisa", () => {
    const ctx = setup({ editor: buildEditor({ zones: [], objects: [] }) });
    act(() => ctx.result.current.commitCatalogPlacement(cabinet, { x: 300, y: 300 }));
    const created = last(ctx);
    expect(created).toMatchObject({ objectType: "cabinet", label: "Armário" });
    expect(ctx.selectedStore.box.value).toEqual({ type: "object", id: created.id });
    expect(ctx.objectIdsStore.box.value).toEqual([created.id]);
    expect(ctx.placementStore.box.value).toBeNull();
    expect(ctx.notify).toHaveBeenCalledWith("Armário adicionado a planta.", "ok");
  });

  it("ponto de conexao seleciona o ponto e zera os ids de objeto", () => {
    const ctx = setup({ editor: buildEditor({ zones: [], objects: [] }) });
    act(() => ctx.result.current.commitCatalogPlacement(outlet, { x: 300, y: 300 }));
    expect(ctx.selectedStore.box.value).toMatchObject({ type: "point" });
    expect(ctx.objectIdsStore.box.value).toEqual([]);
  });

  it("recusa posicao invalida com o motivo e nao altera a planta", () => {
    const ctx = setup({ editor: buildEditor({ zones: [], objects: [] }) });
    act(() => ctx.result.current.commitCatalogPlacement(outlet, { x: 5000, y: 300 }));
    expect(ctx.notify).toHaveBeenCalledWith("Fora dos limites da planta", "warning");
    expect(ctx.commitEditor).not.toHaveBeenCalled();
    act(() => ctx.result.current.commitCatalogPlacement(outlet, { x: 5000, y: 300 }, { valid: false }));
    expect(ctx.notify).toHaveBeenLastCalledWith("Escolha outra posição para o item.", "warning");
  });

  it("usa a pre-visualizacao recebida e ignora chamadas sem item ou andar", () => {
    const ctx = setup({ editor: buildEditor({ zones: [], objects: [] }) });
    const preview = { valid: true, point: { x: 310, y: 310 } };
    act(() => ctx.result.current.commitCatalogPlacement(cabinet, { x: 0, y: 0 }, preview));
    expect(ctx.editorBox.current.objects).toHaveLength(1);
    ctx.commitEditor.mockClear();
    act(() => ctx.result.current.commitCatalogPlacement(null, { x: 0, y: 0 }));
    expect(ctx.commitEditor).not.toHaveBeenCalled();

    const noFloor = setup({ floors: false });
    act(() => noFloor.result.current.commitCatalogPlacement(cabinet, { x: 0, y: 0 }));
    expect(noFloor.commitEditor).not.toHaveBeenCalled();
  });
});

describe("useItemPlacement - paredes", () => {
  const floor = { id: "floor-1" };

  it("primeiro clique fixa o inicio (na grade fina); o segundo cria a parede e reinicia", () => {
    const ctx = setup({ placement: { kind: "wall", item: wallItem, start: null, end: null, gridSize: 5 }, editor: buildEditor({ zones: [], objects: [] }) });
    act(() => ctx.result.current.confirmWallPoint({ x: 103, y: 207 }, floor));
    expect(ctx.placementStore.box.value).toMatchObject({ start: { x: 105, y: 205 }, end: { x: 105, y: 205 } });
    expect(ctx.commitEditor).not.toHaveBeenCalled();

    const second = setup({
      placement: { kind: "wall", item: wallItem, start: { x: 100, y: 100 }, end: { x: 100, y: 100 }, gridSize: 5 },
      editor: buildEditor({ zones: [], objects: [] })
    });
    act(() => second.result.current.confirmWallPoint({ x: 300, y: 101 }, floor));
    expect(second.editorBox.current.objects).toHaveLength(1);
    expect(second.selectedStore.box.value).toMatchObject({ type: "object" });
    expect(second.placementStore.box.value).toMatchObject({ start: null, end: null });
  });
});

describe("useItemPlacement - medidas", () => {
  const floor = { id: "floor-1" };

  it("primeiro clique define o inicio; o segundo cria a medicao, a destaca e reinicia", () => {
    vi.useFakeTimers();
    const ctx = setup({
      placement: { kind: "measurement", start: null, end: null, constrainAngle: false, lengthBuffer: "" },
      editor: buildEditor({ zones: [], objects: [] })
    });
    act(() => ctx.result.current.confirmMeasurementPoint({ x: 100, y: 100 }, floor));
    expect(ctx.placementStore.box.value).toMatchObject({ start: { x: 100, y: 100 }, end: { x: 100, y: 100 } });

    const second = setup({
      placement: { kind: "measurement", start: { x: 100, y: 100 }, end: { x: 100, y: 100 }, constrainAngle: false, lengthBuffer: "12" },
      editor: buildEditor({ zones: [], objects: [] })
    });
    act(() => second.result.current.confirmMeasurementPoint({ x: 300, y: 100 }, floor));
    const created = last(second);
    expect(created).toBeDefined();
    expect(second.selectedStore.box.value).toEqual({ type: "object", id: created.id });
    expect(second.justPlacedStore.box.value).toBe(created.id);
    expect(second.placementStore.box.value).toMatchObject({ start: null, end: null, lengthBuffer: "" });
    act(() => vi.advanceTimersByTime(1400));
    expect(second.justPlacedStore.box.value).toBeNull();
  });

  it("o destaque nao some se outro objeto foi destacado nesse meio tempo", () => {
    vi.useFakeTimers();
    const ctx = setup({
      placement: { kind: "measurement", start: { x: 100, y: 100 }, end: { x: 300, y: 100 }, constrainAngle: false, lengthBuffer: "" },
      editor: buildEditor({ zones: [], objects: [] })
    });
    act(() => ctx.result.current.commitMeasurementFromKeyboard());
    const created = last(ctx);
    expect(ctx.justPlacedStore.box.value).toBe(created.id);
    ctx.justPlacedStore.set("outro");
    act(() => vi.advanceTimersByTime(1400));
    expect(ctx.justPlacedStore.box.value).toBe("outro");
  });

  it("Enter sem fim ou sem andar nao faz nada", () => {
    const noEnd = setup({ placement: { kind: "measurement", start: { x: 1, y: 1 }, end: null }, editor: buildEditor({ zones: [], objects: [] }) });
    act(() => noEnd.result.current.commitMeasurementFromKeyboard());
    expect(noEnd.commitEditor).not.toHaveBeenCalled();
    const noFloor = setup({ placement: { kind: "measurement", start: { x: 1, y: 1 }, end: { x: 5, y: 5 } }, floors: false });
    act(() => noFloor.result.current.commitMeasurementFromKeyboard());
    expect(noFloor.commitEditor).not.toHaveBeenCalled();
  });

  it("setPlacement tolera estado nulo ao reiniciar", () => {
    const ctx = setup({ placement: { kind: "measurement", start: { x: 1, y: 1 }, end: { x: 9, y: 1 } }, editor: buildEditor({ zones: [], objects: [] }) });
    act(() => ctx.result.current.commitMeasurementFromKeyboard());
    ctx.placementStore.box.value = null;
    ctx.ui.setPlacement((current) => current ? { ...current, start: null } : current);
    expect(ctx.placementStore.box.value).toBeNull();
  });
});

describe("useItemPlacement - aberturas", () => {
  const floor = { id: "floor-1" };

  it("clique longe de paredes avisa; sobre a parede encaixa a abertura e a seleciona", () => {
    const none = setup({ placement: { kind: "opening", item: doorItem }, editor: buildEditor({ zones: [], objects: [] }) });
    act(() => none.result.current.confirmOpeningPoint({ x: 200, y: 100 }, floor));
    expect(none.notify).toHaveBeenCalledWith("Clique sobre uma parede para encaixar a abertura.", "warning");

    const ctx = setup({ placement: { kind: "opening", item: doorItem }, editor: buildEditor({ zones: [], objects: [wallObject()] }) });
    act(() => ctx.result.current.confirmOpeningPoint({ x: 200, y: 100 }, floor));
    const door = ctx.editorBox.current.objects.find((object) => object.objectType === "door");
    expect(door).toBeDefined();
    expect(ctx.selectedStore.box.value).toEqual({ type: "object", id: door.id });
  });
});

describe("useItemPlacement.handlePointerMove", () => {
  it("catalogo: atualiza a pre-visualizacao", () => {
    const ctx = setup({ placement: { kind: "catalog", item: cabinet }, editor: buildEditor({ zones: [], objects: [] }) });
    let handled;
    act(() => { handled = ctx.result.current.handlePointerMove({ x: 500, y: 420 }); });
    expect(handled).toBe(true);
    expect(ctx.placementStore.box.value.preview).toMatchObject({ valid: true });
    ctx.placementStore.box.value = { kind: "wall" };
    ctx.ui.setPlacement((current) => current?.kind === "catalog" ? { ...current, preview: 1 } : current);
    expect(ctx.placementStore.box.value).toEqual({ kind: "wall" });
  });

  it("parede em andamento: acompanha o ponteiro na grade e nas pontas", () => {
    const ctx = setup({
      placement: { kind: "wall", item: wallItem, start: { x: 100, y: 100 }, end: { x: 100, y: 100 }, gridSize: 5 },
      editor: buildEditor({ zones: [], objects: [wallObject()] })
    });
    let handled;
    act(() => { handled = ctx.result.current.handlePointerMove({ x: 302, y: 104 }); });
    expect(handled).toBe(true);
    expect(Math.round(ctx.placementStore.box.value.end.x)).toBe(300);
    expect(Math.round(ctx.placementStore.box.value.end.y)).toBe(100);
  });

  it("medicao em andamento: segue o ponteiro e o Shift trava o angulo", () => {
    const ctx = setup({
      placement: { kind: "measurement", start: { x: 100, y: 100 }, end: null, constrainAngle: false },
      editor: buildEditor({ zones: [], objects: [] })
    });
    act(() => ctx.result.current.handlePointerMove({ x: 250, y: 130, shiftKey: true }));
    expect(ctx.placementStore.box.value).toMatchObject({ end: { x: 250, y: 130 }, constrainAngle: true });
    act(() => ctx.result.current.handlePointerMove({ x: 260, y: 130 }));
    // quirk preservado: sem Shift o valor vem direto de event.shiftKey (undefined no teste)
    expect(ctx.placementStore.box.value.constrainAngle).toBeUndefined();
  });

  it("sem posicionamento ou antes do primeiro clique nao trata o evento", () => {
    expect(setup().result.current.handlePointerMove({ x: 1, y: 1 })).toBe(false);
    const wall = setup({ placement: { kind: "wall", item: wallItem, start: null } });
    expect(wall.result.current.handlePointerMove({ x: 1, y: 1 })).toBe(false);
    const measurement = setup({ placement: { kind: "measurement", start: null } });
    expect(measurement.result.current.handlePointerMove({ x: 1, y: 1 })).toBe(false);
  });

  it("usa os padroes do plano sem editor carregado", () => {
    const ctx = setup({ placement: { kind: "wall", item: wallItem, start: { x: 0, y: 0 } } });
    ctx.ui.setPlacement((current) => current);
    expect(ctx.result.current.handlePointerMove({ x: 10, y: 10 })).toBe(true);
  });
});
