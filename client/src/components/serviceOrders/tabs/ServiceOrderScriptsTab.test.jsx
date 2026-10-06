import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../../api.js";
import ServiceOrderScriptsTab from "./ServiceOrderScriptsTab.jsx";
import { makeDevice, makeOrder, wireApi } from "../test/fixtures.jsx";

vi.mock("../../../api.js", async () => (await import("../test/fixtures.jsx")).createApiMock());
vi.mock("../../maintenance/ScriptExecutionDiagnosticPanel.jsx", () => ({
  default: (props) => <div data-testid="diagnostic" data-asset={props.assetId} data-context={props.context} />
}));

const scripts = {
  recommended: [{ id: "sc1", name: "Limpar temp", riskLevel: "low", recommendationReason: "Disco cheio", estimatedSummary: "Remove arquivos" }],
  others: [{ id: "sc2", name: "Reiniciar spooler", riskLevel: "high", requiresAdmin: true, requiresLoggedUser: false }]
};
const agentAsset = { id: "dev-1", name: "PC-FIN-01", source: "agent", lastSeenAt: new Date().toISOString() };

function renderTab(props = {}) {
  const handlers = { notify: vi.fn() };
  const view = render(
    <ServiceOrderScriptsTab serviceOrder={makeOrder({ number: "OS-7" })} asset={agentAsset} token="tok" canManage canRegisterSimulation remoteScriptExecutionEnabled {...handlers} {...props} />
  );
  return { ...view, ...handlers };
}

async function renderReady(props) {
  const result = renderTab(props);
  await waitFor(() => expect(screen.queryByText("Carregando scripts...")).toBeNull());
  return result;
}

describe("ServiceOrderScriptsTab", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset?.());
    wireApi(api);
    api.fetchMaintenanceScriptRecommendations.mockResolvedValue(scripts);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("mostra carregando e depois scripts recomendados com risco e motivo", async () => {
    renderTab();
    expect(screen.getByText("Carregando scripts...")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Limpar temp")).toBeInTheDocument());
    expect(api.fetchServiceOrderScriptActivity).toHaveBeenCalledWith("tok", "os-1");
    expect(api.fetchMaintenanceScriptRecommendations).toHaveBeenCalledWith("tok", {
      assetIds: ["dev-1"],
      context: { category: "Desktop", problemType: "", title: "Computador não liga", description: "O computador do financeiro não liga." }
    });
    expect(screen.getByText("Baixo")).toHaveClass("risk-low");
    expect(screen.getByText("Alto")).toHaveClass("risk-high");
    expect(screen.getByText("Disco cheio")).toBeInTheDocument();
    expect(screen.getByText("Remove arquivos")).toBeInTheDocument();
    expect(screen.getByTestId("diagnostic")).toHaveAttribute("data-context", "service_order");
    expect(screen.queryByText(/Execução real desabilitada/)).toBeNull();
    expect(screen.getByText("Nenhum script executado nesta OS ainda.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Registrar simulação/ })).toBeNull();
    for (const button of screen.getAllByRole("button", { name: /Executar no agente/ })) expect(button).not.toBeDisabled();
  });

  it("sem ativo não busca recomendações, não mostra diagnóstico e explica o bloqueio", async () => {
    await renderReady({ serviceOrder: makeOrder({ assetId: "" }), asset: undefined });
    expect(api.fetchMaintenanceScriptRecommendations).not.toHaveBeenCalled();
    expect(screen.queryByTestId("diagnostic")).toBeNull();
    expect(screen.getByText("Nenhum script ativo cadastrado no catálogo.")).toBeInTheDocument();
    expect(screen.getByText("Esta OS não tem uma máquina/ativo vinculado.")).toBeInTheDocument();
  });

  it.each([
    ["OS finalizada", { serviceOrder: makeOrder({ closedAt: "2026-08-12T10:00:00.000Z" }) }, "Esta OS está finalizada. Reabra a OS para executar scripts."],
    ["sem agente", { asset: { id: "dev-1" } }, "Esta máquina não possui agente registrado."],
    ["agente desatualizado", { asset: { ...agentAsset, lastSeenAt: "2020-01-01T00:00:00.000Z" } }, "O agente desta máquina está offline ou desatualizado."],
    ["sem permissão", { canManage: false }, "Você não tem permissão para executar scripts nesta OS."]
  ])("bloqueia a execução real: %s", async (_name, props, message) => {
    await renderReady(props);
    expect(screen.getByText(message)).toBeInTheDocument();
    const [first] = screen.getAllByRole("button", { name: /Executar no agente/ });
    expect(first).toBeDisabled();
    expect(first).toHaveAttribute("title", message);
  });

  it("com execução real desabilitada mostra o aviso e só permite simulação", async () => {
    await renderReady({ remoteScriptExecutionEnabled: false });
    expect(screen.getAllByText(/Execução real desabilitada/)).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Registrar simulação/ })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Executar no agente/ })[0]).toBeDisabled();
  });

  it("confirma e enfileira a execução, exigindo reconhecimento de risco alto", async () => {
    const { notify } = await renderReady();
    api.fetchServiceOrderScriptActivity.mockResolvedValue({ activity: [{ id: "a1", scriptName: "Reiniciar spooler", status: "succeeded", executedAt: "2026-08-12T10:00:00.000Z" }] });
    click(screen.getAllByRole("button", { name: /Executar no agente/ })[1]);
    const dialog = screen.getByRole("dialog", { name: "Confirmar execução de script" });
    expect(within(dialog).getByRole("heading", { name: "Confirmar execução" })).toBeInTheDocument();
    expect(within(dialog).getByText("Reiniciar spooler")).toBeInTheDocument();
    expect(within(dialog).getByText("PC-FIN-01")).toBeInTheDocument();
    expect(within(dialog).getByText("até 600s")).toBeInTheDocument();
    const answers = [...dialog.querySelectorAll("dd")].map((node) => node.textContent);
    expect(answers).toEqual(["Reiniciar spooler", "Alto", "PC-FIN-01", "até 600s", "Sim", "Não"]);
    click(within(dialog).getByRole("button", { name: "Confirmar execução" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Script enfileirado. Aguardando execução pelo agente da máquina.", "success"));
    expect(api.useServiceOrderScript).toHaveBeenCalledWith("tok", "os-1", "sc2", { confirmed: true, riskAcknowledged: true });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(screen.getByText("Concluído com sucesso", { exact: false })).toBeInTheDocument());
  });

  it("execução de risco baixo não reconhece risco; erro mantém o diálogo e notifica", async () => {
    const { notify } = await renderReady();
    api.useServiceOrderScript.mockRejectedValueOnce(new Error("agente recusou"));
    click(screen.getAllByRole("button", { name: /Executar no agente/ })[0]);
    click(screen.getByRole("button", { name: "Confirmar execução" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("agente recusou", "danger"));
    expect(api.useServiceOrderScript).toHaveBeenCalledWith("tok", "os-1", "sc1", { confirmed: true, riskAcknowledged: false });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("mostra 'Enviando...' e bloqueia cancelamento durante o envio", async () => {
    await renderReady();
    let finish;
    api.useServiceOrderScript.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    click(screen.getAllByRole("button", { name: /Executar no agente/ })[0]);
    click(screen.getByRole("button", { name: "Confirmar execução" }));
    expect(screen.getByRole("button", { name: "Enviando..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    click(screen.getByRole("dialog").parentElement);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => finish({}));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("fecha a confirmação com clique no fundo e com Escape sem afetar o clique interno", async () => {
    await renderReady();
    click(screen.getAllByRole("button", { name: /Executar no agente/ })[0]);
    click(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    click(screen.getByRole("dialog").parentElement);
    expect(screen.queryByRole("dialog")).toBeNull();
    click(screen.getAllByRole("button", { name: /Executar no agente/ })[0]);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("registra simulação sem executar nada", async () => {
    const { notify } = await renderReady({ remoteScriptExecutionEnabled: false });
    click(screen.getAllByRole("button", { name: /Registrar simulação/ })[1]);
    const dialog = screen.getByRole("dialog", { name: "Confirmar simulação de script" });
    expect(within(dialog).getByText(/Nenhum comando será executado/)).toBeInTheDocument();
    expect(within(dialog).queryByText("Timeout")).toBeNull();
    click(within(dialog).getByRole("button", { name: "Confirmar simulação" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Simulação registrada. Nenhum comando foi executado.", "success"));
    expect(api.registerMaintenanceScriptSimulation).toHaveBeenCalledWith("tok", "sc2", {
      confirmed: true, riskAcknowledged: true, assetId: "dev-1", serviceOrderId: "os-1",
      notes: "Simulação registrada pela aba Scripts da OS OS-7."
    });
    expect(api.useServiceOrderScript).not.toHaveBeenCalled();
  });

  it("notifica falha na simulação", async () => {
    const { notify } = await renderReady({ remoteScriptExecutionEnabled: false });
    api.registerMaintenanceScriptSimulation.mockRejectedValue(new Error("sem permissão"));
    click(screen.getAllByRole("button", { name: /Registrar simulação/ })[0]);
    click(screen.getByRole("button", { name: "Confirmar simulação" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("sem permissão", "danger"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("lista a atividade com estados, saídas e indicador de execução", async () => {
    api.fetchServiceOrderScriptActivity.mockResolvedValue({
      activity: [
        { id: "a1", scriptName: "Limpar temp", job: { status: "queued" }, createdAt: "2026-08-12T10:00:00.000Z" },
        { id: "a2", status: "claimed", executedAt: "2026-08-12T11:00:00.000Z" },
        { id: "a3", scriptName: "Falhou", job: { status: "failed", stdout: "o".repeat(500), stderr: "erro", errorMessage: "boom" } },
        { id: "a4", scriptName: "Estranho", status: "weird" }
      ]
    });
    await renderReady();
    const items = document.querySelectorAll(".service-order-scripts-activity li");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Na fila, aguardando o agente");
    expect(items[0].querySelector(".pulse-dot")).toHaveClass("warning");
    expect(items[1]).toHaveTextContent("Script");
    expect(items[1].querySelector(".pulse-dot")).toHaveClass("ok");
    expect(items[2]).toHaveTextContent("Falhou");
    expect(items[2].querySelector(".service-order-script-output").textContent).toHaveLength(400);
    expect(items[2].querySelectorAll(".service-order-script-output.error")).toHaveLength(2);
    expect(items[3]).toHaveTextContent("weird");
    expect(items[3].querySelector(".pulse-dot")).toBeNull();
  });

  it("atualiza a atividade periodicamente enquanto há job ativo, até o limite", async () => {
    api.fetchServiceOrderScriptActivity.mockResolvedValue({ activity: [{ id: "a1", scriptName: "X", job: { status: "claimed" } }] });
    await renderReady();
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    // o intervalo é criado depois do carregamento; força nova montagem sob relógio falso
    cleanup();
    api.fetchServiceOrderScriptActivity.mockClear();
    renderTab();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await vi.waitFor(() => expect(screen.queryByText("Carregando scripts...")).toBeNull());
    api.fetchServiceOrderScriptActivity.mockClear();
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(api.fetchServiceOrderScriptActivity).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(5000 * 100); });
    expect(api.fetchServiceOrderScriptActivity).toHaveBeenCalledTimes(90);
  });

  it("não atualiza em loop sem job ativo e notifica falhas de carregamento", async () => {
    api.fetchServiceOrderScriptActivity.mockRejectedValue(new Error("atividade falhou"));
    const { notify } = await renderReady();
    expect(notify).toHaveBeenCalledWith("atividade falhou", "danger");
    expect(screen.queryByText("Nenhum script ativo cadastrado no catálogo.")).not.toBeNull();
  });

  it("não carrega nada sem token ou OS", async () => {
    renderTab({ token: undefined });
    expect(screen.getByText("Carregando scripts...")).toBeInTheDocument();
    expect(api.fetchServiceOrderScriptActivity).not.toHaveBeenCalled();
  });
});

function click(element) {
  fireEvent.click(element);
}
