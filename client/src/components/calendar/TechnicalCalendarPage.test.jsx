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
    fireEvent.click(await screen.findByRole("button", { name: "Semana" }));
    expect(document.querySelector(".calendar-surface.view-week")).toBeInTheDocument();
  });
});
