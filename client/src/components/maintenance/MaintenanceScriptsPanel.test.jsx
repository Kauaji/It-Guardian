import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MaintenanceScriptsPanel from "./MaintenanceScriptsPanel.jsx";

const scripts = [
  {
    id: "s1",
    name: "Limpar disco",
    type: "powershell",
    category: "Disco",
    riskLevel: "high",
    description: "Remove temporarios",
    estimatedSummary: "Apaga arquivos temporarios",
    content: "Remove-Item $env:TEMP\\*",
    alertType: "disk_usage",
    problemType: "Disco cheio",
    tags: ["disco", "limpeza"],
    supportedVariables: ["{{hostname}}", "ip"],
    active: true
  },
  { id: "s2", name: "Reiniciar spooler", type: "cmd", riskLevel: "low", content: "net stop spooler", active: true },
  { id: "s3", name: "Antigo", type: "cmd", riskLevel: "low", content: "x", active: false }
];
const devices = [{ id: "d1", name: "PC-01", ip: "10.0.0.5" }, { id: "d2", name: "PC-02" }];
const serviceOrders = [{ id: "o1", number: "OS-1", title: "Trocar HD" }];
const alerts = [{ id: "a1", title: "Disco cheio", hostName: "PC-01" }, { id: "a2", title: "Sem ping" }];

const analysisResult = {
  estimatedSummary: "Limpa a pasta temporaria",
  suggestedRiskLevel: "medium",
  detectedActions: ["Remover temporarios"],
  detectedVariables: ["hostname"],
  allowedVariables: [{ name: "hostname" }, { name: "ip" }],
  unknownVariables: ["foo"],
  safePreview: "preview",
  variableValidationStatus: "warning",
  safetyWarnings: ["Revise antes.", "Cuidado."]
};

let handlers;

function mount(props = {}) {
  handlers = {
    onAnalyze: vi.fn().mockResolvedValue(analysisResult),
    onSave: vi.fn().mockResolvedValue(),
    onDeactivate: vi.fn().mockResolvedValue(),
    onRegisterSimulation: vi.fn().mockResolvedValue()
  };
  render(
    <MaintenanceScriptsPanel
      scripts={scripts}
      devices={devices}
      serviceOrders={serviceOrders}
      alerts={alerts}
      canManage
      canRegisterSimulation
      {...handlers}
      {...props}
    />
  );
  return userEvent.setup();
}

beforeEach(() => {
  window.requestAnimationFrame = (cb) => { cb(); return 0; };
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MaintenanceScriptsPanel - lista", () => {
  it("mostra cabecalho, aviso de seguranca e apenas scripts ativos", () => {
    mount();
    expect(screen.getByRole("heading", { name: "Scripts de manutenção" })).toBeInTheDocument();
    expect(screen.getByText(/Execução real indisponível nesta versão/)).toBeInTheDocument();
    expect(screen.getByText("Limpar disco")).toBeInTheDocument();
    expect(screen.getByText("Reiniciar spooler")).toBeInTheDocument();
    expect(screen.queryByText("Antigo")).not.toBeInTheDocument();
    expect(screen.getByText("PowerShell - Disco")).toBeInTheDocument();
    expect(screen.getByText("CMD - Sem categoria")).toBeInTheDocument();
    expect(screen.getByText("Alto", { selector: ".script-risk-pill" })).toBeInTheDocument();
    expect(screen.getByText("Remove temporarios")).toBeInTheDocument();
    expect(screen.getByText("Apaga arquivos temporarios")).toBeInTheDocument();
    expect(screen.getByText("Resumo não informado.")).toBeInTheDocument();
    expect(screen.getByText("Aviso: disk_usage")).toBeInTheDocument();
    expect(screen.getByText("Problema: Disco cheio")).toBeInTheDocument();
    expect(screen.getByText("#disco")).toBeInTheDocument();
    expect(screen.getByText("Variáveis: {{hostname}}, {{ip}}")).toBeInTheDocument();
  });

  it("flags de exibicao escondem partes e sem scripts mostra o vazio", () => {
    mount({ scripts: [], showHeader: false, showSafetyBanner: false, showForm: false, compact: true });
    expect(screen.queryByRole("heading", { name: "Scripts de manutenção" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Execução real indisponível/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhum script de manutenção ativo cadastrado.")).toBeInTheDocument();
    expect(document.querySelector(".maintenance-scripts-panel.compact")).not.toBeNull();
  });

  it("sem permissao nao mostra formulario, edicao nem simulacao", () => {
    mount({ canManage: false, canRegisterSimulation: false });
    expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Registrar simulação/ })).not.toBeInTheDocument();
  });

  it("showSimulation=false esconde o formulario de simulacao", () => {
    mount({ showSimulation: false });
    expect(screen.queryByRole("button", { name: /Registrar simulação/ })).not.toBeInTheDocument();
  });
});

describe("MaintenanceScriptsPanel - cadastro", () => {
  it("analisa o texto, preenche campos inferidos e mostra o resumo", async () => {
    const user = mount();
    const prompt = screen.getByLabelText("Prompt do script");
    expect(screen.queryByRole("button", { name: "Cadastrar script" })).not.toBeInTheDocument();
    await user.type(prompt, "Get-Process | Stop-Process disco");
    await user.click(screen.getByRole("button", { name: "Analisar texto" }));
    await waitFor(() => expect(handlers.onAnalyze).toHaveBeenCalledWith({ content: "Get-Process | Stop-Process disco", type: "powershell" }));

    expect(await screen.findByText("Limpa a pasta temporaria", { selector: ".script-analysis-box p" })).toBeInTheDocument();
    expect(screen.getByText("Risco sugerido: Médio")).toBeInTheDocument();
    expect(screen.getByText("hostname, ip")).toBeInTheDocument();
    expect(screen.getByText("foo")).toBeInTheDocument();
    expect(screen.getByText("Remover temporarios", { selector: "li" })).toBeInTheDocument();
    expect(screen.getByText("Revise antes. Cuidado.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Remover temporarios");
    expect(screen.getByLabelText("Descrição")).toHaveValue("Limpa a pasta temporaria");
    expect(screen.getByLabelText("Categoria")).toHaveValue("Disco");
    expect(screen.getByLabelText("Tipo de aviso")).toHaveValue("disco");
    expect(screen.getByLabelText("Tipo de problema")).toHaveValue("Remover temporarios");
    expect(screen.getByLabelText("Risco")).toHaveValue("medium");
    expect(screen.getByLabelText("Tipo")).toHaveValue("powershell");
    expect(screen.getByRole("button", { name: "Cadastrar script" })).toBeInTheDocument();
  });

  it("nao sobrescreve campos ja preenchidos e infere tipo e categorias de outros textos", async () => {
    handlers = null;
    const user = mount();
    handlers.onAnalyze.mockResolvedValue({ estimatedSummary: "", detectedActions: [] });
    await user.type(screen.getByLabelText("Nome"), "Meu nome");
    await user.type(screen.getByLabelText("Categoria"), "Minha");
    await user.type(screen.getByLabelText("Prompt do script"), "ping 8.8.8.8");
    await user.click(screen.getByRole("button", { name: "Analisar texto" }));
    await waitFor(() => expect(screen.getByLabelText("Tipo de aviso")).toHaveValue("rede"));
    expect(screen.getByLabelText("Nome")).toHaveValue("Meu nome");
    expect(screen.getByLabelText("Categoria")).toHaveValue("Minha");
    expect(screen.getByLabelText("Tipo")).toHaveValue("cmd");
    expect(screen.getByLabelText("Tipo de problema")).toHaveValue("ping 8.8.8.8");
    expect(screen.getByLabelText("Risco")).toHaveValue("medium");
  });

  it("infere categorias Rede, Impressora, Memoria e Manutencao e nome pela primeira linha", async () => {
    const user = mount();
    handlers.onAnalyze.mockResolvedValue({});
    const cases = [
      ["rem Teste de rede\nipconfig /all", "Rede"],
      ["echo printer reset", "Impressora"],
      ["echo ram clean", "Memória"],
      ["echo oi", "Manutenção"]
    ];
    for (const [content, category] of cases) {
      await user.click(screen.getByRole("button", { name: "Limpar" }));
      const prompt = screen.getByLabelText("Prompt do script");
      await user.click(prompt);
      await user.paste(content);
      await user.click(screen.getByRole("button", { name: "Analisar texto" }));
      await waitFor(() => expect(screen.getByLabelText("Categoria")).toHaveValue(category));
    }
    expect(screen.getByLabelText("Nome")).toHaveValue("echo oi");
  });

  it("nome padrao quando o texto e vazio de linhas uteis", async () => {
    const user = mount();
    handlers.onAnalyze.mockResolvedValue({});
    await user.click(screen.getByLabelText("Prompt do script"));
    await user.paste("::   \n\nrem ");
    await user.click(screen.getByRole("button", { name: "Analisar texto" }));
    await waitFor(() => expect(screen.getByLabelText("Nome")).toHaveValue("Script de manutenção"));
  });

  it("enviar sem analise analisa antes, confirma e salva com payload completo e limpa", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = mount();
    await user.type(screen.getByLabelText("Prompt do script"), "Get-Date");
    await user.type(screen.getByLabelText("Tags"), " a, b ,,c");
    await user.type(screen.getByLabelText("Tipos de aviso relacionados"), "x,y");
    await user.type(screen.getByLabelText("Tipos de problema relacionados"), "p");
    await user.type(screen.getByLabelText("Categorias recomendadas"), "Rede");
    await user.click(screen.getByLabelText("Requer usuário logado"));
    await user.click(screen.getByLabelText("Requer administrador"));
    await user.click(screen.getByLabelText("Exige confirmação"));
    await user.type(screen.getByLabelText("Nome"), "N");
    // sem analise previa nao ha botao de envio: o envio programatico analisa antes de salvar
    fireEvent.submit(document.querySelector(".maintenance-script-form"));
    await waitFor(() => expect(handlers.onSave).toHaveBeenCalled());
    const [payload, editingId] = handlers.onSave.mock.calls[0];
    expect(editingId).toBeNull();
    expect(payload).toMatchObject({
      name: "N",
      type: "powershell",
      content: "Get-Date",
      tags: ["a", "b", "c"],
      relatedAlertTypes: ["x", "y"],
      relatedProblemTypes: ["p"],
      recommendedForCategories: ["Rede"],
      requiresLoggedUser: true,
      requiresAdmin: true,
      requiresConfirmation: false,
      supportedVariables: ["hostname"],
      safePreview: "preview",
      variableValidationStatus: "warning",
      estimatedSummary: "Limpa a pasta temporaria",
      suggestedRiskLevel: "medium"
    });
    await waitFor(() => expect(screen.getByLabelText("Prompt do script")).toHaveValue(""));
  });

  it("cancelar a confirmacao nao salva; editar o texto invalida a analise", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = mount();
    await user.type(screen.getByLabelText("Prompt do script"), "dir");
    await user.click(screen.getByRole("button", { name: "Analisar texto" }));
    await screen.findByRole("button", { name: "Cadastrar script" });
    await user.click(screen.getByRole("button", { name: "Cadastrar script" }));
    expect(window.confirm).toHaveBeenCalledWith("Deseja cadastrar este script com este resumo estimado?");
    expect(handlers.onSave).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Prompt do script"), "x");
    expect(screen.queryByRole("button", { name: "Cadastrar script" })).not.toBeInTheDocument();
  });

  it("erro ao salvar mantem o formulario; erro ao analisar nao quebra", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = mount();
    handlers.onSave.mockRejectedValue(new Error("falhou"));
    await user.type(screen.getByLabelText("Nome"), "N");
    await user.type(screen.getByLabelText("Prompt do script"), "dir");
    await user.click(screen.getByRole("button", { name: "Analisar texto" }));
    await user.click(await screen.findByRole("button", { name: "Cadastrar script" }));
    await waitFor(() => expect(handlers.onSave).toHaveBeenCalled());
    expect(screen.getByLabelText("Prompt do script")).toHaveValue("dir");

    handlers.onAnalyze.mockRejectedValue(new Error("analise fora"));
    await user.type(screen.getByLabelText("Prompt do script"), "!");
    await user.click(screen.getByRole("button", { name: "Analisar texto" }));
    await waitFor(() => expect(handlers.onAnalyze).toHaveBeenCalledTimes(2));
  });

  it("erro na analise ao enviar o formulario e ignorado", async () => {
    const user = mount();
    handlers.onAnalyze.mockRejectedValue(new Error("x"));
    await user.type(screen.getByLabelText("Nome"), "N");
    await user.type(screen.getByLabelText("Prompt do script"), "dir");
    fireEvent.submit(document.querySelector(".maintenance-script-form"));
    await waitFor(() => expect(handlers.onAnalyze).toHaveBeenCalled());
    expect(handlers.onSave).not.toHaveBeenCalled();
  });
});

describe("MaintenanceScriptsPanel - edicao e desativacao", () => {
  it("editar carrega o script no formulario com o resumo salvo e salva com o id", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = mount();
    const card = screen.getByText("Limpar disco").closest("article");
    await user.click(within(card).getByRole("button", { name: "Editar" }));
    expect(screen.getByLabelText("Nome")).toHaveValue("Limpar disco");
    expect(screen.getByLabelText("Tags")).toHaveValue("disco, limpeza");
    expect(screen.getByLabelText("Tipo")).toHaveValue("powershell");
    expect(screen.getByText("Resumo salvo anteriormente. Revise manualmente antes de usar.")).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(handlers.onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "Limpar disco", tags: ["disco", "limpeza"] }), "s1"));
  });

  it("editar script minimo usa padroes (tipo other, risco medio)", async () => {
    const user = mount({ scripts: [{ id: "m", name: "", content: "", active: true }] });
    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByLabelText("Risco")).toHaveValue("medium");
    expect(screen.getByLabelText("Exige confirmação")).toBeChecked();
    expect(screen.getByLabelText("Requer administrador")).not.toBeChecked();
  });

  it("desativar pede confirmacao; erro e ignorado", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
    const user = mount();
    const card = screen.getByText("Limpar disco").closest("article");
    await user.click(within(card).getByRole("button", { name: "Desativar" }));
    expect(handlers.onDeactivate).not.toHaveBeenCalled();
    await user.click(within(card).getByRole("button", { name: "Desativar" }));
    expect(confirm).toHaveBeenCalledWith('Desativar o script "Limpar disco"?');
    await waitFor(() => expect(handlers.onDeactivate).toHaveBeenCalledWith("s1"));
    handlers.onDeactivate.mockRejectedValue(new Error("x"));
    await user.click(within(card).getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(handlers.onDeactivate).toHaveBeenCalledTimes(2));
  });
});

describe("MaintenanceScriptsPanel - simulacao", () => {
  it("lista opcoes de maquina, OS e aviso e registra com confirmacao", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = mount();
    const card = screen.getByText("Reiniciar spooler").closest("article");
    const form = within(card);
    expect(form.getByRole("option", { name: "PC-01 - 10.0.0.5" })).toBeInTheDocument();
    expect(form.getByRole("option", { name: "PC-02 - sem IP" })).toBeInTheDocument();
    expect(form.getByRole("option", { name: "OS-1 - Trocar HD" })).toBeInTheDocument();
    expect(form.getByRole("option", { name: "Disco cheio - PC-01" })).toBeInTheDocument();
    expect(form.getByRole("option", { name: "Sem ping - sem máquina" })).toBeInTheDocument();

    await user.selectOptions(form.getByLabelText("Máquina"), "d1");
    await user.selectOptions(form.getByLabelText("Ordem de Serviço"), "o1");
    await user.selectOptions(form.getByLabelText("Aviso"), "a1");
    await user.selectOptions(form.getByLabelText("Modo"), "prepared");
    await user.type(form.getByLabelText("Observação"), "teste");
    await user.click(form.getByRole("button", { name: /Registrar simulação/ }));
    await waitFor(() => expect(handlers.onRegisterSimulation).toHaveBeenCalled());
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(handlers.onRegisterSimulation).toHaveBeenCalledWith("s2", {
      assetId: "d1", serviceOrderId: "o1", alertId: "a1", mode: "prepared", notes: "teste", confirmed: true, riskAcknowledged: false
    });
    await waitFor(() => expect(form.getByLabelText("Observação")).toHaveValue(""));
  });

  it("script de alto risco exige a segunda confirmacao", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(true).mockReturnValueOnce(false).mockReturnValue(true);
    const user = mount();
    const card = screen.getByText("Limpar disco").closest("article");
    const form = within(card).getByRole("button", { name: /Registrar simulação/ });
    await user.click(form);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(handlers.onRegisterSimulation).not.toHaveBeenCalled();
    await user.click(form);
    await waitFor(() => expect(handlers.onRegisterSimulation).toHaveBeenCalledWith("s1", expect.objectContaining({ riskAcknowledged: true })));
  });

  it("cancelar a primeira confirmacao nao registra; erro no registro e ignorado e preserva a observacao", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
    const user = mount();
    const card = within(screen.getByText("Reiniciar spooler").closest("article"));
    await user.type(card.getByLabelText("Observação"), "nota");
    await user.click(card.getByRole("button", { name: /Registrar simulação/ }));
    expect(handlers.onRegisterSimulation).not.toHaveBeenCalled();
    handlers.onRegisterSimulation.mockRejectedValue(new Error("x"));
    await user.click(card.getByRole("button", { name: /Registrar simulação/ }));
    await waitFor(() => expect(handlers.onRegisterSimulation).toHaveBeenCalled());
    expect(card.getByLabelText("Observação")).toHaveValue("nota");
  });
});
