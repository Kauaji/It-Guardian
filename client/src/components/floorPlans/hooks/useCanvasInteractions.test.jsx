import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDesk, buildEditor, buildPc } from "../test/fixtures.js";
import { cloneEditor } from "../utils/editorGeometry.js";
import { useCanvasInteractions } from "./useCanvasInteractions.js";

function store(initial) {
  const box = { value: initial };
  const set = vi.fn((next) => {
    box.value = typeof next === "function" ? next(box.value) : next;
  });
  return { box, set };
}

function pointerEvent(extra = {}) {
  return {
    button: 0,
    x: 0,
    y: 0,
    pointerId: 1,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    currentTarget: { setPointerCapture: vi.fn() },
    ...extra
  };
}

function setup({ editor = buildEditor(), ui = {}, viewport = {}, isEditing = true, placementHandles = false } = {}) {
  const editorBox = { current: editor };
  const selected = store(null);
  const selectedObjectIds = store(ui.selectedObjectIds || []);
  const selectionBox = store(null);
  const guides = store([]);
  const commitEditor = vi.fn((mutate) => {
    const draft = cloneEditor(editorBox.current);
    editorBox.current = mutate(draft) || draft;
  });
  const deps = {
    doc: { editor, activeFloorId: "floor-1", commitEditor, pushHistory: vi.fn() },
    ui: {
      selectedTool: "select",
      placement: null,
      paintDraft: null,
      selectedObjectIds: selectedObjectIds.box.value,
      zoomMode: false,
      setSelected: selected.set,
      setSelectedObjectIds: selectedObjectIds.set,
      setSelectionBox: selectionBox.set,
      setAlignmentGuides: guides.set,
      ...ui
    },
    viewport: {
      getSvgPoint: vi.fn((event) => ({ x: event.x ?? 0, y: event.y ?? 0 })),
      spacePressed: false,
      beginPan: vi.fn((event) => ({ type: "pan", clientX: event.x ?? 0, clientY: event.y ?? 0, viewBox: {} })),
      movePan: vi.fn(),
      endPan: vi.fn(),
      zoomAtClick: vi.fn(),
      ...viewport
    },
    paint: { applyPaint: vi.fn(), paintPointerRef: { current: false } },
    placementApi: {
      confirmPlacement: vi.fn(),
      finishRoomPlacement: vi.fn(),
      handlePointerMove: vi.fn(() => placementHandles)
    },
    entities: { handleEntitySelect: vi.fn() },
    isEditing
  };
  const { result } = renderHook(() => useCanvasInteractions(deps));
  return { ...deps, result, selected, selectedObjectIds, selectionBox, guides, commitEditor, editorBox };
}

beforeEach(() => vi.clearAllMocks());

describe("handleCanvasPointerDown", () => {
  it("pan com botao do meio, direito ou espaco + clique captura o ponteiro", () => {
    for (const [button, spacePressed] of [
      [1, false],
      [2, false],
      [0, true]
    ]) {
      const ctx = setup({ viewport: { spacePressed } });
      const event = pointerEvent({ button });
      act(() => ctx.result.current.handleCanvasPointerDown(event));
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.currentTarget.setPointerCapture).toHaveBeenCalledWith(1);
      expect(ctx.viewport.beginPan).toHaveBeenCalledWith(event);
    }
  });

  it("pan tolera alvo sem captura de ponteiro", () => {
    const ctx = setup();
    const event = pointerEvent({ button: 1, currentTarget: null });
    act(() => ctx.result.current.handleCanvasPointerDown(event));
    expect(ctx.viewport.beginPan).toHaveBeenCalled();
  });

  it("modo zoom amplia no clique esquerdo", () => {
    const ctx = setup({ ui: { zoomMode: true } });
    const event = pointerEvent();
    act(() => ctx.result.current.handleCanvasPointerDown(event));
    expect(ctx.viewport.zoomAtClick).toHaveBeenCalledWith(event);
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it("fora da edicao nao faz nada", () => {
    const ctx = setup({ isEditing: false });
    const event = pointerEvent();
    act(() => ctx.result.current.handleCanvasPointerDown(event));
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(ctx.selectionBox.set).not.toHaveBeenCalled();
  });

  it("pincel aplica a tinta e arma o arrasto continuo exceto no balde", () => {
    const ctx = setup({ ui: { paintDraft: { mode: "brush" } } });
    act(() => ctx.result.current.handleCanvasPointerDown(pointerEvent({ x: 10, y: 20 })));
    expect(ctx.paint.applyPaint).toHaveBeenCalledWith({ x: 10, y: 20 });
    expect(ctx.paint.paintPointerRef.current).toBe(true);

    const bucket = setup({ ui: { paintDraft: { mode: "bucket" } } });
    act(() => bucket.result.current.handleCanvasPointerDown(pointerEvent()));
    expect(bucket.paint.paintPointerRef.current).toBe(false);
  });

  it("posicionamento ativo delega a confirmacao", () => {
    const ctx = setup({ ui: { placement: { kind: "catalog" } } });
    const event = pointerEvent();
    act(() => ctx.result.current.handleCanvasPointerDown(event));
    expect(ctx.placementApi.confirmPlacement).toHaveBeenCalledWith(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("ferramenta diferente de selecao ignora o clique", () => {
    const ctx = setup({ ui: { selectedTool: "paint" } });
    act(() => ctx.result.current.handleCanvasPointerDown(pointerEvent()));
    expect(ctx.selectionBox.set).not.toHaveBeenCalled();
  });

  it("selecao: inicia o retangulo e limpa a selecao (ou preserva com Ctrl/Cmd)", () => {
    const ctx = setup();
    act(() => ctx.result.current.handleCanvasPointerDown(pointerEvent({ x: 30, y: 40 })));
    expect(ctx.selectionBox.box.value).toEqual({ x: 30, y: 40, width: 0, height: 0 });
    expect(ctx.selected.set).toHaveBeenCalledWith(null);
    expect(ctx.selectedObjectIds.set).toHaveBeenCalledWith([]);

    const additive = setup();
    act(() => additive.result.current.handleCanvasPointerDown(pointerEvent({ ctrlKey: true })));
    expect(additive.selected.set).not.toHaveBeenCalled();
    const meta = setup();
    act(() => meta.result.current.handleCanvasPointerDown(pointerEvent({ metaKey: true })));
    expect(meta.selected.set).not.toHaveBeenCalled();
  });
});

describe("beginDrag", () => {
  it("ignora com outra ferramenta, posicionamento ou pincel e entidade inexistente", () => {
    const tool = setup({ ui: { selectedTool: "paint" } });
    act(() => tool.result.current.beginDrag(pointerEvent(), "object", "desk-1"));
    const placing = setup({ ui: { placement: {} } });
    act(() => placing.result.current.beginDrag(pointerEvent(), "object", "desk-1"));
    const painting = setup({ ui: { paintDraft: {} } });
    act(() => painting.result.current.beginDrag(pointerEvent(), "object", "desk-1"));
    const missing = setup();
    act(() => missing.result.current.beginDrag(pointerEvent(), "object", "nao-existe"));
    for (const ctx of [tool, placing, painting, missing]) expect(ctx.doc.pushHistory).not.toHaveBeenCalled();
  });

  it("objeto travado ou com modificador apenas seleciona", () => {
    const locked = setup({ editor: buildEditor({ objects: [buildDesk({ metadata: { locked: true } })] }) });
    const event = pointerEvent();
    act(() => locked.result.current.beginDrag(event, "object", "desk-1"));
    expect(locked.entities.handleEntitySelect).toHaveBeenCalledWith({ type: "object", id: "desk-1" }, event);
    expect(locked.doc.pushHistory).not.toHaveBeenCalled();

    const shift = setup();
    act(() => shift.result.current.beginDrag(pointerEvent({ shiftKey: true }), "object", "desk-1"));
    expect(shift.entities.handleEntitySelect).toHaveBeenCalled();
  });

  it("inicia o arrasto de objeto: guarda historico, seleciona e usa a selecao multipla atual", () => {
    const ctx = setup({ ui: { selectedObjectIds: ["desk-1", "pc-1"] } });
    act(() => ctx.result.current.beginDrag(pointerEvent({ x: 210, y: 210 }), "object", "desk-1"));
    expect(ctx.doc.pushHistory).toHaveBeenCalledWith(ctx.doc.editor);
    expect(ctx.selected.set).toHaveBeenCalledWith({ type: "object", id: "desk-1" });
    expect(ctx.selectedObjectIds.set).toHaveBeenCalledWith(["desk-1", "pc-1"]);

    const single = setup();
    act(() => single.result.current.beginDrag(pointerEvent(), "object", "pc-1"));
    expect(single.selectedObjectIds.set).toHaveBeenCalledWith(["pc-1"]);
  });

  it("comodos e pontos de conexao: arrasto sem ids de objeto", () => {
    const zone = setup();
    act(() => zone.result.current.beginDrag(pointerEvent(), "zone", "room-1"));
    expect(zone.selected.set).toHaveBeenCalledWith({ type: "zone", id: "room-1" });
    expect(zone.selectedObjectIds.set).toHaveBeenCalledWith([]);
  });
});

describe("handleCanvasPointerMove / moveDrag / endDrag", () => {
  it("move o objeto arrastado, com guias de alinhamento e sem registrar historico", () => {
    const ctx = setup();
    act(() => ctx.result.current.beginDrag(pointerEvent({ x: 210, y: 210 }), "object", "pc-1"));
    act(() => ctx.result.current.handleCanvasPointerMove(pointerEvent({ x: 260, y: 235 })));
    expect(ctx.commitEditor).toHaveBeenCalledWith(expect.any(Function), { track: false });
    expect(ctx.guides.set).toHaveBeenCalled();
    const moved = ctx.editorBox.current.objects.find((object) => object.id === "pc-1");
    expect(moved.x).not.toBe(240);
  });

  it("sem arrasto em andamento nao faz nada; placementApi que trata o evento impede o arrasto", () => {
    const idle = setup();
    act(() => idle.result.current.handleCanvasPointerMove(pointerEvent()));
    expect(idle.commitEditor).not.toHaveBeenCalled();

    const handled = setup({ placementHandles: true });
    act(() => handled.result.current.beginDrag(pointerEvent({ x: 210, y: 210 }), "object", "pc-1"));
    act(() => handled.result.current.handleCanvasPointerMove(pointerEvent({ x: 260, y: 235 })));
    expect(handled.commitEditor).not.toHaveBeenCalled();
  });

  it("pincel com o ponteiro apertado continua pintando", () => {
    const ctx = setup({ ui: { paintDraft: { mode: "brush" } } });
    ctx.paint.paintPointerRef.current = true;
    act(() => ctx.result.current.handleCanvasPointerMove(pointerEvent({ x: 5, y: 6 })));
    expect(ctx.paint.applyPaint).toHaveBeenCalledWith({ x: 5, y: 6 });
    expect(ctx.placementApi.handlePointerMove).not.toHaveBeenCalled();
  });

  it("pan: move o viewport e finaliza no endDrag", () => {
    const ctx = setup();
    act(() => ctx.result.current.handleCanvasPointerDown(pointerEvent({ button: 1 })));
    const move = pointerEvent({ x: 50, y: 60 });
    act(() => ctx.result.current.handleCanvasPointerMove(move));
    expect(ctx.viewport.movePan).toHaveBeenCalledWith(move, expect.objectContaining({ type: "pan" }));
    expect(move.preventDefault).toHaveBeenCalled();
    const up = pointerEvent();
    act(() => ctx.result.current.endDrag(up));
    expect(ctx.viewport.endPan).toHaveBeenCalledWith(up);
    expect(ctx.paint.paintPointerRef.current).toBe(false);
    expect(ctx.guides.set).toHaveBeenLastCalledWith([]);
  });

  it("retangulo de selecao: acompanha o ponteiro e ao soltar seleciona os objetos dentro", () => {
    const ctx = setup();
    act(() => ctx.result.current.handleCanvasPointerDown(pointerEvent({ x: 150, y: 150 })));
    act(() => ctx.result.current.handleCanvasPointerMove(pointerEvent({ x: 420, y: 300 })));
    expect(ctx.selectionBox.box.value).toMatchObject({ x: 150, y: 150, width: 270, height: 150 });
    act(() => ctx.result.current.endDrag(pointerEvent({ x: 420, y: 300 })));
    expect(ctx.selectedObjectIds.box.value).toEqual(expect.arrayContaining(["desk-1", "pc-1"]));
    expect(ctx.selected.set).toHaveBeenCalled();
    expect(ctx.selectionBox.box.value).toBeNull();
  });

  it("soltar o retangulo sem evento usa o ponto inicial", () => {
    const ctx = setup();
    act(() => ctx.result.current.handleCanvasPointerDown(pointerEvent({ x: 900, y: 700 })));
    act(() => ctx.result.current.endDrag(undefined));
    expect(ctx.selectedObjectIds.box.value).toEqual([]);
  });

  it("soltar sem arrasto conclui o posicionamento de comodo, exceto durante o pincel", () => {
    const ctx = setup();
    const up = pointerEvent();
    act(() => ctx.result.current.endDrag(up));
    expect(ctx.placementApi.finishRoomPlacement).toHaveBeenCalledWith(up);

    const painting = setup({ ui: { paintDraft: { mode: "brush" } } });
    act(() => painting.result.current.endDrag(pointerEvent()));
    expect(painting.placementApi.finishRoomPlacement).not.toHaveBeenCalled();
  });

  it("soltar um arrasto de entidade limpa o estado do arrasto", () => {
    const ctx = setup();
    act(() => ctx.result.current.beginDrag(pointerEvent({ x: 210, y: 210 }), "object", "pc-1"));
    act(() => ctx.result.current.endDrag(pointerEvent()));
    expect(ctx.placementApi.finishRoomPlacement).toHaveBeenCalled();
    ctx.commitEditor.mockClear();
    act(() => ctx.result.current.handleCanvasPointerMove(pointerEvent({ x: 300, y: 300 })));
    expect(ctx.commitEditor).not.toHaveBeenCalled();
  });
});

describe("redimensionamento", () => {
  it("comodo: inicia o resize com historico e selecao do comodo", () => {
    const ctx = setup();
    act(() => ctx.result.current.beginRoomResize(pointerEvent({ x: 600, y: 300 }), "room-1", "e"));
    expect(ctx.doc.pushHistory).toHaveBeenCalled();
    expect(ctx.selected.set).toHaveBeenCalledWith({ type: "zone", id: "room-1" });
    expect(ctx.selectedObjectIds.set).toHaveBeenCalledWith([]);
    act(() => ctx.result.current.handleCanvasPointerMove(pointerEvent({ x: 650, y: 300 })));
    expect(ctx.commitEditor).toHaveBeenCalledWith(expect.any(Function), { track: false });
  });

  it("comodo: ignora sem editor, comodo inexistente ou nao-comodo", () => {
    const ctx = setup({ editor: buildEditor() });
    act(() => ctx.result.current.beginRoomResize(pointerEvent(), "nao-existe", "e"));
    expect(ctx.doc.pushHistory).not.toHaveBeenCalled();
  });

  it("objeto: inicia o resize; objeto travado ou inexistente e ignorado", () => {
    const ctx = setup();
    act(() => ctx.result.current.beginObjectResize(pointerEvent({ x: 300, y: 250 }), "desk-1", "se"));
    expect(ctx.doc.pushHistory).toHaveBeenCalled();
    expect(ctx.selected.set).toHaveBeenCalledWith({ type: "object", id: "desk-1" });
    expect(ctx.selectedObjectIds.set).toHaveBeenCalledWith(["desk-1"]);

    const locked = setup({ editor: buildEditor({ objects: [buildDesk({ metadata: { locked: true } }), buildPc()] }) });
    act(() => locked.result.current.beginObjectResize(pointerEvent(), "desk-1", "se"));
    act(() => locked.result.current.beginObjectResize(pointerEvent(), "fantasma", "se"));
    expect(locked.doc.pushHistory).not.toHaveBeenCalled();
  });
});
