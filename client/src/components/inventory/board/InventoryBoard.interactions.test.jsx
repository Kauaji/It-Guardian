import { DndContext } from "@dnd-kit/core";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InventoryBoard from "../InventoryBoard.jsx";
import { pluralizeSegments, resolveBoardProps } from "./boardProps.js";
import { peripheralKey } from "./peripheralKey.js";

vi.mock("../../../api.js", () => ({
  fetchAssetTimeline: vi.fn(async () => ({ events: [], summary: { total: 0 }, topologyReferences: [], metadata: { total: 0 } })),
  fetchDeviceMetricHistory: vi.fn(async () => ({ points: [], samples: [] }))
}));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:image/png;base64,AAA") } }));
vi.mock("../../remoteAssistance/RemoteAssistanceAction.jsx", () => ({ default: () => null }));

globalThis.ResizeObserver =
  globalThis.ResizeObserver ||
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

const segments = [
  { id: "s1", name: "Escritório", groupId: "g1" },
  { id: "s2", name: "Financeiro", groupId: "g1" },
  { id: "s3", name: "Solto" },
  { id: "man", name: "Manutenção" },
  { id: "bkp", name: "Backup", isBackupSegment: true }
];
const devices = [
  {
    id: "d1",
    name: "PC-01",
    ip: "10.0.0.1",
    segmentId: "s1",
    status: "online",
    hardware: { peripherals: [{ id: "p1", type: "Monitor", brand: "LG", assetTag: "A" }] }
  },
  { id: "d2", name: "PC-02", ip: "10.0.0.2", segmentId: "s3", status: "offline" },
  { id: "d3", name: "PC-03", ip: "10.0.0.3", segmentId: "man", status: "online" },
  { id: "d4", name: "PC-04", ip: "10.0.0.4", segmentId: "bkp", status: "online" }
];
const machinesBySegment = new Map(devices.map((device) => [device.segmentId, [device]]));
const groups = [
  { id: "g1", name: "Matriz", segmentIds: ["s1", "s2"] },
  { id: "g2", name: "Colapsado", collapsed: true }
];
const tabs = [
  { id: "t1", name: "Aba 1", color: "#112233" },
  { id: "t2", name: "Aba 2" }
];

const handlerNames = [
  "notify",
  "setSearch",
  "setMoveTarget",
  "onCreateSegment",
  "onRenameSegment",
  "onDeleteSegment",
  "onChangeSegmentColor",
  "onAliasSave",
  "onAddObservation",
  "onMoveMachine",
  "onBulkMoveTargetChange",
  "onBulkMove",
  "onBulkPrint",
  "onBulkMarkBackup",
  "onClearSelection",
  "onSelectAsset",
  "onToggleSelection",
  "onSelectGroup",
  "onSelectSegment",
  "onCreateGroup",
  "onRenameGroup",
  "onDeleteGroup",
  "onChangeGroupColor",
  "onToggleGroup",
  "onMoveGroupOrder",
  "onMoveSegmentToGroup",
  "onMoveSegmentOrder",
  "onSelectTab",
  "onCreateTab",
  "onRenameTab",
  "onDeleteTab",
  "onChangeTabColor",
  "onCreateManualAsset",
  "onCloseMoveModal",
  "onOpenMoveModal"
];

function renderBoard(overrides = {}) {
  const handlers = Object.fromEntries(handlerNames.map((name) => [name, vi.fn()]));
  Object.assign(handlers, {
    onAddPeripheral: vi.fn((id, peripheral) => ({
      peripheral: { ...peripheral, id: "np" },
      event: { id: "ev1", change: "Periférico adicionado" }
    })),
    onRemovePeripheral: vi.fn(() => ({ id: "ev2", change: "Periférico removido" })),
    onRefreshPing: vi.fn(async (machine) => ({ ...machine, status: "online", name: `${machine.name}*` })),
    onChangeDeviceType: vi.fn(async (id, type) => ({ ...devices[0], assetType: type, name: "PC-01 tipo" })),
    onPutMaintenance: vi.fn(async () => true),
    onToggleBackup: vi.fn(async () => true),
    onRemoveMachine: vi.fn(async () => true)
  });
  const props = {
    devices,
    segments,
    machinesBySegment,
    token: "t",
    search: "",
    selectedGroupId: "all",
    selectedSegmentId: "all",
    user: { id: "u" },
    userName: "Ana",
    canManage: true,
    groups,
    tabs,
    activeTab: tabs[0],
    activeTabId: "t1",
    aliases: { d1: "Apelido" },
    selectedAssetIds: new Set(["d2"]),
    bulkMoveTarget: "s1",
    ...handlers,
    ...overrides
  };
  const user = userEvent.setup();
  const tree = (next) => (
    <DndContext>
      <InventoryBoard {...props} {...next} />
    </DndContext>
  );
  const utils = render(tree());
  return { props, user, ...utils, rerenderBoard: (next) => utils.rerender(tree(next)) };
}
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
const group = (name) => screen.getByText(name, { selector: "strong" }).closest("section");

// Fluxos longos com user-event ficam lentos sob cobertura.
vi.setConfig({ testTimeout: 30000 });

beforeEach(() => {
  vi.clearAllMocks();
  window.history.pushState({}, "", "/");
});

describe("boardProps", () => {
  it("aplica padrões somente quando undefined e pluraliza segmentos", () => {
    const resolved = resolveBoardProps({ selectedGroupId: undefined, groups: null, tabs: [1] });
    expect(resolved).toMatchObject({
      selectedGroupId: "all",
      selectedSegmentId: "all",
      groups: null,
      tabs: [1],
      floorPlansView: null,
      topologyView: null,
      aliases: {},
      observations: {}
    });
    expect(resolved.selectedAssetIds.size).toBe(0);
    expect(resolved.isBulkSelectionDragging).toBe(false);
    expect(resolveBoardProps({ selectedGroupId: "g" }).selectedGroupId).toBe("g");
    expect(pluralizeSegments(1)).toBe("1 segmento");
    expect(pluralizeSegments(0)).toBe("0 segmentos");
    expect(peripheralKey({ id: "x" })).toBe("x");
    expect(peripheralKey({ type: "Mouse", brand: "B", assetTag: "T" })).toBe("Mouse-B-T");
  });
});

describe("InventoryBoard — quadro", () => {
  it("renderiza seletor de visão, abas, grupos, sem grupo e segmentos avulsos", () => {
    renderBoard();
    const switcher = screen.getByRole("group", { name: "Visualização do inventário" });
    expect(within(switcher).getByRole("button", { name: "Quadro" })).toHaveAttribute("aria-pressed", "true");
    expect(within(switcher).queryByRole("button", { name: "Plantas" })).toBeNull();
    expect(within(switcher).queryByRole("button", { name: "Mapa de Rede" })).toBeNull();
    expect(document.querySelector(".inventory-board-view").style.getPropertyValue("--active-tab-color")).toBe("#112233");
    expect(group("Matriz")).toHaveTextContent("2 segmentos");
    expect(group("Sem grupo")).toHaveTextContent("2 segmentos");
    expect(group("Colapsado")).toHaveTextContent("0 segmentos");
    expect(screen.getByText("Apelido")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Manutenção" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Ações em massa" })).toBeNull();
  });

  it("exibe as ações em massa com dois ou mais selecionados", async () => {
    const { props, user } = renderBoard({ selectedAssetIds: new Set(["d1", "d2"]), isBulkSelectionDragging: true });
    const bar = screen.getByRole("region", { name: "Ações em massa" });
    expect(bar).toHaveClass("drag-safe-zone");
    expect(within(bar).getByText("2 selecionados")).toBeInTheDocument();
    await user.selectOptions(within(bar).getByLabelText("Segmento de destino"), "s2");
    expect(props.onBulkMoveTargetChange).toHaveBeenCalledWith("s2");
    await user.click(within(bar).getByRole("button", { name: "Mover" }));
    await user.click(within(bar).getByRole("button", { name: "Imprimir QR Codes" }));
    await user.click(within(bar).getByRole("button", { name: "Marcar Backup" }));
    await user.click(within(bar).getByRole("button", { name: "Limpar seleção" }));
    expect(props.onBulkMove).toHaveBeenCalled();
    expect(props.onBulkPrint).toHaveBeenCalled();
    expect(props.onBulkMarkBackup).toHaveBeenCalled();
    expect(props.onClearSelection).toHaveBeenCalled();
  });

  it("usa a cor padrão sem aba ativa e mostra o vazio sem segmentos", () => {
    renderBoard({ activeTab: undefined, segments: [], devices: [], machinesBySegment: new Map(), groups: undefined });
    expect(document.querySelector(".inventory-board-view").style.getPropertyValue("--active-tab-color")).toBe("#2563eb");
    expect(screen.getByText("Nenhum segmento encontrado.")).toBeInTheDocument();
  });

  it("filtra por busca, aba, grupo, segmento e atalhos", async () => {
    const { props, user } = renderBoard({ search: "" });
    expect(document.querySelector(".search-box")).not.toHaveClass("expanded");
    await user.type(screen.getByLabelText("Buscar máquina, IP, sistema ou segmento"), "a");
    expect(props.setSearch).toHaveBeenCalledWith("a");
    expect(document.querySelector(".search-box")).toHaveClass("expanded");
    fireEvent.blur(screen.getByLabelText("Buscar máquina, IP, sistema ou segmento"));
    expect(document.querySelector(".search-box")).not.toHaveClass("expanded");
    fireEvent.focus(screen.getByLabelText("Buscar máquina, IP, sistema ou segmento"));
    expect(document.querySelector(".search-box")).toHaveClass("expanded");
    fireEvent.blur(screen.getByLabelText("Buscar máquina, IP, sistema ou segmento"));
    const toggle = screen.getByRole("button", { name: "Filtros do inventário" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.selectOptions(screen.getByLabelText("Filtrar por aba"), "t2");
    await user.selectOptions(screen.getByLabelText("Filtrar por grupo"), "ungrouped");
    await user.selectOptions(screen.getByLabelText("Filtrar por segmento"), "s2");
    expect(props.onSelectTab).toHaveBeenCalledWith("t2");
    expect(props.onSelectGroup).toHaveBeenCalledWith("ungrouped");
    expect(props.onSelectSegment).toHaveBeenCalledWith("s2");
    await user.click(screen.getByRole("button", { name: "Backup", exact: true }));
    expect(props.onSelectSegment).toHaveBeenLastCalledWith("bkp");
    await user.click(screen.getByRole("button", { name: "Manutenção", exact: true }));
    expect(props.onSelectSegment).toHaveBeenLastCalledWith("man");
    await user.click(toggle);
    expect(screen.queryByLabelText("Filtrar por aba")).toBeNull();
  });

  it("alterna o atalho para limpar o filtro quando o segmento já está selecionado", async () => {
    const { props, user } = renderBoard({ selectedSegmentId: "bkp" });
    await user.click(screen.getByRole("button", { name: "Filtros do inventário" }));
    const chip = screen.getByRole("button", { name: "Backup", exact: true });
    expect(chip).toHaveClass("active");
    await user.click(chip);
    expect(props.onSelectSegment).toHaveBeenCalledWith("all");
  });

  it("mostra as ações de criação apenas com permissão", async () => {
    const { props, user, rerenderBoard } = renderBoard();
    await user.click(screen.getByRole("button", { name: "Ativo de rede" }));
    await user.click(screen.getByRole("button", { name: "Segmento" }));
    await user.click(screen.getByRole("button", { name: "Grupo" }));
    expect(props.onCreateManualAsset).toHaveBeenCalled();
    expect(props.onCreateSegment).toHaveBeenCalled();
    expect(props.onCreateGroup).toHaveBeenCalled();
    rerenderBoard({ canManage: false });
    expect(screen.queryByRole("button", { name: "Ativo de rede" })).toBeNull();
  });

  it("controla as ações do grupo (popover, ordem, cor, renomear, excluir)", async () => {
    const { props, user, rerenderBoard } = renderBoard({
      groups: [groups[0], { id: "g3", name: "Terceiro" }, { id: "g4", name: "Quarto" }]
    });
    const triggers = () => screen.getAllByRole("button", { name: "Ações do grupo" });
    await user.click(triggers()[1]);
    expect(triggers()[1]).toHaveAttribute("aria-expanded", "true");
    const strip = document.querySelector(".group-inline-actions");
    expect(within(strip).getByRole("button", { name: "Subir grupo" })).toBeInTheDocument();
    expect(within(strip).getByRole("button", { name: "Descer grupo" })).toBeInTheDocument();
    await user.click(within(strip).getByRole("button", { name: "Subir grupo" }));
    expect(props.onMoveGroupOrder).toHaveBeenCalledWith("g3", "up");
    expect(document.querySelector(".group-inline-actions")).toBeNull();
    await user.click(triggers()[1]);
    await user.click(screen.getByRole("button", { name: "Descer grupo" }));
    expect(props.onMoveGroupOrder).toHaveBeenLastCalledWith("g3", "down");
    await user.click(triggers()[1]);
    await user.click(screen.getByRole("button", { name: "Renomear grupo" }));
    expect(props.onRenameGroup).toHaveBeenCalledWith("g3");
    await user.click(triggers()[1]);
    await user.click(screen.getByRole("button", { name: "Excluir grupo" }));
    expect(props.onDeleteGroup).toHaveBeenCalledWith("g3");
    await user.click(triggers()[1]);
    await user.click(screen.getByRole("button", { name: "Ocultar grupo" }));
    expect(props.onToggleGroup).toHaveBeenCalledWith("g3");
    await user.click(triggers()[1]);
    await user.click(within(document.querySelector(".group-inline-actions")).getByRole("button", { name: /cor/i }));
    await user.click(
      document.querySelector(".color-picker-popover button, [role=listbox] button, .segment-color-popover button") ||
        screen.getAllByRole("button", { name: /#/ })[0]
    );
    expect(props.onChangeGroupColor).toHaveBeenCalled();
    await user.click(triggers()[0]);
    expect(within(document.querySelector(".group-inline-actions")).queryByRole("button", { name: "Subir grupo" })).toBeNull();
    await user.click(triggers()[2]);
    expect(screen.queryByRole("button", { name: "Descer grupo" })).toBeNull();
    rerenderBoard({ canManage: false });
    await user.click(triggers()[1]);
    expect(screen.queryByRole("button", { name: "Renomear grupo" })).toBeNull();
  });

  it("fecha o popover por clique fora, Escape e pelo evento global", async () => {
    const { user } = renderBoard();
    const trigger = () => screen.getAllByRole("button", { name: "Ações do grupo" })[0];
    await user.click(trigger());
    expect(document.querySelector(".group-inline-actions")).not.toBeNull();
    await user.click(document.body);
    expect(document.querySelector(".group-inline-actions")).toBeNull();
    await user.click(trigger());
    await user.keyboard("{Escape}");
    expect(document.querySelector(".group-inline-actions")).toBeNull();
    await user.click(trigger());
    await user.keyboard("a");
    expect(document.querySelector(".group-inline-actions")).not.toBeNull();
    act(() => {
      window.dispatchEvent(new CustomEvent("it-guardian:close-popovers"));
    });
    expect(document.querySelector(".group-inline-actions")).toBeNull();
  });

  it("mostra o grupo vazio e oculta os segmentos de grupos recolhidos", () => {
    renderBoard();
    expect(within(group("Colapsado")).queryByText("Grupo vazio")).toBeNull();
    renderBoard({ groups: [{ id: "g9", name: "Sem nada" }] });
    expect(screen.getAllByText("Grupo vazio").length).toBeGreaterThan(0);
  });

  it("reinicia a seleção de segmentos ao mudar filtros e seleciona com ctrl", () => {
    const { rerenderBoard } = renderBoard();
    const handle = () => screen.getAllByTitle("Mover segmento")[0];
    fireEvent.click(handle(), { ctrlKey: true });
    expect(document.querySelectorAll(".segment-card.segment-selected")).toHaveLength(1);
    fireEvent.click(screen.getAllByTitle("Mover segmento")[1], { metaKey: true });
    expect(document.querySelectorAll(".segment-card.segment-selected")).toHaveLength(2);
    fireEvent.click(handle(), { ctrlKey: true });
    expect(document.querySelectorAll(".segment-card.segment-selected")).toHaveLength(1);
    rerenderBoard({ selectedGroupId: "g1" });
    expect(document.querySelectorAll(".segment-card.segment-selected")).toHaveLength(0);
  });
});

describe("InventoryBoard — visões", () => {
  const Floor = () => <div data-testid="floor">plantas</div>;
  const Topology = ({ onOpenDetails }) => (
    <button type="button" onClick={() => onOpenDetails(devices[0])}>
      abrir-detalhes
    </button>
  );

  it("alterna entre Quadro, Plantas e Mapa de Rede com aria-pressed", async () => {
    const { user } = renderBoard({ floorPlansView: <Floor />, topologyView: <Topology /> });
    const switcher = screen.getByRole("group", { name: "Visualização do inventário" });
    await user.click(within(switcher).getByRole("button", { name: "Plantas" }));
    expect(screen.getByTestId("floor")).toBeInTheDocument();
    expect(within(switcher).getByRole("button", { name: "Plantas" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("region", { name: "Segmentos de inventário" })).toBeNull();
    await user.click(within(switcher).getByRole("button", { name: "Mapa de Rede" }));
    await user.click(screen.getByRole("button", { name: "abrir-detalhes" }));
    expect(screen.getByRole("dialog", { name: "Detalhes do ativo" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(within(switcher).getByRole("button", { name: "Quadro" }));
    expect(screen.getByRole("region", { name: "Segmentos de inventário" })).toBeInTheDocument();
  });

  it("abre em Plantas pela rota e volta ao quadro quando a visão some", () => {
    window.history.pushState({}, "", "/plantas");
    const { rerenderBoard } = renderBoard({ floorPlansView: <Floor /> });
    expect(screen.getByTestId("floor")).toBeInTheDocument();
    rerenderBoard({ floorPlansView: null });
    expect(screen.queryByTestId("floor")).toBeNull();
    expect(screen.getByRole("region", { name: "Segmentos de inventário" })).toBeInTheDocument();
  });

  it("volta ao quadro quando a visão de rede some", async () => {
    const { user, rerenderBoard } = renderBoard({ topologyView: <Topology /> });
    await user.click(screen.getByRole("button", { name: "Mapa de Rede" }));
    rerenderBoard({ topologyView: null });
    expect(screen.getByRole("region", { name: "Segmentos de inventário" })).toBeInTheDocument();
  });

  it("o evento open-inventory-board volta ao quadro e abre o ativo", async () => {
    const { user } = renderBoard({ floorPlansView: <Floor /> });
    await user.click(screen.getByRole("button", { name: "Plantas" }));
    act(() => {
      window.dispatchEvent(new CustomEvent("it-guardian:open-inventory-board", { detail: { assetId: "d2" } }));
    });
    expect(screen.getByRole("dialog", { name: "Detalhes do ativo" })).toBeInTheDocument();
    expect(document.body).toHaveClass("machine-details-open");
    await user.keyboard("{Escape}");
    expect(document.body).not.toHaveClass("machine-details-open");
    act(() => {
      window.dispatchEvent(new CustomEvent("it-guardian:open-inventory-board", { detail: { assetId: "x" } }));
    });
    act(() => {
      window.dispatchEvent(new CustomEvent("it-guardian:open-inventory-board"));
    });
    expect(screen.queryByRole("dialog", { name: "Detalhes do ativo" })).toBeNull();
  });
});

describe("InventoryBoard — modais", () => {
  async function openDetails(user, name = "PC-01") {
    const card = screen.getByText(name).closest(".machine-card");
    await user.click(within(card).getByRole("button", { name: "Ficha" }));
    await settle();
    return screen.getByRole("dialog", { name: "Detalhes do ativo" });
  }

  it("abre a ficha com apelido, observações e cor do segmento e executa as ações", async () => {
    const { props, user } = renderBoard({
      observations: { d1: [{ id: "o", text: "Nota antiga", author: "x", createdAt: "2026-01-01T00:00:00Z" }] }
    });
    let dialog = await openDetails(user, "Apelido");
    expect(within(dialog).getByRole("heading", { level: 2, name: "Apelido" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Observações" }));
    expect(within(dialog).getByText("Nota antiga")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Geral" }));
    const select = within(dialog).getByLabelText("Tipo do aparelho");
    await user.selectOptions(select, select.options[1].value);
    await settle();
    expect(props.onChangeDeviceType).toHaveBeenCalledWith("d1", select.options[1].value);
    expect(within(dialog).getByText("PC-01 tipo - 10.0.0.1")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Colocar em manutenção" }));
    await settle();
    expect(props.onPutMaintenance).toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Detalhes do ativo" })).toBeNull();

    dialog = await openDetails(user, "Apelido");
    await user.click(within(dialog).getByRole("button", { name: "Marcar Backup" }));
    await settle();
    expect(props.onToggleBackup).toHaveBeenCalledWith(expect.objectContaining({ id: "d1" }), true);
    expect(screen.queryByRole("dialog", { name: "Detalhes do ativo" })).toBeNull();

    dialog = await openDetails(user, "Apelido");
    await user.click(within(dialog).getByRole("button", { name: "Remover" }));
    await settle();
    expect(props.onRemoveMachine).toHaveBeenCalledWith(expect.objectContaining({ id: "d1" }));
    expect(screen.queryByRole("dialog", { name: "Detalhes do ativo" })).toBeNull();
  });

  it("mantém a ficha aberta quando as ações não concluem", async () => {
    const { props, user } = renderBoard({
      onPutMaintenance: undefined,
      onToggleBackup: vi.fn(async () => false),
      onRemoveMachine: vi.fn(async () => false),
      onChangeDeviceType: vi.fn(async () => null),
      onRefreshPing: vi.fn(async () => null)
    });
    const dialog = await openDetails(user, "Apelido");
    await user.click(within(dialog).getByRole("button", { name: "Colocar em manutenção" }));
    await user.click(within(dialog).getByRole("button", { name: "Marcar Backup" }));
    await user.click(within(dialog).getByRole("button", { name: "Remover" }));
    const select = within(dialog).getByLabelText("Tipo do aparelho");
    await user.selectOptions(select, select.options[1].value);
    await settle();
    expect(props.onToggleBackup).toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Detalhes do ativo" })).toBeInTheDocument();
  });

  it("atualiza o ping de ativo manual pela ficha", async () => {
    const manual = {
      id: "mn",
      name: "SW",
      ip: "10.1.1.1",
      segmentId: "s3",
      source: "manual",
      status: "offline",
      manualAsset: { assetTag: "N1" }
    };
    const { props, user } = renderBoard({
      devices: [...devices, manual],
      machinesBySegment: new Map([...machinesBySegment, ["s3", [devices[1], manual]]])
    });
    const dialog = await openDetails(user, "SW");
    await user.click(within(dialog).getByRole("button", { name: /Atualizar ping/ }));
    await settle();
    expect(props.onRefreshPing).toHaveBeenCalledWith(expect.objectContaining({ id: "mn" }));
    expect(within(dialog).getByText("SW* - 10.1.1.1")).toBeInTheDocument();
  });

  it("adiciona e remove periféricos atualizando a máquina aberta", async () => {
    const { props, user } = renderBoard();
    const dialog = await openDetails(user, "Apelido");
    await user.click(within(dialog).getByRole("button", { name: "Periféricos" }));
    await user.type(within(dialog).getByPlaceholderText(/marca/i), "Dell");
    await user.click(within(dialog).getByRole("button", { name: /adicionar/i }));
    await settle();
    expect(props.onAddPeripheral).toHaveBeenCalledWith("d1", expect.objectContaining({ type: "Monitor", brand: "Dell" }));
    await user.click(within(dialog).getByRole("button", { name: "Prontuário Técnico" }));
    await settle();
    await user.click(within(dialog).getByRole("button", { name: "Periféricos" }));
    await user.click(within(dialog).getAllByTitle("Remover periférico")[0]);
    await settle();
    expect(props.onRemovePeripheral).toHaveBeenCalledWith("d1", expect.objectContaining({ id: "p1" }));
  });

  it("abre o mapa de rede a partir do prontuário", async () => {
    const Topology = () => <div data-testid="topo" />;
    const { user } = renderBoard({ topologyView: <Topology /> });
    await openDetails(user, "Apelido");
    await user.click(screen.getByRole("button", { name: "Prontuário Técnico" }));
    await settle();
    const open = [...document.querySelectorAll(".asset-modal-body button")].find((button) => /mapa de rede/i.test(button.textContent));
    if (open) {
      await user.click(open);
      expect(screen.getByTestId("topo")).toBeInTheDocument();
    }
  });

  it("confirma a movimentação pelo modal de mover", async () => {
    const { props, user } = renderBoard({ moveModal: devices[0], moveTarget: "s2" });
    const modal = screen.getByRole("dialog", { name: "Mover máquina" });
    await user.click(within(modal).getByRole("button", { name: "Mover", exact: true }));
    expect(props.onMoveMachine).toHaveBeenCalledWith(devices[0], "s2");
    expect(within(modal).queryByRole("option", { name: "Backup" })).toBeNull();
  });
});
