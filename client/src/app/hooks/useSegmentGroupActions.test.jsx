import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSegmentGroup, deleteSegmentGroup, updateSegmentGroup } from "../../api.js";
import { createSession, createStore, sessionWrapper } from "../../test/appHarness.jsx";
import { useSegmentGroupActions } from "./useSegmentGroupActions.js";

vi.mock("../../api.js", () => ({
  createSegmentGroup: vi.fn(),
  deleteSegmentGroup: vi.fn(),
  updateSegmentGroup: vi.fn()
}));

const groups = [
  { id: "g1", name: "Andar 1", color: "#111", segmentIds: ["s1"] },
  { id: "g2", name: "Andar 2", color: "#222", segmentIds: [] }
];

function setup(selectedInventoryGroup = "all") {
  const session = createSession();
  const groupStore = createStore(groups);
  const segmentStore = createStore([{ id: "s1", groupId: "g1" }]);
  const tabMeta = createStore({});
  const filters = {
    selectedInventoryGroup,
    setSelectedInventoryGroup: vi.fn(),
    setSelectedInventorySegment: vi.fn()
  };
  const deps = {
    data: {
      loadData: vi.fn().mockResolvedValue(),
      segmentGroups: groups,
      setSegmentGroups: groupStore.set,
      setSegments: segmentStore.set
    },
    inventory: {
      filters,
      model: {
        activeInventoryTab: { id: "tab-a" },
        activeSegmentGroups: groups,
        activeSegments: [{ id: "s1", groupId: "g1" }]
      },
      persistence: { saveInventoryTabMeta: tabMeta.set }
    },
    meta: { updateInventoryMeta: vi.fn() }
  };
  const { result } = renderHook(() => useSegmentGroupActions(deps), { wrapper: sessionWrapper(session) });
  return { ...deps, filters, groupStore, result, segmentStore, session, tabMeta };
}

describe("useSegmentGroupActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("abre e fecha o formulario de criar e de renomear", () => {
    const { result } = setup();
    act(() => result.current.openSegmentGroupForm());
    expect(result.current.segmentGroupForm).toEqual({ mode: "create", group: null });
    act(() => result.current.renameSegmentGroup("g1"));
    expect(result.current.segmentGroupForm).toEqual({ mode: "edit", group: groups[0] });
    act(() => result.current.closeSegmentGroupForm());
    expect(result.current.segmentGroupForm).toBeNull();
    act(() => result.current.renameSegmentGroup("inexistente"));
    expect(result.current.segmentGroupForm).toBeNull();
  });

  it("recusa grupo duplicado ignorando maiusculas", async () => {
    const { result, session } = setup();
    act(() => result.current.openSegmentGroupForm());
    await act(async () => {
      await result.current.submitSegmentGroupForm(" ANDAR 1 ", "#fff");
    });
    expect(session.notify).toHaveBeenCalledWith("Ja existe um grupo com esse nome.", "danger");
    expect(createSegmentGroup).not.toHaveBeenCalled();
  });

  it("cria o grupo na aba ativa, ao final da ordem", async () => {
    createSegmentGroup.mockResolvedValue({ group: { id: "g3", name: "Andar 3" } });
    const { result, groupStore, meta, data, session } = setup();
    act(() => result.current.openSegmentGroupForm());
    await act(async () => {
      await result.current.submitSegmentGroupForm("Andar 3", "");
    });
    expect(createSegmentGroup).toHaveBeenCalledWith("token-1", expect.objectContaining({ name: "Andar 3" }));
    expect(groupStore.get().map((group) => group.id)).toEqual(["g1", "g2", "g3"]);
    expect(meta.updateInventoryMeta).toHaveBeenCalledWith("groups", "g3", { tabId: "tab-a", order: 2 });
    expect(session.notify).toHaveBeenCalledWith("Grupo criado.", "ok");
    expect(data.loadData).toHaveBeenCalledWith(true);
    expect(result.current.segmentGroupForm).toBeNull();
  });

  it("renomeia o grupo existente", async () => {
    updateSegmentGroup.mockResolvedValue({ group: { name: "Térreo" } });
    const { result, groupStore, session } = setup();
    act(() => result.current.renameSegmentGroup("g1"));
    await act(async () => {
      await result.current.submitSegmentGroupForm("Térreo", "#111");
    });
    expect(updateSegmentGroup).toHaveBeenCalledWith("token-1", "g1", { name: "Térreo", color: "#111" });
    expect(groupStore.get()[0].name).toBe("Térreo");
    expect(session.notify).toHaveBeenCalledWith("Grupo renomeado.", "ok");
  });

  it("avisa erro da API e libera o estado de salvando", async () => {
    createSegmentGroup.mockRejectedValue(new Error("erro grupo"));
    const { result, session } = setup();
    act(() => result.current.openSegmentGroupForm());
    await act(async () => {
      await result.current.submitSegmentGroupForm("Novo", "#fff");
    });
    expect(session.notify).toHaveBeenCalledWith("erro grupo", "danger");
    expect(result.current.segmentGroupSaving).toBe(false);
  });

  it("recolhe/expande o grupo na hora e avisa se o servidor falhar", async () => {
    updateSegmentGroup.mockRejectedValue(new Error("falhou toggle"));
    const { result, groupStore, session } = setup();
    act(() => result.current.toggleSegmentGroup("g1"));
    expect(groupStore.get()[0].collapsed).toBe(true);
    expect(updateSegmentGroup).toHaveBeenCalledWith("token-1", "g1", { collapsed: true });
    await vi.waitFor(() => expect(session.notify).toHaveBeenCalledWith("falhou toggle", "danger"));
    act(() => result.current.toggleSegmentGroup("inexistente"));
    expect(updateSegmentGroup).toHaveBeenCalledTimes(1);
  });

  it("troca a cor do grupo, confirma com o servidor e reverte em caso de erro", async () => {
    updateSegmentGroup.mockResolvedValueOnce({ group: { color: "#999" } });
    const { result, groupStore } = setup();
    await result.current.changeSegmentGroupColor("g1", "");
    await result.current.changeSegmentGroupColor("g1", "#111");
    expect(updateSegmentGroup).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.changeSegmentGroupColor("g1", "#abc");
    });
    expect(groupStore.get()[0].color).toBe("#999");

    updateSegmentGroup.mockRejectedValueOnce(new Error("sem cor"));
    await act(async () => {
      await result.current.changeSegmentGroupColor("g2", "#abc");
    });
    expect(groupStore.get()).toBe(groups);
  });

  it("exclui o grupo apos confirmar, soltando os segmentos e limpando o filtro", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteSegmentGroup.mockResolvedValue({});
    const { result, groupStore, segmentStore, filters, session } = setup("g1");
    await act(async () => {
      await result.current.deleteSegmentGroup("g1");
    });
    expect(confirm).toHaveBeenCalledWith('Excluir o grupo "Andar 1" e mover 1 segmento(s) para Sem grupo?');
    expect(groupStore.get().map((group) => group.id)).toEqual(["g2"]);
    expect(segmentStore.get()[0].groupId).toBe("");
    expect(filters.setSelectedInventoryGroup).toHaveBeenCalledWith("all");
    expect(session.notify).toHaveBeenCalledWith("Grupo excluido. Segmentos mantidos em Sem grupo.", "ok");
  });

  it("nao exclui sem confirmacao, grupo vazio usa a mensagem simples e erros avisam", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result, session } = setup();
    await act(async () => {
      await result.current.deleteSegmentGroup("g2");
    });
    expect(confirm).toHaveBeenCalledWith('Excluir o grupo "Andar 2"?');
    expect(deleteSegmentGroup).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    deleteSegmentGroup.mockRejectedValue(new Error("nao exclui"));
    await act(async () => {
      await result.current.deleteSegmentGroup("g2");
    });
    expect(session.notify).toHaveBeenCalledWith("nao exclui", "danger");
    await result.current.deleteSegmentGroup("inexistente");
  });

  it("reordena grupos gravando aba e ordem; nao grava na borda", () => {
    const { result, tabMeta } = setup();
    act(() => result.current.moveGroupOrder("g1", "down"));
    expect(tabMeta.get().groups).toEqual({
      g2: { tabId: "tab-a", order: 0 },
      g1: { tabId: "tab-a", order: 1 }
    });
    tabMeta.set.mockClear();
    act(() => result.current.moveGroupOrder("g1", "up"));
    expect(tabMeta.set).not.toHaveBeenCalled();
  });
});
