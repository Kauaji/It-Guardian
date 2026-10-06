import { DndContext, useDndContext } from "@dnd-kit/core";
import { useEffect } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SegmentCard from "./SegmentCard.jsx";

vi.mock("../../api.js", () => ({ fetchDeviceMetricHistory: vi.fn(async () => ({ points: [], samples: [] })) }));
vi.mock("../remoteAssistance/RemoteAssistanceAction.jsx", () => ({ default: () => null }));

function Probe({ onContext }) {
  const context = useDndContext();
  useEffect(() => { onContext(context); }, [context, onContext]);
  return null;
}

const segment = { id: "s1", name: "Escritório", color: "#10b981" };
const machines = [
  { id: "m1", name: "PC-01", ip: "10.0.0.1", segmentId: "s1", status: "online", metrics: { cpu: 10, ram: 20 } },
  { id: "m2", name: "PC-02", ip: "10.0.0.2", segmentId: "s1", status: "offline" }
];

function renderSegment(overrides = {}, onContext = () => {}) {
  const props = {
    segment, machines, segments: [segment], aliases: { m1: "Apelido" }, selectedAssetIds: new Set(["m2"]), canManage: true,
    onRename: vi.fn(), onDelete: vi.fn(), onColorChange: vi.fn(), onMoveMachine: vi.fn(), onOpenDetails: vi.fn(), onOpenMoveModal: vi.fn(),
    onRefreshPing: vi.fn(), onSelectAsset: vi.fn(), onToggleSelection: vi.fn(), onMoveSegmentOrder: vi.fn(), canMoveSegmentUp: true, canMoveSegmentDown: true,
    selected: false, onSelectSegment: vi.fn(), onAddPeripheral: vi.fn(), onRemovePeripheral: vi.fn(), activePopoverId: null, setActivePopoverId: vi.fn(),
    token: "t", user: {}, notify: vi.fn(), ...overrides
  };
  const user = userEvent.setup();
  const tree = (next) => <DndContext><Probe onContext={onContext} /><SegmentCard {...props} {...next} /></DndContext>;
  const utils = render(tree());
  return { props, user, ...utils, rerenderSegment: (next) => utils.rerender(tree(next)) };
}

beforeEach(() => vi.clearAllMocks());

describe("SegmentCard", () => {
  it("renderiza título, contagem, nota de saúde e cartões com apelido e seleção", () => {
    renderSegment();
    const section = document.getElementById("inventory-segment-s1");
    expect(within(section).getByRole("heading", { name: "Escritório" })).toBeInTheDocument();
    expect(within(section).getByText("2 máquinas")).toBeInTheDocument();
    expect(within(section).getByLabelText(/Nota de saúde do segmento Escritório:/)).toHaveAttribute("tabindex", "0");
    expect(within(section).getByText("Apelido")).toBeInTheDocument();
    expect(section.style.getPropertyValue("--segment-color")).toBe("#10b981");
    expect(section.querySelectorAll(".machine-card.selected")).toHaveLength(1);
  });

  it("usa singular para uma máquina e o estado vazio", () => {
    const first = renderSegment({ machines: [machines[0]] });
    expect(screen.getByText("1 máquina")).toBeInTheDocument();
    first.unmount();
    renderSegment({ machines: [] });
    expect(screen.getByText("0 máquinas")).toBeInTheDocument();
    expect(screen.getByText("Solte máquinas aqui")).toBeInTheDocument();
    expect(screen.getByLabelText(/sem dados/)).toBeInTheDocument();
  });

  it("aplica cores do segmento padrão, de backup e a cor padrão", () => {
    const def = renderSegment({ segment: { ...segment, isDefault: true } });
    expect(document.querySelector(".segment-card")).toHaveClass("default-segment-card");
    expect(document.querySelector(".segment-card").style.getPropertyValue("--segment-color")).toBe("#111827");
    def.unmount();
    const backup = renderSegment({ segment: { ...segment, isBackupSegment: true } });
    expect(document.querySelector(".segment-card")).toHaveClass("backup-segment-card");
    expect(document.querySelector(".segment-card").style.getPropertyValue("--segment-color")).toBe("#f97316");
    backup.unmount();
    renderSegment({ segment: { id: "s9", name: "Sem cor" } });
    expect(document.querySelector(".segment-card").style.getPropertyValue("--segment-color")).toBe("#1f7a61");
  });

  it("recolhe o segmento padrão pelo botão dedicado", async () => {
    const { user } = renderSegment({ segment: { ...segment, isDefault: true } });
    expect(screen.queryByRole("button", { name: "Ações do segmento" })).toBeNull();
    expect(screen.getByTitle("Segmento padrão não pode ser movido")).toBeDisabled();
    const toggle = screen.getByTitle("Recolher segmento");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);
    expect(screen.queryByText("PC-01")).toBeNull();
    expect(screen.getByTitle("Expandir segmento")).toHaveClass("collapsed");
    await user.click(screen.getByTitle("Expandir segmento"));
    expect(screen.getByText("Apelido")).toBeInTheDocument();
  });

  it("abre o menu de ações e executa cada ação fechando o popover", async () => {
    const first = renderSegment();
    await first.user.click(screen.getByRole("button", { name: "Ações do segmento" }));
    expect(first.props.setActivePopoverId).toHaveBeenCalledWith("segment-actions-s1");
    first.unmount();

    for (const [label, handler, args] of [
      ["Subir segmento", "onMoveSegmentOrder", [segment, "up"]],
      ["Descer segmento", "onMoveSegmentOrder", [segment, "down"]],
      ["Renomear segmento", "onRename", [segment]],
      ["Excluir segmento", "onDelete", [segment]]
    ]) {
      const { props, user, unmount } = renderSegment({ activePopoverId: "segment-actions-s1" });
      await user.click(screen.getByRole("button", { name: label }));
      expect(props[handler]).toHaveBeenCalledWith(...args);
      expect(props.setActivePopoverId).toHaveBeenLastCalledWith(null);
      unmount();
    }
  });

  it("recolhe e expande pelo menu e altera a cor", async () => {
    const { user, props, rerenderSegment } = renderSegment({ activePopoverId: "segment-actions-s1" });
    expect(screen.getByRole("button", { name: "Ações do segmento", expanded: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Recolher segmento" }));
    expect(screen.queryByText("Apelido")).toBeNull();
    rerenderSegment({ activePopoverId: "segment-actions-s1" });
    expect(screen.getByRole("button", { name: "Expandir segmento" })).toBeInTheDocument();
    const strip = document.querySelector(".segment-inline-actions");
    await user.click(within(strip).getByRole("button", { name: /cor/i }));
    await user.click(screen.getAllByRole("button", { name: /#/ })[1] || document.querySelector(".color-option"));
    expect(props.onColorChange).toHaveBeenCalled();
  });

  it("omite ordenação, cor, renomear e excluir sem permissão ou sem destino", () => {
    renderSegment({ activePopoverId: "segment-actions-s1", canManage: false });
    const strip = document.querySelector(".segment-inline-actions");
    expect(within(strip).getAllByRole("button")).toHaveLength(1);
    expect(screen.getByTitle("Mover segmento")).toBeDisabled();
  });

  it("omite subir e descer quando não há vizinhos", () => {
    renderSegment({ activePopoverId: "segment-actions-s1", canMoveSegmentUp: false, canMoveSegmentDown: false });
    expect(screen.queryByRole("button", { name: "Subir segmento" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Descer segmento" })).toBeNull();
    expect(screen.getByRole("button", { name: "Renomear segmento" })).toBeInTheDocument();
  });

  it("seleciona o segmento com ctrl/cmd no título sem iniciar arraste", () => {
    const { props } = renderSegment();
    const handle = screen.getByTitle("Mover segmento");
    fireEvent.click(handle);
    expect(props.onSelectSegment).not.toHaveBeenCalled();
    fireEvent.click(handle, { ctrlKey: true });
    fireEvent.click(handle, { metaKey: true });
    expect(props.onSelectSegment).toHaveBeenCalledWith("s1", true);
    expect(props.onSelectSegment).toHaveBeenCalledTimes(2);
    fireEvent.pointerDown(handle);
    expect(props.setActivePopoverId).toHaveBeenCalledWith(null);
  });

  it("marca segmento selecionado e registra destino e origem de arraste", () => {
    const onContext = vi.fn();
    renderSegment({ selected: true }, onContext);
    expect(document.querySelector(".segment-card")).toHaveClass("segment-selected");
    const context = onContext.mock.calls.at(-1)[0];
    expect(context.droppableContainers.get("segment-drop-s1").data.current).toEqual({ type: "segment", segmentId: "s1" });
    expect(context.draggableNodes.get("segment-drag-s1").data.current).toEqual({ type: "segment", segmentId: "s1", origin: "board" });
  });

  it("aceita os callbacks opcionais ausentes", async () => {
    const { user } = renderSegment({ setActivePopoverId: undefined, onSelectSegment: undefined, onMoveSegmentOrder: undefined, activePopoverId: "segment-actions-s1" });
    await user.click(screen.getByRole("button", { name: "Subir segmento" }));
    fireEvent.click(screen.getByTitle("Mover segmento"), { ctrlKey: true });
    fireEvent.pointerDown(screen.getByTitle("Mover segmento"));
  });
});
