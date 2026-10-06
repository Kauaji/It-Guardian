import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api.js", () => ({
  createMonitoringSocket: vi.fn(),
  fetchAlertCorrelations: vi.fn(),
  fetchAlertHistory: vi.fn(),
  fetchAlertRules: vi.fn(),
  fetchAlertSettings: vi.fn(),
  fetchAlerts: vi.fn(),
  fetchDevice: vi.fn(),
  fetchDevices: vi.fn(),
  fetchMaintenanceScripts: vi.fn(),
  fetchPreventiveAutomationManagement: vi.fn(),
  fetchPreventiveAutomationPlans: vi.fn(),
  fetchPreventivePlans: vi.fn(),
  fetchServiceOrders: vi.fn(),
  fetchServiceOrderSuggestions: vi.fn(),
  fetchSegmentGroups: vi.fn(),
  fetchSegments: vi.fn(),
  fetchSystemSettings: vi.fn()
}));

import * as api from "../api.js";
import { useDashboardData } from "./useDashboardData.js";

const device = (id, extra = {}) => ({ id, name: `PC-${id}`, segmentName: "Redes", ...extra });

let props;
let socket;

function makeProps(overrides = {}) {
  return {
    activeView: "inventory",
    applyInventoryLocalState: vi.fn((list) => list.map((item) => ({ ...item, local: true }))),
    applySegmentGroups: vi.fn((list, groups) => list.map((item) => ({ ...item, groups: groups.length }))),
    canViewAlerts: true,
    canViewInventory: true,
    canViewMachine: true,
    canViewPreventiveAutomation: true,
    canViewPreventivePlans: true,
    canViewScripts: true,
    canViewServiceOrders: true,
    initialSystemMode: "local",
    logout: vi.fn(),
    maintenanceRecords: {},
    manualPeripherals: {},
    notify: vi.fn(),
    onMaintenanceRecordsChange: vi.fn(),
    peripheralHistory: {},
    removedPeripherals: {},
    search: "",
    selectedId: null,
    setSelectedDevice: vi.fn(),
    setSelectedId: vi.fn(),
    status: "",
    token: "tok",
    ...overrides
  };
}

function mockHappyApi() {
  api.fetchDevices.mockImplementation(async (_token, filters) => (
    filters ? { devices: [device("1")], summary: { totalDevices: 1 } } : { devices: [device("1"), device("2")] }
  ));
  api.fetchSegments.mockResolvedValue({ segments: [{ id: "s1" }] });
  api.fetchSegmentGroups.mockResolvedValue({ groups: [{ id: "g1" }] });
  api.fetchAlerts.mockResolvedValue({ alerts: [{ id: "a1", title: "CPU alta", severity: "Crítico", hostname: "srv" }] });
  api.fetchAlertHistory.mockResolvedValue({ alerts: [{ id: "h1", title: "Disco", severity: "warning" }] });
  api.fetchAlertCorrelations.mockResolvedValue({ correlations: [{ id: "c1" }] });
  api.fetchAlertRules.mockResolvedValue({ rules: [{ id: "r1" }] });
  api.fetchServiceOrderSuggestions.mockResolvedValue({ suggestions: [{ id: "sg1", title: "Limpar", machineAlias: "PC" }] });
  api.fetchMaintenanceScripts.mockResolvedValue({ scripts: [{ id: "sc1" }] });
  api.fetchPreventivePlans.mockResolvedValue({ preventivePlans: [{ id: "pp1" }] });
  api.fetchPreventiveAutomationPlans.mockResolvedValue({ preventiveAutomationPlans: [{ id: "pa1" }] });
  api.fetchPreventiveAutomationManagement.mockResolvedValue({ plans: [{ id: "m1" }], machines: [{ id: "mm1" }], metadata: { planCount: 1, machineCount: 1 } });
  api.fetchServiceOrders.mockResolvedValue({ serviceOrders: [{ id: "o1" }] });
  api.fetchAlertSettings.mockResolvedValue({ settings: { priorityColors: { critical: "#111111" } } });
  api.fetchSystemSettings.mockResolvedValue({ settings: { systemMode: "business", remoteScriptExecutionEnabled: true } });
  api.fetchDevice.mockResolvedValue({ device: { id: "1", detailed: true } });
}

function mount(overrides = {}) {
  props = makeProps(overrides);
  return renderHook(() => useDashboardData(props));
}

async function loaded(result) {
  await waitFor(() => expect(result.current.loading).toBe(false));
}

beforeEach(() => {
  mockHappyApi();
  socket = { close: vi.fn() };
  api.createMonitoringSocket.mockReturnValue(socket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useDashboardData - carga inicial", () => {
  it("carrega tudo, normaliza avisos/sugestoes e aplica o estado local do inventario", async () => {
    const { result } = mount();
    expect(result.current.loading).toBe(true);
    expect(result.current.systemMode).toBe("local");
    await loaded(result);

    expect(api.fetchDevices).toHaveBeenCalledWith("tok", { search: "", status: "" });
    expect(api.fetchDevices).toHaveBeenCalledWith("tok");
    expect(result.current.devices).toEqual([{ ...device("1"), local: true }]);
    expect(result.current.allDevices.map((d) => d.id)).toEqual(["1", "2"]);
    expect(result.current.segments).toEqual([{ id: "s1", groups: 1 }]);
    expect(result.current.segmentGroups).toEqual([{ id: "g1" }]);
    expect(result.current.summary).toEqual({ totalDevices: 1 });
    expect(result.current.alerts[0]).toMatchObject({ id: "a1", severity: "critical", hostName: "srv", status: "active" });
    expect(result.current.history[0]).toMatchObject({ id: "h1", severity: "warning", hostName: "Máquina não vinculada" });
    expect(result.current.alertCorrelations).toEqual([{ id: "c1" }]);
    expect(result.current.alertRules).toEqual([{ id: "r1" }]);
    expect(result.current.serviceOrderSuggestions[0]).toMatchObject({ id: "sg1", hostName: "PC", description: "Limpar" });
    expect(result.current.maintenanceScripts).toEqual([{ id: "sc1" }]);
    expect(result.current.preventivePlans).toEqual([{ id: "pp1" }]);
    expect(result.current.preventiveAutomationPlans).toEqual([{ id: "pa1" }]);
    expect(result.current.preventiveAutomationManagement).toEqual({ plans: [{ id: "m1" }], machines: [{ id: "mm1" }], metadata: { planCount: 1, machineCount: 1 } });
    expect(result.current.preventiveAutomationManagementError).toBe("");
    expect(result.current.serviceOrders).toEqual([{ id: "o1" }]);
    expect(result.current.alertPriorityColors).toMatchObject({ critical: "#111111" });
    expect(result.current.systemMode).toBe("business");
    expect(result.current.remoteScriptExecutionEnabledOnServer).toBe(true);
    expect(result.current.lastUpdated).toBeInstanceOf(Date);
    expect(props.notify).toHaveBeenCalledWith("Existem avisos críticos pendentes.", "danger");
  });

  it("seleciona o primeiro item visivel e carrega os detalhes (fora do dashboard usa todos os dispositivos)", async () => {
    const { result } = mount({ activeView: "inventory" });
    await loaded(result);
    expect(props.setSelectedId).toHaveBeenCalledWith("1");
    await waitFor(() => expect(props.setSelectedDevice).toHaveBeenCalledWith({ id: "1", detailed: true }));
    expect(api.fetchDevice).toHaveBeenCalledWith("tok", "1");
  });

  it("no dashboard usa os dispositivos filtrados e mantem a selecao ainda visivel", async () => {
    api.fetchDevices.mockImplementation(async (_t, filters) => (
      filters ? { devices: [device("9")], summary: null } : { devices: [device("1")] }
    ));
    const { result } = mount({ activeView: "dashboard", selectedId: "9" });
    await loaded(result);
    expect(props.setSelectedId).toHaveBeenCalledWith("9");
    expect(api.fetchDevice).toHaveBeenCalledWith("tok", "9");
  });

  it("sem acesso a maquina limpa o detalhe; erro ao buscar o detalhe tambem", async () => {
    const first = mount({ canViewMachine: false });
    await loaded(first.result);
    expect(props.setSelectedDevice).toHaveBeenCalledWith(null);
    expect(api.fetchDevice).not.toHaveBeenCalled();

    api.fetchDevice.mockRejectedValue(new Error("x"));
    const second = mount();
    await loaded(second.result);
    await waitFor(() => expect(props.setSelectedDevice).toHaveBeenCalledWith(null));
  });

  it("sem lista de dispositivos limpa a selecao", async () => {
    api.fetchDevices.mockResolvedValue({ devices: [], summary: null });
    const { result } = mount();
    await loaded(result);
    expect(props.setSelectedId).toHaveBeenCalledWith(undefined);
    expect(props.setSelectedDevice).toHaveBeenCalledWith(null);
  });

  it("sem nenhuma permissao so consulta as configuracoes do sistema", async () => {
    api.fetchSystemSettings.mockResolvedValue({ settings: {} });
    const { result } = mount({
      canViewAlerts: false,
      canViewInventory: false,
      canViewMachine: false,
      canViewPreventiveAutomation: false,
      canViewPreventivePlans: false,
      canViewScripts: false,
      canViewServiceOrders: false
    });
    await loaded(result);
    for (const name of ["fetchDevices", "fetchSegments", "fetchAlerts", "fetchMaintenanceScripts", "fetchPreventivePlans", "fetchPreventiveAutomationPlans", "fetchPreventiveAutomationManagement", "fetchServiceOrders", "fetchAlertSettings"]) {
      expect(api[name]).not.toHaveBeenCalled();
    }
    expect(api.fetchSystemSettings).toHaveBeenCalledWith("tok");
    expect(result.current.devices).toEqual([]);
    expect(result.current.alerts).toEqual([]);
    expect(result.current.systemMode).toBe("local");
    expect(result.current.remoteScriptExecutionEnabledOnServer).toBeNull();
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("falhas tolerantes: correlacoes, configuracao de avisos, sistema e automacao preventiva", async () => {
    api.fetchAlertCorrelations.mockRejectedValue(new Error("x"));
    api.fetchAlertSettings.mockRejectedValue(new Error("x"));
    api.fetchSystemSettings.mockRejectedValue(new Error("x"));
    api.fetchPreventiveAutomationManagement.mockRejectedValue(new Error("Gestao fora"));
    const { result } = mount();
    await loaded(result);
    expect(result.current.alertCorrelations).toEqual([]);
    expect(result.current.systemMode).toBe("local");
    expect(result.current.preventiveAutomationManagement).toEqual({ plans: [], machines: [], metadata: { planCount: 0, machineCount: 0 } });
    expect(result.current.preventiveAutomationManagementError).toBe("Gestao fora");
  });

  it("modo do sistema desconhecido vira local", async () => {
    api.fetchSystemSettings.mockResolvedValue({ settings: { systemMode: "qualquer", remoteScriptExecutionEnabled: false } });
    const { result } = mount({ initialSystemMode: "business" });
    await loaded(result);
    expect(result.current.systemMode).toBe("local");
    expect(result.current.remoteScriptExecutionEnabledOnServer).toBe(false);
  });

  it("erro em qualquer consulta notifica e encerra o carregando", async () => {
    api.fetchServiceOrders.mockRejectedValue(new Error("OS fora"));
    const { result } = mount();
    await loaded(result);
    expect(props.notify).toHaveBeenCalledWith("OS fora", "danger");
    expect(result.current.devices).toEqual([]);
  });

  it("remove registros de manutencao de maquinas que sairam do segmento Manutencao", async () => {
    api.fetchDevices.mockImplementation(async (_t, filters) => (
      filters ? { devices: [], summary: null } : { devices: [device("1", { segmentName: "Redes" }), device("2", { segmentName: "Manutenção" })] }
    ));
    const records = { 1: { active: true }, 2: { active: true }, 3: { active: false } };
    const { result } = mount({ maintenanceRecords: records });
    await loaded(result);
    expect(props.onMaintenanceRecordsChange).toHaveBeenCalledWith({ 2: { active: true }, 3: { active: false } });
    expect(props.applyInventoryLocalState.mock.calls[0][3]).toEqual({ 2: { active: true }, 3: { active: false } });
  });

  it("sem mudanca nos registros de manutencao nao os notifica", async () => {
    const { result } = mount({ maintenanceRecords: { 9: { active: true } } });
    await loaded(result);
    expect(props.onMaintenanceRecordsChange).not.toHaveBeenCalled();
    expect(props.applyInventoryLocalState.mock.calls[0][3]).toBe(props.maintenanceRecords);
  });

  it("loadData(true) recarrega em silencio, sem o carregando nem o aviso critico", async () => {
    const { result } = mount();
    await loaded(result);
    props.notify.mockClear();
    await act(async () => {
      await result.current.loadData(true);
    });
    expect(result.current.loading).toBe(false);
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("atualiza sozinho a cada 15 segundos", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = mount();
    await loaded(result);
    api.fetchAlerts.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(api.fetchAlerts).toHaveBeenCalledTimes(1);
  });
});

describe("useDashboardData - streaming em tempo real", () => {
  function snapshot(extra = {}) {
    return {
      data: JSON.stringify({
        type: "monitoring.snapshot",
        summary: { totalDevices: 7 },
        alerts: [{ id: "n1", title: "Novo", severity: "high" }],
        updatedAt: "2026-10-01T10:00:00Z",
        devices: [device("1", { fresh: true })],
        segments: [{ id: "s9" }],
        ...extra
      })
    };
  }

  it("aplica o snapshot: resumo, avisos, dispositivos, segmentos e detalhe selecionado", async () => {
    const { result } = mount();
    await loaded(result);
    act(() => socket.onmessage(snapshot()));
    expect(result.current.summary).toEqual({ totalDevices: 7 });
    expect(result.current.alerts[0]).toMatchObject({ id: "n1", severity: "high" });
    expect(result.current.lastUpdated.toISOString()).toBe("2026-10-01T10:00:00.000Z");
    expect(result.current.allDevices[0].fresh).toBe(true);
    expect(result.current.devices[0].fresh).toBe(true);
    expect(result.current.segments).toEqual([{ id: "s9", groups: 1 }]);
    const updater = props.setSelectedDevice.mock.calls.at(-1)[0];
    expect(typeof updater).toBe("function");
    expect(updater(null)).toBeNull();
    expect(updater({ id: "1", old: true })).toMatchObject({ fresh: true });
    expect(updater({ id: "zzz" })).toEqual({ id: "zzz" });
  });

  it("com filtros ativos nao troca a lista filtrada; sem segmentos no snapshot mantem os atuais", async () => {
    const { result } = mount({ search: "pc" });
    await loaded(result);
    const before = result.current.devices;
    act(() => socket.onmessage(snapshot({ segments: undefined })));
    expect(result.current.devices).toBe(before);
    expect(result.current.allDevices[0].fresh).toBe(true);
    expect(result.current.segments).toEqual([{ id: "s1", groups: 1 }]);
  });

  it("ignora outros tipos de mensagem e avisa quando o JSON e invalido", async () => {
    const { result } = mount();
    await loaded(result);
    act(() => socket.onmessage({ data: JSON.stringify({ type: "outro" }) }));
    expect(result.current.summary).toEqual({ totalDevices: 1 });
    act(() => socket.onmessage({ data: "{nao-json" }));
    expect(props.notify).toHaveBeenCalledWith("Não foi possível processar o streaming em tempo real.", "danger");
  });

  it("fecha com 1008: avisa e faz logout; outros codigos nao", async () => {
    const { result } = mount();
    await loaded(result);
    act(() => socket.onclose({ code: 1006 }));
    expect(props.logout).not.toHaveBeenCalled();
    act(() => socket.onclose({ code: 1008 }));
    expect(props.notify).toHaveBeenCalledWith("Sessão de streaming não autorizada.", "danger");
    expect(props.logout).toHaveBeenCalled();
  });

  it("sem socket nao quebra e ao desmontar fecha a conexao", async () => {
    api.createMonitoringSocket.mockReturnValueOnce(null);
    const first = mount();
    await loaded(first.result);
    first.unmount();

    const second = mount();
    await loaded(second.result);
    second.unmount();
    expect(socket.close).toHaveBeenCalled();
  });
});

describe("useDashboardData - setters expostos", () => {
  it("expoe os setters usados pelos fluxos de edicao", async () => {
    const { result } = mount();
    await loaded(result);
    act(() => {
      result.current.setAlerts([{ id: "x" }]);
      result.current.setDevices([{ id: "y" }]);
      result.current.setSystemMode("business");
      result.current.setServiceOrders([{ id: "z" }]);
    });
    expect(result.current.alerts).toEqual([{ id: "x" }]);
    expect(result.current.devices).toEqual([{ id: "y" }]);
    expect(result.current.systemMode).toBe("business");
    expect(result.current.serviceOrders).toEqual([{ id: "z" }]);
    for (const name of [
      "setAlertCorrelations", "setAlertPriorityColors", "setAlertPrioritySettings", "setAlertRules", "setAllDevices", "setHistory",
      "setMaintenanceScripts", "setPreventiveAutomationManagement", "setPreventiveAutomationManagementError",
      "setPreventiveAutomationPlans", "setPreventivePlans", "setSegmentGroups", "setSegments", "setServiceOrderSuggestions", "setSummary"
    ]) {
      expect(typeof result.current[name]).toBe("function");
    }
  });
});
