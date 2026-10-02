import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteSegment, renameSegment } from "../../api.js";
import { createSession, createStore, sessionWrapper } from "../../test/appHarness.jsx";
import { useSegmentMutations } from "./useSegmentMutations.js";

vi.mock("../../api.js", () => ({ deleteSegment: vi.fn(), renameSegment: vi.fn() }));

const defaultSegment = { id: "def", name: "Não organizadas", isDefault: true };
const redes = { id: "s1", name: "Redes", color: "#111", groupId: "g1" };
const redes2 = { id: "s2", name: "Caixas", color: "#222", groupId: "g1" };
const manutencao = { id: "m1", name: "Manutenção" };

function setup({ activeAllDevices = [] } = {}) {
  const session = createSession();
  const segments = createStore([defaultSegment, redes, redes2, manutencao]);
  const groups = createStore([{ id: "g1", segmentIds: ["s1", "s2"], collapsed: true }, { id: "g2", segmentIds: [] }]);
  const tabMeta = createStore({});
  const records = createStore({ d1: { active: true }, d2: { active: true } });
  const deps = {
    data: { loadData: vi.fn().mockResolvedValue(), segmentGroups: groups.get(), setSegmentGroups: groups.set, setSegments: segments.set },
    deviceState: { appendDeviceHistoryEvent: vi.fn(), updateDeviceSegmentInState: vi.fn() },
    inventory: {
      model: {
        activeAllDevices,
        activeInventoryTab: { id: "tab-a" },
        activeSegmentGroups: groups.get(),
        activeSegments: [defaultSegment, redes, redes2, manutencao]
      },
      persistence: { saveInventoryTabMeta: tabMeta.set, saveMaintenanceRecords: records.set }
    },
    meta: { updateInventoryMeta: vi.fn() }
  };
  const { result } = renderHook(() => useSegmentMutations(deps), { wrapper: sessionWrapper(session) });
  return { ...deps, groups, records, result, segments, session, tabMeta };
}

describe("useSegmentMutations.handleChangeSegmentColor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ignora cor vazia ou igual a atual", async () => {
    const { result } = setup();
    await result.current.handleChangeSegmentColor(redes, "");
    await result.current.handleChangeSegmentColor(redes, "#111");
    expect(renameSegment).not.toHaveBeenCalled();
  });

  it("aplica a cor na hora e confirma com o valor do servidor", async () => {
    renameSegment.mockResolvedValue({ segment: { color: "#999" } });
    const { result, segments, data } = setup();
    await act(async () => {
      await result.current.handleChangeSegmentColor(redes, "#abc");
    });
    expect(renameSegment).toHaveBeenCalledWith("token-1", "s1", { color: "#abc" });
    expect(segments.get().find((segment) => segment.id === "s1").color).toBe("#999");
    expect(data.loadData).toHaveBeenCalledWith(true);
  });

  it("restaura a cor anterior quando o servidor recusa", async () => {
    renameSegment.mockRejectedValue(new Error("erro cor"));
    const { result, segments, session } = setup();
    await act(async () => {
      await result.current.handleChangeSegmentColor(redes, "#abc");
    });
    expect(segments.get().find((segment) => segment.id === "s1").color).toBe("#111");
    expect(session.notify).toHaveBeenCalledWith("erro cor", "danger");
  });
});

describe("useSegmentMutations.handleDeleteSegment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("nao exclui sem confirmacao", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = setup();
    await result.current.handleDeleteSegment(redes);
    expect(deleteSegment).not.toHaveBeenCalled();
  });

  it("exclui o segmento comum e o tira do grupo", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteSegment.mockResolvedValue({});
    const { result, segments, groups, session, deviceState } = setup();
    await act(async () => {
      await result.current.handleDeleteSegment(redes);
    });
    expect(segments.get().map((segment) => segment.id)).not.toContain("s1");
    expect(groups.get()[0].segmentIds).toEqual(["s2"]);
    expect(deviceState.updateDeviceSegmentInState).not.toHaveBeenCalled();
    expect(session.notify).toHaveBeenCalledWith("Segmento excluído. Máquinas movidas para Não organizadas.", "ok");
  });

  it("ao excluir Manutencao devolve as maquinas ao padrao e limpa os registros", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteSegment.mockResolvedValue({});
    const inMaintenance = [{ id: "d1", segmentId: "m1" }, { id: "d2", segmentId: "m1" }, { id: "d3", segmentId: "s1" }];
    const { result, records, deviceState } = setup({ activeAllDevices: inMaintenance });
    await act(async () => {
      await result.current.handleDeleteSegment(manutencao);
    });
    expect(records.get()).toEqual({});
    expect(deviceState.updateDeviceSegmentInState).toHaveBeenCalledTimes(2);
    expect(deviceState.updateDeviceSegmentInState).toHaveBeenCalledWith("d1", "def", "Não organizadas", {
      maintenance: false,
      maintenanceOrigin: null
    });
    expect(deviceState.appendDeviceHistoryEvent).toHaveBeenCalledTimes(2);
  });

  it("avisa quando a exclusao falha", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteSegment.mockRejectedValue(new Error("em uso"));
    const { result, session } = setup();
    await act(async () => {
      await result.current.handleDeleteSegment(redes);
    });
    expect(session.notify).toHaveBeenCalledWith("em uso", "danger");
  });
});

describe("useSegmentMutations.moveSegmentToGroup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("move o segmento para o grupo, expande o grupo e grava no servidor", () => {
    renameSegment.mockResolvedValue({});
    const { result, groups, segments, meta } = setup();
    act(() => result.current.moveSegmentToGroup("s1", "g2"));
    expect(groups.get().find((group) => group.id === "g2")).toMatchObject({ segmentIds: ["s1"], collapsed: false });
    expect(segments.get().find((segment) => segment.id === "s1").groupId).toBe("g2");
    expect(meta.updateInventoryMeta).toHaveBeenCalledWith("segments", "s1", { tabId: "tab-a", order: 0 });
    expect(renameSegment).toHaveBeenCalledWith("token-1", "s1", { groupId: "g2" });
  });

  it("mover para 'sem grupo' envia groupId nulo", () => {
    renameSegment.mockResolvedValue({});
    const { result, segments } = setup();
    act(() => result.current.moveSegmentToGroup("s1", ""));
    expect(segments.get().find((segment) => segment.id === "s1").groupId).toBe("");
    expect(renameSegment).toHaveBeenCalledWith("token-1", "s1", { groupId: null });
  });

  it("desfaz os grupos, recarrega e avisa quando o servidor recusa", async () => {
    renameSegment.mockRejectedValue(new Error("nao deu"));
    const { result, groups, data, session } = setup();
    const previous = groups.get();
    act(() => result.current.moveSegmentToGroup("s1", "g2"));
    await vi.waitFor(() => expect(session.notify).toHaveBeenCalledWith("nao deu", "danger"));
    expect(groups.get()).toBe(previous);
    expect(data.loadData).toHaveBeenCalledWith(true);
  });
});

describe("useSegmentMutations.moveSegmentOrder", () => {
  it("regrava a ordem dos segmentos do mesmo grupo", () => {
    const { result, tabMeta } = setup();
    act(() => result.current.moveSegmentOrder(redes, "down"));
    expect(tabMeta.get().segments.s2.order).toBe(0);
    expect(tabMeta.get().segments.s1.order).toBe(1);
    expect(tabMeta.get().segments.s1.tabId).toBe("tab-a");
  });

  it("nao grava quando o segmento ja esta na borda", () => {
    const { result, tabMeta } = setup();
    act(() => result.current.moveSegmentOrder(redes, "up"));
    expect(tabMeta.set).not.toHaveBeenCalled();
  });
});
