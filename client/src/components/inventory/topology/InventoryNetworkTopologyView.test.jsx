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
  fireEvent.keyDown(await screen.findByRole("button", { name: "Grupo A, ver grupo" }), { key: "Enter", altKey: true });
  fireEvent.keyDown(await screen.findByRole("button", { name: "Estações, ver segmento" }), { key: "Enter", altKey: true });
  return screen.findByRole("button", { name: "Desktop A, ver ativo" });
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
    const group = await screen.findByRole("button", { name: "Grupo A, ver grupo" });
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
    fireEvent.doubleClick(await screen.findByRole("button", { name: "Grupo A, ver grupo" }));
    const segment = await screen.findByRole("button", { name: "Estações, ver segmento" });
    expect(screen.getByRole("button", { name: "Editando" })).toBeVisible();
    fireEvent.doubleClick(segment);
    expect(await screen.findByRole("button", { name: "Desktop A, ver ativo" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Editando" })).toBeVisible();
    assertNoTopologyWrites();
  });

  it("cria e desenha linha entre itens automáticos usando somente IDs reais", async () => {
    api.createNetworkTopologyLink.mockImplementation(async (_token, mapId, payload) => ({
      link: { id: "new-link", mapId, ...payload, type: "ethernet" }
    }));
    render(<InventoryNetworkTopologyView {...props} />);
    const first = await openSegment();
    fireEvent.click(screen.getByRole("button", { name: "Conectar ativos" }));
    fireEvent.keyDown(first, { key: "Enter" });
    expect(screen.getByText(/Ativo de origem selecionado/)).toBeVisible();
    fireEvent.keyDown(screen.getByRole("button", { name: "Desktop B, ver ativo" }), { key: "Enter" });
    expect(await screen.findByRole("button", { name: "Conexão entre Desktop A e Desktop B" })).toBeInTheDocument();
    expect(screen.getByText("1 conexão(ões)")).toBeVisible();
    expect(api.createNetworkTopologyLink).toHaveBeenCalledExactlyOnceWith("test-token", "map-segment-s1", {
      sourceType: "asset", targetType: "asset", sourceAssetId: "d1", targetAssetId: "d2"
    });
    expect(api.createNetworkTopologyNode).not.toHaveBeenCalled();
    expect(api.saveNetworkTopologyNodePositions).not.toHaveBeenCalled();
  });

  it("expõe Conectar grupos enquanto visualiza e inicia a seleção em modo de edição", async () => {
    api.createNetworkTopologyLink.mockImplementation(async (_token, mapId, payload) => ({
      link: { id: "group-link", mapId, ...payload, type: "ethernet" }
    }));
    render(<InventoryNetworkTopologyView {...props} groups={[
      props.groups[0],
      { id: "g3", name: "Grupo C", tabId: "t1" },
      props.groups[1]
    ]} />);

    expect(await screen.findByRole("button", { name: "Visualizando" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Conectar grupos" }));
    expect(screen.getByRole("button", { name: "Editando" })).toBeVisible();
    fireEvent.keyDown(screen.getByRole("button", { name: "Grupo A, ver grupo" }), { key: "Enter" });
    expect(screen.getByText(/Grupo de origem selecionado/)).toBeVisible();
    fireEvent.keyDown(screen.getByRole("button", { name: "Grupo C, ver grupo" }), { key: "Enter" });

    await waitFor(() => expect(api.createNetworkTopologyLink).toHaveBeenCalledExactlyOnceWith(
      "test-token", "map-inventory_tab-t1", {
        sourceType: "group", targetType: "group", sourceAssetId: "g1", targetAssetId: "g3"
      }
    ));
    expect(screen.getByRole("button", { name: "Conexão entre Grupo A e Grupo C" })).toBeVisible();
  });

  it("expõe Conectar segmentos enquanto visualiza e persiste segmento com segmento", async () => {
    api.createNetworkTopologyLink.mockImplementation(async (_token, mapId, payload) => ({
      link: { id: "segment-link", mapId, ...payload, type: "fiber" }
    }));
    render(<InventoryNetworkTopologyView {...props} segments={[
      ...props.segments,
      { id: "s3", name: "Arquivos", groupId: "g1", tabId: "t1" }
    ]} />);

    fireEvent.doubleClick(await screen.findByRole("button", { name: "Grupo A, ver grupo" }));
    expect(await screen.findByRole("button", { name: "Estações, ver segmento" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Editando" }));
    expect(screen.getByRole("button", { name: "Visualizando" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Conectar segmentos" }));
    expect(screen.getByRole("button", { name: "Editando" })).toBeVisible();
    fireEvent.keyDown(screen.getByRole("button", { name: "Estações, ver segmento" }), { key: "Enter" });
    expect(screen.getByText(/Segmento de origem selecionado/)).toBeVisible();
    fireEvent.keyDown(screen.getByRole("button", { name: "Arquivos, ver segmento" }), { key: "Enter" });

    await waitFor(() => expect(api.createNetworkTopologyLink).toHaveBeenCalledExactlyOnceWith(
      "test-token", "map-group-g1", {
        sourceType: "segment", targetType: "segment", sourceAssetId: "s1", targetAssetId: "s3"
      }
    ));
    expect(screen.getByRole("button", { name: "Conexão entre Estações e Arquivos" })).toBeVisible();
  });

  it("trata aba com grupo e segmento avulso como mista sem oferecer um par impossível", async () => {
    render(<InventoryNetworkTopologyView
      {...props}
      groups={[props.groups[0]]}
      segments={[
        ...props.segments,
        { id: "standalone", name: "Laboratório", groupId: null, tabId: "t1" }
      ]}
    />);

    expect(await screen.findByRole("button", { name: "Grupo A, ver grupo" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Laboratório, ver segmento" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Conectar itens do mesmo tipo" })).toBeDisabled();
    assertNoTopologyWrites();
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
    await openSegment();
    expect(screen.getByRole("button", { name: "Editando" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Salvar layout" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Conectar ativos" }));
    expect(screen.getByText(/Clique no primeiro ativo/)).toBeVisible();
    fireEvent.keyDown(screen.getByRole("button", { name: "Desktop A, ver ativo" }), { key: "Enter" });
    expect(screen.getByText(/Ativo de origem selecionado/)).toBeVisible();
    fireEvent.keyDown(screen.getByRole("button", { name: "Desktop B, ver ativo" }), { key: "Enter" });
    await waitFor(() => expect(api.createNetworkTopologyLink).toHaveBeenCalledTimes(1));
    expect(api.createNetworkTopologyNode).not.toHaveBeenCalled();
  });

  it("fixar um item automático mantém os outros itens e a conexão", async () => {
    api.fetchNetworkTopologyMapByScope.mockImplementation(async (_token, scopeType, scopeId) => ({
      map: { id: `map-${scopeId}`, scopeType, scopeId },
      nodes: [],
      links: scopeType === "segment" ? [{ id: "saved-link", sourceAssetId: "d1", targetAssetId: "d2", type: "ethernet" }] : []
    }));
    api.createNetworkTopologyNode.mockImplementation(async (_token, _mapId, payload) => ({
      node: { id: "saved-a", ...payload }
    }));
    api.updateNetworkTopologyNode.mockResolvedValue({
      node: { id: "saved-a", assetId: "d1", nodeType: "asset", x: 685, y: 500, pinned: true }
    });
    render(<InventoryNetworkTopologyView {...props} />);
    const first = await openSegment();
    fireEvent.keyDown(first, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Fixar posição" }));
    await waitFor(() => expect(api.updateNetworkTopologyNode).toHaveBeenCalledWith("test-token", "saved-a", { pinned: true }));
    expect(await screen.findByRole("button", { name: "Desafixar", exact: true })).toBeVisible();
    expect(screen.getByRole("button", { name: "Desktop B, ver ativo" })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Conexão entre Desktop A e Desktop B/ })).toBeVisible();
    expect(screen.queryByText("Algumas posições ainda não foram salvas.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remover.*mapa|Remover posição salva/ })).not.toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: "Conectar ativos" })).not.toBeInTheDocument();
    assertNoTopologyWrites();
  });

  it("carrega o ambiente uma vez e exibe seus itens sem avisos ou gravações", async () => {
    render(<InventoryNetworkTopologyView {...props} />);
    expect(await screen.findByRole("button", { name: "Grupo A, ver grupo" })).toBeVisible();
    expect(screen.queryByText("Prévia do inventário · não salva.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ajustar à tela" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Voltar para/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Grupo B, ver grupo/ })).not.toBeInTheDocument();
    expect(api.fetchNetworkTopologyMapByScope).toHaveBeenCalledExactlyOnceWith("test-token", "inventory_tab", "t1", "Ambiente A");
    assertNoTopologyWrites();
  });

  it("mostra máquinas de um segmento sem nós salvos, sem pedir modo de edição", async () => {
    render(<InventoryNetworkTopologyView {...props} />);
    expect(await openSegment()).toBeVisible();
    expect(screen.getByRole("button", { name: "Desktop B, ver ativo" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Desktop C, ver ativo/ })).not.toBeInTheDocument();
    expect(screen.getByText("2 ativo(s)")).toBeVisible();
    expect(screen.getByRole("button", { name: "Editando" })).toBeVisible();
    expect(screen.queryByText("Não há ativos neste segmento")).not.toBeInTheDocument();
    expect(api.fetchNetworkTopologyMapByScope).toHaveBeenLastCalledWith("test-token", "segment", "s1", undefined);
    assertNoTopologyWrites();
  });

  it("permite filtrar por status e abrir os detalhes reais da máquina", async () => {
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

  it("omite Manutenção e Backup mesmo com posições antigas salvas, sem alterar registros", async () => {
    api.fetchNetworkTopologyMapByScope.mockResolvedValue({
      map: { id: "root-map" }, links: [],
      nodes: [
        { id: "maintenance-node", nodeType: "segment", refId: "m1", x: 100, y: 100 },
        { id: "backup-node", nodeType: "segment", refId: "b1", x: 300, y: 100 }
      ]
    });
    render(<InventoryNetworkTopologyView {...props} segments={[...props.segments, { id: "b1", name: "Backup", tabId: "t1" }]} />);
    expect(await screen.findByRole("button", { name: "Grupo A, ver grupo" })).toHaveTextContent("1 segmento(s) · 2 ativo(s)");
    expect(screen.queryByRole("button", { name: /Manutenção, ver segmento|Backup, ver segmento/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir navegação do mapa" }));
    const navigation = screen.getByRole("navigation", { name: "Hierarquia do inventário" });
    expect(within(navigation).queryByText("Manutenção")).not.toBeInTheDocument();
    expect(within(navigation).queryByText("Backup")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Desktop em reparo, ver ativo/ })).not.toBeInTheDocument();
    assertNoTopologyWrites();
  });

  it("preserva nós, posições, rótulos e conexões já salvos", async () => {
    api.fetchNetworkTopologyMapByScope.mockImplementation(async (_token, scopeType, scopeId) => ({
      map: { id: "map-" + scopeType + "-" + scopeId },
      nodes: scopeType === "segment" ? [
        { id: "n1", assetId: "d1", x: -800, y: 4500, pinned: true, labelOverride: "Meu PC" },
        { id: "n2", assetId: "d2", x: 300, y: 100, pinned: false }
      ] : [],
      links: scopeType === "segment" ? [{ id: "l1", sourceAssetId: "d1", targetAssetId: "d2", label: "Rede física", type: "ethernet" }] : []
    }));
    render(<InventoryNetworkTopologyView {...props} />);
    fireEvent.doubleClick(await screen.findByRole("button", { name: "Grupo A, ver grupo" }));
    fireEvent.doubleClick(await screen.findByRole("button", { name: "Estações, ver segmento" }));
    const node = await screen.findByRole("button", { name: "Meu PC, ver ativo" });
    expect(node.closest("g")).toHaveAttribute("transform", "translate(-858, 4450)");
    expect(screen.getByText("Rede física")).toBeInTheDocument();
    expect(screen.getByText("1 conexão(ões)")).toBeVisible();
    expect(screen.queryByText("Prévia do inventário · não salva.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Grupo A, ver grupo/ })).not.toBeInTheDocument();
    assertNoTopologyWrites();
  });

  it("salva a posição arrastada de um item automático usando o ID real", async () => {
    api.createNetworkTopologyNode.mockImplementation(async (_token, _mapId, payload) => ({ node: { id: "persisted-node", ...payload } }));
    api.saveNetworkTopologyNodePositions.mockImplementation(async (_token, _mapId, positions) => ({
      nodes: positions.map(({ nodeId, x, y }) => ({ id: nodeId, assetId: "d1", nodeType: "asset", x, y, pinned: false }))
    }));
    render(<InventoryNetworkTopologyView {...props} />);
    const device = await openSegment();
    fireEvent.keyDown(device, { key: " " });
    expect(screen.getByRole("button", { name: "Conectar ativos" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Remover do mapa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar ao mapa" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Adicionar ativo ao mapa...")).not.toBeInTheDocument();
    assertNoTopologyWrites();
    const svg = device.closest("svg");
    svg.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } });
    svg.getScreenCTM = () => ({ inverse: () => ({}) });
    const pointer = (target, type, clientX, clientY) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY });
      Object.defineProperty(event, "pointerId", { value: 1 });
      fireEvent(target, event);
    };
    pointer(device, "pointerdown", 100, 100);
    pointer(svg, "pointermove", 160, 140);
    pointer(svg, "pointerup", 160, 140);
    assertNoTopologyWrites();
    fireEvent.click(screen.getByRole("button", { name: "Salvar layout" }));
    await waitFor(() => expect(api.saveNetworkTopologyNodePositions).toHaveBeenCalledExactlyOnceWith(
      "test-token", "map-segment-s1", [{ nodeId: "persisted-node", x: 745, y: 540 }]
    ));
    const [_token, mapId, payload] = api.createNetworkTopologyNode.mock.calls[0];
    expect(mapId).toBe("map-segment-s1");
    expect(payload).toEqual({ nodeType: "asset", assetId: "d1", x: 685, y: 500, pinned: false });
    expect(await screen.findByRole("button", { name: "Desktop A, ver ativo" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Desktop B, ver ativo" })).toBeVisible();
    expect(screen.queryByText("Prévia do inventário · não salva.")).not.toBeInTheDocument();
    expect(api.createNetworkTopologyLink).not.toHaveBeenCalled();
    expect(api.fetchNetworkTopologyMapByScope).toHaveBeenCalledTimes(3);
  });

  it("trocar de ambiente sai do segmento anterior e carrega o mapa da nova aba", async () => {
    const { rerender } = render(<InventoryNetworkTopologyView {...props} />);
    await openSegment();
    rerender(<InventoryNetworkTopologyView {...props} activeTab={tabs[1]} />);
    expect(await screen.findByRole("button", { name: "Grupo B, ver grupo" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Desktop A, ver ativo/ })).not.toBeInTheDocument();
    expect(api.fetchNetworkTopologyMapByScope).toHaveBeenLastCalledWith("test-token", "inventory_tab", "t2", "Ambiente B");
    assertNoTopologyWrites();
  });

  it("volta do segmento para o grupo e depois para a visão raiz", async () => {
    render(<InventoryNetworkTopologyView {...props} />);
    await openSegment();
    const back = screen.getByRole("button", { name: "Voltar para Grupo A" });
    expect(back.closest(".network-topology-canvas-wrap")).not.toBeNull();
    fireEvent.click(back);
    expect(await screen.findByRole("button", { name: "Estações, ver segmento" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Voltar para Ambiente A" }));
    expect(await screen.findByRole("button", { name: "Grupo A, ver grupo" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Voltar para/ })).not.toBeInTheDocument();
    assertNoTopologyWrites();
  });

  it("um segmento vazio sem grupo também permite voltar à raiz", async () => {
    render(<InventoryNetworkTopologyView {...props} segments={[
      ...props.segments, { id: "standalone", name: "Laboratório", groupId: null, tabId: "t1" }
    ]} />);
    fireEvent.doubleClick(await screen.findByRole("button", { name: "Laboratório, ver segmento" }));
    expect(await screen.findByText("Não há ativos neste segmento")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Voltar para Ambiente A" }));
    expect(await screen.findByRole("button", { name: "Grupo A, ver grupo" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Voltar para/ })).not.toBeInTheDocument();
    assertNoTopologyWrites();
  });

  it("mantém itens novos visíveis quando o mapa tem uma única posição salva sem conexões", async () => {
    api.fetchNetworkTopologyMapByScope.mockImplementation(async (_token, scopeType, scopeId) => ({
      map: { id: "map-" + scopeType + "-" + scopeId }, links: [],
      nodes: scopeType === "segment" ? [{ id: "saved-a", assetId: "d1", x: 600, y: 400, pinned: true }] : []
    }));
    const { rerender } = render(<InventoryNetworkTopologyView {...props} />);
    await openSegment();
    expect(screen.getByRole("button", { name: "Desktop B, ver ativo" })).toBeVisible();
    rerender(<InventoryNetworkTopologyView {...props} devices={[
      ...props.devices, { id: "new-machine", name: "Desktop novo", segmentId: "s1", tabId: "t1", status: "online" }
    ]} />);
    expect(await screen.findByRole("button", { name: "Desktop novo, ver ativo" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Desktop A, ver ativo" }).closest("g")).toHaveAttribute("transform", "translate(542, 350)");
    expect(screen.getByText("3 ativo(s)")).toBeVisible();
    assertNoTopologyWrites();
  });

  it("retornar ao ambiente limpa o filtro implícito do segmento", async () => {
    render(<InventoryNetworkTopologyView {...props} />);
    await openSegment();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Navegação da hierarquia do mapa de rede" })).getByRole("button", { name: "Ambiente A" }));
    expect(await screen.findByRole("button", { name: "Grupo A, ver grupo" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Manutenção, ver segmento" })).not.toBeInTheDocument();
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
