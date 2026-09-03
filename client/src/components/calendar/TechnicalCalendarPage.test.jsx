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

  it("troca para a visão semanal", async () => {
    render(<TechnicalCalendarPage token="token" permissions={{ create: true }} />);
    await waitFor(() => expect(document.querySelector(".calendar-surface")).not.toHaveClass("is-loading"));
    fireEvent.click(await screen.findByRole("button", { name: "Semana" }));
    expect(document.querySelector(".calendar-surface.view-week")).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector(".calendar-surface.view-week")).not.toHaveClass("is-loading"));
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
});
