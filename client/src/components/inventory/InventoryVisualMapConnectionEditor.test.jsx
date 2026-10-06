import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InventoryVisualMapConnectionEditor from "./InventoryVisualMapConnectionEditor.jsx";

const draft = {
  layer: "infrastructure",
  connectionType: "network_cable",
  label: "Cabo rack A",
  color: "#112233",
  thickness: 4,
  dashed: true,
  points: [
    { x: 1, y: 2, z: 3 },
    { x: 4, y: 5, z: 6 }
  ],
  metadata: { circuit: "C-12", note: "reserva" },
  notes: "Observação"
};

function renderEditor(props = {}) {
  const handlers = {
    onChange: vi.fn(),
    onPointChange: vi.fn(),
    onAddPoint: vi.fn(),
    onRemovePoint: vi.fn(),
    onMetadataChange: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onCancel: vi.fn()
  };
  const result = render(<InventoryVisualMapConnectionEditor draft={draft} canManage saving={false} {...handlers} {...props} />);
  return { ...result, handlers };
}

describe("InventoryVisualMapConnectionEditor", () => {
  it("não renderiza nada sem rascunho", () => {
    const { container } = renderEditor({ draft: null });
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra os campos do rascunho e filtra os tipos pela camada", () => {
    renderEditor();

    expect(screen.getByText("Editar conexão")).toBeVisible();
    expect(screen.getByLabelText("Camada")).toHaveValue("infrastructure");
    expect(screen.getByLabelText("Identificacao")).toHaveValue("Cabo rack A");
    expect(screen.getByLabelText("Cor")).toHaveValue("#112233");
    expect(screen.getByLabelText("Espessura")).toHaveValue(4);
    expect(screen.getByLabelText("Tracejada")).toBeChecked();
    expect(screen.getByLabelText("Circuito")).toHaveValue("C-12");
    expect(screen.getByLabelText("Nota")).toHaveValue("reserva");
    expect(screen.getByLabelText("Notas")).toHaveValue("Observação");
    expect(screen.getByLabelText("Ponto 2 Z")).toHaveValue(6);
    const typeSelect = screen.getByLabelText("Tipo");
    expect(typeSelect.querySelectorAll("option").length).toBeGreaterThan(0);
    expect(typeSelect).toHaveValue("network_cable");
  });

  it("propaga edições de campos, pontos e metadados", () => {
    const { handlers } = renderEditor();

    fireEvent.change(screen.getByLabelText("Camada"), { target: { value: "electrical" } });
    expect(handlers.onChange).toHaveBeenCalledWith("layer", "electrical");
    fireEvent.change(screen.getByLabelText("Identificacao"), { target: { value: "Novo" } });
    expect(handlers.onChange).toHaveBeenCalledWith("label", "Novo");
    fireEvent.click(screen.getByLabelText("Tracejada"));
    expect(handlers.onChange).toHaveBeenCalledWith("dashed", false);
    fireEvent.change(screen.getByLabelText("Ponto 1 Y"), { target: { value: "9" } });
    expect(handlers.onPointChange).toHaveBeenCalledWith(0, "y", "9");
    fireEvent.change(screen.getByLabelText("Disjuntor"), { target: { value: "D1" } });
    expect(handlers.onMetadataChange).toHaveBeenCalledWith("breaker", "D1");
    fireEvent.change(screen.getByLabelText("Notas"), { target: { value: "x" } });
    expect(handlers.onChange).toHaveBeenCalledWith("notes", "x");
  });

  it("adiciona, remove (mínimo de 2 pontos) e aciona salvar, remover e cancelar", () => {
    const { handlers } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Ponto" }));
    expect(handlers.onAddPoint).toHaveBeenCalled();
    expect(screen.getAllByTitle("Remover ponto")[0]).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Salvar conexão" }));
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(handlers.onSave).toHaveBeenCalled();
    expect(handlers.onDelete).toHaveBeenCalled();
    expect(handlers.onCancel).toHaveBeenCalled();
  });

  it("permite remover um ponto quando há mais de dois", () => {
    const { handlers } = renderEditor({ draft: { ...draft, points: [...draft.points, { x: 7, y: 8, z: 9 }] } });

    fireEvent.click(screen.getAllByTitle("Remover ponto")[2]);
    expect(handlers.onRemovePoint).toHaveBeenCalledWith(2);
  });

  it("bloqueia a edição e oculta ações sem permissão de gerenciar", () => {
    renderEditor({ canManage: false });

    expect(screen.getByLabelText("Camada")).toBeDisabled();
    expect(screen.getByLabelText("Ponto 1 X")).toBeDisabled();
    expect(screen.getByLabelText("Notas")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Salvar conexão" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ponto" })).not.toBeInTheDocument();
    expect(screen.queryByTitle("Remover ponto")).not.toBeInTheDocument();
  });

  it("desabilita as ações enquanto salva", () => {
    renderEditor({ saving: true });

    expect(screen.getByRole("button", { name: "Salvar conexão" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ponto" })).toBeDisabled();
  });
});
