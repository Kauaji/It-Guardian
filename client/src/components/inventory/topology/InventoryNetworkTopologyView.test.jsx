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

const permissions = vi.hoisted(() => ({ view: true, manage: true, link: true }));
vi.mock("../../../context/AppSessionContext.jsx", () => ({
  useAppSession: () => ({ can: (permission) => permission === "inventory.topology.view" ? permissions.view : permission === "inventory.topology.link_assets" ? permissions.link : permissions.manage })
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
  fireEvent.keyDown(await screen.findByRole("button", { name: "Grupo A, ver grupo, prévia não salva" }), { key: "Enter", altKey: true });
  fireEvent.keyDown(await screen.findByRole("button", { name: "Estações, ver segmento, prévia não salva" }), { key: "Enter", altKey: true });
  return screen.findByRole("button", { name: "Desktop A, ver ativo, prévia não salva" });
}

describe("InventoryNetworkTopologyView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions.view = true;
    permissions.manage = true;
    permissions.link = true;
    api.fetchNetworkTopologyMaps.mockResolvedValue({ maps: [] });
    api.fetchNetworkTopologyMapByScope.mockImplementation(async (_token, scopeType, scopeId) => ({
      map: { id: `map-${scopeType}-${scopeId}`, scopeType, scopeId }, nodes: [], links: []
    }));
  });

  it("clique simples inspeciona máquinas e conexões internas sem navegar nem criar mapa", async () => {
    api.fetchNetworkTopologyMaps.mockResolvedValue({ maps: [{ id: "existing-group-map", scopeType: "group", scopeId: "g1" }] });
    api.fetchNetworkTopologyMap.mockResolvedValue({
      map: { id: "existing-group-map" }, nodes: [],
      links: [{ id: "inside", sourceType: "segment", targetType: "segment", sourceAssetId: "s1", targetAssetId: "s3", type: "fiber", label: "Backbone" }]
    });
    render(<InventoryNetworkTopologyView {...props} segments={[...props.segments, { id: "s3", name: "Arquivos", groupId: "g1", tabId: "t1" }]} />);
    const group = await screen.findByRole("button", { name: "Grupo A, ver grupo, prévia não salva" });
    fireEvent.keyDown(group, { key: "Enter" });
    const inspector = await screen.findByRole("complementary", { name: "Detalhes do grupo" });
    expect(within(inspector).getByRole("button", { name: "Abrir ficha de Desktop A" })).toBeVisible();
    expect(within(inspector).getByRole("button", { name: "Abrir ficha de Desktop B" })).toBeVisible();
    expect(within(inspector).queryByText("Desktop em reparo")).not.toBeInTheDocument();
    expect(await within(inspector).findByText("Backbone")).toBeVisible();
    expect(within(inspector).getByText("Dentro de Grupo A")).toBeVisible();
    expect(api.fetchNetworkTopologyMapByScope).toHaveBeenCalledTimes(1);
    expect(api.fetchNetworkTopologyMap).toHaveBeenCalledExactlyOnceWith("test-token", "existing-group-map");
    expect(screen.getByRole("navigation", { name: "Navegação da hierarquia do mapa de rede" })).not.toHaveTextContent("Grupo A");
    assertNoTopologyWrites();
  });

  it("dois cliques abrem grupo e segmento diretamente em edição sem salvar posições", async () => {
    render(<InventoryNetworkTopologyView {...props} />);
    fireEvent.doubleClick(await screen.findByRole("button", { name: "Grupo A, ver grupo, prévia não salva" }));
    const segment = await screen.findByRole("button", { name: "Estações, ver segmento, prévia não salva" });
    expect(screen.getByRole("button", { name: "Editando" })).toBeVisible();
    fireEvent.doubleClick(segment);
    expect(await screen.findByRole("button", { name: "Desktop A, ver ativo, prévia não salva" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Editando" })).toBeVisible();
    assertNoTopologyWrites();
  });

  it("cria e desenha linha entre prévias usando somente IDs reais", async () => {
    api.createNetworkTopologyLink.mockImplementation(async (_token, mapId, payload) => ({
      link: { id: "new-link", mapId, ...payload, type: "ethernet" }
    }));
    render(<InventoryNetworkTopologyView {...props} />);
    const first = await openSegment();
    fireEvent.click(screen.getByRole("button", { name: "Criar conexão" }));
    fireEvent.keyDown(first, { key: "Enter" });
    expect(screen.getByText(/Origem selecionada/)).toBeVisible();
    fireEvent.keyDown(screen.getByRole("button", { name: "Desktop B, ver ativo, prévia não salva" }), { key: "Enter" });
    expect(await screen.findByRole("button", { name: "Conexão entre Desktop A e Desktop B" })).toBeInTheDocument();
    expect(screen.getByText("1 conexão(ões)")).toBeVisible();
    expect(api.createNetworkTopologyLink).toHaveBeenCalledExactlyOnceWith("test-token", "map-segment-s1", {
      sourceType: "asset", targetType: "asset", sourceAssetId: "d1", targetAssetId: "d2"
    });
    expect(api.createNetworkTopologyNode).not.toHaveBeenCalled();
    expect(api.saveNetworkTopologyNodePositions).not.toHaveBeenCalled();
  });

  it("exibe vínculos salvos mesmo quando as posições ainda são prévias", async () => {
    api.fetchNetworkTopologyMapByScope.mockImplementation(async (_token, scopeType, scopeId) => ({
      map: { id: "map-" + scopeType + "-" + scopeId, scopeType, scopeId }, nodes: [],
      links: scopeType === "segment" ? [{ id: "saved-line", sourceAssetId: "d1", targetAssetId: "d2", type: "ethernet" }] : []
    }));
    render(<InventoryNetworkTopologyView {...props} />);
    await openSegment();
    expect(screen.getByRole("button", { name: "Conexão entre Desktop A e Desktop B" })).toBeInTheDocument();
    expect(screen.getByText("1 conexão(ões)")).toBeVisible();
    assertNoTopologyWrites();
  });

  it("permissão de conectar não concede edição de posições", async () => {
    permissions.manage = false;
    api.createNetworkTopologyLink.mockResolvedValue({ link: { id: "permitted", sourceAssetId: "d1", targetAssetId: "d2", type: "ethernet" } });
    render(<InventoryNetworkTopologyView {...props} />);
    const first = await openSegment();
    expect(screen.getByRole("button", { name: "Editando" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Salvar layout" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Criar conexão" }));
    fireEvent.keyDown(first, { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Desktop B, ver ativo, prévia não salva" }), { key: "Enter" });
    await waitFor(() => expect(api.createNetworkTopologyLink).toHaveBeenCalledTimes(1));
    expect(api.createNetworkTopologyNode).not.toHaveBeenCalled();
  });

  it("salvar uma posição não oculta o outro endpoint nem a conexão da prévia", async () => {
    api.fetchNetworkTopologyMapByScope.mockImplementation(async (_token, scopeType, scopeId) => ({
      map: { id: `map-${scopeId}`, scopeType, scopeId },
      nodes: [],
      links: scopeType === "segment" ? [{ id: "saved-link", sourceAssetId: "d1", targetAssetId: "d2", type: "ethernet" }] : []
    }));
    api.createNetworkTopologyNode.mockImplementation(async (_token, _mapId, payload) => ({
      node: { id: "saved-a", ...payload }
    }));
    render(<InventoryNetworkTopologyView {...props} />);
    const first = await openSegment();
    fireEvent.keyDown(first, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao mapa" }));
    await screen.findByRole("button", { name: "Desktop A, ver ativo", exact: true });
    expect(screen.getByRole("button", { name: "Desktop B, ver ativo, prévia não salva" })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Conexão entre Desktop A e Desktop B/ })).toBeVisible();
    expect(screen.getByText("Algumas posições ainda não foram salvas.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Remover posição salva" })).toBeVisible();
    expect(api.createNetworkTopologyNode).toHaveBeenCalledTimes(1);
    expect(api.createNetworkTopologyLink).not.toHaveBeenCalled();
    expect(api.saveNetworkTopologyNodePositions).not.toHaveBeenCalled();
  });

  it("somente leitura permite inspecionar e abrir sem entrar em edição", async () => {
    permissions.manage = false;
    permissions.link = false;
    render(<InventoryNetworkTopologyView {...props} />);
    await openSegment();
    expect(screen.getByRole("button", { name: "Visualizando" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Criar conexão" })).not.toBeInTheDocument();
    assertNoTopologyWrites();
  });

  it("carrega o escopo do ambiente ativo uma vez e exibe a prévia sem gravações", async () => {
    render(<InventoryNetworkTopologyView {...props} />);
    expect(await screen.findByRole("button", { name: "Grupo A, ver grupo, prévia não salva" })).toBeVisible();
    expect(screen.getByText("Prévia do inventário · não salva.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Grupo B, ver grupo/ })).not.toBeInTheDocument();
    expect(api.fetchNetworkTopologyMapByScope).toHaveBeenCalledExactlyOnceWith("test-token", "inventory_tab", "t1", "Ambiente A");
    assertNoTopologyWrites();
  });

  it("mostra máquinas de um segmento sem nós salvos, sem pedir modo de edição", async () => {
    render(<InventoryNetworkTopologyView {...props} />);
    expect(await openSegment()).toBeVisible();
    expect(screen.getByRole("button", { name: "Desktop B, ver ativo, prévia não salva" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Desktop C, ver ativo/ })).not.toBeInTheDocument();
    expect(screen.getByText("2 ativo(s)")).toBeVisible();
    expect(screen.getByRole("button", { name: "Editando" })).toBeVisible();
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
    const maintenance = await screen.findByRole("button", { name: "Manutenção, ver segmento, prévia não salva" });
    fireEvent.click(screen.getByRole("button", { name: "Abrir navegação do mapa" }));
    const navigation = screen.getByRole("navigation", { name: "Hierarquia do inventário" });
    expect(within(navigation).queryByText("Sem grupo")).not.toBeInTheDocument();
    const groupRow = within(navigation).getByText("Grupo A").closest(".network-topology-hierarchy-group");
    expect(within(groupRow).queryByText("Manutenção")).not.toBeInTheDocument();
    expect(navigation.querySelector(".network-topology-hierarchy-maintenance")).toHaveTextContent("Manutenção");
    fireEvent.keyDown(maintenance, { key: "Enter", altKey: true });
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
    expect(screen.queryByRole("button", { name: /Grupo A, ver grupo/ })).not.toBeInTheDocument();
    assertNoTopologyWrites();
  });

  it("persiste um item da prévia só após edição e clique explícito, usando o ID real", async () => {
    api.createNetworkTopologyNode.mockImplementation(async (_token, _mapId, payload) => ({ node: { id: "persisted-node", ...payload } }));
    render(<InventoryNetworkTopologyView {...props} />);
    const device = await openSegment();
    fireEvent.keyDown(device, { key: " " });
    expect(screen.getByRole("button", { name: "Criar conexão" })).toBeEnabled();
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
    expect(await screen.findByRole("button", { name: "Grupo B, ver grupo, prévia não salva" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Desktop A, ver ativo/ })).not.toBeInTheDocument();
    expect(api.fetchNetworkTopologyMapByScope).toHaveBeenLastCalledWith("test-token", "inventory_tab", "t2", "Ambiente B");
    assertNoTopologyWrites();
  });

  it("retornar ao ambiente limpa o filtro implícito do segmento", async () => {
    render(<InventoryNetworkTopologyView {...props} />);
    await openSegment();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Navegação da hierarquia do mapa de rede" })).getByRole("button", { name: "Ambiente A" }));
    expect(await screen.findByRole("button", { name: "Grupo A, ver grupo, prévia não salva" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Manutenção, ver segmento, prévia não salva" })).toBeVisible();
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
