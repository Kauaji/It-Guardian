import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ServiceOrderFormModal from "./ServiceOrderFormModal.jsx";

const api = vi.hoisted(() => ({ fetchTechnicians: vi.fn(), fetchClients: vi.fn() }));
vi.mock("../../api.js", () => api);

describe("ServiceOrderFormModal", () => {
  beforeEach(() => api.fetchTechnicians.mockResolvedValue({ technicians: [{ id: "a", name: "Ana" }, { id: "b", name: "Bruno" }] }));

  it("envia um ou mais técnicos e apresenta a aba com explicação", async () => {
    const onSubmit = vi.fn();
    render(<ServiceOrderFormModal open token="token" activeTab={{ id: "t1", name: "Matriz" }} tabs={[{ id: "t1", name: "Matriz" }]} serviceOrderSettings={{}} sectors={[]} onClose={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.getByText(/Define em qual aba do inventário/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Ana" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Título/resumo"), { target: { value: "Troca de memória" } });
    fireEvent.change(screen.getByLabelText("Descrição do problema"), { target: { value: "Falha no módulo" } });
    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "Outro" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Ana" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Bruno" }));
    fireEvent.change(screen.getByLabelText("Solicitante"), { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar OS" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ assignedTechnicianNames: ["Ana", "Bruno"], assignedTechnicianName: "Ana" }));
  });
});
