import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../../api.js";
import InventoryNetworkTopologyView from "./InventoryNetworkTopologyView.jsx";

vi.mock("../../../api.js", () => ({
  createNetworkTopologyLink: vi.fn(),
  createNetworkTopologyMap: vi.fn(),
  createNetworkTopologyNode: vi.fn(),
  deleteNetworkTopologyLink: vi.fn(),
  deleteNetworkTopologyNode: vi.fn(),
  fetchNetworkTopologyMap: vi.fn(),
  fetchNetworkTopologyMapByScope: vi.fn(),
  fetchNetworkTopologyMaps: vi.fn(),
  generateNetworkTopologyAutoLayout: vi.fn(),
  saveNetworkTopologyNodePositions: vi.fn(),
  updateNetworkTopologyLink: vi.fn(),
  updateNetworkTopologyNode: vi.fn()
}));

const permissions = vi.hoisted(() => ({ view: true, manage: true }));
vi.mock("../../../context/AppSessionContext.jsx", () => ({
  useAppSession: () => ({ can: (permission) => permission === "inventory.topology.view" ? permissions.view : permissions.manage })
}));

const tabs = [{ id: "t1", name: "Ambiente A" }, { id: "t2", name: "Ambiente B" }];
const props = {
  token: "test-token",
  notify: vi.fn(),
  tabs,
  activeTab: tabs[0],
  groups: [
    { id: "g1", name: "Grupo A", tabId: "t1" },
    { id: "g2", name: "Grupo B", tabId: "t2" }
  ],
  segments: [
    { id: "s1", name: "Estações", groupId: "g1", tabId: "t1" },
    { id: "s2", name: "Outro segmento", groupId: "g2", tabId: "t2" },
    { id: "m1", name: "Manutenção", groupId: "g1", tabId: "t1" }
  ],
  devices: [
    { id: "d1", name: "Desktop A", segmentId: "s1", tabId: "t1", status: "online", assetType: "desktop" },
    { id: "d2", name: "Desktop B", segmentId: "s1", tabId: "t1", status: "offline", assetType: "desktop" },
    { id: "d3", name: "Desktop C", segmentId: "s2", tabId: "t2", status: "online", assetType: "desktop" },
    { id: "d4", name: "Desktop em reparo", segmentId: "m1", tabId: "t1", status: "problem", assetType: "desktop" }
  ],
  onSelectTab: vi.fn(),
  onOpenDetails: vi.fn()
};

function assertNoTopologyWrites() {
  expect(api.createNetworkTopologyNode).not.toHaveBeenCalled();
  expect(api.createNetworkTopologyLink).not.toHaveBeenCalled();
  expect(api.saveNetworkTopologyNodePositions).not.toHaveBeenCalled();
  expect(api.generateNetworkTopologyAutoLayout).not.toHaveBeenCalled();
  expect(api.deleteNetworkTopologyNode).not.toHaveBeenCalled();
}

async function openSegment() {
  fireEvent.keyDown(await screen.findByRole("button", { name: "Grupo A, abrir mapa, prévia não salva" }), { key: "Enter" });
  fireEvent.keyDown(await screen.findByRole("button", { name: "Estações, abrir mapa, prévia não salva" }), { key: "Enter" });
  return screen.findByRole("button", { name: "Desktop A, ver ativo, prévia não salva" });
}

describe("InventoryNetworkTopologyView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions.view = true;
    permissions.manage = true;
    api.fetchNetworkTopologyMapByScope.mockImplementation(async (_token, scopeType, scopeId) => ({
      map: { id: `map-${scopeType}-${scopeId}`, scopeType, scopeId }, nodes: [], links: []
    }));
  });

  it("carrega o escopo do ambiente ativo uma vez e exibe a prévia sem gravações", async () => {
    render(<InventoryNetworkTopologyView {...props} />);
    expect(await screen.findByRole("button", { name: "Grupo A, abrir mapa, prévia não salva" })).toBeVisible();
    expect(screen.getByText("Prévia do inventário · não salva.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Grupo B, abrir mapa/ })).not.toBeInTheDocument();
    expect(api.fetchNetworkTopologyMapByScope).toHaveBeenCalledExactlyOnceWith("test-token", "inventory_tab", "t1", "Ambiente A");
    assertNoTopologyWrites();
  });

  it("mostra máquinas de um segmento sem nós salvos, sem pedir modo de edição", async () => {
    render(<InventoryNetworkTopologyView {...props} />);
    expect(await openSegment()).toBeVisible();
    expect(screen.getByRole("button", { name: "Desktop B, ver ativo, prévia não salva" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Desktop C, ver ativo/ })).not.toBeInTheDocument();
    expect(screen.getByText("2 ativo(s)")).toBeVisible();
    expect(screen.getByRole("button", { name: "Visualizando" })).toBeVisible();
    expect(screen.queryByText("Não há ativos neste segmento")).not.toBeInTheDocument();
    expect(api.fetchNetworkTopologyMapByScope).toHaveBeenLastCalledWith("test-token", "segment", "s1", undefined);
    assertNoTopologyWrites();
  });

  it("a prévia permite filtrar por status e abrir os detalhes reais da máquina", async () => {
    render(<InventoryNetworkTopologyView {...props} />);
    const device = await openSegment();
    fireEvent.keyDown(device, { key: " " });
    fireEvent.click(screen.getByRole("button", { name: "Abrir ficha" }));
    expect(props.onOpenDetails).toHaveBeenCalledWith(props.devices[0]);
    fireEvent.change(screen.getByDisplayValue("Todos os status"), { target: { value: "offline" } });
    expect(screen.queryByRole("button", { name: /Desktop A, ver ativo/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Desktop B, ver ativo/ })).toBeVisible();
    expect(screen.getByText("1 ativo(s)")).toBeVisible();
    assertNoTopologyWrites();
  });

  it("manutenção fica independente na hierarquia e abre seus próprios ativos", async () => {
    render(<InventoryNetworkTopologyView {...props} />);
    const maintenance = await screen.findByRole("button", { name: "Manutenção, abrir mapa, prévia não salva" });
    fireEvent.click(screen.getByRole("button", { name: "Abrir navegação do mapa" }));
    const navigation = screen.getByRole("navigation", { name: "Hierarquia do inventário" });
    expect(within(navigation).queryByText("Sem grupo")).not.toBeInTheDocument();
    const groupRow = within(navigation).getByText("Grupo A").closest(".network-topology-hierarchy-group");
    expect(within(groupRow).queryByText("Manutenção")).not.toBeInTheDocument();
    expect(navigation.querySelector(".network-topology-hierarchy-maintenance")).toHaveTextContent("Manutenção");
    fireEvent.keyDown(maintenance, { key: "Enter" });
    expect(await screen.findByRole("button", { name: /Desktop em reparo, ver ativo/ })).toBeVisible();
    const breadcrumbs = screen.getByRole("navigation", { name: "Navegação da hierarquia do mapa de rede" });
    expect(breadcrumbs).not.toHaveTextContent("Grupo A");
    assertNoTopologyWrites();
  });

  it("preserva nós, posições, rótulos e conexões já salvos", async () => {
    api.fetchNetworkTopologyMapByScope.mockResolvedValue({
      map: { id: "map-saved" },
      nodes: [
        { id: "n1", assetId: "d1", x: -800, y: 4500, pinned: true, labelOverride: "Meu PC" },
        { id: "n2", assetId: "d2", x: 300, y: 100, pinned: false }
      ],
      links: [{ id: "l1", sourceAssetId: "d1", targetAssetId: "d2", label: "Rede física", type: "ethernet" }]
    });
    render(<InventoryNetworkTopologyView {...props} />);
    const node = await screen.findByRole("button", { name: "Meu PC, ver ativo" });
    expect(node.closest("g")).toHaveAttribute("transform", "translate(-858, 4450)");
    expect(screen.getByText("Rede física")).toBeInTheDocument();
    expect(screen.getByText("1 conexão(ões)")).toBeVisible();
    expect(screen.queryByText("Prévia do inventário · não salva.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Grupo A, abrir mapa/ })).not.toBeInTheDocument();
    assertNoTopologyWrites();
  });

  it("persiste um item da prévia só após edição e clique explícito, usando o ID real", async () => {
    api.createNetworkTopologyNode.mockImplementation(async (_token, _mapId, payload) => ({ node: { id: "persisted-node", ...payload } }));
    render(<InventoryNetworkTopologyView {...props} />);
    const device = await openSegment();
    fireEvent.click(screen.getByRole("button", { name: "Visualizando" }));
    fireEvent.keyDown(device, { key: " " });
    expect(screen.getByRole("button", { name: "Criar conexão" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Remover do mapa" })).not.toBeInTheDocument();
    assertNoTopologyWrites();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao mapa" }));
    await waitFor(() => expect(api.createNetworkTopologyNode).toHaveBeenCalledTimes(1));
    const [_token, mapId, payload] = api.createNetworkTopologyNode.mock.calls[0];
    expect(mapId).toBe("map-segment-s1");
    expect(payload).toEqual({ assetId: "d1", x: 685, y: 500 });
    expect(await screen.findByRole("button", { name: "Desktop A, ver ativo" })).toBeVisible();
    expect(screen.queryByText("Prévia do inventário · não salva.")).not.toBeInTheDocument();
    expect(api.createNetworkTopologyLink).not.toHaveBeenCalled();
    expect(api.fetchNetworkTopologyMapByScope).toHaveBeenCalledTimes(3);
  });

  it("trocar de ambiente sai do segmento anterior e carrega o mapa da nova aba", async () => {
    const { rerender } = render(<InventoryNetworkTopologyView {...props} />);
    await openSegment();
    rerender(<InventoryNetworkTopologyView {...props} activeTab={tabs[1]} />);
    expect(await screen.findByRole("button", { name: "Grupo B, abrir mapa, prévia não salva" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Desktop A, ver ativo/ })).not.toBeInTheDocument();
    expect(api.fetchNetworkTopologyMapByScope).toHaveBeenLastCalledWith("test-token", "inventory_tab", "t2", "Ambiente B");
    assertNoTopologyWrites();
  });

  it("retornar ao ambiente limpa o filtro implícito do segmento", async () => {
    render(<InventoryNetworkTopologyView {...props} />);
    await openSegment();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Navegação da hierarquia do mapa de rede" })).getByRole("button", { name: "Ambiente A" }));
    expect(await screen.findByRole("button", { name: "Grupo A, abrir mapa, prévia não salva" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Manutenção, abrir mapa, prévia não salva" })).toBeVisible();
    assertNoTopologyWrites();
  });

  it("mostra falha do primeiro carregamento em vez de spinner permanente", async () => {
    api.fetchNetworkTopologyMapByScope.mockRejectedValue(new Error("Servidor indisponível"));
    render(<InventoryNetworkTopologyView {...props} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Servidor indisponível");
    expect(screen.queryByText("Prévia do inventário · não salva.")).not.toBeInTheDocument();
  });

  it("visão global abre o mapa legado salvo, não o último mapa de segmento", async () => {
    api.fetchNetworkTopologyMaps.mockResolvedValue({ maps: [
      { id: "map-segment-s1", scopeType: "segment" },
      { id: "legacy-map", scopeType: "global" }
    ] });
    api.fetchNetworkTopologyMap.mockResolvedValue({
      map: { id: "legacy-map", scopeType: "global" },
      nodes: [{ id: "legacy-node", assetId: "d3", x: 150, y: 150 }],
      links: []
    });
    render(<InventoryNetworkTopologyView {...props} />);
    await openSegment();
    fireEvent.click(screen.getByRole("button", { name: "Visão global (legado)" }));
    expect(await screen.findByRole("button", { name: "Desktop C, ver ativo" })).toBeVisible();
    expect(api.fetchNetworkTopologyMap).toHaveBeenCalledExactlyOnceWith("test-token", "legacy-map");
    assertNoTopologyWrites();
  });

  it("não carrega ou grava mapas sem permissão de visualização", () => {
    permissions.view = false;
    render(<InventoryNetworkTopologyView {...props} />);
    expect(api.fetchNetworkTopologyMapByScope).not.toHaveBeenCalled();
    assertNoTopologyWrites();
  });
});
