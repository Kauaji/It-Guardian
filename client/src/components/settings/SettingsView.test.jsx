import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api.js", () => {
  const names = [
    "createClient",
    "createPriorityRule",
    "createProblemType",
    "createProduct",
    "createService",
    "createTechnician",
    "deleteClient",
    "deletePriorityRule",
    "deleteProblemType",
    "deleteProduct",
    "deleteService",
    "deleteTechnician",
    "fetchClients",
    "fetchPriorityRules",
    "fetchProblemTypes",
    "fetchProducts",
    "fetchServices",
    "fetchTechnicians",
    "importClients",
    "importProducts",
    "updateClient",
    "updatePriorityRule",
    "updateProblemType",
    "updateProduct",
    "updateService",
    "updateTechnician"
  ];
  return Object.fromEntries(names.map((name) => [name, vi.fn()]));
});

import * as api from "../../api.js";
import SettingsView from "./SettingsView.jsx";

const clientsFixture = [
  { id: "c1", tradeName: "Acme", document: "11.222.333/0001-44", phone: "1111", contactName: "Ana", active: true, email: "a@acme.com" },
  { id: "c2", tradeName: "Beta Ltda", document: "", phone: "", contactName: "", active: false }
];

let notify;

function mount(props = {}) {
  notify = vi.fn();
  render(<SettingsView token="tok" notify={notify} {...props} />);
  return userEvent.setup();
}

beforeEach(() => {
  api.fetchClients.mockResolvedValue({ clients: clientsFixture });
  api.fetchProducts.mockResolvedValue({
    products: [
      { id: "p1", name: "SSD 240", category: "Armazenamento", internalCode: "SSD", assetTag: "PAT-1", quantity: 3, unitPrice: 199.9 }
    ]
  });
  api.fetchServices.mockResolvedValue({
    services: [{ id: "s1", code: "FMT", name: "Formatação", category: "Software", defaultPriority: "high", defaultValue: 80, active: true }]
  });
  api.fetchTechnicians.mockResolvedValue({
    technicians: [{ id: "t1", name: "Carlos", email: "c@x.com", phone: "2222", specialty: "Redes", active: true }]
  });
  api.fetchProblemTypes.mockResolvedValue({ problemTypes: [{ id: "pt1", name: "Não liga", category: "Computador", defaultPriority: "" }] });
  api.fetchPriorityRules.mockResolvedValue({
    priorityRules: [{ id: "r1", name: "VIP", ruleType: "client", targetValue: "Acme", priority: "critical", active: true }]
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("SettingsView - listagem e navegacao", () => {
  it("abre em Clientes com cabecalho, abas, colunas e celulas formatadas", async () => {
    mount();
    expect(screen.getByRole("heading", { name: "Configurações" })).toBeInTheDocument();
    expect(screen.getByText(/Modo Local ativo/)).toBeInTheDocument();
    await screen.findByText("Acme");
    expect(api.fetchClients).toHaveBeenCalledWith("tok", { search: "" });
    const head = document.querySelector(".settings-table-head");
    expect(
      Array.from(head.querySelectorAll("span"))
        .map((s) => s.textContent)
        .filter(Boolean)
    ).toEqual(["Cliente", "CNPJ", "Telefone", "Responsável", "Status"]);
    expect(head.style.gridTemplateColumns).toBe("repeat(5, minmax(120px, 1fr)) 120px");
    expect(screen.getByText("Ativo")).toHaveClass("settings-status", "active");
    expect(screen.getByText("Inativo")).toHaveClass("settings-status", "inactive");
    expect(screen.getAllByText("Não informado").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Importar/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo cliente" })).toBeInTheDocument();
  });

  it("modo business muda o texto do cabecalho", async () => {
    mount({ systemMode: "business" });
    expect(screen.getByText(/Modo Business ativo/)).toBeInTheDocument();
    await screen.findByText("Acme");
  });

  it("hideHero e hideTabs escondem cabecalho e abas", async () => {
    mount({ hideHero: true, hideTabs: true });
    await screen.findByText("Acme");
    expect(screen.queryByRole("heading", { name: "Configurações" })).not.toBeInTheDocument();
    expect(document.querySelector(".settings-tabs")).toBeNull();
  });

  it("percorre as seis abas carregando cada cadastro", async () => {
    const user = mount();
    await screen.findByText("Acme");

    await user.click(screen.getByRole("button", { name: "Peças" }));
    await screen.findByText("SSD 240");
    expect(api.fetchProducts).toHaveBeenCalled();
    expect(screen.getByText("PAT-1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Serviços" }));
    await screen.findByText("Formatação");
    expect(screen.getByText("Alta")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Importar/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Técnicos" }));
    await screen.findByText("Carlos");

    await user.click(screen.getByRole("button", { name: "Tipos de Problema" }));
    await screen.findByText("Não liga");
    expect(screen.getByText("Sem prioridade padrão")).toBeInTheDocument();
    expect(screen.getByText("Computador")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Regras de Prioridade" }));
    await screen.findByText("VIP");
    expect(screen.getByText("Prioridade por cliente")).toBeInTheDocument();
    expect(screen.getByText("Crítica")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Buscar regras de prioridade" })).toBeInTheDocument();
  });

  it("modo business mostra valor em reais e esconde o patrimonio", async () => {
    const user = mount({ systemMode: "business" });
    await screen.findByText("Acme");
    await user.click(screen.getByRole("button", { name: "Peças" }));
    await screen.findByText("SSD 240");
    expect(screen.getByText(/R\$\s199,90/)).toBeInTheDocument();
    expect(screen.queryByText("PAT-1")).not.toBeInTheDocument();
  });

  it("busca filtra localmente e limpa ao trocar de aba", async () => {
    const user = mount();
    await screen.findByText("Acme");
    await user.type(screen.getByRole("textbox", { name: "Buscar clientes" }), "beta");
    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
    expect(screen.getByText("Beta Ltda")).toBeInTheDocument();
    await user.clear(screen.getByRole("textbox", { name: "Buscar clientes" }));
    await user.type(screen.getByRole("textbox", { name: "Buscar clientes" }), "zzzz");
    expect(screen.getByText("Nenhum cadastro encontrado.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Serviços" }));
    await screen.findByText("Formatação");
    expect(screen.getByRole("textbox", { name: "Buscar serviços" })).toHaveValue("");
  });

  it("erro ao carregar notifica", async () => {
    api.fetchClients.mockRejectedValue(new Error("Falhou"));
    mount();
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Falhou", "danger"));
    expect(screen.getByText("Nenhum cadastro encontrado.")).toBeInTheDocument();
  });

  it("forcedSection fixa a secao e funciona sem notify", async () => {
    render(<SettingsView token="tok" forcedSection="services" hideTabs />);
    await screen.findByText("Formatação");
    expect(api.fetchClients).not.toHaveBeenCalled();
  });

  it("trocar forcedSection limpa a busca e fecha o formulario", async () => {
    const view = render(<SettingsView token="tok" notify={vi.fn()} forcedSection="services" />);
    const user = userEvent.setup();
    await screen.findByText("Formatação");
    await user.click(screen.getByRole("button", { name: "Novo serviço" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    view.rerender(<SettingsView token="tok" notify={vi.fn()} forcedSection="technicians" />);
    await screen.findByText("Carlos");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("SettingsView - formulario de cadastro", () => {
  it("cria cliente: abre o modal, envia o payload e recarrega", async () => {
    api.createClient.mockResolvedValue({});
    const user = mount();
    await screen.findByText("Acme");
    await user.click(screen.getByRole("button", { name: "Novo cliente" }));
    const dialog = screen.getByRole("dialog", { name: "Novo cliente" });
    expect(within(dialog).getByRole("heading", { name: "Novo cliente" })).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Nome fantasia"), "Gama");
    await user.type(within(dialog).getByLabelText("E-mail"), "g@g.com");
    await user.type(within(dialog).getByLabelText("Observações"), "nota");
    await user.selectOptions(within(dialog).getByLabelText("Status"), "inactive");
    api.fetchClients.mockClear();
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.createClient).toHaveBeenCalled());
    expect(api.createClient).toHaveBeenCalledWith(
      "tok",
      expect.objectContaining({ tradeName: "Gama", email: "g@g.com", notes: "nota", active: false })
    );
    expect(notify).toHaveBeenCalledWith("Cadastro criado.", "ok");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.fetchClients).toHaveBeenCalled();
  });

  it("edita um registro preenchendo o formulario", async () => {
    api.updateClient.mockResolvedValue({});
    const user = mount();
    await screen.findByText("Acme");
    const row = screen.getByText("Acme").closest("article");
    await user.click(within(row).getByTitle("Editar"));
    const dialog = screen.getByRole("dialog", { name: "Editar cliente" });
    expect(within(dialog).getByLabelText("Nome fantasia")).toHaveValue("Acme");
    await user.type(within(dialog).getByLabelText("Nome fantasia"), "!");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.updateClient).toHaveBeenCalledWith("tok", "c1", expect.objectContaining({ tradeName: "Acme!" })));
    expect(notify).toHaveBeenCalledWith("Cadastro atualizado.", "ok");
  });

  it("erro ao salvar notifica e mantem o modal aberto; Cancelar e fechar funcionam", async () => {
    api.createClient.mockRejectedValue(new Error("CNPJ duplicado"));
    const user = mount();
    await screen.findByText("Acme");
    await user.click(screen.getByRole("button", { name: "Novo cliente" }));
    await user.type(screen.getByLabelText("Nome fantasia"), "X");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("CNPJ duplicado", "danger"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Novo cliente" }));
    await user.click(screen.getByTitle("Fechar"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("campos por tipo: numero, selecao e moeda (business) no cadastro de servico", async () => {
    api.createService.mockResolvedValue({});
    const user = mount({ systemMode: "business", forcedSection: "services" });
    await screen.findByText("Formatação");
    await user.click(screen.getByRole("button", { name: "Novo serviço" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nome do serviço"), "Limpeza");
    await user.selectOptions(within(dialog).getByLabelText("Prioridade padrão"), "medium");
    await user.type(within(dialog).getByLabelText("Valor do serviço"), "50");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(api.createService).toHaveBeenCalledWith(
        "tok",
        expect.objectContaining({
          name: "Limpeza",
          defaultPriority: "medium",
          defaultValue: "50",
          active: true
        })
      )
    );
  });

  it("modo local esconde campos business e mostra patrimonio em pecas", async () => {
    const user = mount({ forcedSection: "products" });
    await screen.findByText("SSD 240");
    await user.click(screen.getByRole("button", { name: "Novo peça" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Patrimônio")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Valor unitário")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Quantidade")).toHaveValue(0);
  });

  it("tecnicos em business: lista clientes ativos para multipla selecao", async () => {
    api.createTechnician.mockResolvedValue({});
    const user = mount({ systemMode: "business", forcedSection: "technicians" });
    await screen.findByText("Carlos");
    await waitFor(() => expect(api.fetchClients).toHaveBeenCalledWith("tok"));
    await user.click(screen.getByRole("button", { name: "Novo técnico" }));
    const select = screen.getByLabelText("Clientes permitidos");
    expect(select).toHaveAttribute("multiple");
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(["Acme"]);
    await user.type(screen.getByLabelText("Nome"), "Dani");
    await user.selectOptions(select, "c1");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.createTechnician).toHaveBeenCalledWith("tok", expect.objectContaining({ allowedClientIds: ["c1"] })));
  });

  it("tecnicos em business sem clientes mostra o aviso; erro ao buscar clientes notifica", async () => {
    api.fetchClients.mockResolvedValue({ clients: [] });
    const user = mount({ systemMode: "business", forcedSection: "technicians" });
    await screen.findByText("Carlos");
    await user.click(screen.getByRole("button", { name: "Novo técnico" }));
    expect(screen.getByText("Nenhum cliente cadastrado")).toBeInTheDocument();
  });

  it("erro ao carregar clientes do tecnico notifica", async () => {
    api.fetchClients.mockRejectedValue(new Error("Sem clientes"));
    mount({ systemMode: "business", forcedSection: "technicians" });
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Sem clientes", "danger"));
  });

  it("tipo de problema: categorias base mais as existentes e adicionar nova via prompt", async () => {
    api.createProblemType.mockResolvedValue({});
    const prompt = vi.spyOn(window, "prompt").mockReturnValueOnce("  ").mockReturnValueOnce(null).mockReturnValue(" Telefonia ");
    const user = mount({ forcedSection: "problemTypes" });
    await screen.findByText("Não liga");
    await user.click(screen.getByRole("button", { name: "Novo tipo de problema" }));
    const category = screen.getByLabelText("Categoria associada", { selector: "select" });
    expect(within(category).getAllByRole("option")[0]).toHaveTextContent("Selecione uma categoria");
    expect(within(category).getAllByRole("option")).toHaveLength(11);

    await user.click(screen.getByRole("button", { name: "Adicionar categoria" }));
    await user.click(screen.getByRole("button", { name: "Adicionar categoria" }));
    expect(within(category).getAllByRole("option")).toHaveLength(11);
    await user.click(screen.getByRole("button", { name: "Adicionar categoria" }));
    expect(prompt).toHaveBeenCalledWith("Nova categoria");
    expect(within(category).getAllByRole("option")).toHaveLength(12);
    expect(category).toHaveValue("Telefonia");

    await user.type(screen.getByLabelText("Nome do problema"), "Sem sinal");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(api.createProblemType).toHaveBeenCalledWith("tok", expect.objectContaining({ name: "Sem sinal", category: "Telefonia" }))
    );
  });

  it("regra de prioridade: selecao de tipo e horas", async () => {
    api.createPriorityRule.mockResolvedValue({});
    const user = mount({ forcedSection: "priorityRules" });
    await screen.findByText("VIP");
    await user.click(screen.getByRole("button", { name: "Novo regra" }));
    await user.type(screen.getByLabelText("Nome da regra"), "Urgente");
    await user.selectOptions(screen.getByLabelText("Tipo da regra"), "open_time");
    fireEvent.change(screen.getByLabelText("Horas limite"), { target: { value: "8" } });
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(api.createPriorityRule).toHaveBeenCalledWith(
        "tok",
        expect.objectContaining({
          name: "Urgente",
          ruleType: "open_time",
          thresholdHours: "8"
        })
      )
    );
  });
});

describe("SettingsView - exclusao e importacao", () => {
  it("exclui apos confirmar, cancelar nao exclui, erro notifica", async () => {
    api.deleteClient.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("Em uso"));
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
    const user = mount();
    await screen.findByText("Acme");
    const row = () => screen.getByText("Acme").closest("article");
    await user.click(within(row()).getByTitle("Excluir"));
    expect(api.deleteClient).not.toHaveBeenCalled();
    await user.click(within(row()).getByTitle("Excluir"));
    await waitFor(() => expect(api.deleteClient).toHaveBeenCalledWith("tok", "c1"));
    expect(confirm).toHaveBeenCalledWith('Excluir "Acme"?');
    expect(notify).toHaveBeenCalledWith("Cadastro excluído.", "ok");
    await user.click(within(row()).getByTitle("Excluir"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Em uso", "danger"));
  });

  function csvInput() {
    return document.querySelector('input[type="file"]');
  }

  function pick(file) {
    // jsdom nao implementa Blob#text
    if (file && !file.text) file.text = async () => "a,b";
    const input = csvInput();
    Object.defineProperty(input, "files", { value: file ? [file] : [], configurable: true });
    fireEvent.change(input);
  }

  it("importa CSV e informa totais; com erros usa o tom de perigo", async () => {
    api.importClients.mockResolvedValueOnce({ imported: 3, errors: [] }).mockResolvedValueOnce({ imported: 1, errors: ["linha 2"] });
    const user = mount();
    await screen.findByText("Acme");
    const clicked = vi.spyOn(csvInput(), "click");
    await user.click(screen.getByRole("button", { name: /Importar/ }));
    expect(clicked).toHaveBeenCalled();

    pick(new File(["a,b"], "clientes.CSV", { type: "text/csv" }));
    await waitFor(() => expect(api.importClients).toHaveBeenCalledWith("tok", "a,b"));
    expect(notify).toHaveBeenCalledWith("3 registros importados. 0 erros.", "ok");

    pick(new File(["a,b"], "c2.csv", { type: "text/csv" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("1 registros importados. 1 erros.", "danger"));
  });

  it("recusa arquivo que nao e CSV; erro da API notifica", async () => {
    api.importClients.mockRejectedValue(new Error("CSV invalido"));
    mount();
    await screen.findByText("Acme");
    pick(new File(["x"], "planilha.xlsx"));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith("Por enquanto a importação aceita CSV. Excel ficará preparado para uma próxima etapa.", "danger")
    );
    expect(api.importClients).not.toHaveBeenCalled();

    pick(new File(["x"], "ok.csv", { type: "text/csv" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("CSV invalido", "danger"));

    pick(null);
    expect(api.importClients).toHaveBeenCalledTimes(1);
  });
});
