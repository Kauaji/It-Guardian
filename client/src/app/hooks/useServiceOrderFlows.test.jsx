import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteServiceOrder, updateDeviceBackup, updateServiceOrderStatus } from "../../api.js";
import { createSession, createStore, sessionWrapper } from "../../test/appHarness.jsx";
import { useServiceOrderBackupFlow } from "./useServiceOrderBackupFlow.js";
import { useServiceOrderLifecycle } from "./useServiceOrderLifecycle.js";

vi.mock("../../api.js", () => ({
  deleteServiceOrder: vi.fn(),
  updateDeviceBackup: vi.fn(),
  updateServiceOrderStatus: vi.fn()
}));

const defaultSegment = { id: "def", name: "Não organizadas", isDefault: true };
const redes = { id: "s1", name: "Redes" };
const main = { id: "main", name: "PC principal", segmentId: "s1", segmentName: "Redes", tabId: "tab-a" };
const backup = { id: "bk", name: "Reserva", isBackup: true, backupStatus: "available", segmentId: "system-backup", segmentName: "Backup", backupRealSegmentId: "def", tabId: "global-backup" };
const order = { id: "os-1", number: 4, assetId: "main", environmentId: "tab-a" };

function build({ devices = [main, backup] } = {}) {
  const session = createSession();
  const ordersStore = createStore([order]);
  const segments = [defaultSegment, redes];
  const shared = {
    data: { loadData: vi.fn().mockResolvedValue(), segments, setServiceOrders: ordersStore.set },
    deviceState: { appendDeviceHistoryEvent: vi.fn(), upsertDeviceInState: vi.fn() },
    inventory: {
      model: {
        activeInventoryTab: { id: "tab-a" },
        activeSegments: segments,
        decoratedSegmentGroups: [],
        decoratedSegments: segments,
        findDecoratedDevice: (id) => devices.find((device) => device.id === id)
      },
      persistence: { maintenanceRecords: {} }
    },
    maintenanceEntry: { ensureMachineInMaintenanceForServiceOrder: vi.fn().mockResolvedValue(true) },
    moves: { handleMoveMachine: vi.fn().mockResolvedValue(true) },
    serviceOrderCore: {
      addServiceOrderSystemHistory: vi.fn().mockResolvedValue({}),
      handleUpdateServiceOrder: vi.fn().mockResolvedValue({ id: "os-1", number: 4 }),
      setServiceOrderSaving: vi.fn()
    }
  };
  return { ordersStore, session, shared };
}

function renderBackupFlow(context) {
  return renderHook(() => useServiceOrderBackupFlow(context.shared), { wrapper: sessionWrapper(context.session) });
}

describe("useServiceOrderBackupFlow.handleSelectBackupForServiceOrder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("valida a OS e a maquina Backup antes de qualquer alteracao", async () => {
    const context = build();
    const { result } = renderBackupFlow(context);
    const select = result.current.handleSelectBackupForServiceOrder;

    expect(await select(null, backup)).toBe(false);
    expect(await select({ id: "os" }, backup)).toBe(false);
    expect(context.session.notify).toHaveBeenLastCalledWith(expect.stringContaining("Vincule a máquina principal"), "danger");
    expect(await select(order, main)).toBe(false);
    expect(context.session.notify).toHaveBeenLastCalledWith("Selecione uma máquina marcada como Backup.", "danger");
    expect(await select(order, { ...backup, backupStatus: "in_use" })).toBe(false);
    expect(context.session.notify).toHaveBeenLastCalledWith(expect.stringContaining("já está em uso"), "danger");
    expect(await select({ ...order, assetId: "fantasma" }, backup)).toBe(false);
    expect(context.session.notify).toHaveBeenLastCalledWith(expect.stringContaining("máquina principal da OS"), "danger");
    expect(context.shared.moves.handleMoveMachine).not.toHaveBeenCalled();
  });

  it("para quando nao consegue colocar a maquina principal em manutencao ou mover o Backup", async () => {
    const context = build();
    context.shared.maintenanceEntry.ensureMachineInMaintenanceForServiceOrder.mockResolvedValue(false);
    const { result } = renderBackupFlow(context);
    expect(await result.current.handleSelectBackupForServiceOrder(order, backup)).toBe(false);
    expect(context.shared.moves.handleMoveMachine).not.toHaveBeenCalled();

    const other = build();
    other.shared.moves.handleMoveMachine.mockResolvedValue(false);
    const second = renderBackupFlow(other);
    expect(await second.result.current.handleSelectBackupForServiceOrder(order, backup)).toBe(false);
    expect(updateDeviceBackup).not.toHaveBeenCalled();
  });

  it("aloca o Backup no segmento da maquina principal e registra os historicos", async () => {
    updateDeviceBackup.mockResolvedValue({ device: { ...backup, backupStatus: "in_use" } });
    const context = build();
    const { result } = renderBackupFlow(context);

    let ok;
    await act(async () => {
      ok = await result.current.handleSelectBackupForServiceOrder(order, backup);
    });

    expect(ok).toBe(true);
    expect(context.shared.moves.handleMoveMachine).toHaveBeenCalledWith(backup, "s1", {
      reason: "backup_in_use",
      targetTabId: "tab-a",
      forceSingle: true,
      allowBackupMove: true
    });
    expect(updateDeviceBackup).toHaveBeenCalledWith("token-1", "bk", {
      isBackup: true,
      status: "in_use",
      serviceOrderId: "os-1",
      originalSegmentId: "def",
      originalSegmentName: "Não organizadas"
    });
    expect(context.shared.serviceOrderCore.handleUpdateServiceOrder).toHaveBeenCalledWith("os-1", { backupAssetId: "bk" });
    expect(context.shared.deviceState.appendDeviceHistoryEvent).toHaveBeenCalledTimes(2);
    expect(context.shared.data.loadData).toHaveBeenCalledWith(true);
    expect(context.session.notify).toHaveBeenLastCalledWith("Reserva alocada como Backup da OS 4.", "ok");
  });

  it("avisa quando nao encontra o segmento de origem nem o de destino", async () => {
    const orphan = { id: "main", name: "PC principal", segmentId: "", segmentName: "", tabId: "tab-a" };
    const noOrigin = build({ devices: [orphan, backup] });
    noOrigin.shared.data.segments = [];
    noOrigin.shared.inventory.model.activeSegments = [];
    noOrigin.shared.inventory.model.decoratedSegments = [];
    const first = renderBackupFlow(noOrigin);
    expect(await first.result.current.handleSelectBackupForServiceOrder(order, backup)).toBe(false);
    expect(noOrigin.session.notify).toHaveBeenLastCalledWith(
      "Não foi possível localizar o segmento original da máquina principal.", "danger"
    );

    const noTarget = build();
    noTarget.shared.data.segments = [];
    noTarget.shared.inventory.model.activeSegments = [];
    noTarget.shared.inventory.model.decoratedSegments = [];
    const second = renderBackupFlow(noTarget);
    expect(await second.result.current.handleSelectBackupForServiceOrder(order, backup)).toBe(false);
    expect(noTarget.session.notify).toHaveBeenLastCalledWith(
      "Não foi possível localizar o segmento de destino do Backup.", "danger"
    );
    expect(noTarget.shared.moves.handleMoveMachine).not.toHaveBeenCalled();
  });

  it("avisa quando a API de Backup falha", async () => {
    updateDeviceBackup.mockRejectedValue(new Error("falha backup"));
    const context = build();
    const { result } = renderBackupFlow(context);
    expect(await result.current.handleSelectBackupForServiceOrder(order, backup)).toBe(false);
    expect(context.session.notify).toHaveBeenLastCalledWith("falha backup", "danger");
  });
});

describe("useServiceOrderBackupFlow.releaseBackupForServiceOrder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("nao faz nada quando a OS nao tem Backup", async () => {
    const { result } = renderBackupFlow(build());
    expect(await result.current.releaseBackupForServiceOrder({ id: "os-1" })).toBe(false);
  });

  it("apenas limpa o vinculo quando a maquina Backup nao existe mais", async () => {
    const context = build({ devices: [main] });
    const { result } = renderBackupFlow(context);
    expect(await result.current.releaseBackupForServiceOrder({ id: "os-1", backupAssetId: "sumiu" })).toBe(true);
    expect(context.shared.serviceOrderCore.handleUpdateServiceOrder).toHaveBeenCalledWith("os-1", { backupAssetId: null });
  });

  it("devolve o Backup a area de reserva e registra o historico", async () => {
    updateDeviceBackup.mockResolvedValue({ device: backup });
    const inUse = { ...backup, backupStatus: "in_use", segmentId: "s1", segmentName: "Redes" };
    const context = build({ devices: [main, inUse] });
    const { result } = renderBackupFlow(context);

    let ok;
    await act(async () => {
      ok = await result.current.releaseBackupForServiceOrder({ ...order, backupAssetId: "bk" }, { finalized: true });
    });

    expect(ok).toBe(true);
    expect(context.shared.moves.handleMoveMachine).toHaveBeenCalledWith(inUse, "def", expect.objectContaining({ reason: "backup_return" }));
    expect(updateDeviceBackup).toHaveBeenCalledWith("token-1", "bk", expect.objectContaining({ status: "available", serviceOrderId: null }));
    expect(context.shared.serviceOrderCore.addServiceOrderSystemHistory).toHaveBeenCalledWith("os-1", expect.objectContaining({
      message: "OS finalizada e máquina Backup devolvida para a área Backup."
    }));
    expect(context.session.notify).toHaveBeenLastCalledWith("Reserva devolvida para Backup.", "ok");
  });

  it("falha sem destino e quando a movimentacao ou a API falham", async () => {
    const noSegments = build({ devices: [main, { ...backup, backupRealSegmentId: undefined, backupOriginalSegmentId: undefined }] });
    noSegments.shared.data.segments = [];
    noSegments.shared.inventory.model.activeSegments = [];
    noSegments.shared.inventory.model.decoratedSegments = [];
    const first = renderBackupFlow(noSegments);
    expect(await first.result.current.releaseBackupForServiceOrder({ ...order, backupAssetId: "bk" })).toBe(false);
    expect(noSegments.session.notify).toHaveBeenLastCalledWith("Não foi possível localizar o retorno do Backup.", "danger");

    const blocked = build();
    blocked.shared.moves.handleMoveMachine.mockResolvedValue(false);
    const second = renderBackupFlow(blocked);
    expect(await second.result.current.releaseBackupForServiceOrder({ ...order, backupAssetId: "bk" })).toBe(false);

    updateDeviceBackup.mockRejectedValue(new Error("erro api"));
    const broken = build();
    const third = renderBackupFlow(broken);
    expect(await third.result.current.releaseBackupForServiceOrder({ ...order, backupAssetId: "bk" })).toBe(false);
    expect(broken.session.notify).toHaveBeenLastCalledWith("erro api", "danger");
  });
});

function renderLifecycle(context, overrides = {}) {
  const backupFlow = { releaseBackupForServiceOrder: vi.fn().mockResolvedValue(true) };
  const maintenanceExit = { removeMachineFromMaintenance: vi.fn().mockResolvedValue(true) };
  const hook = renderHook(
    () =>
      useServiceOrderLifecycle({
        backupFlow,
        data: context.shared.data,
        inventory: context.shared.inventory,
        maintenanceExit,
        serviceOrderCore: context.shared.serviceOrderCore,
        ...overrides
      }),
    { wrapper: sessionWrapper(context.session) }
  );
  return { ...hook, backupFlow, maintenanceExit };
}

describe("useServiceOrderLifecycle.handleDeleteServiceOrder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("bloqueia a exclusao com Backup em uso ou maquina em manutencao", async () => {
    const context = build({ devices: [{ ...main, maintenance: true }] });
    const { result } = renderLifecycle(context);
    expect(await result.current.handleDeleteServiceOrder(null)).toBe(false);
    expect(await result.current.handleDeleteServiceOrder({ ...order, backupAssetId: "bk" })).toBe(false);
    expect(context.session.notify).toHaveBeenLastCalledWith(expect.stringContaining("Backup em uso"), "danger");
    expect(await result.current.handleDeleteServiceOrder(order)).toBe(false);
    expect(context.session.notify).toHaveBeenLastCalledWith(expect.stringContaining("em manutenção"), "danger");
    expect(deleteServiceOrder).not.toHaveBeenCalled();
  });

  it("exclui a OS e a remove da lista", async () => {
    deleteServiceOrder.mockResolvedValue({});
    const context = build();
    const { result } = renderLifecycle(context);
    let ok;
    await act(async () => {
      ok = await result.current.handleDeleteServiceOrder(order);
    });
    expect(ok).toBe(true);
    expect(context.ordersStore.get()).toEqual([]);
    expect(context.session.notify).toHaveBeenLastCalledWith("Ordem 4 excluída.", "ok");
    expect(context.shared.serviceOrderCore.setServiceOrderSaving).toHaveBeenLastCalledWith(false);
  });

  it("avisa quando a exclusao falha", async () => {
    deleteServiceOrder.mockRejectedValue(new Error("nao pode"));
    const context = build();
    const { result } = renderLifecycle(context);
    let ok;
    await act(async () => {
      ok = await result.current.handleDeleteServiceOrder(order);
    });
    expect(ok).toBe(false);
    expect(context.session.notify).toHaveBeenLastCalledWith("nao pode", "danger");
  });
});

describe("useServiceOrderLifecycle.handleChangeServiceOrderStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("nao chama a API quando o status nao muda", async () => {
    const { result } = renderLifecycle(build());
    const same = { ...order, status: "open" };
    expect(await result.current.handleChangeServiceOrderStatus(same, "open")).toBe(same);
    expect(await result.current.handleChangeServiceOrderStatus(null, "open")).toBeNull();
    expect(updateServiceOrderStatus).not.toHaveBeenCalled();
  });

  it("atualiza o status sem efeitos colaterais quando a OS nao foi fechada", async () => {
    updateServiceOrderStatus.mockResolvedValue({ serviceOrder: { ...order, status: "in_progress" } });
    const context = build();
    const { result, backupFlow, maintenanceExit } = renderLifecycle(context);
    await act(async () => {
      await result.current.handleChangeServiceOrderStatus({ ...order, status: "open" }, "in_progress");
    });
    expect(context.ordersStore.get()[0].status).toBe("in_progress");
    expect(backupFlow.releaseBackupForServiceOrder).not.toHaveBeenCalled();
    expect(maintenanceExit.removeMachineFromMaintenance).not.toHaveBeenCalled();
  });

  it("ao fechar devolve o Backup, tira a maquina da manutencao e registra no historico", async () => {
    const closed = { ...order, status: "closed", closedAt: "2026-01-01", backupAssetId: "bk" };
    updateServiceOrderStatus.mockResolvedValue({ serviceOrder: closed });
    const context = build({ devices: [{ ...main, maintenance: true, segmentName: "Manutenção" }, backup] });
    const { result, backupFlow, maintenanceExit } = renderLifecycle(context);

    let updated;
    await act(async () => {
      updated = await result.current.handleChangeServiceOrderStatus({ ...order, status: "open" }, "closed");
    });

    expect(updated).toBe(closed);
    expect(backupFlow.releaseBackupForServiceOrder).toHaveBeenCalledWith(closed, { finalized: true });
    expect(maintenanceExit.removeMachineFromMaintenance).toHaveBeenCalledWith(
      expect.objectContaining({ id: "main" }),
      { serviceOrder: closed }
    );
    expect(context.shared.serviceOrderCore.addServiceOrderSystemHistory).toHaveBeenCalledWith("os-1", expect.objectContaining({
      message: "OS finalizada e máquina retirada da manutenção.",
      oldValue: "Manutenção"
    }));
  });

  it("nao registra historico quando a maquina nao saiu da manutencao e trata erro da API", async () => {
    updateServiceOrderStatus.mockResolvedValueOnce({ serviceOrder: { ...order, closedAt: "x" } });
    const context = build({ devices: [{ ...main, maintenance: true }] });
    const { result, maintenanceExit } = renderLifecycle(context);
    maintenanceExit.removeMachineFromMaintenance.mockResolvedValue(false);
    await act(async () => {
      await result.current.handleChangeServiceOrderStatus({ ...order, status: "open" }, "closed");
    });
    expect(context.shared.serviceOrderCore.addServiceOrderSystemHistory).not.toHaveBeenCalled();

    updateServiceOrderStatus.mockRejectedValueOnce(new Error("sem acesso"));
    let updated;
    await act(async () => {
      updated = await result.current.handleChangeServiceOrderStatus({ ...order, status: "open" }, "closed");
    });
    expect(updated).toBeNull();
    expect(context.session.notify).toHaveBeenLastCalledWith("sem acesso", "danger");
  });
});
