import { DndContext } from "@dnd-kit/core";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MachineCard from "./MachineCard.jsx";
import { buildMachineCardClassName, formatLastPing, metricTone, pulseTone, statusLabel, statusTone } from "./machineCard/machineCardPresentation.js";

vi.mock("../../api.js", () => ({ fetchDeviceMetricHistory: vi.fn(async () => ({ points: [], samples: [] })) }));
vi.mock("../remoteAssistance/RemoteAssistanceAction.jsx", () => ({
  default: ({ asset, compact }) => <span data-testid="remote">{asset.id}|{String(compact)}</span>
}));

globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

const segments = [
  { id: "s1", name: "Escritório" },
  { id: "s2", name: "Financeiro", color: "#ff0000" },
  { id: "bkp", name: "Backup", isBackupSegment: true }
];
const pc = { id: "pc1", name: "PC-01", ip: "10.0.0.1", segmentId: "s1", status: "online", assetType: "desktop", metrics: { cpu: 90, ram: 75, disk: 40 }, hardware: { peripherals: [{ id: "p1", type: "Monitor", brand: "LG" }] }, inventorySearchTabName: "Aba X" };
const manual = { id: "m1", name: "SW", ip: "10.0.0.2", segmentId: "s1", status: "offline", source: "manual", assetType: "switch", lastPingAt: "2026-01-02T13:45:00", manualAsset: { brand: "Cisco", model: "2960", assetTag: "NET-1", location: "Sala", hostname: "sw1" }, isBackup: true, backupStatus: "in_use" };

function renderCard(machine = pc, overrides = {}) {
  const props = {
    machine, segments, canManage: true, segmentColor: "#1f7a61", alias: undefined, selected: false,
    onMoveMachine: vi.fn(), onOpenDetails: vi.fn(), onOpenMoveModal: vi.fn(), onRefreshPing: vi.fn(), onSelect: vi.fn(), onToggleSelection: vi.fn(),
    onAddPeripheral: vi.fn(), onRemovePeripheral: vi.fn(), activePopoverId: null, setActivePopoverId: vi.fn(), token: "t", user: { id: "u" }, notify: vi.fn(), ...overrides
  };
  const user = userEvent.setup();
  const utils = render(<DndContext><MachineCard {...props} /></DndContext>);
  return { props, user, ...utils };
}

beforeEach(() => vi.clearAllMocks());

describe("machineCardPresentation", () => {
  it("traduz status, tons e limites", () => {
    expect(statusLabel("online")).toBe("Online");
    expect(statusLabel("problem")).toBe("Erro");
    expect(statusLabel("x")).toBe("Sem dados");
    expect(statusTone("offline")).toBe("unknown");
    expect(statusTone("problem")).toBe("error");
    expect(statusTone(undefined)).toBe("unknown");
    expect(pulseTone("online")).toBe("ok");
    expect(pulseTone("problem")).toBe("danger");
    expect(pulseTone("zzz")).toBe("offline");
    expect(metricTone(85)).toBe("danger");
    expect(metricTone(70)).toBe("warning");
    expect(metricTone(69)).toBe("ok");
    expect(formatLastPing(null)).toBe("--:--");
    expect(formatLastPing("2026-01-02T13:45:00")).toMatch(/13:45/);
  });

  it("monta a classe do cartão na ordem original", () => {
    expect(buildMachineCardClassName({})).toBe(`machine-card${" ".repeat(7)}`);
    expect(buildMachineCardClassName({ isBackup: true, selected: true, isOverlay: true })).toContain("backup-card");
    expect(buildMachineCardClassName({ expanded: true, moveMenuOpen: true, isDragging: true, backupInUse: true }))
      .toBe("machine-card  backup-in-use  details-open move-menu-open dragging ");
  });
});

describe("MachineCard", () => {
  it("mostra nome, IP, tipo, aba da busca e métricas", () => {
    renderCard();
    expect(screen.getByText("PC-01")).toBeInTheDocument();
    expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
    expect(screen.getByText("Aba: Aba X")).toBeInTheDocument();
    expect(screen.getByText("90%")).toHaveClass("danger");
    expect(screen.getByText("75%")).toHaveClass("warning");
    expect(screen.getByTitle("Disco 40%")).toBeInTheDocument();
    expect(screen.getByTestId("remote")).toHaveTextContent("pc1|true");
    expect(screen.getByText("Online", { selector: ".status-dot" })).toHaveClass("online");
  });

  it("usa o apelido e traços para métricas ausentes", () => {
    renderCard({ ...pc, metrics: undefined, status: undefined, source: "agent" }, { alias: "Meu PC" });
    expect(screen.getByText("Meu PC")).toBeInTheDocument();
    expect(screen.getAllByText("--")).toHaveLength(2);
    expect(screen.queryByTitle(/Disco/)).toBeNull();
    expect(screen.getByText("Sem dados", { selector: ".status-dot" })).toBeInTheDocument();
  });

  it("seleciona ao clicar, com ctrl para múltiplos, e fecha popovers", async () => {
    const { props, user } = renderCard();
    await user.click(screen.getByText("10.0.0.1"));
    expect(props.onSelect).toHaveBeenCalledWith(pc, { additive: false });
    expect(props.setActivePopoverId).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByText("10.0.0.1"), { ctrlKey: true });
    expect(props.onSelect).toHaveBeenLastCalledWith(pc, { additive: true });
    await user.click(screen.getByRole("button", { name: "Selecionar equipamento" }));
    expect(props.onToggleSelection).toHaveBeenCalledWith("pc1");
    expect(props.onSelect).toHaveBeenCalledTimes(2);
  });

  it("marca selecionado e fecha popover no arraste", () => {
    const { props } = renderCard(pc, { selected: true });
    expect(document.querySelector(".machine-card")).toHaveClass("selected");
    fireEvent.pointerDown(screen.getByTitle("Arrastar ativo"));
    expect(props.setActivePopoverId).toHaveBeenCalledWith(null);
  });

  it("abre os periféricos e a ficha", async () => {
    const { props, user, rerender } = renderCard();
    await user.click(screen.getByRole("button", { name: "Periféricos" }));
    expect(props.setActivePopoverId).toHaveBeenCalledWith("peripherals-pc1");
    rerender(<DndContext><MachineCard {...props} activePopoverId="peripherals-pc1" /></DndContext>);
    expect(screen.getByRole("button", { name: "Periféricos", expanded: true })).toHaveAttribute("title", "Ocultar periféricos");
    expect(document.querySelector(".machine-details")).toHaveClass("expanded");
    expect(document.querySelector(".machine-card")).toHaveClass("details-open");
    await user.click(screen.getByRole("button", { name: "Periféricos", expanded: true }));
    expect(props.setActivePopoverId).toHaveBeenLastCalledWith(null);
    await user.click(screen.getByRole("button", { name: "Ficha" }));
    expect(props.onOpenDetails).toHaveBeenCalledWith(pc);
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it("move para outro segmento ignorando o atual e o de backup", async () => {
    const { props, user, rerender } = renderCard();
    await user.click(screen.getByRole("button", { name: "Mover" }));
    expect(props.setActivePopoverId).toHaveBeenCalledWith("move-pc1");
    rerender(<DndContext><MachineCard {...props} activePopoverId="move-pc1" /></DndContext>);
    const popover = document.querySelector(".move-menu-popover");
    expect(within(popover).getAllByRole("button").map((button) => button.textContent)).toEqual(["Financeiro"]);
    expect(document.querySelector(".machine-card")).toHaveClass("move-menu-open");
    await user.click(within(popover).getByRole("button", { name: "Financeiro" }));
    expect(props.onMoveMachine).toHaveBeenCalledWith(pc, "s2");
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it("esconde o menu de mover sem destinos e o desabilita sem permissão", () => {
    const first = renderCard(pc, { segments: [segments[0]] });
    expect(screen.queryByRole("button", { name: "Mover" })).toBeNull();
    first.unmount();
    renderCard(pc, { canManage: false });
    expect(screen.getByRole("button", { name: "Mover" })).toBeDisabled();
  });

  it("mostra dados de ativo manual e atualiza o ping", async () => {
    const { props, user } = renderCard(manual);
    expect(screen.getByText("Cisco 2960")).toBeInTheDocument();
    expect(screen.getByText("NET-1")).toBeInTheDocument();
    expect(screen.getByText("13:45")).toBeInTheDocument();
    expect(screen.getByText("Backup em uso")).toHaveClass("in-use");
    expect(screen.getByText("Sala")).toBeInTheDocument();
    expect(screen.getByText("sw1")).toBeInTheDocument();
    expect(screen.queryByText("CPU")).toBeNull();
    await user.click(screen.getByTitle("Atualizar ping"));
    expect(props.onRefreshPing).toHaveBeenCalledWith(manual);
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it("usa textos de reserva do ativo manual e desabilita o ping sem permissão", () => {
    renderCard({ ...manual, isBackup: false, backupStatus: undefined, lastPingAt: undefined, manualAsset: {} }, { canManage: false });
    expect(screen.getByText("Sem localização")).toBeInTheDocument();
    expect(screen.getByText("Sem hostname/MAC")).toBeInTheDocument();
    expect(screen.getByText("--:--")).toBeInTheDocument();
    expect(screen.getByTitle("Atualizar ping")).toBeDisabled();
    expect(screen.queryByText(/Backup/)).toBeNull();
  });

  it("mostra Backup disponível", () => {
    renderCard({ ...pc, isBackup: true });
    expect(screen.getByText("Backup disponível")).toHaveClass("available");
  });

  it("abre o histórico de métricas pelos selos de CPU, RAM e disco", async () => {
    const { user } = renderCard();
    for (const label of ["CPU", "RAM"]) {
      await user.click(screen.getByText(label).closest("button"));
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
      await user.keyboard("{Escape}");
    }
    await user.click(screen.getByTitle("Disco 40%").closest("button"));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
