import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, sessionWrapper } from "../../test/appHarness.jsx";
import { useInventoryDragController } from "./useInventoryDragController.js";

const redes = { id: "s1", name: "Redes", groupId: "g1" };
const caixas = { id: "s2", name: "Caixas", groupId: "" };
const padrao = { id: "def", name: "Não organizadas", isDefault: true };
const devices = [
  { id: "d1", name: "PC-01", segmentId: "s1" },
  { id: "d2", name: "PC-02", segmentId: "s1" }
];
const groups = [{ id: "g1", name: "Andar 1", segmentIds: ["s1"] }];

function setup({ activeView = "inventory", selected = [] } = {}) {
  const session = createSession();
  const selection = { selectOnly: vi.fn(), selectedAssetIds: new Set(selected) };
  const moves = { handleMoveMachine: vi.fn(), handleMoveMachines: vi.fn() };
  const sidebar = { beginDrag: vi.fn(), endDrag: vi.fn() };
  const segmentMutations = { moveSegmentToGroup: vi.fn() };
  const deps = {
    activeView,
    data: { segments: [redes, caixas, padrao] },
    inventory: {
      filters: {
        filteredInventoryDevices: devices,
        inventoryViewDevices: devices,
        inventoryViewSegments: [redes, caixas, padrao]
      },
      model: { activeAllDevices: devices, activeSegmentGroups: groups, activeSegments: [redes, caixas, padrao] },
      selection
    },
    moves,
    segmentMutations,
    sidebar
  };
  const { result } = renderHook(() => useInventoryDragController(deps), { wrapper: sessionWrapper(session) });
  return { ...deps, result, session };
}

const startEvent = (data) => ({ active: { data: { current: data } } });

describe("useInventoryDragController", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.className = "";
  });

  it("ao iniciar o arraste de um ativo marca o ativo, abre a sidebar e seleciona so ele", () => {
    const popovers = vi.fn();
    window.addEventListener("it-guardian:close-popovers", popovers);
    const { result, sidebar, inventory } = setup();

    act(() => result.current.handleDragStart(startEvent({ type: "machine", machineId: "d1" })));

    expect(result.current.activeDragMachine).toMatchObject({ id: "d1" });
    expect(result.current.activeDragSegment).toBeNull();
    expect(document.body.classList.contains("is-inventory-dragging")).toBe(true);
    expect(sidebar.beginDrag).toHaveBeenCalled();
    expect(inventory.selection.selectOnly).toHaveBeenCalledWith("d1");
    expect(popovers).toHaveBeenCalled();
    window.removeEventListener("it-guardian:close-popovers", popovers);
  });

  it("nao altera a selecao quando o ativo arrastado ja esta selecionado", () => {
    const { result, inventory } = setup({ selected: ["d1", "d2"] });
    act(() => result.current.handleDragStart(startEvent({ type: "machine", machineId: "d1" })));
    expect(inventory.selection.selectOnly).not.toHaveBeenCalled();
  });

  it("arrastar um segmento expoe o segmento, o grupo e a contagem de maquinas", () => {
    const { result } = setup();
    act(() => result.current.handleDragStart(startEvent({ type: "segment", segmentId: "s1" })));
    expect(result.current.activeDragSegment).toMatchObject({ id: "s1" });
    expect(result.current.activeDragMachine).toBeNull();
    expect(result.current.activeDragSegmentGroupName).toBe("Andar 1");
    expect(result.current.activeDragSegmentCount).toBe(2);

    act(() => result.current.handleDragCancel());
    expect(result.current.activeDragSegmentGroupName).toBe("Sem grupo");
    expect(result.current.activeDragSegmentCount).toBe(0);
  });

  it("segmento sem grupo mostra 'Sem grupo'", () => {
    const { result } = setup();
    act(() => result.current.handleDragStart(startEvent({ type: "segment", segmentId: "s2" })));
    expect(result.current.activeDragSegmentGroupName).toBe("Sem grupo");
  });

  it("ignora o arraste fora da visao de inventario", () => {
    const { result, sidebar } = setup({ activeView: "dashboard" });
    act(() => result.current.handleDragStart(startEvent({ type: "machine", machineId: "d1" })));
    expect(sidebar.beginDrag).not.toHaveBeenCalled();
    expect(result.current.activeDragMachine).toBeNull();

    act(() => result.current.handleDragEnd({ active: { data: { current: { type: "segment", segmentId: "s1" } } } }));
    expect(sidebar.endDrag).toHaveBeenCalledWith({ forceCollapse: false });
  });

  it("cancelar limpa o arraste e repassa o recolhimento da sidebar", () => {
    const { result, sidebar } = setup();
    act(() => result.current.handleDragStart(startEvent({ type: "machine", machineId: "d1" })));
    act(() => result.current.handleDragCancel({ forceCollapse: true }));
    expect(result.current.activeDragMachine).toBeNull();
    expect(document.body.classList.contains("is-inventory-dragging")).toBe(false);
    expect(sidebar.endDrag).toHaveBeenCalledWith({ forceCollapse: true });
  });

  it("soltar um segmento sobre outro grupo move o segmento e avisa", () => {
    const { result, segmentMutations, session, sidebar } = setup();
    act(() =>
      result.current.handleDragEnd({
        active: { data: { current: { type: "segment", segmentId: "s2" } } },
        over: { data: { current: { type: "sidebar-segment-group-drop", groupId: "g1" } } }
      })
    );
    expect(segmentMutations.moveSegmentToGroup).toHaveBeenCalledWith("s2", "g1");
    expect(session.notify).toHaveBeenCalledWith("Caixas movido para Andar 1.", "ok");
    expect(sidebar.endDrag).toHaveBeenCalledWith({ forceCollapse: true });
  });

  it("soltar um segmento em 'Sem grupo' usa a mensagem propria", () => {
    const { result, segmentMutations, session } = setup();
    act(() =>
      result.current.handleDragEnd({
        active: { data: { current: { type: "segment", segmentId: "s1" } } },
        over: { data: { current: { type: "segment-group-drop", groupId: "" } } }
      })
    );
    expect(segmentMutations.moveSegmentToGroup).toHaveBeenCalledWith("s1", "");
    expect(session.notify).toHaveBeenCalledWith("Redes movido para Sem grupo.", "ok");
  });

  it("nao move segmento padrao, para o mesmo grupo ou para alvo inadequado", () => {
    const { result, segmentMutations } = setup();
    const end = (segmentId, over) =>
      act(() => result.current.handleDragEnd({ active: { data: { current: { type: "segment", segmentId } } }, over }));

    end("def", { data: { current: { type: "segment-group-drop", groupId: "g1" } } });
    end("s1", { data: { current: { type: "segment-group-drop", groupId: "g1" } } });
    end("s1", { data: { current: { type: "segment", segmentId: "s2" } } });
    end("s1", { data: { current: { type: "segment-group-drop" } } });
    end("s1", undefined);
    expect(segmentMutations.moveSegmentToGroup).not.toHaveBeenCalled();
  });

  it("soltar um ativo sobre um segmento move o ativo e anima a rolagem de retorno", () => {
    const target = document.createElement("div");
    target.id = "inventory-segment-s2";
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);
    window.scrollTo = vi.fn();
    const { result, moves } = setup();

    act(() => result.current.handleDragStart(startEvent({ type: "machine", machineId: "d1" })));
    act(() =>
      result.current.handleDragEnd({
        active: { data: { current: { type: "machine", machineId: "d1" } } },
        over: { data: { current: { type: "segment", segmentId: "s2" } } }
      })
    );

    expect(moves.handleMoveMachine).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(110));
    expect(target.classList.contains("drop-confirm-highlight")).toBe(true);
    expect(target.scrollIntoView).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1100));
    expect(target.classList.contains("drop-confirm-highlight")).toBe(false);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    target.remove();
  });
});
