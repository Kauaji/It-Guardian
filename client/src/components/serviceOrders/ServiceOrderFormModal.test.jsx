import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api.js";
import ServiceOrderFormModal from "./ServiceOrderFormModal.jsx";
import { clients, makeDevice, technicians } from "./test/fixtures.jsx";

vi.mock("../../api.js", async () => (await import("./test/fixtures.jsx")).createApiMock());

const tabs = [{ id: "t1", name: "Matriz" }, { id: "t2", name: "" }];
const devices = [
  makeDevice({ id: "d1", name: "PC-01", ip: "10.0.0.1", groupName: "Andar 1", segmentName: "Financeiro" }),
  makeDevice({ id: "d2", name: "PC-02", ip: "10.0.0.2", assetType: "notebook", segment: { name: "Recepção" }, group: { name: "Térreo" } }),
  makeDevice({ id: "d3", name: "PC-03", ip: "10.0.0.3" })
];

function renderForm(props = {}) {
  const handlers = { onClose: vi.fn(), onSubmit: vi.fn(), notify: vi.fn() };
  const view = render(
    <ServiceOrderFormModal open token="tok" activeTab={tabs[0]} tabs={tabs} devices={devices} serviceOrderSettings={{}} sectors={[]} {...handlers} {...props} />
  );
  return { ...view, ...handlers };
}

async function renderReady(props) {
  const result = renderForm(props);
  await act(async () => {});
  return result;
}

const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Criar OS" }));
const error = () => document.querySelector(".service-order-form-error")?.textContent;

describe("ServiceOrderFormModal", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset?.());
    api.fetchTechnicians.mockResolvedValue({ technicians });
    api.fetchClients.mockResolvedValue({ clients });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("envia um ou mais técnicos e apresenta a aba com explicação", async () => {
    const onSubmit = vi.fn();
    render(<ServiceOrderFormModal open token="token" activeTab={{ id: "t1", name: "Matriz" }} tabs={[{ id: "t1", name: "Matriz" }]} serviceOrderSettings={{}} sectors={[]} onClose={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.getByText(/Define em qual aba do inventário/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /Ana Técnica/ })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Título/resumo"), { target: { value: "Troca de memória" } });
    fireEvent.change(screen.getByLabelText("Descrição do problema"), { target: { value: "Falha no módulo" } });
    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "Outro" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Ana Técnica/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Bruno Silva" }));
    fireEvent.change(screen.getByLabelText("Solicitante"), { target: { value: "Ana Técnica" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar OS" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ assignedTechnicianNames: ["Ana Técnica", "Bruno Silva"], assignedTechnicianName: "Ana Técnica" }));
  });

  it("não renderiza fechado e não busca dados", async () => {
    const { container } = await renderReady({ open: false });
    expect(container).toBeEmptyDOMElement();
    expect(api.fetchTechnicians).not.toHaveBeenCalled();
  });

  it("monta o diálogo acessível com texto de apoio do modo Local", async () => {
    await renderReady();
    const dialog = screen.getByRole("dialog", { name: "Nova Ordem de Serviço" });
    expect(dialog).toHaveAccessibleName("Nova Ordem de Serviço");
    expect(within(dialog).getByText("No modo Local, o setor organiza o atendimento interno sem exigir cliente.")).toBeInTheDocument();
    await waitFor(() => expect(dialog).toContainElement(document.activeElement));
    expect(screen.getByRole("button", { name: "Criar OS" })).toBeDisabled();
    expect(screen.getByLabelText("Setor")).toHaveValue("sector-geral");
    expect(screen.getByLabelText(/Aba do inventário/)).toHaveValue("t1");
    expect([...screen.getByLabelText(/Aba do inventário/).options].map((option) => option.textContent)).toEqual(["Usar a aba atual", "Matriz", "Novo ambiente"]);
    expect(screen.getByText("Selecione um ou mais técnicos para atender esta ordem.")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Inativo" })).toBeNull();
  });

  it("fecha pelo botão X, Cancelar e Escape", async () => {
    const { onClose } = await renderReady();
    fireEvent.click(screen.getByTitle("Fechar"));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("valida os campos obrigatórios do modo Local", async () => {
    const { onSubmit } = await renderReady();
    change("Título/resumo", "Ab");
    expect(screen.getByRole("button", { name: "Criar OS" })).toBeDisabled();
    change("Título/resumo", "  Título ok  ");
    submit();
    expect(error()).toBe("Informe descrição, categoria e solicitante para criar a OS.");
    change("Descrição do problema", "Descrição");
    expect(error()).toBeUndefined();
    submit();
    expect(error()).toBe("Informe descrição, categoria e solicitante para criar a OS.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("monta o payload completo no modo Local com setor, aba e solicitante de terceiros", async () => {
    const { onSubmit } = await renderReady({ sectors: [{ id: "s-ti", name: "TI" }, { id: "sector-geral", name: "Geral" }], serviceOrderSettings: { autoPriority: { enabled: true } } });
    change("Título/resumo", " Rede lenta ");
    change("Descrição do problema", " Muito lenta ");
    change("Prioridade", "critical");
    change("Categoria", "Notebook");
    change("Setor", "s-ti");
    change(/Aba do inventário/, "t2");
    change(/Máquina\/ativo/, "d2");
    expect(screen.getByText("PC-02", { selector: "strong" }).parentElement).toHaveTextContent("10.0.0.2 - Notebook - Térreo / Recepção");
    change("Solicitante", "Bruno Silva");
    fireEvent.click(screen.getByLabelText("É uma OS de terceiros?"));
    expect(screen.getByLabelText("Solicitante")).toHaveValue("");
    change("Solicitante", " Fulano ");
    submit();
    expect(onSubmit).toHaveBeenCalledWith({
      title: "Rede lenta", description: "Muito lenta", priority: "critical", assetId: "d2", environmentId: "t2",
      requesterName: "Fulano", assignedTechnicianName: "", assignedTechnicianNames: [], sectorId: "s-ti", sectorName: "TI",
      autoPriorityEnabled: true, category: "Notebook", notes: "", environmentName: ""
    });
  });

  it("usa a aba ativa como ambiente quando nenhuma é escolhida e lista contexto do ativo", async () => {
    const { onSubmit } = await renderReady();
    expect(screen.getByRole("option", { name: "PC-01 - 10.0.0.1 - Andar 1 / Financeiro" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "PC-03 - 10.0.0.3" })).toBeInTheDocument();
    change("Título/resumo", "Teste");
    change("Descrição do problema", "Desc");
    change("Categoria", "Outro");
    change("Solicitante", "Ana Técnica");
    submit();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ environmentId: "t1", environmentName: "Matriz", sectorName: "Geral", requesterName: "Ana Técnica" }));
  });

  it("alterna técnicos responsáveis e mantém o primeiro como principal", async () => {
    const { onSubmit } = await renderReady();
    const ana = await screen.findByRole("checkbox", { name: /Ana Técnica/ });
    expect(screen.getByText("Redes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Bruno Silva" }));
    fireEvent.click(ana);
    expect(ana.closest("label")).toHaveClass("selected");
    fireEvent.click(screen.getByRole("checkbox", { name: "Bruno Silva" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Bruno Silva" }));
    change("Título/resumo", "Teste");
    change("Descrição do problema", "Desc");
    change("Categoria", "Outro");
    change("Solicitante", "Ana Técnica");
    submit();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ assignedTechnicianName: "Ana Técnica", assignedTechnicianNames: ["Ana Técnica", "Bruno Silva"] }));
  });

  it("sem técnicos cadastrados mostra avisos", async () => {
    api.fetchTechnicians.mockResolvedValue({ technicians: [] });
    await renderReady();
    expect(screen.getAllByText("Não existem técnicos cadastrados.")).toHaveLength(2);
  });

  it("notifica falha ao carregar técnicos", async () => {
    api.fetchTechnicians.mockRejectedValue(new Error("sem técnicos"));
    const { notify } = await renderReady();
    expect(notify).toHaveBeenCalledWith("sem técnicos", "danger");
  });

  it("mostra 'Criando...' e ignora envio enquanto salva", async () => {
    const { onSubmit } = await renderReady({ saving: true });
    change("Título/resumo", "Teste");
    expect(screen.getByRole("button", { name: "Criando..." })).toBeDisabled();
    fireEvent.submit(document.querySelector("form"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("limpa o formulário ao reabrir", async () => {
    const { rerender, onClose, onSubmit } = await renderReady();
    change("Título/resumo", "Rascunho");
    rerender(<ServiceOrderFormModal open={false} token="tok" tabs={tabs} devices={devices} onClose={onClose} onSubmit={onSubmit} />);
    rerender(<ServiceOrderFormModal open token="tok" tabs={tabs} activeTab={tabs[1]} devices={devices} onClose={onClose} onSubmit={onSubmit} />);
    await act(async () => {});
    expect(screen.getByLabelText("Título/resumo")).toHaveValue("");
    expect(screen.getByLabelText(/Aba do inventário/)).toHaveValue("t2");
  });

  describe("modo Business", () => {
    const business = { systemMode: "business" };

    it("exige cliente, ativo, solicitante, categoria e descrição, nessa ordem", async () => {
      const { onSubmit } = await renderReady(business);
      expect(screen.getByText("No modo Business, informe cliente/ambiente, ativo, solicitante, categoria e descrição.")).toBeInTheDocument();
      change("Título/resumo", "Título");
      submit();
      expect(error()).toBe("No modo Business, selecione um cliente para abrir a Ordem de Serviço.");
      change("Cliente", "c1");
      submit();
      expect(error()).toBe("No modo Business, vincule uma máquina/ativo à OS.");
      change(/Máquina\/ativo$/, "d1");
      submit();
      expect(error()).toBe("No modo Business, informe o solicitante.");
      fireEvent.click(screen.getByLabelText("É uma OS de terceiros?"));
      change("Solicitante", "Cliente final");
      submit();
      expect(error()).toBe("No modo Business, informe a categoria da OS.");
      change("Categoria", "Servidor");
      submit();
      expect(error()).toBe("No modo Business, descreva a solicitação.");
      change("Descrição do problema", "Descrição");
      submit();
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ environmentId: "c1", environmentName: "Acme", assetId: "d1", category: "Servidor" }));
    });

    it("lista só clientes ativos e usa razão social como nome", async () => {
      const { onSubmit } = await renderReady(business);
      await waitFor(() => expect(screen.getByRole("option", { name: "Acme" })).toBeInTheDocument());
      expect([...screen.getByLabelText("Cliente").options].map((option) => option.textContent)).toEqual(["Selecione um cliente", "Acme", "Beta Ltda", ""]);
      change("Título/resumo", "Título");
      change("Cliente", "c2");
      change(/Máquina\/ativo$/, "d1");
      fireEvent.click(screen.getByLabelText("É uma OS de terceiros?"));
      change("Solicitante", "X");
      change("Categoria", "Outro");
      change("Descrição do problema", "D");
      submit();
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ environmentName: "Beta Ltda" }));
    });

    it("notifica falha ao carregar clientes", async () => {
      api.fetchClients.mockRejectedValue(new Error("sem clientes"));
      const { notify } = await renderReady(business);
      expect(notify).toHaveBeenCalledWith("sem clientes", "danger");
    });
  });
});
