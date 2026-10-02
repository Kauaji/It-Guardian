import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSegment, renameSegment } from "../../api.js";
import { createSession, createStore, sessionWrapper } from "../../test/appHarness.jsx";
import { useSegmentForm } from "./useSegmentForm.js";

vi.mock("../../api.js", () => ({ createSegment: vi.fn(), renameSegment: vi.fn() }));

const redes = { id: "s1", name: "Redes", groupId: "g1" };

function setup(selectedInventoryGroup = "all") {
  const session = createSession();
  const segments = createStore([redes]);
  const groups = createStore([{ id: "g1", segmentIds: ["s1"] }]);
  const allDevices = createStore([{ id: "d1", segmentId: "s1", segmentName: "Redes" }]);
  const deps = {
    data: {
      loadData: vi.fn().mockResolvedValue(),
      segmentGroups: groups.get(),
      setAllDevices: allDevices.set,
      setSegmentGroups: groups.set,
      setSegments: segments.set
    },
    inventory: {
      filters: { selectedInventoryGroup },
      model: {
        activeInventoryTab: { id: "tab-a" },
        activeSegmentGroups: [{ id: "g1", segmentIds: ["s1"] }],
        activeSegments: [redes]
      }
    },
    meta: { updateInventoryMeta: vi.fn() }
  };
  const { result } = renderHook(() => useSegmentForm(deps), { wrapper: sessionWrapper(session) });
  return { ...deps, allDevices, groups, result, segments, session };
}

describe("useSegmentForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("abre o formulario de criacao usando o grupo selecionado como padrao", () => {
    const { result } = setup("g1");
    act(() => result.current.handleCreateSegment());
    expect(result.current.segmentForm).toEqual({ mode: "create", segment: null, groupId: "g1" });
    act(() => result.current.closeSegmentForm());
    expect(result.current.segmentForm).toBeNull();
  });

  it("nao pre-seleciona grupo quando o filtro e 'todos' ou 'sem grupo'", () => {
    for (const filter of ["all", "ungrouped"]) {
      const { result } = setup(filter);
      act(() => result.current.handleCreateSegment());
      expect(result.current.segmentForm.groupId).toBe("");
    }
  });

  it("recusa nomes reservados e duplicados no mesmo grupo", async () => {
    const { result, session } = setup();
    act(() => result.current.handleCreateSegment());
    await act(async () => {
      await result.current.submitSegmentForm("Manutenção", "");
    });
    expect(session.notify).toHaveBeenLastCalledWith("Esse nome e reservado pelo sistema.", "danger");

    await act(async () => {
      await result.current.submitSegmentForm(" redes ", "g1");
    });
    expect(session.notify).toHaveBeenLastCalledWith("Ja existe um segmento com esse nome neste grupo.", "danger");
    expect(createSegment).not.toHaveBeenCalled();
  });

  it("cria o segmento, registra aba/ordem e fecha o formulario", async () => {
    createSegment.mockResolvedValue({ segment: { id: "s9", name: "Caixas", groupId: "g1" } });
    const { result, segments, meta, data, session, groups } = (() => {
      const context = setup("g1");
      return { ...context, meta: context.meta, data: context.data };
    })();
    act(() => result.current.handleCreateSegment());
    await act(async () => {
      await result.current.submitSegmentForm("  Caixas ", "g1");
    });
    expect(createSegment).toHaveBeenCalledWith("token-1", expect.objectContaining({ name: "Caixas", groupId: "g1" }));
    expect(segments.get().map((segment) => segment.id)).toEqual(["s1", "s9"]);
    expect(meta.updateInventoryMeta).toHaveBeenCalledWith("segments", "s9", { tabId: "tab-a", order: 1 });
    expect(groups.get()[0].segmentIds).toContain("s9");
    expect(session.notify).toHaveBeenCalledWith("Segmento Caixas criado.", "ok");
    expect(data.loadData).toHaveBeenCalledWith(true);
    expect(result.current.segmentForm).toBeNull();
    expect(result.current.segmentSaving).toBe(false);
  });

  it("renomeia o segmento, atualizando lista, ativos e grupo", async () => {
    renameSegment.mockResolvedValue({ segment: { name: "Redes 2", groupId: "" } });
    const { result, segments, allDevices, session, meta } = setup();
    act(() => result.current.handleRenameSegment(redes));
    expect(result.current.segmentForm).toEqual({ mode: "rename", segment: redes, groupId: "g1" });

    await act(async () => {
      await result.current.submitSegmentForm("Redes 2", "");
    });
    expect(renameSegment).toHaveBeenCalledWith("token-1", "s1", { name: "Redes 2", groupId: null });
    expect(segments.get()[0]).toMatchObject({ name: "Redes 2", groupId: "" });
    expect(allDevices.get()[0].segmentName).toBe("Redes 2");
    expect(meta.updateInventoryMeta).toHaveBeenCalledWith("segments", "s1", { tabId: "tab-a" });
    expect(session.notify).toHaveBeenCalledWith("Segmento renomeado.", "ok");
  });

  it("avisa erros da API e mantem o formulario aberto", async () => {
    createSegment.mockRejectedValue(new Error("falhou"));
    const { result, session } = setup();
    act(() => result.current.handleCreateSegment());
    await act(async () => {
      await result.current.submitSegmentForm("Novo");
    });
    expect(session.notify).toHaveBeenLastCalledWith("falhou", "danger");
    expect(result.current.segmentForm).not.toBeNull();
    expect(result.current.segmentSaving).toBe(false);
  });
});
