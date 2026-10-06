import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSegment, createServiceOrder } from "../../api.js";
import { createSession, createStore, sessionWrapper } from "../../test/appHarness.jsx";
import { maintenanceExitMessage, useMaintenanceExit } from "./useMaintenanceExit.js";
import { useMaintenanceEntry } from "./useMaintenanceEntry.js";

vi.mock("../../api.js", () => ({ createSegment: vi.fn(), createServiceOrder: vi.fn() }));

const defaultSegment = { id: "def", name: "Não organizadas", isDefault: true };
const redes = { id: "s1", name: "Redes", groupId: "g1" };
const manutencao = { id: "m1", name: "Manutenção" };
const activeTab = { id: "tab-a", name: "Matriz" };
const machine = { id: "d1", name: "PC-01", segmentId: "s1", segmentName: "Redes", tabId: "tab-a" };

function build({ segments = [defaultSegment, redes], records = {}, serviceOrders = [] } = {}) {
  const session = createSession();
  const recordsStore = createStore(records);
  const segmentsStore = createStore(segments);
  const ordersStore = createStore(serviceOrders);
  const deps = {
    data: { segments, serviceOrders, setSegments: segmentsStore.set, setServiceOrders: ordersStore.set },
    deviceState: { appendDeviceHistoryEvent: vi.fn(), updateDeviceSegmentInState: vi.fn() },
    inventory: {
      model: {
        activeInventoryTab: activeTab,
        activeSegmentGroups: [{ id: "g1" }],
        activeSegments: segments,
        decoratedSegmentGroups: [{ id: "g1" }],
        decoratedSegments: segments
      },
      persistence: { maintenanceRecords: records, saveMaintenanceRecords: recordsStore.set }
    },
    meta: { updateInventoryMeta: vi.fn() },
    moves: { handleMoveMachine: vi.fn().mockResolvedValue(true) },
    serviceOrderCore: { addServiceOrderSystemHistory: vi.fn().mockResolvedValue({}) }
  };
  return { deps, ordersStore, recordsStore, segmentsStore, session };
}

function renderExit(context) {
  return renderHook(() => useMaintenanceExit(context.deps), { wrapper: sessionWrapper(context.session) });
}

function renderEntry(context, exit = { removeMachineFromMaintenance: vi.fn() }) {
  const hook = renderHook(() => useMaintenanceEntry({ ...context.deps, exit }), {
    wrapper: sessionWrapper(context.session)
  });
  return { ...hook, exit };
}

describe("maintenanceExitMessage", () => {
  it("descreve a saida conforme exista OS e segmento de origem", () => {
    expect(maintenanceExitMessage({ hasServiceOrder: false, hasOriginSegment: true })).toBe("Máquina retirada da manutenção");
    expect(maintenanceExitMessage({ hasServiceOrder: false, hasOriginSegment: false })).toMatch(/segmento original não existe/);
    expect(maintenanceExitMessage({ hasServiceOrder: true, hasOriginSegment: true, serviceOrderLabel: "#7" })).toMatch(/OS #7\.$/);
    expect(maintenanceExitMessage({ hasServiceOrder: true, hasOriginSegment: false, serviceOrderLabel: "#7" })).toMatch(/OS #7, mas/);
  });
});

describe("useMaintenanceExit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve a maquina ao segmento de origem registrado e limpa o registro", async () => {
    const context = build({
      segments: [defaultSegment, redes, manutencao],
      records: { d1: { active: true, origin: { tabId: "tab-a", segmentId: "s1", segmentName: "Redes" } } }
    });
    const { result } = renderExit(context);
    const inMaintenance = { ...machine, segmentId: "m1", segmentName: "Manutenção" };

    let ok;
    await act(async () => {
      ok = await result.current.removeMachineFromMaintenance(inMaintenance);
    });

    expect(ok).toBe(true);
    expect(context.deps.moves.handleMoveMachine).toHaveBeenCalledWith(
      { ...inMaintenance, maintenance: true },
      "s1",
      { reason: "maintenance_exit", targetTabId: "tab-a" }
    );
    expect(context.deps.deviceState.updateDeviceSegmentInState).toHaveBeenCalledWith("d1", "s1", "Redes", {
      maintenance: false,
      maintenanceOrigin: null
    });
    expect(context.recordsStore.get()).toEqual({});
    expect(context.deps.deviceState.appendDeviceHistoryEvent.mock.calls[0][1]).toMatchObject({
      eventType: "maintenance",
      message: "Máquina retirada da manutenção",
      oldValue: "Manutenção",
      newValue: "Redes",
      userName: "Ana Admin"
    });
    expect(context.session.notify).toHaveBeenCalledWith("PC-01 retirada da manutenção.", "ok");
  });

  it("usa o segmento padrao quando a origem nao existe mais e cita a OS finalizada", async () => {
    const context = build({ records: { d1: { origin: { segmentId: "sumiu", segmentName: "Antigo" } } } });
    const { result } = renderExit(context);
    await act(async () => {
      await result.current.removeMachineFromMaintenance({ ...machine, segmentName: "Manutenção" }, { serviceOrder: { number: 12 } });
    });
    expect(context.deps.moves.handleMoveMachine.mock.calls[0][1]).toBe("def");
    expect(context.deps.deviceState.appendDeviceHistoryEvent.mock.calls[0][1].message).toMatch(
      /finalização da OS #12, mas o segmento original não existe mais/
    );
  });

  it("avisa quando nao ha segmento de retorno e nao altera nada", async () => {
    const context = build({ segments: [redes] });
    const { result } = renderExit(context);
    expect(await result.current.removeMachineFromMaintenance(machine)).toBe(false);
    expect(context.session.notify).toHaveBeenCalledWith("Não foi possível localizar o segmento de retorno.", "danger");
    expect(context.deps.moves.handleMoveMachine).not.toHaveBeenCalled();
  });

  it("para sem alterar o registro quando a movimentacao falha ou nao ha maquina", async () => {
    const context = build();
    context.deps.moves.handleMoveMachine.mockResolvedValue(false);
    const { result } = renderExit(context);
    expect(await result.current.removeMachineFromMaintenance(machine)).toBe(false);
    expect(context.deps.deviceState.appendDeviceHistoryEvent).not.toHaveBeenCalled();
    expect(await result.current.removeMachineFromMaintenance(null)).toBe(false);
  });
});

describe("useMaintenanceEntry.putMachineInMaintenance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delega a saida quando a maquina ja esta em manutencao", async () => {
    const context = build({ segments: [defaultSegment, redes, manutencao] });
    const { result, exit } = renderEntry(context);
    exit.removeMachineFromMaintenance.mockResolvedValue(true);
    const inMaintenance = { ...machine, segmentName: "Manutenção" };
    expect(await result.current.putMachineInMaintenance(inMaintenance)).toBe(true);
    expect(exit.removeMachineFromMaintenance).toHaveBeenCalledWith(inMaintenance);
    expect(await result.current.putMachineInMaintenance(null)).toBe(false);
  });

  it("cria o segmento Manutencao, registra a origem e abre a OS de manutencao", async () => {
    createSegment.mockResolvedValue({ segment: { id: "m1", name: "Manutenção" } });
    createServiceOrder.mockResolvedValue({ serviceOrder: { id: "os-1", number: 5 } });
    const context = build();
    const { result } = renderEntry(context);

    let ok;
    await act(async () => {
      ok = await result.current.putMachineInMaintenance(machine);
    });

    expect(ok).toBe(true);
    expect(createSegment).toHaveBeenCalledWith("token-1", expect.objectContaining({ systemSegment: "maintenance", groupId: null }));
    expect(context.deps.meta.updateInventoryMeta).toHaveBeenCalledWith("segments", "m1", { tabId: "shared", order: -1 });
    expect(context.segmentsStore.get().map((segment) => segment.id)).toContain("m1");
    expect(context.deps.moves.handleMoveMachine).toHaveBeenCalledWith(machine, "m1", { reason: "maintenance" });
    expect(context.recordsStore.get().d1.origin).toEqual({
      tabId: "tab-a",
      groupId: "g1",
      segmentId: "s1",
      segmentName: "Redes"
    });
    expect(context.deps.deviceState.updateDeviceSegmentInState).toHaveBeenCalledWith("d1", "m1", "Manutenção", expect.objectContaining({ maintenance: true }));
    expect(createServiceOrder).toHaveBeenCalledWith("token-1", expect.objectContaining({
      title: "Manutenção - PC-01",
      category: "Manutenção",
      assetId: "d1",
      environmentId: "tab-a",
      notes: "Origem: Redes"
    }));
    expect(context.ordersStore.get()[0].id).toBe("os-1");
    expect(context.session.notify).toHaveBeenCalledWith("PC-01 colocada em manutenção.", "ok");
  });

  it("reaproveita o segmento existente e nao duplica a OS aberta", async () => {
    const context = build({
      segments: [defaultSegment, redes, manutencao],
      serviceOrders: [{ id: "os-9", assetId: "d1", category: "Manutencao", status: "open" }]
    });
    const { result } = renderEntry(context);
    await act(async () => {
      await result.current.putMachineInMaintenance(machine);
    });
    expect(createSegment).not.toHaveBeenCalled();
    expect(createServiceOrder).not.toHaveBeenCalled();
    expect(context.deps.moves.handleMoveMachine).toHaveBeenCalledWith(machine, "m1", { reason: "maintenance" });
  });

  it("nao registra nada quando a movimentacao falha e avisa erros da API", async () => {
    const failed = build({ segments: [defaultSegment, redes, manutencao] });
    failed.deps.moves.handleMoveMachine.mockResolvedValue(false);
    const first = renderEntry(failed);
    expect(await first.result.current.putMachineInMaintenance(machine)).toBe(false);
    expect(failed.deps.deviceState.appendDeviceHistoryEvent).not.toHaveBeenCalled();

    createSegment.mockRejectedValue(new Error("sem permissao"));
    const broken = build();
    const second = renderEntry(broken);
    expect(await second.result.current.putMachineInMaintenance(machine)).toBe(false);
    expect(broken.session.notify).toHaveBeenCalledWith("sem permissao", "danger");
  });
});

describe("useMaintenanceEntry.ensureMachineInMaintenanceForServiceOrder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ignora chamadas sem maquina ou sem OS", async () => {
    const { result } = renderEntry(build());
    expect(await result.current.ensureMachineInMaintenanceForServiceOrder(null, { id: "os" })).toBe(false);
    expect(await result.current.ensureMachineInMaintenanceForServiceOrder(machine, {})).toBe(false);
  });

  it("so registra no historico da OS quando a maquina ja estava em manutencao", async () => {
    const context = build({ segments: [defaultSegment, redes, manutencao] });
    const { result } = renderEntry(context);
    const ok = await result.current.ensureMachineInMaintenanceForServiceOrder({ ...machine, maintenance: true }, { id: "os-1" });
    expect(ok).toBe(true);
    expect(context.deps.serviceOrderCore.addServiceOrderSystemHistory).toHaveBeenCalledWith("os-1", expect.objectContaining({
      message: "Máquina vinculada. Ela já estava em manutenção."
    }));
    expect(context.deps.moves.handleMoveMachine).not.toHaveBeenCalled();
  });

  it("move para manutencao usando a aba da maquina e lanca historico no ativo e na OS", async () => {
    const context = build({ segments: [defaultSegment, redes, manutencao] });
    const { result } = renderEntry(context);
    let ok;
    await act(async () => {
      ok = await result.current.ensureMachineInMaintenanceForServiceOrder(machine, { id: "os-1", number: 3 });
    });
    expect(ok).toBe(true);
    expect(context.deps.moves.handleMoveMachine).toHaveBeenCalledWith(machine, "m1", {
      reason: "maintenance",
      targetTabId: "tab-a",
      forceSingle: true
    });
    expect(context.deps.deviceState.appendDeviceHistoryEvent.mock.calls[0][1].message).toBe(
      "Máquina colocada em manutenção automaticamente pela OS #3."
    );
    expect(context.deps.serviceOrderCore.addServiceOrderSystemHistory).toHaveBeenCalledWith("os-1", expect.objectContaining({
      message: "Máquina vinculada e colocada em manutenção.",
      oldValue: "Redes",
      newValue: "Manutenção"
    }));
  });

  it("usa a aba da OS para maquinas nao organizadas e trata falhas", async () => {
    const context = build({ segments: [defaultSegment, redes, manutencao] });
    const { result } = renderEntry(context);
    await act(async () => {
      await result.current.ensureMachineInMaintenanceForServiceOrder(
        { ...machine, tabId: "global-unorganized" },
        { id: "os-1", environmentId: "env-7" }
      );
    });
    expect(context.deps.moves.handleMoveMachine.mock.calls[0][2].targetTabId).toBe("env-7");

    context.deps.moves.handleMoveMachine.mockResolvedValue(false);
    expect(await result.current.ensureMachineInMaintenanceForServiceOrder(machine, { id: "os-2" })).toBe(false);

    context.deps.moves.handleMoveMachine.mockRejectedValue(new Error("falha"));
    expect(await result.current.ensureMachineInMaintenanceForServiceOrder(machine, { id: "os-3" })).toBe(false);
    expect(context.session.notify).toHaveBeenCalledWith("falha", "danger");
  });
});
