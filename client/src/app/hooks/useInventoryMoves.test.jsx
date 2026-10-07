import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateDeviceSegment } from "../../api.js";
import { createSession, sessionWrapper } from "../../test/appHarness.jsx";
import { useInventoryMoves } from "./useInventoryMoves.js";

vi.mock("../../api.js", () => ({ updateDeviceSegment: vi.fn() }));

const redes = { id: "s1", name: "Redes" };
const caixas = { id: "s2", name: "Caixas" };
const machine = { id: "d1", name: "PC-01", segmentId: "s1", segmentName: "Redes", tabId: "tab-a" };

function setup({ selected = [], devices = [machine, { ...machine, id: "d2", name: "PC-02" }], bulkMoveTarget = "" } = {}) {
  const session = createSession();
  const deps = {
    data: { loadData: vi.fn().mockResolvedValue(), segments: [redes, caixas] },
    deviceState: { updateDeviceSegmentInState: vi.fn() },
    meta: { updateDeviceTabOwnership: vi.fn() },
    inventory: {
      model: { activeAllDevices: devices, activeSegments: [redes, caixas], decoratedSegments: [redes, caixas] },
      selection: {
        bulkMoveTarget,
        clearAssetSelection: vi.fn(),
        selectedAssetIds: new Set(selected)
      }
    }
  };
  const { result } = renderHook(() => useInventoryMoves(deps), { wrapper: sessionWrapper(session) });
  return { ...deps, result, session };
}

describe("useInventoryMoves.handleMoveMachine", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fecha o modal e nao faz nada quando o destino e o mesmo segmento", async () => {
    const { result } = setup();
    act(() => result.current.openMoveModal(machine));
    expect(result.current.moveModal).toBe(machine);
    expect(result.current.moveTarget).toBe("s1");

    let moved;
    await act(async () => {
      moved = await result.current.handleMoveMachine(machine, "s1");
    });
    expect(moved).toBe(false);
    expect(result.current.moveModal).toBeNull();
    expect(updateDeviceSegment).not.toHaveBeenCalled();
  });

  it("impede mover para a area Backup e mover reservas disponiveis", async () => {
    const { result, session } = setup();
    expect(await result.current.handleMoveMachine(machine, "system-backup")).toBe(false);
    expect(session.notify).toHaveBeenLastCalledWith(expect.stringContaining("ação Backup"), "danger");

    const reserve = { ...machine, isBackup: true, backupStatus: "available" };
    expect(await result.current.handleMoveMachine(reserve, "s2")).toBe(false);
    expect(session.notify).toHaveBeenLastCalledWith(expect.stringContaining("alocadas temporariamente"), "danger");
  });

  it("recusa segmento de destino inexistente", async () => {
    const { result, session } = setup();
    expect(await result.current.handleMoveMachine(machine, "nao-existe")).toBe(false);
    expect(session.notify).toHaveBeenLastCalledWith("Segmento de destino inválido.", "danger");
  });

  it("move de forma otimista, confirma no servidor e recarrega os dados", async () => {
    updateDeviceSegment.mockResolvedValue({ device: { segmentId: "s2", segmentName: "Caixas" } });
    const { result, deviceState, meta, data, inventory, session } = setup();

    let moved;
    await act(async () => {
      moved = await result.current.handleMoveMachine(machine, "s2", { reason: "maintenance", targetTabId: "tab-z" });
    });

    expect(moved).toBe(true);
    expect(meta.updateDeviceTabOwnership).toHaveBeenCalledWith("d1", caixas, "tab-z");
    expect(deviceState.updateDeviceSegmentInState).toHaveBeenNthCalledWith(1, "d1", "s2", "Caixas", { maintenance: true });
    expect(updateDeviceSegment).toHaveBeenCalledWith("token-1", "d1", "s2", { reason: "maintenance" });
    expect(deviceState.updateDeviceSegmentInState).toHaveBeenNthCalledWith(2, "d1", "s2", "Caixas", { maintenance: true });
    expect(session.notify).toHaveBeenCalledWith("PC-01 movida para Caixas.", "ok");
    expect(data.loadData).toHaveBeenCalledWith(true);
    expect(inventory.selection.clearAssetSelection).toHaveBeenCalled();
  });

  it("reverte a mudanca e avisa quando o servidor recusa", async () => {
    updateDeviceSegment.mockRejectedValue(new Error("Falha de rede"));
    const { result, deviceState, meta, session } = setup();

    let moved;
    await act(async () => {
      moved = await result.current.handleMoveMachine(machine, "s2");
    });

    expect(moved).toBe(false);
    expect(deviceState.updateDeviceSegmentInState).toHaveBeenLastCalledWith("d1", "s1", "Redes");
    expect(meta.updateDeviceTabOwnership).toHaveBeenLastCalledWith("d1", redes, "tab-a");
    expect(session.notify).toHaveBeenLastCalledWith("Falha de rede", "danger");
  });

  it("move todo o grupo quando o ativo faz parte de uma selecao multipla", async () => {
    updateDeviceSegment.mockResolvedValue({});
    const { result, session } = setup({ selected: ["d1", "d2"] });

    await act(async () => {
      await result.current.handleMoveMachine(machine, "s2");
    });

    expect(updateDeviceSegment).toHaveBeenCalledTimes(2);
    expect(session.notify).toHaveBeenCalledWith("2 equipamentos movidos para Caixas.", "ok");
  });

  it("forceSingle ignora a selecao multipla", async () => {
    updateDeviceSegment.mockResolvedValue({ device: { segmentId: "s2", segmentName: "Caixas" } });
    const { result } = setup({ selected: ["d1", "d2"] });
    await act(async () => {
      await result.current.handleMoveMachine(machine, "s2", { forceSingle: true });
    });
    expect(updateDeviceSegment).toHaveBeenCalledTimes(1);
  });
});

describe("useInventoryMoves.handleMoveMachines", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ignora lista vazia e destino ausente", async () => {
    const { result } = setup();
    expect(await result.current.handleMoveMachines([], "s2")).toBe(false);
    expect(await result.current.handleMoveMachines(["d1"], "")).toBe(false);
  });

  it("limpa a selecao quando nenhum ativo precisa mover", async () => {
    const { result, inventory } = setup();
    expect(await result.current.handleMoveMachines(["d1"], "s1")).toBe(false);
    expect(inventory.selection.clearAssetSelection).toHaveBeenCalled();
  });

  it("recusa reservas disponiveis, area Backup e destino invalido", async () => {
    const reserve = { ...machine, id: "r1", isBackup: true, backupStatus: "available" };
    const { result, session } = setup({ devices: [reserve] });
    expect(await result.current.handleMoveMachines(["r1"], "s2")).toBe(false);
    expect(session.notify).toHaveBeenLastCalledWith(expect.stringContaining("alocadas temporariamente"), "danger");
    expect(await result.current.handleMoveMachines(["r1"], "system-backup")).toBe(false);
    expect(await result.current.handleMoveMachines(["r1"], "x")).toBe(false);
    expect(session.notify).toHaveBeenLastCalledWith("Segmento de destino inválido.", "danger");
  });

  it("reverte todos os ativos quando alguma gravacao falha", async () => {
    updateDeviceSegment.mockRejectedValue(new Error("boom"));
    const { result, deviceState, session } = setup();
    let moved;
    await act(async () => {
      moved = await result.current.handleMoveMachines(["d1", "d2"], "s2");
    });
    expect(moved).toBe(false);
    expect(deviceState.updateDeviceSegmentInState).toHaveBeenCalledWith("d1", "s1", "Redes");
    expect(deviceState.updateDeviceSegmentInState).toHaveBeenCalledWith("d2", "s1", "Redes");
    expect(session.notify).toHaveBeenLastCalledWith("boom", "danger");
  });
});

describe("useInventoryMoves.handleBulkMove", () => {
  beforeEach(() => vi.clearAllMocks());

  it("so move quando ha destino e selecao", async () => {
    updateDeviceSegment.mockResolvedValue({});
    const none = setup({ selected: ["d1"], bulkMoveTarget: "" });
    none.result.current.handleBulkMove();
    expect(updateDeviceSegment).not.toHaveBeenCalled();

    const ready = setup({ selected: ["d1", "d2"], bulkMoveTarget: "s2" });
    await act(async () => {
      ready.result.current.handleBulkMove();
    });
    expect(updateDeviceSegment).toHaveBeenCalledTimes(2);
  });

  it("fecha o modal de mover", () => {
    const { result } = setup();
    act(() => result.current.openMoveModal(machine, "s2"));
    act(() => result.current.closeMoveModal());
    expect(result.current.moveModal).toBeNull();
  });
});
