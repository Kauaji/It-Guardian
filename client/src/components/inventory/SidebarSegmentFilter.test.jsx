import { useEffect } from "react";
import { DndContext, useDndContext } from "@dnd-kit/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SidebarSegmentFilter from "./SidebarSegmentFilter.jsx";

const maintenance = { id: "maintenance", name: "Manutenção", groupId: "g1" };
const regular = { id: "regular", name: "Estações", groupId: "g1" };
const ungrouped = { id: "ungrouped", name: "Laboratório" };
const group = { id: "g1", name: "Escritório", segmentIds: [regular.id, maintenance.id] };
const devices = [
  { id: "d1", segmentId: regular.id },
  { id: "d2", segmentId: ungrouped.id },
  { id: "d3", segmentId: maintenance.id },
  { id: "d4", segmentId: maintenance.id }
];

function DndProbe({ onContext }) {
  const context = useDndContext();
  useEffect(() => { onContext?.(context); }, [context, onContext]);
  return null;
}

function renderFilter(overrides = {}, onContext) {
  return render(
    <DndContext>
      <DndProbe onContext={onContext} />
      <SidebarSegmentFilter
        devices={devices}
        segments={[regular, ungrouped, maintenance]}
        groups={[group]}
        selectedSegmentId="all"
        onSelectGroup={vi.fn()}
        onSelectSegment={vi.fn()}
        {...overrides}
      />
    </DndContext>
  );
}

function buttonForLabel(label) {
  return screen.getByText(label).closest("button");
}

describe("SidebarSegmentFilter — manutenção independente", () => {
  it.each(["Manutenção", "Manutencao", " manutenção ".toUpperCase()])("mostra %s fora dos grupos e exclui suas máquinas das contagens dos grupos", (name) => {
    renderFilter({ segments: [regular, ungrouped, { ...maintenance, name }] });
    const maintenanceButton = buttonForLabel(name.trim());
    const groupButton = buttonForLabel("Escritório");
    const ungroupedButton = buttonForLabel("Sem grupo");

    expect(maintenanceButton.parentElement).toHaveClass("sidebar-segment-filter");
    expect(maintenanceButton.closest(".sidebar-segment-group")).toBeNull();
    expect(maintenanceButton.querySelector("small")).toHaveTextContent("2");
    expect(groupButton.querySelector("small")).toHaveTextContent("1");
    expect(ungroupedButton.querySelector("small")).toHaveTextContent("1");
    expect(buttonForLabel("Todos").querySelector("small")).toHaveTextContent("4");
    expect(within(groupButton.closest("section")).queryByText(name.trim())).not.toBeInTheDocument();
    expect(within(ungroupedButton.closest("section")).queryByText(name.trim())).not.toBeInTheDocument();
    expect(screen.getAllByText(name.trim())).toHaveLength(1);
  });

  it("ignora o vínculo legado em segmentIds sem modificar os dados", () => {
    const segment = Object.freeze({ id: maintenance.id, name: maintenance.name });
    const legacyGroup = Object.freeze({ ...group, segmentIds: Object.freeze([regular.id, maintenance.id]) });
    renderFilter({ segments: [regular, segment], groups: [legacyGroup] });

    expect(buttonForLabel("Manutenção").closest(".sidebar-segment-group")).toBeNull();
    expect(buttonForLabel("Escritório").querySelector("small")).toHaveTextContent("1");
    expect(screen.queryByText("Sem grupo")).not.toBeInTheDocument();
    expect(legacyGroup.segmentIds).toEqual([regular.id, maintenance.id]);
    expect(segment).toEqual({ id: maintenance.id, name: maintenance.name });
  });

  it("seleciona Manutenção pelo ID original mesmo com seu antigo grupo recolhido", () => {
    const onSelectSegment = vi.fn();
    renderFilter({ groups: [{ ...group, collapsed: true }], selectedSegmentId: maintenance.id, onSelectSegment });
    const maintenanceButton = buttonForLabel("Manutenção");

    expect(screen.queryByText("Estações")).not.toBeInTheDocument();
    expect(maintenanceButton).toHaveClass("active");
    fireEvent.click(maintenanceButton);
    expect(onSelectSegment).toHaveBeenCalledExactlyOnceWith(maintenance.id);
    expect(screen.getAllByText("Manutenção")).toHaveLength(1);
  });

  it("não cria Sem grupo quando só há segmentos de manutenção", () => {
    renderFilter({ segments: [{ ...maintenance, groupId: null }], groups: [], devices: devices.slice(2) });

    expect(screen.queryByText("Sem grupo")).not.toBeInTheDocument();
    expect(buttonForLabel("Manutenção").parentElement).toHaveClass("sidebar-segment-filter");
    expect(buttonForLabel("Todos").querySelector("small")).toHaveTextContent("2");
  });

  it("não confunde manutenção preventiva com o segmento especial", () => {
    const preventive = { id: "preventive", name: "Manutenção preventiva", groupId: group.id };
    renderFilter({ segments: [preventive], devices: [{ id: "p1", segmentId: preventive.id }] });

    expect(buttonForLabel(preventive.name).closest(".sidebar-segment-group")).not.toBeNull();
    expect(buttonForLabel("Escritório").querySelector("small")).toHaveTextContent("1");
  });

  it("mantém distintos os IDs legados de manutenção sem duplicar ou agregar cartões", () => {
    const anotherMaintenance = { id: "maintenance-2", name: "Manutencao" };
    const onSelectSegment = vi.fn();
    renderFilter({
      segments: [maintenance, anotherMaintenance],
      devices: [...devices.slice(2), { id: "d5", segmentId: anotherMaintenance.id }],
      onSelectSegment
    });
    const first = buttonForLabel("Manutenção");
    const second = buttonForLabel("Manutencao");

    expect(first.querySelector("small")).toHaveTextContent("2");
    expect(second.querySelector("small")).toHaveTextContent("1");
    expect(buttonForLabel("Escritório").querySelector("small")).toHaveTextContent("0");
    expect(screen.queryByText("Sem grupo")).not.toBeInTheDocument();
    fireEvent.click(first);
    fireEvent.click(second);
    expect(onSelectSegment.mock.calls).toEqual([[maintenance.id], [anotherMaintenance.id]]);
  });

  it("preserva IDs e destinos de arrastar e soltar dos segmentos comuns e das máquinas", () => {
    const onContext = vi.fn();
    const onSelectSegment = vi.fn();
    renderFilter({ onSelectSegment }, onContext);
    const context = onContext.mock.calls.at(-1)[0];

    expect(context.draggableNodes.get(`sidebar-segment-drag-${regular.id}`).data.current).toEqual({
      type: "segment", segmentId: regular.id, origin: "sidebar"
    });
    expect(context.droppableContainers.get(`sidebar-segment-${regular.id}`).data.current).toEqual({
      type: "sidebar-segment", segmentId: regular.id
    });
    expect(context.droppableContainers.get(`sidebar-segment-${maintenance.id}`).data.current).toEqual({
      type: "sidebar-segment", segmentId: maintenance.id
    });
    expect(context.droppableContainers.get(`sidebar-group-${group.id}`).data.current).toEqual({
      type: "sidebar-segment-group-drop", groupId: group.id
    });
    expect(context.droppableContainers.get("sidebar-group-ungrouped").data.current.groupId).toBe("");
    expect(buttonForLabel("Estações").querySelector(".sidebar-segment-drag-handle")).toHaveAttribute("aria-disabled", "false");
    expect(buttonForLabel("Manutenção").querySelector(".sidebar-segment-drag-handle")).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(buttonForLabel("Estações"));
    expect(onSelectSegment).toHaveBeenCalledExactlyOnceWith(regular.id);
  });
});
