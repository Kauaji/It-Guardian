import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AlertCenterV2 from "./AlertCenterV2.jsx";
import {
  baseDevices,
  baseInventoryTabs,
  baseSegmentGroups,
  baseSegments,
  baseSuggestions,
  loggedValidationWithLog,
  renderWithAlertCenter,
  restrictedUser
} from "./__fixtures__/alertCenterFixtures.jsx";

const api = vi.hoisted(() => ({
  fetchMaintenanceScriptRecommendations: vi.fn(),
  fetchPreventiveAutomationAgenda: vi.fn(),
  fetchPreventiveAutomationPlanHistory: vi.fn(),
  fetchSuggestionRecommendedScripts: vi.fn()
}));
vi.mock("../../api.js", () => api);
vi.mock("../maintenance/MaintenanceScriptsPanel.jsx", () => ({
  default: () => <div data-testid="maintenance-scripts-panel">Painel de scripts</div>
}));

function renderCenter({ props = {}, ...options } = {}) {
  return renderWithAlertCenter(
    <AlertCenterV2
      token="tok"
      devices={baseDevices}
      segments={baseSegments}
      segmentGroups={baseSegmentGroups}
      inventoryTabs={baseInventoryTabs}
      serviceOrders={[]}
      onOpenServiceOrders={vi.fn()}
      remoteScriptExecutionEnabled
      {...props}
    />,
    options
  );
}

function summaryValue(label) {
  const summary = document.querySelector(".alerts-summary");
  const card = within(summary).getByText(label).closest("article");
  return card.querySelector(".sr-only").textContent;
}

function suggestionCards() {
  return Array.from(document.querySelectorAll(".suggestion-card"));
}

beforeEach(() => {
  api.fetchMaintenanceScriptRecommendations.mockResolvedValue({ recommended: [], others: [] });
  api.fetchPreventiveAutomationAgenda.mockResolvedValue({ items: [], summary: {} });
  api.fetchPreventiveAutomationPlanHistory.mockResolvedValue({ items: [] });
  api.fetchSuggestionRecommendedScripts.mockResolvedValue({ recommended: [], others: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.values(api).forEach((mock) => mock.mockReset());
});

describe("AlertCenterV2 - aba de sugestões", () => {
  it("resume os avisos e lista uma sugestão consolidada por máquina, ordenada por prioridade", () => {
    renderCenter();

    expect(summaryValue("Avisos ativos")).toBe("2");
    expect(summaryValue("Críticos")).toBe("1");
    expect(summaryValue("Sugestões pendentes")).toBe("2");
    expect(summaryValue("OS criadas por aviso")).toBe("1");
    expect(summaryValue("Avisos recorrentes")).toBe("1");
    expect(summaryValue("Máquinas em risco")).toBe("2");

    const cards = suggestionCards();
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("CPU alta em PC-01")).toBeInTheDocument();
    expect(within(cards[0]).getByText("AVISO-2026-0001")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Matriz • Recepção")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Crítica")).toBeInTheDocument();
    expect(within(cards[0]).getByText("3x")).toBeInTheDocument();
    expect(within(cards[1]).getByText("RAM alta em PC-02")).toBeInTheDocument();
    expect(within(cards[1]).getByText("Média")).toBeInTheDocument();
  });

  it("mostra a central de avisos resumida com todos os avisos do histórico", () => {
    renderCenter();

    const compact = document.querySelector(".compact-alert-board");
    expect(within(compact).getByText("CPU acima do limite em PC-01")).toBeInTheDocument();
    expect(within(compact).getByText("PC-01 · 95%")).toBeInTheDocument();
    expect(within(compact).getAllByText("Resolvido")).toHaveLength(1);
    expect(within(compact).getByText("Disco acima do limite em Servidor-01")).toBeInTheDocument();
  });

  it("aplica filtros de severidade e status ao resumo de avisos", () => {
    renderCenter({ center: { severityFilter: "critical", statusFilter: "active" } });

    const compact = document.querySelector(".compact-alert-board");
    expect(within(compact).getByText("CPU acima do limite em PC-01")).toBeInTheDocument();
    expect(within(compact).queryByText("RAM acima do limite em PC-02")).toBeNull();
    expect(within(compact).queryByText("Disco acima do limite em Servidor-01")).toBeNull();
  });

  it("repassa a mudança de filtros para o contexto", () => {
    const { center } = renderCenter();
    const selects = document.querySelectorAll(".alerts-compact-panel select");

    fireEvent.change(selects[0], { target: { value: "critical" } });
    fireEvent.change(selects[1], { target: { value: "resolved" } });
    fireEvent.change(document.querySelector(".suggestions-panel select"), { target: { value: "pending" } });

    expect(center.setSeverityFilter).toHaveBeenCalledWith("critical");
    expect(center.setStatusFilter).toHaveBeenCalledWith("resolved");
    expect(center.setSuggestionStatusFilter).toHaveBeenCalledWith("pending");
  });

  it("filtra as sugestões pelo status recebido do contexto", () => {
    const suggestions = [
      ...baseSuggestions,
      { ...baseSuggestions[1], id: "sug5", status: "observed_persistent", assetId: "d3", hostName: "Servidor-01", title: "Verificação preventiva: RAM acima do limite em Servidor-01" }
    ];
    renderCenter({ center: { suggestions, suggestionStatusFilter: "observed_persistent" } });

    const cards = suggestionCards();
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getByText("RAM alta em Servidor-01")).toBeInTheDocument();
  });

  it("mostra mensagem vazia quando nenhuma sugestão passa nos filtros", () => {
    renderCenter({ center: { suggestions: [], history: [], alerts: [] } });

    expect(screen.getByText("Nenhuma sugestão encontrada para os filtros atuais.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum aviso encontrado para os filtros atuais.")).toBeInTheDocument();
  });

  it("aceita e recusa sugestões usando o id representativo", async () => {
    const user = userEvent.setup();
    const { center } = renderCenter();
    const [first, second] = suggestionCards();

    await user.click(within(first).getByRole("button", { name: "Criar Ordem de Serviço" }));
    await user.click(within(second).getByRole("button", { name: "Recusar" }));

    expect(center.onAcceptSuggestion).toHaveBeenCalledWith("sug1");
    expect(center.onRejectSuggestion).toHaveBeenCalledWith("sug2");
  });

  it("esconde ações de gestão para quem não pode gerenciar sugestões", () => {
    renderCenter({ user: restrictedUser(["alerts.view"]) });

    expect(screen.queryByRole("button", { name: "Criar Ordem de Serviço" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Recusar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Avaliar" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Ver detalhes do aviso" })).toHaveLength(2);
  });

  it("aciona a avaliação de recorrência", async () => {
    const user = userEvent.setup();
    const { center } = renderCenter();

    await user.click(screen.getByRole("button", { name: "Avaliar" }));

    expect(center.onEvaluateAlerts).toHaveBeenCalledTimes(1);
  });
});

describe("AlertCenterV2 - detalhes da sugestão", () => {
  it("abre o modal de detalhes com informações da máquina, do aviso e correlação", async () => {
    const user = userEvent.setup();
    renderCenter({
      center: {
        alertCorrelations: [{ correlationId: "c1", relatedHosts: ["PC-01"], relatedAlerts: [], confidenceLevel: "Alta", correlationSummary: "CPU em vários PCs" }]
      }
    });

    await user.click(within(suggestionCards()[0]).getByRole("button", { name: "Ver detalhes do aviso" }));

    const dialog = screen.getByRole("dialog", { name: "CPU alta em PC-01" });
    expect(within(dialog).getByText("Informações da máquina")).toBeInTheDocument();
    expect(within(dialog).getByText("10.0.0.1")).toBeInTheDocument();
    expect(within(dialog).getByText("Informações do aviso")).toBeInTheDocument();
    expect(within(dialog).getByText("95%")).toBeInTheDocument();
    expect(within(dialog).getByText("90%")).toBeInTheDocument();
    expect(within(dialog).getByText("CPU em vários PCs")).toBeInTheDocument();
    expect(within(dialog).getByText("Nenhum item de checklist cadastrado para este aviso.")).toBeInTheDocument();
    expect(within(dialog).getByText("Nenhum comentário registrado.")).toBeInTheDocument();
  });

  it("cria a OS pelo modal e fecha o diálogo", async () => {
    const user = userEvent.setup();
    const { center } = renderCenter();

    await user.click(within(suggestionCards()[0]).getByRole("button", { name: "Ver detalhes do aviso" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Criar OS" }));

    expect(center.onAcceptSuggestion).toHaveBeenCalledWith("sug1");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("recusa pelo modal e fecha o diálogo", async () => {
    const user = userEvent.setup();
    const { center } = renderCenter();

    await user.click(within(suggestionCards()[0]).getByRole("button", { name: "Ver detalhes do aviso" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Recusar" }));

    expect(center.onRejectSuggestion).toHaveBeenCalledWith("sug1");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("fecha o modal pelo botão Fechar e pelo botão do cabeçalho", async () => {
    const user = userEvent.setup();
    renderCenter();
    const trigger = () => within(suggestionCards()[0]).getByRole("button", { name: "Ver detalhes do aviso" });

    await user.click(trigger());
    await user.click(screen.getByRole("button", { name: "Fechar detalhes do aviso" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(trigger());
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("envia comentário interno e limpa o rascunho", async () => {
    const user = userEvent.setup();
    const { center } = renderCenter();

    await user.click(within(suggestionCards()[0]).getByRole("button", { name: "Ver detalhes do aviso" }));
    const input = screen.getByPlaceholderText("Adicionar comentário interno");
    await user.type(input, "  Verificar hoje  ");
    await user.click(screen.getByRole("button", { name: "Comentar" }));

    expect(center.onAddAlertComment).toHaveBeenCalledWith("al1", "Verificar hoje");
    await waitFor(() => expect(screen.getByPlaceholderText("Adicionar comentário interno")).toHaveValue(""));
  });

  it("não envia comentário vazio", async () => {
    const user = userEvent.setup();
    const { center } = renderCenter();

    await user.click(within(suggestionCards()[0]).getByRole("button", { name: "Ver detalhes do aviso" }));
    await user.click(screen.getByRole("button", { name: "Comentar" }));

    expect(center.onAddAlertComment).not.toHaveBeenCalled();
  });
});

describe("AlertCenterV2 - scripts da sugestão", () => {
  it("carrega recomendações ao abrir o menu e executa o script após confirmação", async () => {
    const user = userEvent.setup();
    api.fetchSuggestionRecommendedScripts.mockResolvedValue({
      recommended: [{ id: "sc1", name: "Limpar temporários", recommendationReason: "Disco cheio", riskLevel: "low" }],
      others: [{ id: "sc2", name: "Reiniciar spooler", estimatedSummary: "Reinicia serviço", riskLevel: "high" }]
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { center } = renderCenter();

    await user.click(within(suggestionCards()[0]).getByRole("button", { name: "Scripts disponíveis" }));

    expect(await screen.findByText("Recomendado")).toBeInTheDocument();
    expect(api.fetchSuggestionRecommendedScripts).toHaveBeenCalledWith("tok", "sug1");
    expect(screen.getByText("Outros scripts disponíveis")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Limpar temporários/ }));

    expect(confirm).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(center.onUseSuggestionScript).toHaveBeenCalledWith("sug1", "sc1", {
        mode: "agent",
        confirmed: true,
        riskAcknowledged: false,
        validationWindowMinutes: 30,
        // O codigo do aviso nesta nota hoje sai sem o indice do card (AVISO-2026-0NaN):
        // comportamento pre-existente, preservado pela refatoracao.
        notes: expect.stringMatching(/^Script solicitado pelo card AVISO-2026-0\w+ para execução via agente autenticado\.$/)
      })
    );
    await waitFor(() => expect(screen.queryByText("Recomendado")).toBeNull());
  });

  it("exige confirmação extra para script de risco alto", async () => {
    const user = userEvent.setup();
    api.fetchSuggestionRecommendedScripts.mockResolvedValue({
      recommended: [],
      others: [{ id: "sc2", name: "Reiniciar spooler", riskLevel: "high" }]
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { center } = renderCenter();

    await user.click(within(suggestionCards()[0]).getByRole("button", { name: "Scripts disponíveis" }));
    await user.click(await screen.findByRole("button", { name: /Reiniciar spooler/ }));

    expect(confirm).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(center.onUseSuggestionScript).toHaveBeenCalledWith("sug1", "sc2", expect.objectContaining({ riskAcknowledged: true }))
    );
  });

  it("não executa quando o usuário cancela a confirmação", async () => {
    const user = userEvent.setup();
    api.fetchSuggestionRecommendedScripts.mockResolvedValue({ recommended: [{ id: "sc1", name: "Limpar temporários" }], others: [] });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { center } = renderCenter();

    await user.click(within(suggestionCards()[0]).getByRole("button", { name: "Scripts disponíveis" }));
    await user.click(await screen.findByRole("button", { name: /Limpar temporários/ }));

    expect(center.onUseSuggestionScript).not.toHaveBeenCalled();
  });

  it("avisa quando a máquina não tem agente ativo", async () => {
    const user = userEvent.setup();
    api.fetchSuggestionRecommendedScripts.mockResolvedValue({ recommended: [{ id: "sc1", name: "Limpar temporários" }], others: [] });
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { center } = renderCenter({ props: { devices: baseDevices.map((device) => ({ ...device, source: undefined, agent: undefined })) } });

    await user.click(within(suggestionCards()[0]).getByRole("button", { name: "Scripts disponíveis" }));
    const option = await screen.findByRole("button", { name: /Limpar temporários/ });

    expect(option).toBeDisabled();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(center.onUseSuggestionScript).not.toHaveBeenCalled();
  });

  it("usa a lista de scripts ativos quando a busca de recomendações falha", async () => {
    const user = userEvent.setup();
    api.fetchSuggestionRecommendedScripts.mockRejectedValue(new Error("falhou"));
    renderCenter();

    await user.click(within(suggestionCards()[0]).getByRole("button", { name: "Scripts disponíveis" }));

    expect(await screen.findByText("Outros scripts disponíveis")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Limpar temporários/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Script antigo/ })).toBeNull();
  });

  it("explica que a execução real está desabilitada", async () => {
    const user = userEvent.setup();
    renderCenter({ props: { remoteScriptExecutionEnabled: false } });

    await user.click(within(suggestionCards()[0]).getByRole("button", { name: "Scripts disponíveis" }));

    expect(await screen.findByText(/Execução real desabilitada no servidor/)).toBeInTheDocument();
  });

  it("alterna o menu ao clicar novamente", async () => {
    const user = userEvent.setup();
    renderCenter();
    const trigger = () => within(suggestionCards()[0]).getByRole("button", { name: "Scripts disponíveis" });

    await user.click(trigger());
    expect(await screen.findByText("Nenhum script ativo cadastrado.")).toBeInTheDocument();
    await user.click(trigger());
    expect(screen.queryByText("Nenhum script ativo cadastrado.")).toBeNull();
  });
});

describe("AlertCenterV2 - log de script", () => {
  const suggestionsWithLog = baseSuggestions.map((suggestion) =>
    suggestion.id === "sug1" ? { ...suggestion, latestValidation: loggedValidationWithLog } : suggestion
  );

  it("abre o log pelo card, mostra detalhes e marca como analisado", async () => {
    const user = userEvent.setup();
    const { center } = renderCenter({ center: { suggestions: suggestionsWithLog } });

    await user.click(within(suggestionCards()[0]).getByRole("button", { name: "Ver log do script" }));

    const dialog = screen.getByRole("dialog", { name: "Limpar temporários" });
    expect(within(dialog).getByText("Falha ao limpar pasta.")).toBeInTheDocument();
    expect(within(dialog).getByText("Pasta em uso.")).toBeInTheDocument();
    expect(within(dialog).getByText("Fechar o processo e repetir.")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Marcar como analisado" }));

    expect(center.onAcknowledgeScriptLog).toHaveBeenCalledWith("log1");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("registra a solução sugerida somente após confirmação", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { center } = renderCenter({ center: { suggestions: suggestionsWithLog } });

    await user.click(within(suggestionCards()[0]).getByRole("button", { name: "Ver log do script" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Registrar solução sugerida" }));
    expect(center.onApplyScriptLogSuggestedSolution).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Registrar solução sugerida" }));

    expect(confirm).toHaveBeenCalledTimes(2);
    expect(center.onApplyScriptLogSuggestedSolution).toHaveBeenCalledWith("log1", { notes: "Fechar o processo e repetir." });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("registra solução própria com as notas digitadas", async () => {
    const user = userEvent.setup();
    const { center } = renderCenter({ center: { suggestions: suggestionsWithLog } });

    await user.click(within(suggestionCards()[0]).getByRole("button", { name: "Ver log do script" }));
    await user.type(screen.getByPlaceholderText(/Descreva a correção/), "Reiniciei o serviço");
    await user.click(screen.getByRole("button", { name: "Registrar solução própria" }));

    expect(center.onApplyScriptLogSuggestedSolution).toHaveBeenCalledWith("log1", { notes: "Reiniciei o serviço" });
  });

  it("cancela a análise pela validação associada", async () => {
    const user = userEvent.setup();
    const { center } = renderCenter({ center: { suggestions: suggestionsWithLog } });

    await user.click(within(suggestionCards()[0]).getByRole("button", { name: "Ver log do script" }));
    await user.click(screen.getByRole("button", { name: "Cancelar análise" }));

    expect(center.onCancelScriptValidation).toHaveBeenCalledWith("val1");
  });

  it("abre o log mais recente pelo botão da barra de abas", async () => {
    const user = userEvent.setup();
    renderCenter({ center: { suggestions: suggestionsWithLog } });

    await user.click(screen.getByRole("button", { name: "Abrir tela de log" }));

    expect(screen.getByRole("dialog", { name: "Limpar temporários" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar solução própria" })).not.toBeNull();
  });

  it("avisa quando não existe log disponível", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    renderCenter();

    await user.click(screen.getByRole("button", { name: "Abrir tela de log" }));

    expect(alertSpy).toHaveBeenCalledWith("Nenhum log de script disponível.");
  });
});

describe("AlertCenterV2 - configurações", () => {
  async function openSettings(options) {
    const user = userEvent.setup();
    const rendered = renderCenter(options);
    await user.click(screen.getByRole("button", { name: "Configurações de aviso" }));
    return { user, dialog: screen.getByRole("dialog", { name: "Configurações de aviso" }), ...rendered };
  }

  it("abre o modal com as seções recolhidas e expande a de regras", async () => {
    const { user, dialog } = await openSettings();

    expect(within(dialog).getByText("Regras de aviso")).toBeInTheDocument();
    expect(within(dialog).queryByText("Ignorar aviso recusado por (horas)")).toBeNull();

    await user.click(within(dialog).getByText("Regras de aviso"));

    expect(within(dialog).getByText("Ignorar aviso recusado por (horas)")).toBeInTheDocument();
    expect(within(dialog).getByText("Limite")).toBeInTheDocument();
  });

  it("salva as janelas operacionais normalizadas", async () => {
    const { user, dialog, center } = await openSettings();

    await user.click(within(dialog).getByText("Regras de aviso"));
    const silence = within(dialog).getByLabelText(/Ignorar aviso recusado por/);
    fireEvent.change(silence, { target: { value: "12" } });
    fireEvent.change(within(dialog).getByLabelText(/Validacao de script/), { target: { value: "1" } });
    await user.click(within(dialog).getByRole("button", { name: "Salvar janelas" }));

    await waitFor(() => expect(center.onSaveAlertPrioritySettings).toHaveBeenCalledTimes(1));
    expect(center.onSaveAlertPrioritySettings).toHaveBeenCalledWith(
      expect.objectContaining({ rejectedAlertSilenceHours: 12, scriptValidationWindowMinutes: 5, preventiveDueDays: 180 })
    );
  });

  it("edita regras e repassa a alteração ao contexto", async () => {
    const { user, dialog, center } = await openSettings();

    await user.click(within(dialog).getByText("Regras de aviso"));
    const rows = dialog.querySelectorAll(".alert-rule-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("CPU acima do limite")).toBeInTheDocument();

    fireEvent.change(within(rows[0]).getAllByRole("spinbutton")[0], { target: { value: "85" } });
    await user.click(within(rows[1]).getByRole("checkbox"));
    fireEvent.change(within(rows[0]).getAllByRole("combobox")[1], { target: { value: "low" } });

    expect(center.onUpdateRule).toHaveBeenCalledWith("r-cpu", { threshold: "85" });
    expect(center.onUpdateRule).toHaveBeenCalledWith("r-off", { enabled: true });
    expect(center.onUpdateRule).toHaveBeenCalledWith("r-cpu", { suggestedPriority: "low" });
    expect(within(rows[1]).getAllByRole("spinbutton")[0]).toBeDisabled();
  });

  it("edita prioridades, cores e salva o rascunho", async () => {
    const { user, dialog, center } = await openSettings();

    await user.click(within(dialog).getByText("Prioridade"));
    fireEvent.change(within(dialog).getByLabelText("Baixa para Média (horas)"), { target: { value: "10" } });
    await user.click(within(dialog).getByLabelText("Ativar mudança automática de prioridade"));
    await user.click(within(dialog).getByRole("button", { name: "Cores" }));
    fireEvent.change(within(dialog).getByLabelText("Cor da prioridade Alta"), { target: { value: "#112233" } });
    await user.click(within(dialog).getByRole("button", { name: "Padrão" }));
    expect(within(dialog).getByLabelText("Cor da prioridade Alta")).toHaveValue("#ea580c");
    await user.click(within(dialog).getByRole("button", { name: "Ocultar cores" }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar prioridade" }));

    await waitFor(() => expect(center.onSaveAlertPrioritySettings).toHaveBeenCalledTimes(1));
    const saved = center.onSaveAlertPrioritySettings.mock.calls[0][0];
    expect(saved.autoPriority).toEqual({ enabled: true, lowToMediumHours: "10", mediumToHighHours: 48, highToCriticalHours: 72 });
    expect(saved.priorityColors.high).toBe("#ea580c");
  });

  it("renderiza o painel de scripts quando a seção é aberta", async () => {
    const { user, dialog } = await openSettings();

    expect(screen.queryByTestId("maintenance-scripts-panel")).toBeNull();
    await user.click(within(dialog).getByText("Scripts de manutenção"));

    expect(screen.getByTestId("maintenance-scripts-panel")).toBeInTheDocument();
  });

  it("fecha o modal pelo botão de fechar", async () => {
    const { user, dialog } = await openSettings();

    await user.click(within(dialog).getAllByRole("button").find((button) => button.classList.contains("icon-button")));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("não oferece configurações para quem não tem permissão", () => {
    renderCenter({ user: restrictedUser(["alerts.view"]) });

    expect(screen.queryByRole("button", { name: "Configurações de aviso" })).toBeNull();
  });

  it("desabilita campos quando o usuário só pode ver scripts", async () => {
    const user = userEvent.setup();
    renderCenter({ user: restrictedUser(["alerts.view", "scripts.view", "scripts.manage"]) });

    await user.click(screen.getByRole("button", { name: "Configurações de aviso" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("Regras de aviso"));

    expect(within(dialog).getByLabelText(/Ignorar aviso recusado por/)).toBeDisabled();
  });
});

describe("AlertCenterV2 - navegação por abas e permissões", () => {
  it("só mostra as abas permitidas e começa em Preventivas sem permissão de avisos", () => {
    renderCenter({ user: restrictedUser(["preventive_plans.view"]) });

    const nav = screen.getByRole("navigation", { name: "Áreas da Central de Avisos" });
    expect(within(nav).queryByRole("button", { name: "Sugestões de OS" })).toBeNull();
    expect(within(nav).getByRole("button", { name: "Preventivas" })).toBeInTheDocument();
    expect(within(nav).queryByRole("button", { name: "Automatizações" })).toBeNull();
    expect(screen.getByRole("region", { name: "Resumo preventivo" })).toBeInTheDocument();
  });

  it("renderiza vazio quando o usuário não vê nenhuma área", () => {
    const { container } = renderCenter({ user: restrictedUser(["dashboard.view"]) });

    expect(container.querySelector(".alerts-view-v2")).toBeEmptyDOMElement();
  });

  it("mostra Automatizações somente com permissão e planos cadastrados", async () => {
    const user = userEvent.setup();
    const management = {
      plans: [{ id: "ap1", name: "Limpeza mensal", active: true, indicatorColor: "#2563eb", assetCount: 1, scriptCount: 1 }],
      machines: [{ assetId: "d1", assetName: "PC-01", plans: [{ id: "ap1", planName: "Limpeza mensal", active: true, nextRunAt: "2026-07-01T10:00:00.000Z" }] }],
      metadata: { planCount: 1, machineCount: 1 }
    };
    renderCenter({ center: { preventiveAutomationManagement: management, preventiveAutomationPlans: management.plans } });

    await user.click(screen.getByRole("button", { name: "Automatizações" }));

    expect(await screen.findByRole("heading", { name: "Automatizações" })).toBeInTheDocument();
    expect(await screen.findByText("PC-01")).toBeInTheDocument();
    expect(screen.queryByText("Sugestões de OS", { selector: "h2" })).toBeNull();
  });

  it("volta para Preventivas quando a aba de automação perde o sentido", async () => {
    const user = userEvent.setup();
    const management = { plans: [{ id: "ap1", name: "Plano", active: true }], machines: [], metadata: { planCount: 1, machineCount: 0 } };
    const view = renderCenter({ center: { preventiveAutomationManagement: management, preventiveAutomationPlans: management.plans } });

    await user.click(screen.getByRole("button", { name: "Automatizações" }));
    expect(await screen.findByRole("heading", { name: "Automatizações" })).toBeInTheDocument();

    view.rerenderWithCenter({
      preventiveAutomationManagement: { plans: [], machines: [], metadata: { planCount: 0, machineCount: 0 } },
      preventiveAutomationPlans: []
    });

    await waitFor(() => expect(screen.queryByRole("button", { name: "Automatizações" })).toBeNull());
    expect(screen.getByRole("heading", { name: "Preventivas" })).toBeInTheDocument();
  });
});
