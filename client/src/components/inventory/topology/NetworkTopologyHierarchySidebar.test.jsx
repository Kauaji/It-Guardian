import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NetworkTopologyHierarchySidebar from "./NetworkTopologyHierarchySidebar.jsx";
import { buildHierarchyTree } from "./networkTopologyHierarchy.js";

const tree = buildHierarchyTree({
  groups: [{ id: "g1", name: "Infraestrutura" }],
  segments: [
    { id: "s1", name: "Estações", groupId: "g1" },
    { id: "s2", name: "Servidores de backup" },
    { id: "m1", name: "Manutenção", groupId: "g1" },
    { id: "b1", name: "Backup", groupId: "g1" },
    { id: "m2", name: "Oficina", isMaintenanceSegment: true }
  ],
  devices: [
    { id: "d1", name: "Estação Recepção", segmentId: "s1", status: "online" },
    { id: "d2", name: "Servidor de arquivos", segmentId: "s2", status: "online" },
    { id: "d3", name: "Computador em reparo", segmentId: "m1", status: "problem" },
    { id: "d4", name: "Computador reserva", segmentId: "b1", status: "offline" },
    { id: "d5", name: "Notebook em reparo", segmentId: "m2", status: "problem" }
  ]
});

function renderSidebar(overrides = {}) {
  const props = {
    tabs: [{ id: "tab1", name: "Ambiente" }],
    activeTabId: "tab1",
    tree,
    onSelectGroup: vi.fn(),
    onSelectSegment: vi.fn(),
    onSelectTab: vi.fn(),
    ...overrides
  };
  return { ...render(<NetworkTopologyHierarchySidebar {...props} />), props };
}

describe("NetworkTopologyHierarchySidebar", () => {
  it("omite manutenção e backup da árvore e das contagens sem esconder segmentos comuns", () => {
    renderSidebar();
    expect(screen.queryByText("Manutenção")).not.toBeInTheDocument();
    expect(screen.queryByText("Backup")).not.toBeInTheDocument();
    expect(screen.queryByText("Oficina")).not.toBeInTheDocument();
    expect(screen.getByText("Estações")).toBeInTheDocument();
    expect(screen.getByText("Servidores de backup")).toBeInTheDocument();
    const group = screen.getByText("Infraestrutura").closest("button");
    expect(within(group).getByText("1")).toHaveAttribute("title", "1 ativo(s) em 1 segmento(s)");
    expect(screen.queryByLabelText("Segmentos de manutenção independentes")).not.toBeInTheDocument();
  });

  it("a busca por backup encontra o nome comum sem recuperar a fila operacional", () => {
    renderSidebar();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar grupo ou segmento" }), { target: { value: "backup" } });
    expect(screen.getByText("Servidores de backup")).toBeInTheDocument();
    expect(screen.queryByText("Backup")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar grupo ou segmento" }), { target: { value: "manutenção" } });
    expect(screen.getByText("Nenhum grupo ou segmento encontrado.")).toBeInTheDocument();
    expect(screen.queryByText("Manutenção")).not.toBeInTheDocument();
  });

  it("mantém navegação e expansão dos ativos reais nos segmentos elegíveis", () => {
    const { props } = renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Expandir segmento Servidores de backup" }));
    const asset = screen.getByRole("button", { name: "Servidor de arquivos" });
    fireEvent.click(asset);
    expect(props.onSelectSegment).toHaveBeenCalledExactlyOnceWith("s2", null);
    expect(screen.queryByText("Computador em reparo")).not.toBeInTheDocument();
    expect(screen.queryByText("Computador reserva")).not.toBeInTheDocument();
  });

  it("ignora o campo maintenanceSegments legado sem editar a árvore recebida", () => {
    const legacyMaintenance = Object.freeze({ id: "m-old", name: "Manutenção", deviceCount: 1 });
    const legacyTree = Object.freeze({ ...tree, maintenanceSegments: Object.freeze([legacyMaintenance]) });
    renderSidebar({ tree: legacyTree });
    expect(screen.queryByText("Manutenção")).not.toBeInTheDocument();
    expect(legacyTree.maintenanceSegments[0]).toBe(legacyMaintenance);
  });
});
