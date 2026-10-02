import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAlertLookups } from "../alertLookups.js";
import usePreventivePlans from "./usePreventivePlans.js";

const api = vi.hoisted(() => ({ fetchMaintenanceScriptRecommendations: vi.fn() }));
vi.mock("../../../api.js", () => api);

const devices = [
  { id: "d1", name: "PC-01", segmentId: "s1" },
  { id: "d2", name: "PC-02", segmentId: "s1" }
];
const lookups = createAlertLookups({ devices, segments: [{ id: "s1", name: "Recepção" }] });
const activeScripts = [{ id: "sc1", name: "Limpar", riskLevel: "low" }, { id: "sc2", name: "Reiniciar", riskLevel: "high" }];

function setup({ activeTab = "preventives", canCreatePlans = true, handlers = {}, data = {} } = {}) {
  const props = {
    data: {
      token: "tok",
      devices,
      alerts: [],
      lookups,
      preventivePlans: [],
      automationMachines: undefined,
      activeScripts,
      dueDays: 180,
      ...data
    },
    activeTab,
    canCreatePlans,
    handlers: {
      onCreatePreventivePlan: vi.fn().mockResolvedValue({ id: "pp1", name: "Plano" }),
      onCreatePreventivePlanServiceOrder: vi.fn().mockResolvedValue({ preventivePlan: { id: "pp1", serviceOrderId: "OS-1" } }),
      ...handlers
    }
  };
  const hook = renderHook((current) => usePreventivePlans(current), { initialProps: props });
  return { ...hook, props };
}

beforeEach(() => {
  api.fetchMaintenanceScriptRecommendations.mockReset();
  api.fetchMaintenanceScriptRecommendations.mockResolvedValue({ recommended: [], others: [] });
});

describe("usePreventivePlans - visão e filtros", () => {
  it("resume e agrupa as máquinas", () => {
    const { result } = setup();

    expect(result.current.summary).toMatchObject({ withoutPreventive: 2 });
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0].devices.map((item) => item.device.id)).toEqual(["d1", "d2"]);
  });

  it("filtra por busca e por status", () => {
    const { result } = setup();

    act(() => result.current.setSearch("pc-02"));
    expect(result.current.groups[0].devices.map((item) => item.device.id)).toEqual(["d2"]);
    act(() => result.current.setSearch(""));
    act(() => result.current.setFilter("backup"));
    expect(result.current.groups).toEqual([]);
  });

  it("ordena as verificações com as recomendadas primeiro", async () => {
    api.fetchMaintenanceScriptRecommendations.mockResolvedValue({ recommended: [{ id: "sc2", name: "Reiniciar" }], others: [] });
    const { result } = setup();

    act(() => result.current.selection.toggleAsset("d1"));
    await waitFor(() => expect(result.current.recommendations.recommended).toHaveLength(1));

    expect(result.current.orderedScripts.map((script) => script.id)).toEqual(["sc2", "sc1"]);
  });

  it("calcula as máquinas e scripts selecionados e os de risco", () => {
    const { result } = setup();

    act(() => result.current.selection.toggleAsset("d2"));
    act(() => result.current.selection.toggleScript("sc2"));
    act(() => result.current.selection.toggleScript("sc1"));

    expect(result.current.selectedDevices.map((device) => device.id)).toEqual(["d2"]);
    expect(result.current.selectedScripts.map((script) => script.id)).toEqual(["sc1", "sc2"]);
    expect(result.current.riskScripts.map((script) => script.id)).toEqual(["sc2"]);
  });
});

describe("usePreventivePlans - registro", () => {
  function selectAll(hook) {
    act(() => hook.result.current.selection.toggleAsset("d1"));
    act(() => hook.result.current.selection.toggleScript("sc1"));
  }

  it("só abre a revisão com permissão e com máquinas e scripts selecionados", () => {
    const semPermissao = setup({ canCreatePlans: false });
    selectAll(semPermissao);
    act(() => semPermissao.result.current.openReview());
    expect(semPermissao.result.current.reviewOpen).toBe(false);

    const semSelecao = setup();
    act(() => semSelecao.result.current.openReview());
    expect(semSelecao.result.current.reviewOpen).toBe(false);

    const completo = setup();
    selectAll(completo);
    act(() => completo.result.current.openReview());
    expect(completo.result.current.reviewOpen).toBe(true);
    act(() => completo.result.current.closeReview());
    expect(completo.result.current.reviewOpen).toBe(false);
  });

  it("registra o plano manual, limpa a seleção e guarda o plano criado", async () => {
    const hook = setup();
    selectAll(hook);
    act(() => hook.result.current.setPlanName("Plano de junho"));
    act(() => hook.result.current.openReview());

    await act(async () => hook.result.current.confirmRegistration());

    expect(hook.props.handlers.onCreatePreventivePlan).toHaveBeenCalledWith({
      name: "Plano de junho",
      description: "Plano preventivo registrado pela tela de Avisos.",
      source: "manual",
      notes: "",
      riskAcknowledged: false,
      assetIds: ["d1"],
      scriptIds: ["sc1"]
    });
    expect(hook.result.current.lastCreatedPlan).toEqual({ id: "pp1", name: "Plano" });
    expect(hook.result.current.selection.assets.size).toBe(0);
    expect(hook.result.current.reviewOpen).toBe(false);
    expect(hook.result.current.saving).toBe(false);
  });

  it("marca o risco reconhecido para scripts de risco alto", async () => {
    const hook = setup();
    act(() => hook.result.current.selection.toggleAsset("d1"));
    act(() => hook.result.current.selection.toggleScript("sc2"));

    await act(async () => hook.result.current.confirmRegistration());

    expect(hook.props.handlers.onCreatePreventivePlan).toHaveBeenCalledWith(expect.objectContaining({ riskAcknowledged: true }));
  });

  it("não registra sem handler e mantém a seleção quando o registro falha", async () => {
    const semHandler = setup({ handlers: { onCreatePreventivePlan: undefined } });
    selectAll(semHandler);
    await act(async () => semHandler.result.current.confirmRegistration());
    expect(semHandler.result.current.selection.assets.size).toBe(1);

    const falha = setup({ handlers: { onCreatePreventivePlan: vi.fn().mockRejectedValue(new Error("falhou")) } });
    selectAll(falha);
    await act(async () => {
      await falha.result.current.confirmRegistration().catch(() => {});
    });
    expect(falha.result.current.selection.assets.size).toBe(1);
    expect(falha.result.current.saving).toBe(false);
  });

  it("cria a OS preventiva e atualiza o plano exibido", async () => {
    const hook = setup();

    await act(async () => hook.result.current.createServiceOrder({ id: "pp1" }));

    expect(hook.props.handlers.onCreatePreventivePlanServiceOrder).toHaveBeenCalledWith("pp1");
    expect(hook.result.current.lastCreatedPlan).toEqual({ id: "pp1", serviceOrderId: "OS-1" });
    expect(hook.result.current.serviceOrderSavingId).toBeNull();
  });

  it("ignora a criação de OS sem plano, sem handler ou sem plano na resposta", async () => {
    const hook = setup();
    await act(async () => hook.result.current.createServiceOrder(null));
    expect(hook.props.handlers.onCreatePreventivePlanServiceOrder).not.toHaveBeenCalled();

    const semHandler = setup({ handlers: { onCreatePreventivePlanServiceOrder: undefined } });
    await act(async () => semHandler.result.current.createServiceOrder({ id: "pp1" }));
    expect(semHandler.result.current.lastCreatedPlan).toBeNull();

    const semPlano = setup({ handlers: { onCreatePreventivePlanServiceOrder: vi.fn().mockResolvedValue({}) } });
    await act(async () => semPlano.result.current.createServiceOrder({ id: "pp1" }));
    expect(semPlano.result.current.lastCreatedPlan).toBeNull();
  });
});

describe("usePreventivePlans - automação", () => {
  it("abre o assistente com a seleção atual", () => {
    const hook = setup();
    act(() => hook.result.current.selection.toggleAsset("d1"));
    act(() => hook.result.current.selection.toggleScript("sc1"));

    act(() => hook.result.current.openAutomationFromSelection());

    expect(hook.result.current.automationCreateRequest.defaults).toMatchObject({
      name: "Plano preventivo",
      scopeType: "asset_list",
      assetIds: ["d1"],
      defaultScriptIds: ["sc1"]
    });
    act(() => hook.result.current.clearAutomationCreateRequest());
    expect(hook.result.current.automationCreateRequest).toBeNull();
  });

  it("descarta o pedido do assistente ao sair da aba Preventivas", async () => {
    const hook = setup();
    act(() => hook.result.current.openAutomationFromSelection());
    expect(hook.result.current.automationCreateRequest).not.toBeNull();

    hook.rerender({ ...hook.props, activeTab: "suggestions" });

    await waitFor(() => expect(hook.result.current.automationCreateRequest).toBeNull());
  });

  it("cria o plano automatizado e limpa a seleção, mantendo as descrições expandidas", async () => {
    const hook = setup();
    act(() => hook.result.current.selection.toggleAsset("d1"));
    act(() => hook.result.current.selection.toggleScript("sc1"));
    act(() => hook.result.current.selection.toggleScriptDetails("sc1"));
    act(() => hook.result.current.openAutomationFromSelection());

    let created;
    await act(async () => { created = await hook.result.current.createAutomatedPlanFromSelection({ name: "Rotina", recurrenceType: "weekly" }); });

    expect(created).toEqual({ id: "pp1", name: "Plano" });
    expect(hook.props.handlers.onCreatePreventivePlan).toHaveBeenCalledWith(expect.objectContaining({
      name: "Rotina",
      source: "automated",
      assetIds: ["d1"],
      scriptIds: ["sc1"]
    }));
    expect(hook.result.current.selection.assets.size + hook.result.current.selection.scripts.size).toBe(0);
    expect(hook.result.current.selection.expandedScripts.size).toBe(1);
    expect(hook.result.current.automationCreateRequest).toBeNull();
  });
});
