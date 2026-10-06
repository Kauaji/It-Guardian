import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api.js";
import { createSession, createStore, dataSliceWrapper } from "../../test/appHarness.jsx";
import { AlertFiltersProvider } from "../context/AlertFiltersContext.jsx";
import { DataProvider } from "../context/workspaceContexts.js";
import { AppSessionProvider } from "../../context/AppSessionContext.jsx";
import { useAlertActions } from "./useAlertActions.js";
import { useAlertCenterValue } from "./useAlertCenterValue.js";
import { useMaintenanceScriptActions } from "./useMaintenanceScriptActions.js";
import { automationSaveMessage, usePreventiveAutomationActions } from "./usePreventiveAutomationActions.js";
import { usePreventivePlanActions } from "./usePreventivePlanActions.js";

vi.mock("../../api.js");

function setup(hook, { remoteScriptExecutionEnabled = true, overrides = {} } = {}) {
  const session = createSession();
  const stores = {
    alertCorrelations: createStore([]),
    alertRules: createStore([{ id: "r1", enabled: true }]),
    alerts: createStore([]),
    maintenanceScripts: createStore([{ id: "sc1", name: "Limpeza" }]),
    preventiveAutomationPlans: createStore([{ id: "pa1", active: true }]),
    preventivePlans: createStore([{ id: "pp1" }]),
    serviceOrderSuggestions: createStore([{ id: "sg1" }, { id: "sg2" }]),
    serviceOrders: createStore([])
  };
  const data = {
    loadData: vi.fn().mockResolvedValue(),
    preventiveAutomationPlans: stores.preventiveAutomationPlans.get(),
    remoteScriptExecutionEnabled,
    setAlertCorrelations: stores.alertCorrelations.set,
    setAlertPriorityColors: vi.fn(),
    setAlertPrioritySettings: vi.fn(),
    setAlertRules: stores.alertRules.set,
    setAlerts: stores.alerts.set,
    setMaintenanceScripts: stores.maintenanceScripts.set,
    setPreventiveAutomationPlans: stores.preventiveAutomationPlans.set,
    setPreventivePlans: stores.preventivePlans.set,
    setServiceOrderSuggestions: stores.serviceOrderSuggestions.set,
    setServiceOrders: stores.serviceOrders.set,
    ...overrides
  };
  const { result } = renderHook(hook, { wrapper: dataSliceWrapper(session, data) });
  return { data, result, session, stores };
}

describe("useAlertActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reavalia os avisos atualizando alertas, regras, sugestoes e correlacoes", async () => {
    api.evaluateAlerts.mockResolvedValue({
      alerts: [{ id: "a1" }],
      rules: [{ id: "r2" }],
      suggestions: [{ id: "sg3" }],
      createdSuggestions: [{}, {}]
    });
    api.fetchAlertCorrelations.mockResolvedValue({ correlations: [{ id: "c1" }] });
    const { result, stores, session } = setup(() => useAlertActions());
    await act(async () => {
      await result.current.handleEvaluateAlerts();
    });
    expect(stores.alerts.get()).toEqual([{ id: "a1" }]);
    expect(stores.alertRules.get()).toEqual([{ id: "r2" }]);
    expect(stores.serviceOrderSuggestions.get()).toEqual([{ id: "sg3" }]);
    expect(stores.alertCorrelations.get()).toEqual([{ id: "c1" }]);
    expect(session.notify).toHaveBeenCalledWith("2 sugestão(ões) de OS criada(s) a partir dos avisos.", "ok");
  });

  it("tolera falha nas correlacoes e informa quando nao ha novas sugestoes", async () => {
    api.evaluateAlerts.mockResolvedValue({});
    api.fetchAlertCorrelations.mockRejectedValue(new Error("x"));
    const { result, stores, session } = setup(() => useAlertActions());
    await act(async () => {
      await result.current.handleEvaluateAlerts();
    });
    expect(stores.alertCorrelations.get()).toEqual([]);
    expect(session.notify).toHaveBeenCalledWith("Avisos avaliados. Nenhuma nova sugestão foi necessária.", "ok");

    api.evaluateAlerts.mockRejectedValue(new Error("falhou"));
    await act(async () => {
      await result.current.handleEvaluateAlerts();
    });
    expect(session.notify).toHaveBeenLastCalledWith("falhou", "danger");
  });

  it("aceita e recusa sugestoes removendo-as da lista e recarregando", async () => {
    api.acceptServiceOrderSuggestion.mockResolvedValue({ serviceOrder: { number: 10 } });
    api.rejectServiceOrderSuggestion.mockResolvedValue({});
    const { result, stores, data, session } = setup(() => useAlertActions());

    await act(async () => {
      await result.current.handleAcceptSuggestion("sg1");
    });
    expect(stores.serviceOrderSuggestions.get().map((item) => item.id)).toEqual(["sg2"]);
    expect(session.notify).toHaveBeenCalledWith("OS criada a partir do aviso: 10.", "ok");

    await act(async () => {
      await result.current.handleRejectSuggestion("sg2");
    });
    expect(api.rejectServiceOrderSuggestion).toHaveBeenCalledWith("token-1", "sg2", "Recusado pelo painel de avisos.");
    expect(stores.serviceOrderSuggestions.get()).toEqual([]);
    expect(data.loadData).toHaveBeenCalledTimes(2);
  });

  it("avisa erros ao aceitar, recusar, comentar e atualizar regra", async () => {
    api.acceptServiceOrderSuggestion.mockRejectedValue(new Error("e1"));
    api.rejectServiceOrderSuggestion.mockRejectedValue(new Error("e2"));
    api.createAlertComment.mockRejectedValue(new Error("e3"));
    api.updateAlertRule.mockRejectedValue(new Error("e4"));
    const { result, session } = setup(() => useAlertActions());
    await act(async () => {
      await result.current.handleAcceptSuggestion("sg1");
      await result.current.handleRejectSuggestion("sg1");
      await result.current.handleAddAlertComment("a1", "oi");
      await result.current.handleUpdateAlertRule("r1", {});
    });
    expect(session.notify.mock.calls.map((call) => call[0])).toEqual(["e1", "e2", "e3", "e4"]);
  });

  it("registra comentario e atualiza regra", async () => {
    api.createAlertComment.mockResolvedValue({});
    api.updateAlertRule.mockResolvedValue({ rule: { id: "r1", enabled: false } });
    const { result, stores, session } = setup(() => useAlertActions());
    await act(async () => {
      await result.current.handleAddAlertComment("a1", "visto");
      await result.current.handleUpdateAlertRule("r1", { enabled: false });
    });
    expect(session.notify).toHaveBeenCalledWith("Comentário registrado no aviso.", "ok");
    expect(stores.alertRules.get()).toEqual([{ id: "r1", enabled: false }]);
  });

  it("salva as prioridades normalizadas e repassa erros", async () => {
    api.updateAlertSettings.mockResolvedValue({ settings: { priorityColors: { critical: "#f00" } } });
    const { result, data, session } = setup(() => useAlertActions());
    let saved;
    await act(async () => {
      saved = await result.current.handleSaveAlertPrioritySettings({ any: 1 });
    });
    expect(data.setAlertPrioritySettings).toHaveBeenCalledWith(saved);
    expect(data.setAlertPriorityColors).toHaveBeenCalledWith(saved.priorityColors);
    expect(session.notify).toHaveBeenCalledWith("Configurações de prioridade dos avisos salvas.", "ok");

    api.updateAlertSettings.mockRejectedValue(new Error("nao salvou"));
    await act(async () => {
      await expect(result.current.handleSaveAlertPrioritySettings({})).rejects.toThrow("nao salvou");
    });
  });
});

describe("useMaintenanceScriptActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("analisa o script devolvendo a analise e repassando erros", async () => {
    api.analyzeMaintenanceScript.mockResolvedValue({ analysis: { risk: "low" } });
    const { result, session } = setup(() => useMaintenanceScriptActions());
    let analysis;
    await act(async () => {
      analysis = await result.current.handleAnalyzeMaintenanceScript({});
    });
    expect(analysis).toEqual({ risk: "low" });
    expect(session.notify).toHaveBeenCalledWith("Resumo estimado gerado. Revise manualmente antes de salvar.", "ok");

    api.analyzeMaintenanceScript.mockRejectedValue(new Error("invalido"));
    await act(async () => {
      await expect(result.current.handleAnalyzeMaintenanceScript({})).rejects.toThrow("invalido");
    });
  });

  it("cadastra um script novo no topo e atualiza um existente", async () => {
    api.createMaintenanceScript.mockResolvedValue({ script: { id: "sc2", name: "Novo" } });
    api.updateMaintenanceScript.mockResolvedValue({ script: { id: "sc1", name: "Limpeza v2" } });
    const { result, stores, session } = setup(() => useMaintenanceScriptActions());
    await act(async () => {
      await result.current.handleSaveMaintenanceScript({ name: "Novo" });
    });
    expect(stores.maintenanceScripts.get().map((script) => script.id)).toEqual(["sc2", "sc1"]);
    expect(session.notify).toHaveBeenCalledWith("Script de manutenção cadastrado.", "ok");

    await act(async () => {
      await result.current.handleSaveMaintenanceScript({ name: "Limpeza v2" }, "sc1");
    });
    expect(stores.maintenanceScripts.get().find((script) => script.id === "sc1").name).toBe("Limpeza v2");
    expect(session.notify).toHaveBeenCalledWith("Script de manutenção atualizado.", "ok");
  });

  it("desativa o script e repassa erros de gravacao e desativacao", async () => {
    api.deleteMaintenanceScript.mockResolvedValue({ script: { id: "sc1", active: false } });
    const { result, stores, session } = setup(() => useMaintenanceScriptActions());
    await act(async () => {
      await result.current.handleDeactivateMaintenanceScript("sc1");
    });
    expect(stores.maintenanceScripts.get()[0]).toEqual({ id: "sc1", active: false });
    expect(session.notify).toHaveBeenCalledWith("Script de manutenção desativado.", "ok");

    api.deleteMaintenanceScript.mockRejectedValue(new Error("d"));
    api.createMaintenanceScript.mockRejectedValue(new Error("s"));
    await act(async () => {
      await expect(result.current.handleDeactivateMaintenanceScript("sc1")).rejects.toThrow("d");
      await expect(result.current.handleSaveMaintenanceScript({})).rejects.toThrow("s");
    });
  });

  it("registra simulacao, revisao de log, acao corretiva e cancelamento recarregando os dados", async () => {
    for (const fn of ["registerMaintenanceScriptSimulation", "acknowledgeScriptLog", "applyScriptLogSuggestedSolution", "cancelScriptValidation"]) {
      api[fn].mockResolvedValue({});
    }
    const { result, data, session } = setup(() => useMaintenanceScriptActions());
    await act(async () => {
      await result.current.handleRegisterMaintenanceScriptSimulation("sc1", { a: 1 });
      await result.current.handleAcknowledgeScriptLog("log1");
      await result.current.handleApplyScriptLogSuggestedSolution("log1", { b: 2 });
      await result.current.handleCancelScriptValidation("val1");
    });
    expect(api.registerMaintenanceScriptSimulation).toHaveBeenCalledWith("token-1", "sc1", { a: 1 });
    expect(data.loadData).toHaveBeenCalledTimes(4);
    expect(session.notify.mock.calls.map((call) => call[0])).toEqual([
      "Registro criado. Nenhum comando foi executado.",
      "Log marcado como revisado.",
      "Ação corretiva registrada. Nenhum comando foi executado.",
      "Observação cancelada."
    ]);
  });

  it("propaga o erro (apos avisar) quando a acao falha", async () => {
    api.acknowledgeScriptLog.mockRejectedValue(new Error("log invalido"));
    const { result, data, session } = setup(() => useMaintenanceScriptActions());
    await act(async () => {
      await expect(result.current.handleAcknowledgeScriptLog("log1")).rejects.toThrow("log invalido");
    });
    expect(session.notify).toHaveBeenCalledWith("log invalido", "danger");
    expect(data.loadData).not.toHaveBeenCalled();
  });

  it("so enfileira o script de uma sugestao quando a execucao remota esta habilitada", async () => {
    api.useSuggestionScript.mockResolvedValue({});
    const disabled = setup(() => useMaintenanceScriptActions(), { remoteScriptExecutionEnabled: false });
    await act(async () => {
      await disabled.result.current.handleUseSuggestionScript("sg1", "sc1", {});
    });
    expect(api.useSuggestionScript).not.toHaveBeenCalled();
    expect(disabled.session.notify).toHaveBeenCalledWith(expect.stringContaining("Execução remota desabilitada"), "warning");

    const enabled = setup(() => useMaintenanceScriptActions());
    await act(async () => {
      await enabled.result.current.handleUseSuggestionScript("sg1", "sc1", { x: 1 });
    });
    expect(api.useSuggestionScript).toHaveBeenCalledWith("token-1", "sg1", "sc1", { x: 1 });
    expect(enabled.session.notify).toHaveBeenCalledWith("Script enfileirado. Aguardando execução pelo agente da máquina.", "ok");
  });
});

describe("usePreventivePlanActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cria plano preventivo com mensagem conforme a automacao e repassa erros", async () => {
    api.createPreventivePlan.mockResolvedValue({ preventivePlan: { id: "pp2" } });
    const { result, stores, session } = setup(() => usePreventivePlanActions());
    await act(async () => {
      await result.current.handleCreatePreventivePlan({ automation: { enabled: true } });
    });
    expect(stores.preventivePlans.get().map((plan) => plan.id)).toEqual(["pp2", "pp1"]);
    expect(session.notify).toHaveBeenLastCalledWith(expect.stringContaining("automatizado"), "ok");

    await act(async () => {
      await result.current.handleCreatePreventivePlan({});
    });
    expect(session.notify).toHaveBeenLastCalledWith("Preventiva registrada e enfileirada no agente da máquina.", "ok");

    api.createPreventivePlan.mockRejectedValue(new Error("nao criou"));
    await act(async () => {
      await expect(result.current.handleCreatePreventivePlan({})).rejects.toThrow("nao criou");
    });
  });

  it("cria OS a partir do plano atualizando plano e lista de OS", async () => {
    api.createPreventivePlanServiceOrder.mockResolvedValue({
      preventivePlan: { id: "pp1", serviceOrderId: "os-5" },
      serviceOrder: { id: "os-5", number: 5 }
    });
    const { result, stores, session } = setup(() => usePreventivePlanActions());
    await act(async () => {
      await result.current.handleCreatePreventivePlanServiceOrder("pp1");
    });
    expect(stores.preventivePlans.get()[0].serviceOrderId).toBe("os-5");
    expect(stores.serviceOrders.get()[0].id).toBe("os-5");
    expect(session.notify).toHaveBeenCalledWith("OS preventiva 5 criada.", "ok");

    api.createPreventivePlanServiceOrder.mockRejectedValue(new Error("sem OS"));
    await act(async () => {
      await expect(result.current.handleCreatePreventivePlanServiceOrder("pp1")).rejects.toThrow("sem OS");
    });
  });
});

describe("usePreventiveAutomationActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("escolhe a mensagem de salvamento conforme pausa/reativacao", () => {
    expect(automationSaveMessage({ isUpdate: false, payload: {}, previousPlan: null })).toBe("Automação preventiva criada.");
    expect(automationSaveMessage({ isUpdate: true, payload: {}, previousPlan: { active: true } })).toBe("Automação preventiva atualizada.");
    expect(automationSaveMessage({ isUpdate: true, payload: { active: false }, previousPlan: { active: true } })).toMatch(/pausada/);
    expect(automationSaveMessage({ isUpdate: true, payload: { active: true }, previousPlan: { active: false } })).toMatch(/reativada/);
    expect(automationSaveMessage({ isUpdate: true, payload: { active: true }, previousPlan: { active: true } })).toBe("Automação preventiva atualizada.");
  });

  it("cria e atualiza planos de automacao", async () => {
    api.createPreventiveAutomationPlan.mockResolvedValue({ preventiveAutomationPlan: { id: "pa2", active: true } });
    api.updatePreventiveAutomationPlan.mockResolvedValue({ preventiveAutomationPlan: { id: "pa1", active: false } });
    const { result, stores, session, data } = setup(() => usePreventiveAutomationActions());
    await act(async () => {
      await result.current.handleSavePreventiveAutomationPlan(null, { name: "Novo" });
    });
    expect(stores.preventiveAutomationPlans.get().map((plan) => plan.id)).toEqual(["pa2", "pa1"]);
    expect(session.notify).toHaveBeenLastCalledWith("Automação preventiva criada.", "ok");

    let saved;
    await act(async () => {
      saved = await result.current.handleSavePreventiveAutomationPlan("pa1", { active: false });
    });
    expect(saved).toEqual({ id: "pa1", active: false });
    expect(session.notify).toHaveBeenLastCalledWith("Automação pausada. As agendas futuras foram desativadas.", "ok");
    expect(data.loadData).toHaveBeenCalledTimes(2);

    api.updatePreventiveAutomationPlan.mockRejectedValue(new Error("nao salvou"));
    await act(async () => {
      await expect(result.current.handleSavePreventiveAutomationPlan("pa1", {})).rejects.toThrow("nao salvou");
    });
  });

  it("pausa e reativa substituindo o plano na lista", async () => {
    api.disablePreventiveAutomationPlan.mockResolvedValue({ preventiveAutomationPlan: { id: "pa1", active: false } });
    api.reactivatePreventiveAutomationPlan.mockResolvedValue({ preventiveAutomationPlan: { id: "pa1", active: true } });
    const { result, stores, session } = setup(() => usePreventiveAutomationActions());
    await act(async () => {
      await result.current.handleDisablePreventiveAutomationPlan("pa1");
    });
    expect(stores.preventiveAutomationPlans.get()[0].active).toBe(false);
    expect(session.notify).toHaveBeenLastCalledWith("Automação preventiva pausada.", "ok");

    await act(async () => {
      await result.current.handleReactivatePreventiveAutomationPlan("pa1");
    });
    expect(stores.preventiveAutomationPlans.get()[0].active).toBe(true);
    expect(session.notify).toHaveBeenLastCalledWith("Automação preventiva reativada.", "ok");

    api.disablePreventiveAutomationPlan.mockRejectedValue(new Error("d"));
    api.reactivatePreventiveAutomationPlan.mockRejectedValue(new Error("r"));
    await act(async () => {
      await expect(result.current.handleDisablePreventiveAutomationPlan("pa1")).rejects.toThrow("d");
      await expect(result.current.handleReactivatePreventiveAutomationPlan("pa1")).rejects.toThrow("r");
    });
  });

  it("exclui plano, grava e remove recorrencia por maquina e remove maquina do plano", async () => {
    api.deletePreventiveAutomationPlan.mockResolvedValue({});
    api.savePreventiveAutomationAssetOverride.mockResolvedValue({ automationAsset: { id: "x1" } });
    api.removePreventiveAutomationAssetOverride.mockResolvedValue({ automationAsset: { id: "x2" } });
    api.removeAssetFromPreventiveAutomationPlan.mockResolvedValue({ ok: true });
    api.fetchPreventiveAutomationAsset.mockResolvedValue({ automationAsset: { id: "x3" } });
    const { result, session, data } = setup(() => usePreventiveAutomationActions());

    await act(async () => {
      expect(await result.current.handleDeletePreventiveAutomationPlan("pa1")).toBeUndefined();
      expect(await result.current.handleSavePreventiveAutomationAssetOverride("pa1", "a1", {})).toEqual({ id: "x1" });
      expect(await result.current.handleRemovePreventiveAutomationAssetOverride("pa1", "a1")).toEqual({ id: "x2" });
      expect(await result.current.handleRemoveAssetFromPreventiveAutomationPlan("pa1", "a1")).toEqual({ ok: true });
      expect(await result.current.handleFetchPreventiveAutomationAsset("pa1", "a1")).toEqual({ id: "x3" });
    });
    expect(data.loadData).toHaveBeenCalledTimes(4);
    expect(session.notify.mock.calls.map((call) => call[0])).toEqual([
      "Plano de automação excluído. Histórico e auditoria foram preservados.",
      "Recorrência personalizada atualizada para esta máquina.",
      "A máquina voltou a usar a recorrência padrão do plano.",
      "Máquina removida do plano. Agendas futuras foram desativadas."
    ]);

    api.deletePreventiveAutomationPlan.mockRejectedValue(new Error("nao apagou"));
    await act(async () => {
      await expect(result.current.handleDeletePreventiveAutomationPlan("pa1")).rejects.toThrow("nao apagou");
    });
  });
});

describe("useAlertCenterValue", () => {
  it("monta o contrato do AlertCenterProvider com dados, filtros e acoes", () => {
    const session = createSession();
    const data = {
      alerts: [{ id: "a1" }],
      alertCorrelations: [],
      alertPriorityColors: {},
      alertPrioritySettings: {},
      alertRules: [],
      history: [],
      loadData: vi.fn(),
      loading: true,
      maintenanceScripts: [],
      preventiveAutomationManagement: {},
      preventiveAutomationManagementError: "",
      preventiveAutomationPlans: [],
      preventivePlans: [],
      serviceOrderSuggestions: [{ id: "sg1" }]
    };
    const wrapper = ({ children }) => (
      <AppSessionProvider value={session}>
        <DataProvider value={data}>
          <AlertFiltersProvider>{children}</AlertFiltersProvider>
        </DataProvider>
      </AppSessionProvider>
    );
    const { result } = renderHook(() => useAlertCenterValue(), { wrapper });
    const value = result.current;

    expect(value.alerts).toBe(data.alerts);
    expect(value.suggestions).toBe(data.serviceOrderSuggestions);
    expect(value.preventiveAutomationManagementLoading).toBe(true);
    expect(value.severityFilter).toBe("all");
    expect(value.statusFilter).toBe("all");
    expect(value.suggestionStatusFilter).toBe("all");

    const handlers = Object.entries(value).filter(([key]) => key.startsWith("on") || key.startsWith("set"));
    expect(handlers.length).toBeGreaterThanOrEqual(28);
    expect(handlers.every(([, fn]) => typeof fn === "function")).toBe(true);

    act(() => value.onRefreshPreventiveAutomationManagement());
    expect(data.loadData).toHaveBeenCalledWith(true);

    act(() => result.current.setSeverityFilter("critical"));
    expect(result.current.severityFilter).toBe("critical");
  });
});
