import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CalendarEventModal from "./CalendarEventModal.jsx";

const baseProps = {
  selectedDate: new Date("2026-09-03T12:00:00"), defaults: {}, technicians: [],
  serviceOrders: [{ id: "open", number: "OS-1", title: "Aberta", status: "new" }, { id: "closed", number: "OS-2", title: "Finalizada", status: "finalizado" }],
  tabs: [{ id: "t1", name: "Matriz" }], groups: [{ id: "g1", name: "Operação", tabId: "t1" }],
  segments: [{ id: "s1", name: "Financeiro", groupId: "g1", tabId: "t1" }, { id: "maintenance", name: "Manutenção", groupId: "g1", tabId: "t1" }],
  devices: [{ id: "d1", name: "Desktop A", segmentId: "s1", tabId: "t1" }],
  permissions: { create: true, update: true, delete: true, cancel: true, assignTechnician: true }, saving: false,
  onClose: vi.fn(), onSave: vi.fn(), onCancel: vi.fn(), onDelete: vi.fn()
};

describe("CalendarEventModal", () => {
  it("oculta horários no modo dia inteiro e remove OS finalizada", () => {
    render(<CalendarEventModal {...baseProps} />);
    expect(screen.getByRole("option", { name: /OS-1/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /OS-2/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Dia inteiro" }));
    expect(screen.queryByLabelText("Início")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Término")).not.toBeInTheDocument();
  });

  it("libera aba, grupo, segmento e somente então a máquina", () => {
    render(<CalendarEventModal {...baseProps} />);
    fireEvent.change(screen.getByLabelText("Aba"), { target: { value: "t1" } });
    fireEvent.change(screen.getByLabelText("Grupo"), { target: { value: "g1" } });
    expect(screen.queryByRole("option", { name: "Manutenção" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Segmento"), { target: { value: "s1" } });
    expect(screen.getByRole("option", { name: "Desktop A" })).toBeInTheDocument();
  });
});
