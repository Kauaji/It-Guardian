import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createManualAsset, deleteDevice, refreshAssetPing, updateDeviceAlias, updateDeviceType } from "../../api.js";
import { createSession, createStore, sessionWrapper } from "../../test/appHarness.jsx";
import { useInventoryAssetActions } from "./useInventoryAssetActions.js";
import { useMachinePeripherals } from "./useMachinePeripherals.js";

vi.mock("../../api.js", () => ({
  createManualAsset: vi.fn(),
  deleteDevice: vi.fn(),
  refreshAssetPing: vi.fn(),
  updateDeviceAlias: vi.fn(),
  updateDeviceType: vi.fn()
}));

const agentMachine = { id: "d1", name: "PC-01", source: "agent" };
const manualMachine = { id: "d2", name: "Switch", source: "manual" };

function setup() {
  const session = createSession();
  const aliases = createStore({ d1: "Antigo" });
  const observations = createStore({});
  const manualPeripherals = createStore({});
  const peripheralHistory = createStore({});
  const deps = {
    data: { loadData: vi.fn().mockResolvedValue() },
    deviceState: {
      patchDeviceInState: vi.fn(),
      removeDeviceFromState: vi.fn(),
      upsertDeviceInState: vi.fn()
    },
    inventory: {
      model: { activeAllDevices: [agentMachine, manualMachine], activeInventoryTab: { id: "tab-a" } },
      persistence: {
        saveMachineAliases: aliases.set,
        saveMachineObservations: observations.set,
        saveManualPeripherals: manualPeripherals.set,
        savePeripheralHistory: peripheralHistory.set
      },
      selection: { deselectAsset: vi.fn() }
    },
    meta: { updateInventoryMeta: vi.fn() }
  };
  const { result } = renderHook(() => useInventoryAssetActions(deps), { wrapper: sessionWrapper(session) });
  return { ...deps, aliases, manualPeripherals, observations, peripheralHistory, result, session };
}

describe("useInventoryAssetActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cria ativo manual na aba ativa e fecha o formulario", async () => {
    createManualAsset.mockResolvedValue({ device: { id: "d9", name: "Roteador" } });
    const { result, deviceState, meta, data, session } = setup();
    act(() => result.current.openManualAssetForm());
    expect(result.current.manualAssetFormOpen).toBe(true);

    await act(async () => {
      await result.current.handleCreateManualAsset({ name: "Roteador" });
    });
    expect(deviceState.upsertDeviceInState).toHaveBeenCalledWith({ id: "d9", name: "Roteador" });
    expect(meta.updateInventoryMeta).toHaveBeenCalledWith("devices", "d9", { tabId: "tab-a", order: 2 });
    expect(session.notify).toHaveBeenCalledWith("Ativo Roteador criado.", "ok");
    expect(data.loadData).toHaveBeenCalledWith(true);
    expect(result.current.manualAssetFormOpen).toBe(false);
    expect(result.current.manualAssetSaving).toBe(false);
  });

  it("avisa quando o cadastro manual falha, mantendo o formulario", async () => {
    createManualAsset.mockRejectedValue(new Error("duplicado"));
    const { result, session } = setup();
    act(() => result.current.openManualAssetForm());
    await act(async () => {
      await result.current.handleCreateManualAsset({});
    });
    expect(session.notify).toHaveBeenCalledWith("duplicado", "danger");
    expect(result.current.manualAssetFormOpen).toBe(true);
    act(() => result.current.closeManualAssetForm());
    expect(result.current.manualAssetFormOpen).toBe(false);
  });

  it("so atualiza o ping de ativos manuais e usa o tom conforme o status", async () => {
    refreshAssetPing.mockResolvedValue({ device: { id: "d2", status: "offline" }, ping: { message: "Sem resposta" } });
    const { result, deviceState, session } = setup();
    expect(await result.current.handleRefreshPing(agentMachine)).toBeUndefined();
    expect(refreshAssetPing).not.toHaveBeenCalled();

    let device;
    await act(async () => {
      device = await result.current.handleRefreshPing(manualMachine);
    });
    expect(device).toEqual({ id: "d2", status: "offline" });
    expect(deviceState.upsertDeviceInState).toHaveBeenCalled();
    expect(session.notify).toHaveBeenCalledWith("Sem resposta", "danger");

    refreshAssetPing.mockRejectedValue(new Error("timeout"));
    await act(async () => {
      await result.current.handleRefreshPing(manualMachine);
    });
    expect(session.notify).toHaveBeenLastCalledWith("timeout", "danger");
  });

  it("altera o tipo do aparelho", async () => {
    updateDeviceType.mockResolvedValue({ device: { id: "d1", assetType: "server" } });
    const { result, session } = setup();
    let device;
    await act(async () => {
      device = await result.current.handleChangeDeviceType("d1", "server");
    });
    expect(device.assetType).toBe("server");
    expect(session.notify).toHaveBeenCalledWith("Tipo do aparelho atualizado.", "ok");

    updateDeviceType.mockRejectedValue(new Error("tipo invalido"));
    await act(async () => {
      expect(await result.current.handleChangeDeviceType("d1", "x")).toBeUndefined();
    });
    expect(session.notify).toHaveBeenLastCalledWith("tipo invalido", "danger");
  });

  it("remove o ativo do inventario somente apos confirmar", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    deleteDevice.mockResolvedValue({});
    const { result, deviceState, inventory, session } = setup();
    expect(await result.current.removeMachineFromInventory(null)).toBe(false);
    expect(await result.current.removeMachineFromInventory(agentMachine)).toBe(false);
    expect(deleteDevice).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    let ok;
    await act(async () => {
      ok = await result.current.removeMachineFromInventory(agentMachine);
    });
    expect(ok).toBe(true);
    expect(deviceState.removeDeviceFromState).toHaveBeenCalledWith("d1");
    expect(inventory.selection.deselectAsset).toHaveBeenCalledWith("d1");
    expect(session.notify).toHaveBeenCalledWith("PC-01 removida do inventario.", "ok");

    deleteDevice.mockRejectedValue(new Error("em uso"));
    await act(async () => {
      expect(await result.current.removeMachineFromInventory(agentMachine)).toBe(false);
    });
  });

  it("grava o apelido local e envia ao servidor so para ativos de agente", async () => {
    updateDeviceAlias.mockResolvedValue({});
    const { result, aliases, session } = setup();
    await act(async () => {
      await result.current.saveMachineAlias("d1", "Caixa 1");
    });
    expect(updateDeviceAlias).toHaveBeenCalledWith("token-1", "d1", "Caixa 1");
    expect(aliases.get()).toEqual({ d1: "Caixa 1" });
    expect(session.notify).toHaveBeenCalledWith("Nome fantasia atualizado.", "ok");

    updateDeviceAlias.mockClear();
    await act(async () => {
      await result.current.saveMachineAlias("d2", "Switch 2");
    });
    expect(updateDeviceAlias).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.saveMachineAlias("d1", "");
    });
    expect(aliases.get()).not.toHaveProperty("d1");
    expect(session.notify).toHaveBeenLastCalledWith("Nome fantasia removido.", "ok");
  });

  it("repassa o erro ao salvar apelido, avisando o usuario", async () => {
    updateDeviceAlias.mockRejectedValue(new Error(""));
    const { result, session } = setup();
    await act(async () => {
      await expect(result.current.saveMachineAlias("d1", "x")).rejects.toThrow();
    });
    expect(session.notify).toHaveBeenCalledWith("Não foi possível atualizar o nome fantasia.", "error");
  });

  it("registra observacoes no inicio da lista do ativo", () => {
    const { result, observations, session } = setup();
    act(() => result.current.addMachineObservation("d1", "primeira"));
    act(() => result.current.addMachineObservation("d1", "segunda"));
    expect(observations.get().d1.map((item) => item.text)).toEqual(["segunda", "primeira"]);
    expect(observations.get().d1[0]).toMatchObject({ user: "Ana Admin" });
    expect(session.notify).toHaveBeenCalledWith("Observacao adicionada.", "ok");
  });
});

describe("useMachinePeripherals", () => {
  beforeEach(() => vi.clearAllMocks());

  function setupPeripherals() {
    const session = createSession();
    const manual = createStore({});
    const history = createStore({});
    const deviceState = { patchDeviceInState: vi.fn() };
    const inventory = {
      persistence: { saveManualPeripherals: manual.set, savePeripheralHistory: history.set }
    };
    const { result } = renderHook(() => useMachinePeripherals({ deviceState, inventory }), {
      wrapper: sessionWrapper(session)
    });
    return { deviceState, history, manual, result, session };
  }

  it("adiciona periferico com id, historico e atualiza o ativo", () => {
    const { result, manual, history, deviceState, session } = setupPeripherals();
    let output;
    act(() => {
      output = result.current.addMachinePeripheral("d1", { type: "Monitor", brand: "Dell" });
    });
    expect(output.peripheral.id).toMatch(/^d1-peripheral-/);
    expect(output.event).toMatchObject({
      change: "Periferico adicionado: Monitor",
      message: "Monitor - Dell - Sem patrimonio",
      newValue: "Monitor Dell"
    });
    expect(manual.get().d1).toHaveLength(1);
    expect(history.get().d1[0]).toBe(output.event);
    expect(session.notify).toHaveBeenCalledWith("Periferico adicionado e registrado no historico.", "ok");

    const patch = deviceState.patchDeviceInState.mock.calls[0][1];
    expect(patch({ id: "d1", hardware: { peripherals: [] } }).hardware.peripherals).toHaveLength(1);
  });

  it("remove periferico apenas apos confirmar e registra a remocao", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result, manual, history, deviceState, session } = setupPeripherals();
    const peripheral = { id: "p1", type: "Teclado", brand: "Logitech", assetTag: "T1" };
    expect(result.current.removeMachinePeripheral("d1", peripheral)).toBeNull();
    expect(history.set).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    manual.set(() => ({ d1: [peripheral] }));
    let event;
    act(() => {
      event = result.current.removeMachinePeripheral("d1", peripheral);
    });
    expect(event).toMatchObject({ change: "Periferico removido: Teclado", newValue: "Removido" });
    expect(manual.get().d1).toEqual([]);
    expect(history.get().d1[0]).toBe(event);
    expect(session.notify).toHaveBeenCalledWith("Periferico removido e registrado no historico.", "ok");

    const patch = deviceState.patchDeviceInState.mock.calls[0][1];
    const updated = patch({ id: "d1", hardware: { peripherals: [peripheral] }, assetHistory: [] });
    expect(updated.hardware.peripherals).toEqual([]);
    expect(updated.assetHistory[0]).toBe(event);
  });
});
