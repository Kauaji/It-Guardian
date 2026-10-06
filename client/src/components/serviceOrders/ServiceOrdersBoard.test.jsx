import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api.js";
import ServiceOrdersBoard from "./ServiceOrdersBoard.jsx";
import { makeDataTransfer, makeDevice, makeOrder, wireApi } from "./test/fixtures.jsx";

vi.mock("../../api.js", async () => (await import("./test/fixtures.jsx")).createApiMock());

const captured = vi.hoisted(() => ({ details: null, form: null }));
vi.mock("./ServiceOrderDetailsModal.jsx", () => ({
  default: (props) => {
    captured.details = props;
    return <div data-testid="details" data-order={props.serviceOrder?.id || ""} />;
  }
}));
vi.mock("./ServiceOrderFormModal.jsx", () => ({
  default: (props) => {
    captured.form = props;
    return <div data-testid="form" data-open={String(props.open)} />;
  }
}));
vi.mock("../settings/SettingsView.jsx", () => ({
  default: (props) => <div data-testid="settings-view" data-section={props.forcedSection} />
}));
vi.mock("./ServiceOrderChecklistTemplatesSettings.jsx", () => ({
  default: () => <div data-testid="checklist-templates" />
}));

const orders = [
  makeOrder(),
  makeOrder({
    id: "os-2",
    number: "OS-0002",
    title: "Impressora offline",
    status: "in_progress",
    priority: "low",
    priorityLabel: "Baixa",
    assignedTechnicianName: "Bruno Silva",
    assignedTechnicianNames: ["Bruno Silva"],
    sla: { status: "breached" },
    feedback: { rating: 5 },
    sectorId: "sector-geral",
    sectorName: "Geral",
    environmentId: "c2",
    assetId: "dev-2"
  }),
  makeOrder({
    id: "os-3",
    number: "OS-0003",
    title: "Troca de memória",
    status: "closed",
    closedAt: "2026-08-12T10:00:00.000Z",
    priority: "critical",
    priorityLabel: "Crítica",
    source: "public_support_form",
    sectorId: "sector-ti",
    sla: { status: "resolved" }
  })
];
const devices = [makeDevice(), makeDevice({ id: "dev-2", name: "IMP-01" })];
const allPermissions = { viewAll: true };

function renderBoard(props = {}) {
  const handlers = {
    notify: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(true),
    onUpdate: vi.fn(),
    onStatusChange: vi.fn().mockResolvedValue(undefined)
  };
  const view = render(
    <ServiceOrdersBoard
      serviceOrders={orders}
      devices={devices}
      token="tok"
      permissions={allPermissions}
      user={{ id: "u1", name: "Ana Técnica", sectorId: "sector-ti" }}
      {...handlers}
      {...props}
    />
  );
  return { ...view, ...handlers };
}

async function renderReady(props) {
  const result = renderBoard(props);
  await waitFor(() => expect(api.fetchTechnicians).toHaveBeenCalled());
  await act(async () => {});
  return result;
}

const click = (element) => fireEvent.click(element);
const column = (name) => screen.getByText(name, { selector: "section.service-order-column strong" }).closest("section");

describe("ServiceOrdersBoard", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-15T12:00:00.000Z"));
    Object.values(api).forEach((fn) => fn.mockReset?.());
    wireApi(api);
    captured.details = null;
    captured.form = null;
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("mostra colunas por status com cartoes, contagens e modo local", async () => {
    await renderReady();
    expect(screen.getByRole("heading", { name: "Ordens de Serviço" })).toBeInTheDocument();
    expect(screen.getByText("Modo Local")).toBeInTheDocument();
    expect(within(column("Aberta")).getByText("Computador não liga")).toBeInTheDocument();
    expect(within(column("Em atendimento")).getByText("Impressora offline")).toBeInTheDocument();
    expect(within(column("Finalizada")).getByText("Troca de memória")).toBeInTheDocument();
    const summary = document.querySelector(".service-orders-summary");
    expect(summary).toHaveTextContent("Total3");
    expect(summary).toHaveTextContent("Aberta1");
    expect(document.querySelector(".service-order-kanban")).toHaveClass("layout-horizontal");
  });

  it("filtra pelo mês de abertura e permite escolher ano, mês ou todos", async () => {
    const old = makeOrder({
      id: "os-old",
      number: "OS-0000",
      title: "OS antiga",
      status: "closed",
      createdAt: "2025-03-10T10:00:00.000Z",
      closedAt: "2025-03-20T10:00:00.000Z"
    });
    await renderReady({ serviceOrders: [...orders, old] });
    expect(screen.getByText("Agosto de 2026")).toBeInTheDocument();
    expect(screen.queryByText("OS antiga")).not.toBeInTheDocument();
    click(screen.getByRole("button", { name: "Selecionar mês de abertura" }));
    expect(screen.getByText("Selecione o mês")).toBeInTheDocument();
    click(screen.getByRole("button", { name: "2026" }));
    expect(screen.getByText("Selecione o ano")).toBeInTheDocument();
    click(screen.getByRole("button", { name: "2025" }));
    expect(screen.getByText("Selecione o mês")).toBeInTheDocument();
    click(screen.getByRole("button", { name: "MAR" }));
    expect(screen.getByText("Março de 2025")).toBeInTheDocument();
    expect(screen.getByText("OS antiga")).toBeInTheDocument();
    expect(screen.queryByText("Computador não liga")).not.toBeInTheDocument();
    click(screen.getByRole("button", { name: "Selecionar mês de abertura" }));
    click(screen.getByRole("button", { name: "Todos os meses" }));
    expect(screen.getByText("Todos os meses", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("OS antiga")).toBeInTheDocument();
    click(screen.getByRole("button", { name: "Selecionar mês de abertura" }));
    click(screen.getByRole("button", { name: "Fechar" }));
    expect(document.querySelector(".service-order-month-popover")).toBeNull();
  });

  it("pesquisa por título, técnico e ativo ignorando acentos", async () => {
    await renderReady();
    const search = screen.getByLabelText("Pesquisar por ordem de serviço ou técnico");
    fireEvent.change(search, { target: { value: "MEMORIA" } });
    expect(screen.getByText("Troca de memória")).toBeInTheDocument();
    expect(screen.queryByText("Impressora offline")).not.toBeInTheDocument();
    expect(search.closest("label")).toHaveClass("has-value");
    fireEvent.change(search, { target: { value: "bruno" } });
    expect(screen.getByText("Impressora offline")).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "imp-01" } });
    expect(screen.getByText("Impressora offline")).toBeInTheDocument();
    expect(screen.queryByText("Computador não liga")).not.toBeInTheDocument();
  });

  it("aplica filtros de prioridade, técnico, status, SLA, origem e avaliação", async () => {
    await renderReady();
    click(screen.getByRole("button", { name: "Filtros de Ordens de Serviço" }));
    const filters = document.querySelector(".service-order-filter-popover");
    const select = (label) => within(filters).getByText(label).closest("label").querySelector("select");
    const total = () => document.querySelector(".service-orders-summary article strong").textContent;

    fireEvent.change(select("Prioridade"), { target: { value: "critical" } });
    expect(total()).toBe("1");
    fireEvent.change(select("Prioridade"), { target: { value: "all" } });
    fireEvent.change(select("Técnico"), { target: { value: "Bruno Silva" } });
    expect(total()).toBe("1");
    fireEvent.change(select("Técnico"), { target: { value: "all" } });
    fireEvent.change(select("Status"), { target: { value: "closed" } });
    expect(total()).toBe("1");
    fireEvent.change(select("Status"), { target: { value: "all" } });
    fireEvent.change(select("Prazo (SLA)"), { target: { value: "breached" } });
    expect(total()).toBe("1");
    fireEvent.change(select("Prazo (SLA)"), { target: { value: "all" } });
    fireEvent.change(select("Origem"), { target: { value: "public_support_form" } });
    expect(total()).toBe("1");
    fireEvent.change(select("Origem"), { target: { value: "manual" } });
    expect(total()).toBe("2");
    fireEvent.change(select("Origem"), { target: { value: "all" } });
    fireEvent.change(select("Avaliação"), { target: { value: "5" } });
    expect(total()).toBe("1");
    fireEvent.change(select("Avaliação"), { target: { value: "none" } });
    expect(total()).toBe("2");
    fireEvent.change(select("Avaliação"), { target: { value: "all" } });
    fireEvent.change(select("Setor"), { target: { value: "sector-geral" } });
    expect(total()).toBe("1");
    fireEvent.change(select("Setor"), { target: { value: "sector-ti" } });
    expect(total()).toBe("2");
    expect(within(filters).queryByText("Cliente")).toBeNull();
    expect(within(filters).getByRole("option", { name: "TI" })).toBeInTheDocument();
    expect(within(filters).queryByRole("option", { name: "Fora" })).toBeNull();
    click(screen.getByRole("button", { name: "Filtros de Ordens de Serviço" }));
    expect(document.querySelector(".service-order-filter-popover")).toBeNull();
  });

  it("sem permissão de ver tudo, começa em 'Meu setor' e esconde a opção de todos", async () => {
    await renderReady({ permissions: {} });
    click(screen.getByRole("button", { name: "Filtros de Ordens de Serviço" }));
    const sector = screen.getByText("Setor").closest("label").querySelector("select");
    expect(sector).toHaveValue("mine");
    expect(within(sector).queryByRole("option", { name: "Todos os setores" })).toBeNull();
    expect(screen.getByText("Total", { selector: "span" }).nextSibling).toHaveTextContent("3");
    expect(screen.queryByRole("button", { name: "Configurações da Ordem de Serviço" })).not.toBeNull();
  });

  it("no modo Business carrega clientes e filtra por cliente", async () => {
    await renderReady({ systemMode: "business" });
    expect(screen.getByText("Modo Business")).toBeInTheDocument();
    await waitFor(() => expect(api.fetchClients).toHaveBeenCalledWith("tok"));
    click(screen.getByRole("button", { name: "Filtros de Ordens de Serviço" }));
    const client = screen.getByText("Cliente").closest("label").querySelector("select");
    expect(
      within(client)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["Todos os clientes", "Acme", "Beta Ltda", "Cliente sem nome"]);
    fireEvent.change(client, { target: { value: "c2" } });
    expect(document.querySelector(".service-orders-summary article strong")).toHaveTextContent("1");
    expect(screen.getByText("Setor/local")).toBeInTheDocument();
  });

  it("notifica erro ao carregar configurações e usa o setor geral se a lista de setores falhar", async () => {
    api.fetchServiceOrderSettings.mockRejectedValue(new Error("sem config"));
    api.fetchSectors.mockRejectedValue(new Error("x"));
    api.fetchTechnicians.mockRejectedValue(new Error("x"));
    const { notify } = await renderReady();
    await waitFor(() => expect(notify).toHaveBeenCalledWith("sem config", "danger"));
    click(screen.getByRole("button", { name: "Filtros de Ordens de Serviço" }));
    expect(screen.getByRole("option", { name: "Geral" })).toBeInTheDocument();
  });

  it("aplica configurações carregadas (layout vertical, status e cores)", async () => {
    wireApi(api, {
      settings: {
        boardLayout: "vertical",
        statuses: [
          { id: "a", name: "Nova", color: "#112233", isInitial: true },
          { id: "b", name: "Fim", isFinal: true }
        ]
      }
    });
    await renderReady();
    await waitFor(() => expect(document.querySelector(".service-order-kanban")).toHaveClass("layout-vertical"));
    expect(screen.getByText("Nova", { selector: "section.service-order-column strong" })).toBeInTheDocument();
  });

  it("abre detalhes ao clicar no cartão e fecha pelo callback", async () => {
    await renderReady();
    expect(captured.details.serviceOrder).toBeNull();
    click(screen.getByText("Impressora offline").closest("button"));
    expect(screen.getByTestId("details")).toHaveAttribute("data-order", "os-2");
    expect(captured.details).toMatchObject({
      token: "tok",
      systemMode: "local",
      canChangeSector: false,
      remoteScriptExecutionEnabled: false,
      permissions: allPermissions
    });
    expect(captured.details.statuses.map((status) => status.id)).toEqual(["open", "in_progress", "waiting", "closed"]);
    act(() => captured.details.onClose());
    expect(screen.getByTestId("details")).toHaveAttribute("data-order", "");
  });

  it("repassa o usuário ao detalhe para liberar a assistência remota conforme suas permissões", async () => {
    await renderReady();
    expect(captured.details.user).toEqual({ id: "u1", name: "Ana Técnica", sectorId: "sector-ti" });
  });

  it("repassa a versão atual da OS selecionada ao detalhe", async () => {
    const { rerender } = await renderReady();
    click(screen.getByText("Impressora offline").closest("button"));
    rerender(
      <ServiceOrdersBoard
        serviceOrders={[orders[0], { ...orders[1], title: "Atualizada" }, orders[2]]}
        devices={devices}
        token="tok"
        permissions={allPermissions}
      />
    );
    expect(captured.details.serviceOrder.title).toBe("Atualizada");
    rerender(<ServiceOrdersBoard serviceOrders={[orders[0]]} devices={devices} token="tok" permissions={allPermissions} />);
    expect(captured.details.serviceOrder.title).toBe("Impressora offline");
  });

  it("abre o formulário de nova OS e fecha após criar", async () => {
    const { onCreate } = await renderReady();
    expect(screen.getByTestId("form")).toHaveAttribute("data-open", "false");
    click(screen.getByRole("button", { name: "Nova Ordem de Serviço" }));
    expect(screen.getByTestId("form")).toHaveAttribute("data-open", "true");
    await act(async () => captured.form.onSubmit({ title: "x" }));
    expect(onCreate).toHaveBeenCalledWith({ title: "x" });
    expect(screen.getByTestId("form")).toHaveAttribute("data-open", "false");
    click(screen.getByRole("button", { name: "Nova Ordem de Serviço" }));
    onCreate.mockResolvedValue(false);
    await act(async () => captured.form.onSubmit({ title: "y" }));
    expect(screen.getByTestId("form")).toHaveAttribute("data-open", "true");
    act(() => captured.form.onClose());
    expect(screen.getByTestId("form")).toHaveAttribute("data-open", "false");
  });

  it("esconde botões sem permissão de criar e configurar", async () => {
    await renderReady({ permissions: { create: false, settings: false, viewAll: true } });
    expect(screen.queryByRole("button", { name: "Nova Ordem de Serviço" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Configurações da Ordem de Serviço" })).toBeNull();
  });

  describe("arrastar e soltar", () => {
    function drag(from, toColumn) {
      const dataTransfer = makeDataTransfer();
      const card = screen.getByText(from).closest("button");
      fireEvent.dragStart(card, { dataTransfer });
      expect(card).toHaveClass("is-dragging");
      fireEvent.dragOver(toColumn, { dataTransfer });
      expect(toColumn).toHaveClass("is-drop-target");
      return dataTransfer;
    }

    it("move a OS para outra coluna", async () => {
      const { onStatusChange } = await renderReady();
      const target = column("Em atendimento");
      const dataTransfer = drag("Computador não liga", target);
      fireEvent.drop(target, { dataTransfer });
      await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith(orders[0], "in_progress"));
      expect(target).not.toHaveClass("is-drop-target");
    });

    it("ignora soltar na mesma coluna e limpa o destaque ao sair", async () => {
      const { onStatusChange } = await renderReady();
      const same = column("Aberta");
      const dataTransfer = drag("Computador não liga", same);
      fireEvent.dragLeave(same, { relatedTarget: document.body });
      expect(same).not.toHaveClass("is-drop-target");
      fireEvent.drop(same, { dataTransfer });
      expect(onStatusChange).not.toHaveBeenCalled();
    });

    it("bloqueia sem permissão de alterar status ou de finalizar", async () => {
      const { onStatusChange, notify, unmount } = await renderReady({ permissions: { changeStatus: false, viewAll: true } });
      let target = column("Em atendimento");
      fireEvent.drop(target, { dataTransfer: drag("Computador não liga", target) });
      await waitFor(() => expect(notify).toHaveBeenCalledWith("Você não possui permissão para alterar status de OS.", "danger"));
      unmount();
      const second = await renderReady({ permissions: { changeStatus: true, finish: false, viewAll: true } });
      target = column("Finalizada");
      fireEvent.drop(target, { dataTransfer: drag("Computador não liga", target) });
      await waitFor(() =>
        expect(second.notify).toHaveBeenCalledWith("Você não possui permissão para finalizar esta Ordem de Serviço.", "danger")
      );
      expect(onStatusChange).not.toHaveBeenCalled();
      expect(second.onStatusChange).not.toHaveBeenCalled();
    });

    it("usa a OS arrastada quando o dataTransfer não devolve o id e ignora OS desconhecida", async () => {
      const { onStatusChange } = await renderReady();
      const target = column("Em atendimento");
      const dataTransfer = drag("Computador não liga", target);
      dataTransfer.store["text/plain"] = "";
      fireEvent.drop(target, { dataTransfer });
      await waitFor(() => expect(onStatusChange).toHaveBeenCalledTimes(1));
      fireEvent.drop(target, { dataTransfer: { getData: () => "inexistente" } });
      await act(async () => {});
      expect(onStatusChange).toHaveBeenCalledTimes(1);
      const card = screen.getByText("Impressora offline").closest("button");
      fireEvent.dragStart(card, { dataTransfer: makeDataTransfer() });
      fireEvent.dragEnd(card);
      expect(card).not.toHaveClass("is-dragging");
    });
  });

  describe("configurações da OS", () => {
    const openSettings = async (props) => {
      const result = await renderReady(props);
      click(screen.getByRole("button", { name: "Configurações da Ordem de Serviço" }));
      return result;
    };
    const dialog = () => screen.getByRole("dialog", { name: "Configurações da OS" });
    const tab = (name) => within(dialog()).getByRole("button", { name });

    it("abre o modal com abas e fecha pelo botão", async () => {
      await openSettings();
      expect(within(dialog()).getByRole("heading", { name: "Configuração da OS" })).toBeInTheDocument();
      const labels = [...dialog().querySelectorAll(".service-order-settings-tabs button")].map((button) => button.textContent);
      expect(labels).toEqual(["Geral", "Técnicos", "Peças", "Serviços", "Tipos de problema", "Checklists técnicos"]);
      click(within(dialog()).getByTitle("Fechar"));
      expect(screen.queryByRole("dialog", { name: "Configurações da OS" })).toBeNull();
      click(screen.getByRole("button", { name: "Configurações da Ordem de Serviço" }));
      expect(screen.getByRole("button", { name: "Configurações da Ordem de Serviço" })).toHaveClass("active");
    });

    it("renderiza as telas delegadas conforme a aba", async () => {
      await openSettings({ systemMode: "business" });
      click(tab("Clientes"));
      expect(screen.getByTestId("settings-view")).toHaveAttribute("data-section", "clients");
      click(tab("Tipos de problema"));
      expect(screen.getByTestId("settings-view")).toHaveAttribute("data-section", "problemTypes");
      click(tab("Checklists técnicos"));
      expect(screen.getByTestId("checklist-templates")).toBeInTheDocument();
    });

    it("edita formato do número, prioridade automática, SLA e layout na aba Geral e salva", async () => {
      const { notify } = await openSettings();
      const section = (title) => within(dialog()).getByText(title).closest("section");
      click(within(section("Visualização do painel")).getByRole("button"));
      fireEvent.change(within(dialog()).getByLabelText("Modo de exibição"), { target: { value: "vertical" } });
      expect(document.querySelector(".service-order-kanban")).toHaveClass("layout-vertical");

      click(within(section("Formato do número da OS")).getByRole("button"));
      expect(within(dialog()).queryByLabelText("Modo de exibição")).toBeNull();
      fireEvent.change(within(dialog()).getByLabelText("Prefixo"), { target: { value: "ORD" } });
      fireEvent.change(within(dialog()).getByLabelText("Próximo número"), { target: { value: "12" } });
      click(within(dialog()).getByLabelText("Usar ano no número"));
      click(within(dialog()).getByLabelText("Usar mês no número"));
      const year = String(new Date().getFullYear());
      expect(dialog().querySelector(".service-order-number-preview strong")).toHaveTextContent(`ORD-${year}-08-0012`);

      click(within(section("Prioridade automática")).getByRole("button"));
      fireEvent.change(within(dialog()).getByLabelText("Baixa para Média (horas)"), { target: { value: "10" } });
      fireEvent.change(within(dialog()).getByLabelText("Média para Alta (horas)"), { target: { value: "20" } });
      fireEvent.change(within(dialog()).getByLabelText("Alta para Crítica (horas)"), { target: { value: "30" } });
      click(within(dialog()).getByLabelText("Ativar prioridade automática"));
      click(within(dialog()).getByRole("button", { name: "Configurar cores das prioridades" }));
      fireEvent.change(within(dialog()).getByLabelText("Cor da prioridade Alta"), { target: { value: "#123456" } });
      expect(dialog().querySelector(".service-order-color-swatch")).not.toBeNull();
      click(within(dialog()).getByRole("button", { name: "Padrão" }));
      fireEvent.change(within(dialog()).getByLabelText("Cor da prioridade Baixa"), { target: { value: "#abcdef" } });

      click(within(section("SLA (prazo de atendimento)")).getByRole("button"));
      fireEvent.change(within(dialog()).getByLabelText("Crítica (horas)"), { target: { value: "2" } });
      fireEvent.change(within(dialog()).getByLabelText(/Alerta de "próxima do vencimento"/), { target: { value: "30" } });
      fireEvent.change(within(dialog()).getByLabelText("Ou quando restarem menos de (horas)"), { target: { value: "3" } });
      click(within(dialog()).getByLabelText(/Exigir checklist técnico completo/));

      click(within(dialog()).getByRole("button", { name: "Salvar" }));
      await waitFor(() => expect(notify).toHaveBeenCalledWith("Configurações da OS salvas.", "ok"));
      const saved = api.updateServiceOrderSettings.mock.calls[0];
      expect(saved[0]).toBe("tok");
      expect(saved[1]).toMatchObject({
        boardLayout: "vertical",
        numberFormat: { prefix: "ORD", nextNumber: "12", useYear: true, useMonth: true },
        autoPriority: { enabled: true, lowToMediumHours: "10", mediumToHighHours: "20", highToCriticalHours: "30" },
        priorityColors: { low: "#abcdef", high: "#ea580c" },
        sla: { critical: "2", nearDuePercent: "30", nearDueMinHours: "3" },
        requireChecklistBeforeFinish: true
      });
    });

    it("mostra 'Salvando...' enquanto salva e notifica falha", async () => {
      let rejectSave;
      api.updateServiceOrderSettings.mockReturnValue(
        new Promise((_resolve, reject) => {
          rejectSave = reject;
        })
      );
      const { notify } = await openSettings();
      click(within(dialog()).getByRole("button", { name: "Salvar" }));
      expect(within(dialog()).getByRole("button", { name: "Salvando..." })).toBeDisabled();
      await act(async () => rejectSave(new Error("falhou")));
      expect(notify).toHaveBeenCalledWith("falhou", "danger");
      expect(within(dialog()).getByRole("button", { name: "Salvar" })).not.toBeDisabled();
    });

    it("gerencia status no acordeão: adicionar, mover, papéis e excluir", async () => {
      const { notify } = await openSettings();
      click(within(dialog()).getByText("Segmentos/Status da OS").closest("button"));
      const rows = () => [...dialog().querySelectorAll(".service-order-status-row")];
      const names = () => rows().map((row) => row.querySelector("input").value);
      expect(names()).toEqual(["Aberta", "Em atendimento", "Aguardando", "Finalizada"]);
      expect(within(dialog()).getByText("4/10 status")).toBeInTheDocument();

      click(within(dialog()).getByRole("button", { name: "Novo status" }));
      expect(names()).toEqual(["Aberta", "Em atendimento", "Aguardando", "Finalizada", "Novo status 5"]);
      fireEvent.change(rows()[4].querySelector("input"), { target: { value: "Revisão" } });
      fireEvent.change(rows()[4].querySelector("input[type=color]"), { target: { value: "#010203" } });
      expect(names()[4]).toBe("Revisão");

      click(within(rows()[4]).getByTitle("Subir"));
      expect(names().slice(3)).toEqual(["Revisão", "Finalizada"]);
      click(within(rows()[0]).getByTitle("Descer"));
      expect(names()[0]).toBe("Em atendimento");
      expect(within(rows()[0]).getByTitle("Subir")).toBeDisabled();

      vi.spyOn(window, "confirm").mockReturnValue(false);
      click(within(rows()[2]).getByLabelText("Usar como abertura"));
      expect(window.confirm).toHaveBeenCalledWith("Já existe um status definido como abertura. Deseja substituir?");
      expect(within(rows()[2]).getByLabelText("Usar como abertura")).not.toBeChecked();
      window.confirm.mockReturnValue(true);
      click(within(rows()[2]).getByLabelText("Usar como abertura"));
      expect(within(rows()[2]).getByLabelText("Usar como abertura")).toBeChecked();
      click(within(rows()[2]).getByLabelText("Usar como finalização"));
      expect(window.confirm).toHaveBeenLastCalledWith("Já existe um status definido como finalização. Deseja substituir?");
      expect(within(rows()[2]).getByLabelText("Usar como abertura")).not.toBeChecked();
      click(within(rows()[2]).getByLabelText("Usar como finalização"));
      expect(window.confirm).toHaveBeenCalledTimes(3);

      const revisionIndex = names().indexOf("Revisão");
      click(within(rows()[revisionIndex]).getByTitle("Excluir status"));
      expect(window.confirm).toHaveBeenLastCalledWith('Excluir o status "Revisão"?');
      expect(names()).toHaveLength(4);
      expect(names()).not.toContain("Revisão");
      window.confirm.mockReturnValue(false);
      click(within(rows()[0]).getByTitle("Excluir status"));
      expect(notify).toHaveBeenLastCalledWith("Mova as OS deste status antes de excluí-lo.", "danger");
    });

    it("impede excluir status em uso, limitar a dez e manter o mínimo de dois", async () => {
      const { notify } = await openSettings();
      click(within(dialog()).getByText("Segmentos/Status da OS").closest("button"));
      const rows = () => [...dialog().querySelectorAll(".service-order-status-row")];
      click(within(rows()[0]).getByTitle("Excluir status"));
      expect(notify).toHaveBeenLastCalledWith("Mova as OS deste status antes de excluí-lo.", "danger");
      for (let index = 0; index < 6; index += 1) {
        vi.setSystemTime(new Date(Date.now() + 1000));
        click(within(dialog()).getByRole("button", { name: "Novo status" }));
      }
      expect(rows()).toHaveLength(10);
      expect(within(dialog()).getByRole("button", { name: "Novo status" })).toBeDisabled();
    });

    it("não exclui abaixo de dois status", async () => {
      wireApi(api, {
        settings: {
          statuses: [
            { id: "a", name: "A", isInitial: true },
            { id: "b", name: "B", isFinal: true }
          ]
        }
      });
      const { notify } = await openSettings();
      await act(async () => {});
      click(within(dialog()).getByText("Segmentos/Status da OS").closest("button"));
      const trash = within(dialog()).getAllByTitle("Excluir status")[0];
      expect(trash).toBeDisabled();
      fireEvent.click(trash);
      expect(notify).not.toHaveBeenCalled();
    });

    it("volta para a aba Geral quando o modo deixa de ser Business", async () => {
      const { rerender } = await openSettings({ systemMode: "business" });
      click(tab("Clientes"));
      rerender(<ServiceOrdersBoard serviceOrders={orders} devices={devices} token="tok" permissions={allPermissions} systemMode="local" />);
      expect(screen.getByText("Regras principais da Ordem de Serviço.")).toBeInTheDocument();
    });

    it("fecha com Escape e reinicia o acordeão ao reabrir", async () => {
      await openSettings();
      click(within(dialog()).getByText("Formato do número da OS").closest("button"));
      expect(within(dialog()).getByLabelText("Prefixo")).toBeInTheDocument();
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("dialog", { name: "Configurações da OS" })).toBeNull();
      click(screen.getByRole("button", { name: "Configurações da Ordem de Serviço" }));
      expect(within(dialog()).queryByLabelText("Prefixo")).toBeNull();
    });
  });
});
