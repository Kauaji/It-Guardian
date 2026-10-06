import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api.js", () => ({
  createPublicServiceOrder: vi.fn(),
  fetchPublicMachineContext: vi.fn(),
  fetchPublicSupportOptions: vi.fn()
}));

import * as api from "../../api.js";
import PublicSupportRequest from "./PublicSupportRequest.jsx";

const serverOptions = {
  systemMode: "local",
  categories: ["Computador", "Impressora"],
  problemTypes: [
    { id: "pt1", name: "Não liga", category: "Computador" },
    { id: "pt2", name: "Não imprime", category: "Impressora" },
    { id: "pt3", name: "Genérico" }
  ]
};

function setUrl(search = "") {
  window.history.pushState({}, "", `/chamado${search}`);
}

async function ready() {
  const user = userEvent.setup();
  render(<PublicSupportRequest />);
  await waitFor(() => expect(api.fetchPublicSupportOptions).toHaveBeenCalled());
  await screen.findByRole("option", { name: "Impressora" });
  return user;
}

async function fillRequired(user, { business = false } = {}) {
  await user.type(screen.getByLabelText("Título"), "Computador não inicia");
  await user.type(screen.getByLabelText("Descrição do problema"), "Tela preta ao ligar");
  await user.type(screen.getByLabelText("Solicitante"), "Ana");
  if (business) {
    await user.type(screen.getByLabelText("WhatsApp"), "11999990000");
    await user.clear(screen.getByLabelText("Cliente"));
    await user.type(screen.getByLabelText("Cliente"), "Acme");
  }
}

beforeEach(() => {
  localStorage.clear();
  setUrl();
  api.fetchPublicSupportOptions.mockResolvedValue(serverOptions);
  api.fetchPublicMachineContext.mockResolvedValue({ machine: { id: "m1", name: "PC-RECEPCAO", environmentName: "Matriz" } });
  api.createPublicServiceOrder.mockResolvedValue({ serviceOrder: { number: "OS-9", trackingToken: "tok 1" } });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PublicSupportRequest - formulario", () => {
  it("renderiza o cabecalho e os campos do modo local com opcoes do servidor", async () => {
    await ready();
    expect(screen.getByRole("heading", { name: "Abrir chamado de suporte" })).toBeInTheDocument();
    expect(screen.getByText("Monitoramento e suporte")).toBeInTheDocument();
    expect(screen.getByLabelText("Ramal")).toBeInTheDocument();
    expect(screen.queryByLabelText("WhatsApp")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Cliente")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Categoria")).toHaveValue("Computador");
    expect(screen.getByLabelText("Tipo de problema")).toHaveValue("Não liga");
    expect(screen.getByLabelText("Urgência percebida")).toHaveValue("normal");
    expect(screen.queryByLabelText("Nome da máquina")).not.toBeInTheDocument();
    const honeypot = screen.getByLabelText("Deixe este campo em branco", { selector: "input" });
    expect(honeypot).toHaveAttribute("tabindex", "-1");
  });

  it("usa as opcoes padrao quando a API falha ou vem vazia", async () => {
    api.fetchPublicSupportOptions.mockRejectedValue(new Error("fora"));
    const user = userEvent.setup();
    render(<PublicSupportRequest />);
    await waitFor(() => expect(api.fetchPublicSupportOptions).toHaveBeenCalled());
    expect(await screen.findByRole("option", { name: "Notebook" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de problema")).toHaveValue("Computador não liga");
    await user.selectOptions(screen.getByLabelText("Categoria"), "Impressora");
    expect(screen.getByLabelText("Tipo de problema")).toHaveValue("Impressora não imprime");
  });

  it("opcoes vazias do servidor caem nas padrao", async () => {
    api.fetchPublicSupportOptions.mockResolvedValue({ categories: [], problemTypes: [] });
    render(<PublicSupportRequest />);
    expect(await screen.findByRole("option", { name: "Notebook" })).toBeInTheDocument();
  });

  it("trocar a categoria escolhe o primeiro problema da categoria; escolher problema acerta a categoria", async () => {
    const user = await ready();
    await user.selectOptions(screen.getByLabelText("Categoria"), "Impressora");
    expect(screen.getByLabelText("Tipo de problema")).toHaveValue("Não imprime");
    await user.selectOptions(screen.getByLabelText("Tipo de problema"), "Não liga");
    expect(screen.getByLabelText("Categoria")).toHaveValue("Computador");
    await user.selectOptions(screen.getByLabelText("Tipo de problema"), "Genérico");
    expect(screen.getByLabelText("Categoria")).toHaveValue("Computador");
  });

  it("modo business pede WhatsApp e Cliente e esconde Ramal", async () => {
    api.fetchPublicSupportOptions.mockResolvedValue({ ...serverOptions, systemMode: "business" });
    await ready();
    await screen.findByLabelText("WhatsApp");
    expect(screen.getByLabelText("Cliente")).toHaveValue("Não identificado");
    expect(screen.queryByLabelText("Ramal")).not.toBeInTheDocument();
  });

  it("mostra a secao de maquina ao escolher o escopo e preenche os campos", async () => {
    const user = await ready();
    await user.click(screen.getByLabelText(/O problema é em outra máquina/));
    expect(screen.getByLabelText(/O problema é em outra máquina/).closest("label")).toHaveClass("selected");
    await user.type(screen.getByLabelText("Nome da máquina"), "PC-9");
    await user.type(screen.getByLabelText("Patrimônio"), "PAT-1");
    await user.type(screen.getByLabelText("Localização"), "Sala 2");
    expect(screen.getByLabelText("Nome da máquina")).toHaveValue("PC-9");
    await user.click(screen.getByLabelText(/O problema é na minha máquina/));
    expect(screen.queryByText(/Identificada:/)).not.toBeInTheDocument();
  });
});

describe("PublicSupportRequest - validacao, resumo e envio", () => {
  it("validacao client-side mostra o erro e limpa ao editar", async () => {
    const user = await ready();
    await user.type(screen.getByLabelText("Título"), "abc");
    await user.type(screen.getByLabelText("Descrição do problema"), "descricao longa");
    await user.type(screen.getByLabelText("Solicitante"), "Ana");
    // contorna o `required` nativo para exercitar a validacao do app
    const form = document.querySelector(".public-support-form");
    form.noValidate = true;
    await user.clear(screen.getByLabelText("Título"));
    await user.type(screen.getByLabelText("Título"), "ab");
    await user.click(screen.getByRole("button", { name: "Revisar e enviar" }));
    expect(await screen.findByText("Informe um título com pelo menos 3 caracteres.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Título"), "c");
    expect(screen.queryByText("Informe um título com pelo menos 3 caracteres.")).not.toBeInTheDocument();
  });

  it("fluxo completo local: revisar, voltar, enviar e ver a confirmacao", async () => {
    const user = await ready();
    await fillRequired(user);
    await user.type(screen.getByLabelText("Ramal"), "123");
    await user.type(screen.getByLabelText("Setor"), "RH");
    await user.click(screen.getByRole("button", { name: "Revisar e enviar" }));

    const summary = screen.getByRole("heading", { name: "Confira antes de enviar" }).closest("section");
    expect(within(summary).getByText("Ana")).toBeInTheDocument();
    expect(within(summary).getByText("123")).toBeInTheDocument();
    expect(within(summary).getByText("Não liga")).toBeInTheDocument();
    expect(within(summary).getByText("não vinculada")).toBeInTheDocument();
    expect(within(summary).getByText("RH")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Voltar e corrigir" }));
    expect(screen.getByLabelText("Título")).toHaveValue("Computador não inicia");
    await user.click(screen.getByRole("button", { name: "Revisar e enviar" }));
    await user.click(screen.getByRole("button", { name: "Enviar chamado" }));

    await waitFor(() => expect(api.createPublicServiceOrder).toHaveBeenCalled());
    expect(api.createPublicServiceOrder).toHaveBeenCalledWith(expect.objectContaining({
      title: "Computador não inicia",
      problemType: "Não liga",
      category: "Computador",
      contactInfo: "",
      extension: "123",
      department: "RH",
      relatedAssetText: "",
      website: ""
    }));
    expect((await screen.findAllByText("OS-9", { exact: false })).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();
  });

  it("erro do servidor volta ao formulario com a mensagem; sem mensagem usa a padrao", async () => {
    api.createPublicServiceOrder.mockRejectedValueOnce(new Error("Muitas solicitacoes")).mockRejectedValueOnce({});
    const user = await ready();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Revisar e enviar" }));
    await user.click(screen.getByRole("button", { name: "Enviar chamado" }));
    expect(await screen.findByText("Muitas solicitacoes")).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revisar e enviar" }));
    await user.click(screen.getByRole("button", { name: "Enviar chamado" }));
    expect(await screen.findByText("Não foi possível enviar a solicitação.")).toBeInTheDocument();
  });

  it("modo business envia WhatsApp como contato e zera o ramal", async () => {
    api.fetchPublicSupportOptions.mockResolvedValue({ ...serverOptions, systemMode: "business" });
    const user = await ready();
    await screen.findByLabelText("WhatsApp");
    await fillRequired(user, { business: true });
    await user.click(screen.getByRole("button", { name: "Revisar e enviar" }));
    expect(screen.getByText("11999990000")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enviar chamado" }));
    await waitFor(() => expect(api.createPublicServiceOrder).toHaveBeenCalledWith(expect.objectContaining({
      contactInfo: "11999990000", extension: "", environmentName: "Acme"
    })));
  });

  it("maquina 'outra' vai no resumo e no texto do ativo relacionado", async () => {
    const user = await ready();
    await fillRequired(user);
    await user.click(screen.getByLabelText(/O problema é em outra máquina/));
    await user.type(screen.getByLabelText("Nome da máquina"), "PC-9");
    await user.type(screen.getByLabelText("Patrimônio"), "PAT-1");
    await user.type(screen.getByLabelText("Localização"), "Sala 2");
    await user.click(screen.getByRole("button", { name: "Revisar e enviar" }));
    expect(screen.getByText("outra máquina/equipamento (não vinculada automaticamente)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enviar chamado" }));
    await waitFor(() => expect(api.createPublicServiceOrder).toHaveBeenCalledWith(expect.objectContaining({
      relatedAssetText: "Nome da máquina: PC-9 | Patrimônio: PAT-1 | Localização: Sala 2",
      machineScope: "other"
    })));
  });
});

describe("PublicSupportRequest - contexto da maquina", () => {
  it("identifica a maquina pelo link do instalador e a vincula ao chamado", async () => {
    setUrl("?device=abc123&patrimonio=PAT-7&ambiente=Filial");
    localStorage.setItem("it_guardian_machine_name", "Armazenada");
    const user = await ready();
    expect(api.fetchPublicMachineContext).toHaveBeenCalledWith("abc123");
    expect(await screen.findByText("Máquina identificada")).toBeInTheDocument();
    expect(screen.getAllByText("PC-RECEPCAO").length).toBeGreaterThan(0);
    expect(screen.getByText("Matriz")).toBeInTheDocument();
    expect(screen.getByText("Identificada: PC-RECEPCAO")).toBeInTheDocument();
    expect(screen.getByLabelText("Patrimônio")).toHaveValue("PAT-7");

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Revisar e enviar" }));
    expect(screen.getByText("PC-RECEPCAO", { selector: "dd" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enviar chamado" }));
    await waitFor(() => expect(api.createPublicServiceOrder).toHaveBeenCalledWith(expect.objectContaining({
      deviceToken: "abc123", assetId: "m1", machineScope: "mine", environmentName: "Matriz"
    })));
  });

  it("mostra o carregando e depois o aviso quando a maquina nao e identificada", async () => {
    setUrl("?device=zzz");
    api.fetchPublicMachineContext.mockRejectedValue(new Error("404"));
    render(<PublicSupportRequest />);
    expect(screen.getByText(/Identificando a máquina pelo link do instalador/)).toBeInTheDocument();
    expect(await screen.findByText(/Não foi possível identificar a máquina pelo link/)).toBeInTheDocument();
  });

  it("contexto vazio mantem o aviso e usa localStorage/params como padrao", async () => {
    setUrl("?device=zzz&machine=PC-URL");
    api.fetchPublicMachineContext.mockResolvedValue({});
    render(<PublicSupportRequest />);
    await screen.findByText(/Não foi possível identificar a máquina pelo link/);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/O problema é em outra máquina/));
    expect(screen.getByLabelText("Nome da máquina")).toHaveValue("PC-URL");
  });

  it("aceita hostname e environment como parametros alternativos", async () => {
    setUrl("?hostname=HOST&assetTag=AT&environment=Env");
    localStorage.setItem("it_guardian_environment_name", "Armazenado");
    const user = await ready();
    await user.click(screen.getByLabelText(/O problema é em outra máquina/));
    expect(screen.getByLabelText("Nome da máquina")).toHaveValue("HOST");
    expect(screen.getByLabelText("Patrimônio")).toHaveValue("AT");
  });
});
