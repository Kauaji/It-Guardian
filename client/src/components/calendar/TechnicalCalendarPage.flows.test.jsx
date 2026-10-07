import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TechnicalCalendarPage from "./TechnicalCalendarPage.jsx";

const api = vi.hoisted(() => ({
  fetchCalendarEvents: vi.fn(),
  fetchCalendarSummary: vi.fn(),
  fetchTechnicians: vi.fn(),
  createCalendarEvent: vi.fn(),
  updateCalendarEvent: vi.fn(),
  cancelCalendarEvent: vi.fn(),
  deleteCalendarEvent: vi.fn()
}));
vi.mock("../../api.js", () => api);

const allPermissions = { create: true, update: true, cancel: true, delete: true, assignTechnician: true };
const at = (day, hour = 10) => new Date(2026, 8, day, hour, 0, 0, 0).toISOString();
const event = (id, extra = {}) => ({
  id,
  title: `Evento ${id}`,
  eventType: "technical_visit",
  status: "scheduled",
  priority: "normal",
  startAt: at(15),
  ...extra
});

function renderPage(props = {}) {
  const notify = vi.fn();
  const utils = render(<TechnicalCalendarPage token="tok" notify={notify} permissions={allPermissions} {...props} />);
  return { notify, ...utils };
}
const settle = () => waitFor(() => expect(document.querySelector(".calendar-surface")).not.toHaveClass("is-loading"));

describe("TechnicalCalendarPage (fluxos)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 15, 12, 0, 0));
    api.fetchCalendarEvents.mockResolvedValue({ events: [] });
    api.fetchCalendarSummary.mockResolvedValue({ summary: {} });
    api.fetchTechnicians.mockResolvedValue({ technicians: [{ id: "tec1", name: "Ana" }] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("mostra o mês corrente, a grade de 42 dias, o dia atual e o estado vazio", async () => {
    renderPage();
    await settle();
    expect(screen.getByText("setembro de 2026")).toBeInTheDocument();
    expect(document.querySelectorAll(".calendar-day-cell")).toHaveLength(42);
    expect(document.querySelectorAll(".calendar-weekday-row span")).toHaveLength(7);
    expect(document.querySelector(".calendar-day-cell.today")).toHaveTextContent("15");
    expect(document.querySelectorAll(".calendar-day-cell.outside").length).toBeGreaterThan(0);
    expect(document.querySelector(".calendar-day-cell.past")).toBeInTheDocument();
    expect(screen.getByText("Nenhum agendamento neste período")).toBeInTheDocument();
    const params = api.fetchCalendarEvents.mock.calls[0][1];
    expect(new Date(params.startDate).getDay()).toBe(0);
    expect(new Date(params.endDate) - new Date(params.startDate)).toBe(42 * 86_400_000);
    expect(api.fetchCalendarEvents.mock.calls[0][0]).toBe("tok");
  });

  it("navega entre meses e recarrega o intervalo", async () => {
    renderPage();
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(await screen.findByText("outubro de 2026")).toBeInTheDocument();
    await waitFor(() => expect(api.fetchCalendarEvents).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(await screen.findByText("agosto de 2026")).toBeInTheDocument();
    await waitFor(() => expect(api.fetchCalendarEvents).toHaveBeenCalledTimes(4));
    const [first, last] = [api.fetchCalendarEvents.mock.calls[0][1], api.fetchCalendarEvents.mock.calls[3][1]];
    expect(last.startDate).not.toBe(first.startDate);
  });

  it("mostra o resumo e zera valores ausentes", async () => {
    api.fetchCalendarSummary.mockResolvedValue({
      summary: { today: 2, overdue: 1, busyTechnicians: 3, serviceOrders: 4, preventiveMaintenance: 5 }
    });
    renderPage();
    await settle();
    const strip = document.querySelector(".calendar-summary-strip");
    expect(within(strip).getByText("Hoje").textContent).toBe("Hoje2");
    expect(within(strip).getByText("Atrasados").textContent).toBe("Atrasados1");
    expect(within(strip).getByText("Técnicos ocupados").textContent).toBe("Técnicos ocupados3");
    expect(within(strip).getByText("OS agendadas").textContent).toBe("OS agendadas4");
    expect(within(strip).getByText("Preventivas").textContent).toBe("Preventivas5");
  });

  it("notifica erro ao carregar e sai do estado de carregamento", async () => {
    api.fetchCalendarEvents.mockRejectedValue(new Error("falhou"));
    const { notify } = renderPage();
    await waitFor(() => expect(notify).toHaveBeenCalledWith("falhou", "danger"));
    await settle();
    api.fetchCalendarEvents.mockRejectedValue({});
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Não foi possível carregar a agenda.", "danger"));
  });

  it("filtra por campos, envia somente filtros preenchidos e conta os ativos", async () => {
    renderPage({
      serviceOrders: [{ id: "os1", number: "OS-1", title: "Rede" }],
      groups: [
        { id: "g1", name: "Matriz" },
        { id: "g2", name: "Filial" }
      ],
      segments: [
        { id: "s1", name: "Financeiro", groupId: "g1" },
        { id: "s2", name: "Vendas", groupId: "g2" },
        { id: "s3", name: "Sem grupo" },
        { id: "s4", name: "Manutenção", groupId: "g1" },
        { id: "s5", name: "Padrão", isDefault: true }
      ]
    });
    await settle();
    expect(screen.queryByRole("combobox", { name: "Filtrar por grupo" })).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Mostrar filtros" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Ocultar filtros" })).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("calendar-filter-panel")).toBeInTheDocument();
    const segmentSelect = screen.getByRole("combobox", { name: "Filtrar por segmento" });
    expect(
      within(segmentSelect)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(["Todos", "Financeiro", "Vendas", "Sem grupo"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por grupo" }), { target: { value: "g1" } });
    expect(
      within(segmentSelect)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(["Todos", "Financeiro", "Sem grupo"]);
    fireEvent.change(segmentSelect, { target: { value: "s1" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por técnico" }), { target: { value: "tec1" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por tipo" }), { target: { value: "reminder" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por status" }), { target: { value: "completed" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por prioridade" }), { target: { value: "urgent" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por OS" }), { target: { value: "os1" } });
    await waitFor(() => {
      const last = api.fetchCalendarEvents.mock.calls.at(-1)[1];
      expect(last).toMatchObject({
        groupId: "g1",
        segmentId: "s1",
        technicianId: "tec1",
        eventType: "reminder",
        status: "completed",
        priority: "urgent",
        serviceOrderId: "os1"
      });
    });
    expect(api.fetchCalendarSummary.mock.calls.at(-1)[1].priority).toBe("urgent");
    expect(screen.getByRole("button", { name: "Ocultar filtros" })).toHaveTextContent("7");
    expect(screen.getByRole("button", { name: "Ocultar filtros" })).toHaveClass("active");
    // trocar de grupo limpa o segmento
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por grupo" }), { target: { value: "g2" } });
    await waitFor(() => expect(api.fetchCalendarEvents.mock.calls.at(-1)[1].segmentId).toBeUndefined());
    expect(screen.getByRole("combobox", { name: "Filtrar por segmento" })).toHaveValue("");
    expect(within(screen.getByRole("combobox", { name: "Filtrar por OS" })).getByText("OS-1 · Rede")).toBeInTheDocument();
    expect(within(screen.getByRole("combobox", { name: "Filtrar por técnico" })).getByText("Ana")).toBeInTheDocument();
  });

  it("pesquisa localmente por título, descrição, OS e técnico sem recarregar", async () => {
    api.fetchCalendarEvents.mockResolvedValue({
      events: [
        event("a", { title: "Troca de switch" }),
        event("b", { title: "Outra", description: "Cabeamento Estruturado" }),
        event("c", { title: "Terceira", serviceOrderNumber: "OS-77" }),
        event("d", { title: "Quarta", technicianName: "Beatriz" })
      ]
    });
    renderPage();
    await screen.findByText("Troca de switch");
    const input = screen.getByPlaceholderText("Pesquisar evento, OS ou técnico");
    const calls = api.fetchCalendarEvents.mock.calls.length;
    const type = async (value) => {
      fireEvent.change(input, { target: { value } });
      await settle();
    };
    await type("  CABEAMENTO ");
    expect(screen.queryByText("Troca de switch")).not.toBeInTheDocument();
    expect(screen.getByText("Outra")).toBeInTheDocument();
    await type("os-77");
    expect(screen.getByText(/Terceira/)).toBeInTheDocument();
    await type("beatriz");
    expect(screen.getByText("Quarta")).toBeInTheDocument();
    await type("zzz");
    expect(screen.getByText("Nenhum agendamento neste período")).toBeInTheDocument();
    // a busca é aplicada localmente, mas (comportamento atual) também refaz a consulta ao digitar
    expect(api.fetchCalendarEvents.mock.calls.length).toBe(calls + 4);
    expect(api.fetchCalendarEvents.mock.calls.at(-1)[1]).not.toHaveProperty("search");
    // a busca não conta como filtro ativo
    expect(screen.getByRole("button", { name: "Mostrar filtros" }).textContent).toBe("");
  });

  it("renderiza eventos com título, horário, prioridade e agrupa excedentes", async () => {
    api.fetchCalendarEvents.mockResolvedValue({
      events: [
        event("1", { priority: "low", serviceOrderNumber: "OS-9", technicianName: "Ana" }),
        event("2", { priority: "urgent", allDay: true, technicianName: "" }),
        event("3", { eventType: "desconhecido", priority: "weird" }),
        event("4", { startAt: at(20) })
      ]
    });
    renderPage();
    await screen.findByText("OS-9 · Evento 1");
    const cell = [...document.querySelectorAll(".calendar-day-cell")].find(
      (c) => c.querySelector(".calendar-day-number")?.textContent === "15"
    );
    expect(cell.getAttribute("style")).toContain("--day-priority-color: #dc2626");
    expect(cell.querySelectorAll(".calendar-event")).toHaveLength(2);
    expect(within(cell).getByText("+ 1 eventos")).toBeInTheDocument();
    const first = cell.querySelector(".calendar-event");
    expect(first).toHaveClass("status-scheduled", "priority-low");
    expect(first.getAttribute("title")).toBe("Visita técnica · prioridade baixa · Ana");
    expect(first.querySelector("time").textContent).toMatch(/^\d{2}:\d{2}$/);
    const second = cell.querySelectorAll(".calendar-event")[1];
    expect(second.querySelector("time")).toHaveTextContent("Dia");
    expect(second.getAttribute("title")).toBe("Visita técnica · prioridade urgente · Sem técnico");
    const other = [...document.querySelectorAll(".calendar-day-cell")].find(
      (c) => c.querySelector(".calendar-day-number")?.textContent === "20"
    );
    expect(other).toHaveClass("has-events");
    expect(other.getAttribute("style")).toContain("--day-priority-color: #2878c8");
    expect(document.querySelector(".calendar-empty-state")).not.toBeInTheDocument();
  });

  it("usa meta padrão para tipo/prioridade desconhecidos", async () => {
    api.fetchCalendarEvents.mockResolvedValue({ events: [event("3", { eventType: "desconhecido", priority: "weird" })] });
    renderPage();
    const button = (await screen.findByText("Evento 3")).closest("button");
    expect(button.getAttribute("title")).toBe("Outro · prioridade normal · Sem técnico");
    expect(button).toHaveClass("priority-weird");
    const cell = button.closest(".calendar-day-cell");
    expect(cell.getAttribute("style")).toContain("--day-priority-color: transparent");
  });

  it("sem permissão de criar, o dia não abre formulário nem tem botão", async () => {
    renderPage({ permissions: {} });
    await settle();
    expect(screen.queryByRole("button", { name: "Novo agendamento" })).not.toBeInTheDocument();
    expect(document.querySelector("button.calendar-day-number")).not.toBeInTheDocument();
    expect(document.querySelector("span.calendar-day-number")).toBeInTheDocument();
    fireEvent.click(document.querySelector(".calendar-day-cell"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre o formulário pelo botão Novo agendamento e pelo número do dia", async () => {
    renderPage();
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    expect(screen.getByRole("dialog", { name: "Novo agendamento" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Novo agendamento em 20 de setembro de 2026/ }));
    expect(screen.getByLabelText("Início")).toHaveValue("2026-09-20T09:00");
  });

  it("cria um agendamento, notifica, fecha e recarrega", async () => {
    api.createCalendarEvent.mockResolvedValue({});
    const { notify } = renderPage();
    await settle();
    fireEvent.click(screen.getByRole("button", { name: /Novo agendamento em 20 de setembro de 2026/ }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Visita nova" } });
    const loads = api.fetchCalendarEvents.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Criar agendamento" }));
    await waitFor(() => expect(api.createCalendarEvent).toHaveBeenCalled());
    const [token, payload] = api.createCalendarEvent.mock.calls[0];
    expect(token).toBe("tok");
    expect(payload).toMatchObject({ title: "Visita nova", eventType: "technical_visit", environmentName: null });
    expect(payload).not.toHaveProperty("tabId");
    expect(new Date(payload.startAt).getHours()).toBe(9);
    expect(new Date(payload.endAt).getHours()).toBe(10);
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Agendamento criado.", "ok"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(api.fetchCalendarEvents.mock.calls.length).toBe(loads + 1));
  });

  it("mantém o formulário aberto e notifica quando salvar falha", async () => {
    api.createCalendarEvent.mockRejectedValueOnce(new Error("conflito de agenda")).mockRejectedValueOnce({});
    const { notify } = renderPage();
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Visita nova" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar agendamento" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("conflito de agenda", "danger"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar agendamento" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Criar agendamento" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Não foi possível salvar o agendamento.", "danger"));
  });

  it("edita um evento existente", async () => {
    api.fetchCalendarEvents.mockResolvedValue({ events: [event("e1", { title: "Revisar rack" })] });
    api.updateCalendarEvent.mockResolvedValue({});
    const { notify } = renderPage();
    fireEvent.click(await screen.findByText("Revisar rack"));
    expect(screen.getByLabelText("Título")).toHaveValue("Revisar rack");
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Revisar rack 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(api.updateCalendarEvent).toHaveBeenCalled());
    expect(api.updateCalendarEvent.mock.calls[0].slice(0, 2)).toEqual(["tok", "e1"]);
    expect(api.updateCalendarEvent.mock.calls[0][2].title).toBe("Revisar rack 2");
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Agendamento atualizado.", "ok"));
  });

  it("clicar em um evento não abre o formulário de novo agendamento do dia", async () => {
    api.fetchCalendarEvents.mockResolvedValue({ events: [event("e1")] });
    renderPage();
    fireEvent.click(await screen.findByText("Evento e1"));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Editar agendamento" })).toBeInTheDocument();
  });

  it("conclui eventos e trata erro ao concluir", async () => {
    api.fetchCalendarEvents.mockResolvedValue({ events: [event("e1")] });
    api.updateCalendarEvent.mockRejectedValueOnce(new Error("sem rede")).mockRejectedValueOnce({}).mockResolvedValue({});
    const { notify } = renderPage();
    fireEvent.click(await screen.findByText("Evento e1"));
    fireEvent.click(screen.getByRole("button", { name: /concluir evento/i }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("sem rede", "danger"));
    await waitFor(() => expect(screen.getByRole("button", { name: /concluir evento/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /concluir evento/i }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Não foi possível concluir o agendamento.", "danger"));
    await waitFor(() => expect(screen.getByRole("button", { name: /concluir evento/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /concluir evento/i }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Agendamento concluído.", "ok"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancela com motivo, respeita o cancelamento do prompt", async () => {
    api.fetchCalendarEvents.mockResolvedValue({ events: [event("e1")] });
    api.cancelCalendarEvent.mockResolvedValue({});
    const prompt = vi.spyOn(window, "prompt").mockReturnValueOnce(null).mockReturnValueOnce("Cliente ausente");
    const { notify } = renderPage();
    fireEvent.click(await screen.findByText("Evento e1"));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar evento" }));
    expect(prompt).toHaveBeenCalledWith("Motivo do cancelamento (opcional):", "");
    expect(api.cancelCalendarEvent).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar evento" }));
    await waitFor(() => expect(api.cancelCalendarEvent).toHaveBeenCalledWith("tok", "e1", "Cliente ausente"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Agendamento cancelado.", "ok"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("exclui somente após confirmação", async () => {
    api.fetchCalendarEvents.mockResolvedValue({ events: [event("e1", { title: "Descartável" })] });
    api.deleteCalendarEvent.mockResolvedValue({});
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { notify } = renderPage();
    fireEvent.click(await screen.findByText("Descartável"));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(confirm).toHaveBeenCalledWith('Excluir definitivamente "Descartável"?');
    expect(api.deleteCalendarEvent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(api.deleteCalendarEvent).toHaveBeenCalledWith("tok", "e1"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Agendamento excluído.", "ok"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre o formulário vinculado a uma OS em foco e avisa quando tratada", async () => {
    const onFocusHandled = vi.fn();
    renderPage({
      focusServiceOrder: { id: "os1", number: "OS-5", title: "Trocar fonte", assetId: "d1" },
      onFocusHandled,
      serviceOrders: [{ id: "os1", number: "OS-5", title: "Trocar fonte", assetId: "d1" }],
      devices: [{ id: "d1", name: "Desktop", segmentId: "s1", tabId: "t1" }],
      segments: [{ id: "s1", name: "Financeiro", groupId: "g1", tabId: "t1" }],
      groups: [{ id: "g1", name: "Operação", tabId: "t1" }],
      tabs: [{ id: "t1", name: "Matriz" }]
    });
    expect(screen.getByRole("dialog", { name: "Novo agendamento" })).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue("Atendimento OS-5 · Trocar fonte");
    expect(screen.getByLabelText("Tipo")).toHaveValue("service_order");
    expect(screen.getByLabelText("Ordem de Serviço")).toHaveValue("os1");
    expect(screen.getByLabelText("Máquina/ativo")).toHaveValue("d1");
    expect(onFocusHandled).toHaveBeenCalled();
    await act(async () => {});
  });

  it("passa técnicos e permissões ao formulário", async () => {
    renderPage({ permissions: { create: true } });
    await waitFor(() => expect(api.fetchTechnicians).toHaveBeenCalled());
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    expect(screen.getByLabelText("Técnico")).toBeDisabled();
    expect(within(screen.getByLabelText("Técnico")).getByText("Ana")).toBeInTheDocument();
  });
});
