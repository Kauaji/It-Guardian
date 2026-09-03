import { useEffect } from "react";
import { DndContext, useDndContext } from "@dnd-kit/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InventoryBoard from "./InventoryBoard.jsx";

const maintenance = { id: "maintenance", name: "Manutenção", color: "#f59e0b" };
const regular = { id: "regular", name: "Escritório" };
const machine = { id: "device-1", name: "Computador em reparo", segmentId: maintenance.id, status: "offline" };

function DndProbe({ onContext }) {
  const context = useDndContext();
  useEffect(() => { onContext?.(context); }, [context, onContext]);
  return null;
}

function renderBoard(overrides = {}, onContext) {
  const props = {
    segments: [maintenance, regular],
    machinesBySegment: new Map([[maintenance.id, [machine]]]),
    search: "",
    setSearch: vi.fn(),
    selectedGroupId: "all",
    selectedSegmentId: "all",
    canManage: true,
    ...overrides
  };

  const board = (nextProps) => (
    <DndContext>
      <DndProbe onContext={onContext} />
      <InventoryBoard {...nextProps} />
    </DndContext>
  );
  const result = render(board(props));
  return { ...result, rerenderBoard: (nextProps) => result.rerender(board({ ...props, ...nextProps })) };
}

describe("InventoryBoard — manutenção independente", () => {
  it("renderiza Manutenção fora de Sem grupo e conta somente o segmento comum", () => {
    const { container } = renderBoard();
    const maintenanceCard = screen.getByRole("heading", { name: "Manutenção" }).closest("section");
    const ungrouped = screen.getByText("Sem grupo").closest("section");

    expect(maintenanceCard.parentElement).toHaveClass("segment-stack");
    expect(maintenanceCard.closest(".segment-group-section")).toBeNull();
    expect(within(ungrouped).getByText("1 segmento")).toBeInTheDocument();
    expect(within(ungrouped).queryByRole("heading", { name: "Manutenção" })).toBeNull();
    expect(within(maintenanceCard).getByText(machine.name)).toBeInTheDocument();
    expect(within(maintenanceCard).getByLabelText("Nota de saúde do segmento Manutenção: 60")).toBeInTheDocument();
    expect(container.querySelectorAll(`#inventory-segment-${maintenance.id}`)).toHaveLength(1);
  });

  it("não cria uma caixa Sem grupo quando só existe manutenção", () => {
    renderBoard({ segments: [maintenance] });

    expect(screen.queryByText("Sem grupo")).toBeNull();
    expect(screen.getByRole("heading", { name: "Manutenção" })).toBeInTheDocument();
    expect(screen.queryByText("Nenhum segmento encontrado.")).toBeNull();
  });

  it("exibe manutenção legada fora de um grupo recolhido sem duplicar o cartão", () => {
    const { container } = renderBoard({
      segments: [{ ...maintenance, groupId: "g1" }, regular],
      groups: [{ id: "g1", name: "Grupo recolhido", collapsed: true, segmentIds: [maintenance.id, regular.id] }]
    });
    const group = screen.getByText("Grupo recolhido").closest("section");
    const maintenanceCard = screen.getByRole("heading", { name: "Manutenção" }).closest("section");

    expect(within(group).getByText("1 segmento")).toBeInTheDocument();
    expect(within(group).queryByRole("heading", { name: "Manutenção" })).toBeNull();
    expect(maintenanceCard.parentElement).toHaveClass("segment-stack");
    expect(container.querySelectorAll(`#inventory-segment-${maintenance.id}`)).toHaveLength(1);
  });

  it("mantém o grupo vazio como destino sem atribuir a manutenção a ele", () => {
    renderBoard({
      segments: [{ ...maintenance, groupId: "g1" }],
      groups: [{ id: "g1", name: "Grupo de origem", segmentIds: [maintenance.id] }]
    });
    const group = screen.getByText("Grupo de origem").closest("section");

    expect(within(group).getByText("0 segmentos")).toBeInTheDocument();
    expect(within(group).getByText("Grupo vazio")).toBeInTheDocument();
    expect(within(group).queryByText(machine.name)).toBeNull();
    expect(screen.queryByText("Nenhum segmento encontrado.")).toBeNull();
  });

  it("não mostra estado global vazio quando ainda há grupos como destinos", () => {
    renderBoard({ segments: [], machinesBySegment: new Map(), groups: [{ id: "empty", name: "Novo grupo" }] });

    expect(screen.getByText("Grupo vazio")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum segmento encontrado.")).toBeNull();
  });

  it("preserva os IDs do destino de manutenção e da máquina no arrastar e soltar", () => {
    const onContext = vi.fn();
    renderBoard({}, onContext);
    const context = onContext.mock.calls.at(-1)[0];

    expect(context.droppableContainers.get(`segment-drop-${maintenance.id}`).data.current).toEqual({
      type: "segment",
      segmentId: maintenance.id
    });
    expect(context.draggableNodes.get(machine.id).data.current).toEqual({
      type: "machine",
      machineId: machine.id,
      segmentId: maintenance.id
    });
    expect(context.droppableContainers.get("group-drop-ungrouped").data.current.groupId).toBe("");
  });

  it("o atalho de Manutenção continua selecionando o ID original", () => {
    const onSelectSegment = vi.fn();
    renderBoard({ onSelectSegment, segments: [{ ...maintenance, groupId: "legacy" }, regular] });
    fireEvent.click(screen.getByRole("button", { name: "Filtros do inventário" }));
    fireEvent.click(screen.getByRole("button", { name: "Manutenção", exact: true }));

    expect(onSelectSegment).toHaveBeenCalledWith(maintenance.id);
  });

  it("oculta o cartão e seus filtros quando a contagem real chega a zero", () => {
    renderBoard({
      segments: [{ ...maintenance, machineCount: 2 }, regular],
      devices: [],
      machinesBySegment: new Map()
    });
    expect(screen.queryByRole("heading", { name: "Manutenção" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: regular.name })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filtros do inventário" }));
    expect(screen.queryByRole("button", { name: "Manutenção", exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Manutenção" })).not.toBeInTheDocument();
  });

  it("some só após a última saída, preserva a máquina na origem e reaparece com o mesmo ID", () => {
    const segment = Object.freeze({ ...maintenance, machineCount: 2 });
    const secondMachine = { ...machine, id: "device-2", name: "Segundo computador" };
    const sourceSegments = Object.freeze([segment, regular]);
    const { container, rerenderBoard } = renderBoard({
      segments: sourceSegments,
      devices: [machine, secondMachine],
      machinesBySegment: new Map([[maintenance.id, [machine, secondMachine]]])
    });
    expect(within(screen.getByRole("heading", { name: maintenance.name }).closest("section")).getByText("2 máquinas")).toBeInTheDocument();

    rerenderBoard({ devices: [machine], machinesBySegment: new Map([[maintenance.id, [machine]]]) });
    expect(screen.getByRole("heading", { name: maintenance.name })).toBeInTheDocument();
    const returnedMachine = { ...machine, segmentId: regular.id, maintenance: false };
    rerenderBoard({
      devices: [returnedMachine],
      machinesBySegment: new Map([[regular.id, [returnedMachine]]])
    });
    expect(screen.queryByRole("heading", { name: maintenance.name })).not.toBeInTheDocument();
    expect(within(screen.getByRole("heading", { name: regular.name }).closest("section")).getByText(machine.name)).toBeInTheDocument();
    expect(sourceSegments).toEqual([segment, regular]);
    expect(segment.machineCount).toBe(2);

    rerenderBoard({ devices: [machine], machinesBySegment: new Map([[maintenance.id, [machine]]]) });
    expect(screen.getByRole("heading", { name: maintenance.name })).toBeInTheDocument();
    expect(container.querySelectorAll("#inventory-segment-maintenance")).toHaveLength(1);
  });

  it("uma busca sem resultados não transforma uma manutenção ocupada em segmento vazio", () => {
    const { rerenderBoard } = renderBoard({
      devices: [machine],
      search: "inexistente",
      machinesBySegment: new Map()
    });
    expect(screen.queryByRole("heading", { name: maintenance.name })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filtros do inventário" }));
    expect(screen.getByRole("button", { name: maintenance.name, exact: true })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: maintenance.name })).toBeInTheDocument();
    rerenderBoard({ devices: [machine], search: "", machinesBySegment: new Map([[maintenance.id, [machine]]]) });
    expect(screen.getByRole("heading", { name: maintenance.name })).toBeInTheDocument();
  });

  it("não remove a manutenção vazia dos destinos de movimentação recebidos", () => {
    const onMoveMachine = vi.fn();
    const movingMachine = { ...machine, segmentId: regular.id };
    renderBoard({
      devices: [movingMachine],
      machinesBySegment: new Map([[regular.id, [movingMachine]]]),
      moveModal: movingMachine,
      moveTarget: maintenance.id,
      onMoveMachine
    });
    expect(screen.queryByRole("heading", { name: maintenance.name })).not.toBeInTheDocument();
    const modal = screen.getByRole("dialog", { name: "Mover maquina" });
    expect(within(modal).getByRole("option", { name: maintenance.name })).toHaveValue(maintenance.id);
    fireEvent.click(within(modal).getByRole("button", { name: "Mover", exact: true }));
    expect(onMoveMachine).toHaveBeenCalledExactlyOnceWith(movingMachine, maintenance.id);
  });
});
