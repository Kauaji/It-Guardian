import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TechnicalCalendarPage from "./TechnicalCalendarPage.jsx";

const api = vi.hoisted(() => ({
  fetchCalendarEvents: vi.fn(), fetchCalendarSummary: vi.fn(), fetchTechnicians: vi.fn(),
  createCalendarEvent: vi.fn(), updateCalendarEvent: vi.fn(), cancelCalendarEvent: vi.fn(), deleteCalendarEvent: vi.fn()
}));
vi.mock("../../api.js", () => api);

describe("TechnicalCalendarPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchCalendarEvents.mockResolvedValue({ events: [] });
    api.fetchCalendarSummary.mockResolvedValue({ summary: {} });
    api.fetchTechnicians.mockResolvedValue({ technicians: [] });
  });

  it("renderiza a visão mensal e abre o formulário ao clicar em um dia", async () => {
    render(<TechnicalCalendarPage token="token" permissions={{ create: true, update: true, cancel: true, delete: true, assignTechnician: true }} />);
    expect(await screen.findByRole("heading", { name: "Agenda Técnica" })).toBeInTheDocument();
    await waitFor(() => expect(api.fetchCalendarEvents).toHaveBeenCalled());
    const dayButtons = document.querySelectorAll(".calendar-day-cell:not(.outside)");
    fireEvent.click(dayButtons[0]);
    expect(screen.getByRole("form", { name: "Novo agendamento" })).toBeInTheDocument();
  });

  it("mantém uma agenda mensal enxuta sem controles redundantes", async () => {
    render(<TechnicalCalendarPage token="token" permissions={{ create: true }} />);
    await waitFor(() => expect(document.querySelector(".calendar-surface")).not.toHaveClass("is-loading"));
    expect(document.querySelector(".calendar-surface.view-month")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hoje" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mês" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Semana" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dia" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /atualizar/i })).not.toBeInTheDocument();
  });

  it("abre edição sem disparar novo agendamento e colore o dia pela prioridade", async () => {
    const startAt = new Date();
    startAt.setHours(10, 0, 0, 0);
    api.fetchCalendarEvents.mockResolvedValue({ events: [{ id: "event-1", title: "Visita urgente", eventType: "technical_visit", status: "scheduled", priority: "urgent", startAt: startAt.toISOString() }] });
    render(<TechnicalCalendarPage token="token" permissions={{ create: true, update: true, delete: true }} />);
    await screen.findByText("Visita urgente");
    const eventButton = document.querySelector(".calendar-event");
    expect(eventButton.closest(".calendar-day-cell")).toHaveClass("has-events");
    fireEvent.click(eventButton);
    expect(screen.getByRole("form", { name: "Editar agendamento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir" })).toBeInTheDocument();
  });

  it("permite concluir manualmente um evento", async () => {
    const startAt = new Date();
    startAt.setHours(10, 0, 0, 0);
    api.fetchCalendarEvents.mockResolvedValue({ events: [{ id: "event-2", title: "Revisão concluível", eventType: "technical_visit", status: "scheduled", priority: "medium", startAt: startAt.toISOString() }] });
    api.updateCalendarEvent.mockResolvedValue({ event: { id: "event-2", status: "completed" } });
    render(<TechnicalCalendarPage token="token" permissions={{ create: true, update: true }} />);
    fireEvent.click(await screen.findByText("Revisão concluível"));
    fireEvent.click(screen.getByRole("button", { name: /concluir evento/i }));
    await waitFor(() => expect(api.updateCalendarEvent).toHaveBeenCalledWith("token", "event-2", { status: "completed" }));
  });
});
