import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api.js";
import ServiceOrderDetailsModal from "./ServiceOrderDetailsModal.jsx";
import { makeDetailsProps, makeDevice, makeOrder, stubProps, wireApi } from "./test/fixtures.jsx";

vi.mock("../../api.js", async () => (await import("./test/fixtures.jsx")).createApiMock());
vi.mock("../remoteAssistance/RemoteAssistanceAction.jsx", async () => (await import("./test/fixtures.jsx")).stubModule("remote"));
vi.mock("./tabs/ServiceOrderSlaTab.jsx", async () => (await import("./test/fixtures.jsx")).stubModule("tab-sla"));
vi.mock("./tabs/ServiceOrderAgendaTab.jsx", async () => (await import("./test/fixtures.jsx")).stubModule("tab-agenda"));
vi.mock("./tabs/ServiceOrderChecklistTab.jsx", async () => (await import("./test/fixtures.jsx")).stubModule("tab-checklist"));
vi.mock("./tabs/ServiceOrderScriptsTab.jsx", async () => (await import("./test/fixtures.jsx")).stubModule("tab-scripts"));
vi.mock("./tabs/ServiceOrderAttachmentsTab.jsx", async () => (await import("./test/fixtures.jsx")).stubModule("tab-attachments"));
vi.mock("./tabs/ServiceOrderFeedbackTab.jsx", async () => (await import("./test/fixtures.jsx")).stubModule("tab-feedback"));

const click = (element) => fireEvent.click(element);
const tab = (name) => screen.getByRole("button", { name, selector: ".machine-tabs button" });

async function renderDetails(overrides) {
  const props = makeDetailsProps(overrides);
  const view = render(<ServiceOrderDetailsModal {...props} />);
  await act(async () => {});
  return { ...view, props };
}

describe("ServiceOrderDetailsModal", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset?.());
    wireApi(api);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("não renderiza nem busca dados sem OS", async () => {
    const { container } = await renderDetails({ serviceOrder: null });
    expect(container).toBeEmptyDOMElement();
    expect(api.fetchTechnicians).not.toHaveBeenCalled();
    expect(api.fetchDevice).not.toHaveBeenCalled();
  });

  it("mostra cabeçalho, abas e a aba Geral", async () => {
    await renderDetails({ serviceOrder: makeOrder({ isDemo: true, notes: "Obs inicial", serviceCode: "S1", serviceName: "Formatação" }) });
    const dialog = screen.getByRole("dialog", { name: "Detalhes da OS" });
    expect(within(dialog).getByRole("heading", { level: 2 })).toHaveTextContent("OS-0001 - Computador não liga");
    expect(within(dialog).getByText("Demo")).toBeInTheDocument();
    expect(within(dialog).getByText("Aberta - Prioridade Alta")).toBeInTheDocument();
    expect([...dialog.querySelectorAll(".machine-tabs button")].map((button) => button.textContent)).toEqual(
      ["Geral", "Atendimento", "Máquina", "SLA", "Agenda", "Checklist", "Scripts", "Anexos", "Avaliação", "Histórico"]
    );
    expect(within(dialog).getByText("Solicitação").closest("section")).toHaveTextContent("O computador do financeiro não liga.");
    expect(within(dialog).getByText("Observações iniciais")).toBeInTheDocument();
    const grid = dialog.querySelector(".service-order-detail-grid");
    const item = (label) => within(grid).getByText(label).closest(".service-order-detail-item");
    expect(item("Número")).toHaveTextContent("OS-0001");
    expect(item("Serviço")).toHaveTextContent("S1 - Formatação");
    expect(item("Aberta em")).toHaveTextContent("10/08/2026");
    expect(item("Finalizada em")).toHaveTextContent("Não informado");
    expect(item("Setor responsável")).toHaveTextContent("TI");
    expect(item("Ambiente")).toHaveTextContent("Acme");
    expect(item("Máquina Backup")).toHaveTextContent("Não informado");
    expect(within(grid).queryByText("Valor do serviço")).toBeNull();
    expect(dialog.querySelector(".service-order-print-financial")).toBeNull();
  });

  it("mostra origem preventiva/pública e valores no modo Business", async () => {
    await renderDetails({
      systemMode: "business",
      serviceOrder: makeOrder({ preventivePlanId: "pl", source: "public_support_form", serviceValue: 100, totalPartsValue: 50, totalValue: 150, serviceName: "Só nome" })
    });
    const grid = document.querySelector(".service-order-detail-grid");
    expect(within(grid).getByText("Origem preventiva").closest("div")).toHaveTextContent("Plano Preventivo");
    expect(within(grid).getByText("Origem").closest("div")).toHaveTextContent("Preventiva");
    expect(within(grid).getByText("Cliente")).toBeInTheDocument();
    expect(within(grid).getByText("Valor do serviço").closest("div")).toHaveTextContent("R$ 100,00");
    expect(within(grid).getByText("Total estimado").closest("div")).toHaveTextContent("R$ 150,00");
    expect(within(grid).getByText("Serviço").closest("div")).toHaveTextContent("Só nome");
    expect(document.querySelector(".service-order-print-financial")).toHaveTextContent("Valores da Ordem de Serviço");
    expect(document.querySelector(".service-order-print-financial")).toHaveTextContent("Sem peças/produtos com valor registrados.");
  });

  it("permite trocar o setor quando há permissão", async () => {
    const { props } = await renderDetails({ canChangeSector: true });
    const select = screen.getByText("Setor responsável").closest("label").querySelector("select");
    expect([...select.options].map((option) => option.textContent)).toEqual(["Geral", "TI"]);
    fireEvent.change(select, { target: { value: "sector-ti" } });
    expect(props.onUpdate).toHaveBeenCalledWith("os-1", { sectorId: "sector-ti", sectorName: "TI" });
    fireEvent.change(select, { target: { value: "desconhecido" } });
    expect(props.onUpdate).toHaveBeenLastCalledWith("os-1", { sectorId: "sector-geral", sectorName: "Geral" });
  });

  it("muda a situação respeitando permissões e fecha", async () => {
    const { props, unmount } = await renderDetails({ permissions: { finish: false } });
    const select = screen.getByLabelText("Situação da OS");
    expect(within(select).getByRole("option", { name: "Finalizada" })).toBeDisabled();
    fireEvent.change(select, { target: { value: "in_progress" } });
    expect(props.onStatusChange).toHaveBeenCalledWith(props.serviceOrder, "in_progress");
    click(screen.getByTitle("Fechar"));
    expect(props.onClose).toHaveBeenCalled();
    unmount();
    await renderDetails({ permissions: { changeStatus: false }, statuses: [] });
    const fallback = screen.getByLabelText("Situação da OS");
    expect(fallback).toBeDisabled();
    expect([...fallback.options].map((option) => option.textContent)).toEqual(["Aberta", "Em atendimento", "Aguardando", "Finalizada"]);
  });

  it("Escape fecha o modal", async () => {
    const { props } = await renderDetails();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalled();
  });

  it("repassa dados à assistência remota", async () => {
    await renderDetails({ devices: [makeDevice({ alias: "Financeiro" })] });
    expect(stubProps("remote")).toMatchObject({ asset: { id: "dev-1" }, alias: "Financeiro", token: "tok", compact: true, serviceOrder: { id: "os-1" }, user: { id: "u1" } });
  });

  describe("reabrir e excluir", () => {
    const closed = makeOrder({ status: "closed", closedAt: "2026-08-12T10:00:00.000Z" });

    it("reabre exigindo motivo", async () => {
      const { props } = await renderDetails({ serviceOrder: closed, permissions: { reopen: true } });
      const reopen = screen.getByTitle("Reabrir Ordem de Serviço");
      vi.spyOn(window, "prompt").mockReturnValueOnce(null);
      click(reopen);
      expect(props.onReopen).not.toHaveBeenCalled();
      window.prompt.mockReturnValueOnce("   ");
      click(reopen);
      expect(props.notify).toHaveBeenCalledWith("Informe o motivo da reabertura.", "danger");
      window.prompt.mockReturnValueOnce(" Voltou a falhar ");
      click(reopen);
      await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Ordem de Serviço reaberta.", "ok"));
      expect(props.onReopen).toHaveBeenCalledWith("os-1", "Voltou a falhar");
    });

    it("não notifica se a reabertura não retornar a OS e mostra o botão só com permissão", async () => {
      const { props, unmount } = await renderDetails({ serviceOrder: closed, permissions: { reopen: true } });
      props.onReopen.mockResolvedValue(null);
      vi.spyOn(window, "prompt").mockReturnValue("motivo");
      click(screen.getByTitle("Reabrir Ordem de Serviço"));
      await waitFor(() => expect(props.onReopen).toHaveBeenCalled());
      expect(props.notify).not.toHaveBeenCalledWith("Ordem de Serviço reaberta.", "ok");
      unmount();
      await renderDetails({ serviceOrder: closed });
      expect(screen.queryByTitle("Reabrir Ordem de Serviço")).toBeNull();
    });

    it("exclui com confirmação, avisando se a OS não foi finalizada", async () => {
      const { props, unmount } = await renderDetails();
      vi.spyOn(window, "confirm").mockReturnValueOnce(false);
      click(screen.getByTitle("Excluir Ordem de Serviço"));
      expect(props.onDelete).not.toHaveBeenCalled();
      window.confirm.mockReturnValueOnce(true);
      click(screen.getByTitle("Excluir Ordem de Serviço"));
      expect(window.confirm).toHaveBeenLastCalledWith(
        "Tem certeza que deseja excluir esta Ordem de Serviço? Essa ação não poderá ser desfeita.\n\nEsta OS ainda não foi finalizada. Deseja excluir mesmo assim?"
      );
      await waitFor(() => expect(props.onClose).toHaveBeenCalled());
      unmount();
      const second = await renderDetails({ serviceOrder: closed });
      window.confirm.mockReturnValueOnce(true);
      second.props.onDelete.mockResolvedValue(false);
      click(screen.getByTitle("Excluir Ordem de Serviço"));
      expect(window.confirm).toHaveBeenLastCalledWith("Tem certeza que deseja excluir esta Ordem de Serviço? Essa ação não poderá ser desfeita.");
      await waitFor(() => expect(second.props.onDelete).toHaveBeenCalledWith(closed));
      expect(second.props.onClose).not.toHaveBeenCalled();
    });

    it("esconde excluir e imprimir sem permissão", async () => {
      await renderDetails({ permissions: { edit: false, print: false } });
      expect(screen.queryByTitle("Excluir Ordem de Serviço")).toBeNull();
      expect(screen.queryByTitle("Imprimir OS A4")).toBeNull();
    });
  });

  describe("abas delegadas", () => {
    it("monta cada aba com suas permissões", async () => {
      const { props } = await renderDetails({ permissions: { schedule: false, attendance: false, edit: false, runScripts: true, registerSimulation: true }, remoteScriptExecutionEnabled: true });
      click(tab("SLA"));
      expect(stubProps("tab-sla").serviceOrder.id).toBe("os-1");
      click(tab("Agenda"));
      expect(stubProps("tab-agenda")).toMatchObject({ token: "tok", canCreate: false });
      stubProps("tab-agenda");
      click(tab("Checklist"));
      expect(stubProps("tab-checklist")).toMatchObject({ serviceOrderId: "os-1", token: "tok", canManage: false });
      click(tab("Scripts"));
      expect(stubProps("tab-scripts")).toMatchObject({ canManage: true, canRegisterSimulation: true, remoteScriptExecutionEnabled: true, serviceOrder: { id: "os-1" } });
      click(tab("Anexos"));
      expect(stubProps("tab-attachments")).toMatchObject({ serviceOrderId: "os-1", canAdd: false, canRemove: false });
      click(tab("Avaliação"));
      expect(stubProps("tab-feedback")).toMatchObject({ serviceOrderId: "os-1", canManage: false });
      expect(props.notify).not.toHaveBeenCalled();
    });

    it("usa o padrão de permissões quando nenhuma é informada", async () => {
      await renderDetails();
      click(tab("Agenda"));
      expect(stubProps("tab-agenda").canCreate).toBe(true);
      click(tab("Scripts"));
      expect(stubProps("tab-scripts")).toMatchObject({ canManage: false, canRegisterSimulation: false });
      click(tab("Anexos"));
      expect(stubProps("tab-attachments")).toMatchObject({ canAdd: true, canRemove: true });
    });
  });

  describe("histórico", () => {
    it("lista eventos da OS e do ativo, ou avisa quando vazio", async () => {
      const history = [
        { id: "h1", message: "Criada", createdAt: "2026-08-10T10:00:00.000Z", userName: "Ana" },
        { id: "h2", message: "Status", createdAt: "2026-08-11T10:00:00.000Z", oldValue: "open", newValue: "closed" },
        { id: "h3", message: "Prioridade", createdAt: "2026-08-11T11:00:00.000Z", oldValue: "low" }
      ];
      const { unmount } = await renderDetails({
        serviceOrder: makeOrder({ history }),
        devices: [makeDevice({ assetHistory: [{ id: "a1", message: "Disco trocado", createdAt: "2026-07-01T10:00:00.000Z", userName: "Bruno" }] })]
      });
      click(tab("Histórico"));
      const panel = document.querySelector(".service-order-history-panel");
      expect(within(panel).getAllByRole("article")).toHaveLength(4);
      expect(panel).toHaveTextContent(/Criada10\/08\/2026.* - Ana/);
      expect(panel).toHaveTextContent("open -> closed");
      expect(panel).toHaveTextContent("low -> -");
      expect(panel).toHaveTextContent("Disco trocado");
      expect(panel).toHaveTextContent("- Bruno");
      expect(panel).not.toHaveTextContent("Vincule uma máquina para visualizar");
      unmount();
      await renderDetails({ serviceOrder: makeOrder({ assetId: "", history: undefined }), devices: [] });
      click(tab("Histórico"));
      expect(screen.getByText("Sem histórico de OS registrado.")).toBeInTheDocument();
      expect(screen.getByText("Vincule uma máquina para visualizar o histórico técnico do ativo.")).toBeInTheDocument();
    });
  });

  describe("impressão", () => {
    const makePopup = () => ({ document: { write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() });

    it("avisa quando o navegador bloqueia a janela", async () => {
      const { props } = await renderDetails();
      vi.spyOn(window, "open").mockReturnValue(null);
      click(screen.getByTitle("Imprimir OS A4"));
      expect(props.notify).toHaveBeenCalledWith("Não foi possível abrir a janela de impressão.", "danger");
    });

    it("escreve o documento A4 escapando HTML e imprime", async () => {
      vi.useFakeTimers();
      try {
        await renderDetails({
          serviceOrder: makeOrder({ title: "<b>Titulo</b> & cia", servicePerformed: "Formatou", diagnosis: "Disco", attendanceNotes: "Ok", closedAt: "2026-08-12T10:00:00.000Z", environmentName: "", sectorName: "", requesterName: "", assignedTechnicianName: "", category: "", assetId: "" }),
          devices: [],
          systemMode: "business"
        });
        const popup = makePopup();
        vi.spyOn(window, "open").mockReturnValue(popup);
        click(screen.getByTitle("Imprimir OS A4"));
        expect(window.open).toHaveBeenCalledWith("", "_blank", "width=900,height=700");
        const html = popup.document.write.mock.calls[0][0];
        expect(html).toContain("<title>OS-0001 - IT Guardian</title>");
        expect(html).toContain("OS-0001 - &lt;b&gt;Titulo&lt;/b&gt; &amp; cia");
        expect(html).toContain("Aberta - Prioridade Alta");
        expect(html).toContain("Serviço realizado: Formatou\n\nDiagnóstico: Disco\n\nObservações: Ok");
        expect(html).toContain("<h2>Valores</h2>");
        expect(html).toContain("Sem peças/produtos com valor registrados.");
        expect(html).toContain("<span>Cliente</span>");
        expect(popup.document.close).toHaveBeenCalled();
        expect(popup.focus).toHaveBeenCalled();
        vi.advanceTimersByTime(250);
        expect(popup.print).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("omite valores no modo Local sem itens e mostra atendimento vazio", async () => {
      await renderDetails();
      const popup = makePopup();
      vi.spyOn(window, "open").mockReturnValue(popup);
      click(screen.getByTitle("Imprimir OS A4"));
      const html = popup.document.write.mock.calls[0][0];
      expect(html).not.toContain("<h2>Valores</h2>");
      expect(html).toContain("Sem atendimento registrado.");
      expect(html).toContain("<span>Ambiente</span>");
      expect(html).toContain("PC-FIN-01");
    });
  });

  it("reinicia aba e rascunho ao trocar de OS e avisa falhas de carregamento", async () => {
    api.fetchTechnicians.mockRejectedValue(new Error("falha tec"));
    api.fetchProducts.mockRejectedValue(new Error("falha prod"));
    api.fetchServices.mockRejectedValue(new Error("falha serv"));
    const props = makeDetailsProps();
    const { rerender } = render(<ServiceOrderDetailsModal {...props} />);
    await act(async () => {});
    expect(props.notify).toHaveBeenCalledWith("falha tec", "danger");
    expect(props.notify).toHaveBeenCalledWith("falha prod", "danger");
    expect(props.notify).toHaveBeenCalledWith("falha serv", "danger");
    click(tab("Histórico"));
    expect(document.querySelector(".service-order-history-panel")).not.toBeNull();
    rerender(<ServiceOrderDetailsModal {...props} serviceOrder={makeOrder({ id: "os-9", title: "Outra" })} />);
    await act(async () => {});
    expect(document.querySelector(".service-order-history-panel")).toBeNull();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("OS-0001 - Outra");
  });
});
