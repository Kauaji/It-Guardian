import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../../../api.js";
import InventoryNetworkTopologyView from "../InventoryNetworkTopologyView.jsx";

vi.mock("../../../../api.js", () => ({
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
vi.mock("../../../../context/AppSessionContext.jsx", () => ({
  useAppSession: () => ({
    can: (p) =>
      p === "inventory.topology.view" ? permissions.view : p === "inventory.topology.link_assets" ? permissions.link : permissions.manage
  })
}));

Object.assign(SVGElement.prototype, {
  createSVGPoint: () => ({
    x: 0,
    y: 0,
    matrixTransform(m) {
      return { x: this.x * m.a + m.e, y: this.y * m.d + m.f };
    }
  }),
  getScreenCTM: () => ({ inverse: () => ({ a: 1, d: 1, e: 0, f: 0 }) })
});

const tabs = [
  { id: "t1", name: "Ambiente A" },
  { id: "t2", name: "Ambiente B" }
];
const makeProps = () => ({
  token: "tok",
  notify: vi.fn(),
  tabs,
  activeTab: tabs[0],
  onSelectTab: vi.fn(),
  onOpenDetails: vi.fn(),
  groups: [{ id: "g1", name: "Grupo A", tabId: "t1" }],
  segments: [{ id: "s1", name: "Estações", groupId: "g1", tabId: "t1" }],
  devices: [
    { id: "d1", name: "Desktop A", segmentId: "s1", tabId: "t1", status: "online", assetType: "desktop" },
    { id: "d2", name: "Desktop B", segmentId: "s1", tabId: "t1", status: "offline", assetType: "desktop" },
    { id: "d3", name: "Servidor", segmentId: "s1", tabId: "t1", status: "online", assetType: "server", ip: "10.0.0.3" }
  ]
});
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
const legacyBundle = {
  map: { id: "legacy-1" },
  nodes: [
    { id: "ln1", assetId: "d1", nodeType: "asset", x: 100, y: 100 },
    { id: "ln2", assetId: "d2", nodeType: "asset", x: 300, y: 200 }
  ],
  links: [{ id: "ll1", sourceAssetId: "d1", targetAssetId: "d2", type: "ethernet" }]
};

async function openLegacy(props = makeProps()) {
  const view = render(<InventoryNetworkTopologyView {...props} />);
  await settle();
  fireEvent.click(screen.getByRole("button", { name: /Visão global \(legado\)/ }));
  await settle();
  return { props, ...view };
}
const openSegment = async () => {
  fireEvent.keyDown(await screen.findByRole("button", { name: "Grupo A, ver grupo" }), { key: "Enter", altKey: true });
  fireEvent.keyDown(await screen.findByRole("button", { name: "Estações, ver segmento" }), { key: "Enter", altKey: true });
  return screen.findByRole("button", { name: "Desktop A, ver ativo" });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  Object.assign(permissions, { view: true, manage: true, link: true });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  api.fetchNetworkTopologyMaps.mockResolvedValue({ maps: [{ id: "legacy-1", scopeType: "global" }] });
  api.fetchNetworkTopologyMap.mockResolvedValue(legacyBundle);
  api.fetchNetworkTopologyMapByScope.mockImplementation(async (_t, scopeType, scopeId) => ({
    map: { id: `map-${scopeType}-${scopeId}`, scopeType, scopeId },
    nodes: [],
    links: scopeType === "segment" ? [{ id: "l1", sourceAssetId: "d1", targetAssetId: "d2", label: "Rede física", type: "ethernet" }] : []
  }));
  api.createNetworkTopologyNode.mockImplementation(async (_t, _m, payload) => ({
    node: { id: "new-node", nodeType: "asset", ...payload }
  }));
  api.updateNetworkTopologyLink.mockImplementation(async (_t, id, payload) => ({ link: { id, ...payload } }));
  api.deleteNetworkTopologyLink.mockResolvedValue({});
  api.deleteNetworkTopologyNode.mockResolvedValue({});
});

describe("InventoryNetworkTopologyView — visão global legada", () => {
  it("sem mapa, oferece criar o mapa e o seleciona", async () => {
    api.fetchNetworkTopologyMaps.mockResolvedValue({ maps: [] });
    api.createNetworkTopologyMap.mockResolvedValue({ map: { id: "legacy-new", name: "Mapa de Rede" } });
    await openLegacy();
    expect(screen.getByText("Nenhum mapa de rede criado")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Criar mapa" }));
    await settle();
    expect(api.createNetworkTopologyMap).toHaveBeenCalledWith("tok", { name: "Mapa de Rede" });
    await waitFor(() => expect(api.fetchNetworkTopologyMap).toHaveBeenCalledWith("tok", "legacy-new"));
  });

  it("não oferece criar mapa sem permissão de gestão e informa falha ao criar", async () => {
    api.fetchNetworkTopologyMaps.mockResolvedValue({ maps: [] });
    permissions.manage = false;
    const first = await openLegacy();
    expect(screen.queryByRole("button", { name: "Criar mapa" })).toBeNull();
    first.unmount();
    permissions.manage = true;
    api.createNetworkTopologyMap.mockRejectedValue(new Error("sem espaço"));
    const { props } = await openLegacy();
    fireEvent.click(screen.getByRole("button", { name: "Criar mapa" }));
    await settle();
    expect(props.notify).toHaveBeenCalledWith("error", "sem espaço");
  });

  it("mostra erro de listagem de mapas e de carga do pacote", async () => {
    api.fetchNetworkTopologyMaps.mockRejectedValue(new Error("lista falhou"));
    const first = await openLegacy();
    expect(screen.getByRole("alert")).toHaveTextContent("lista falhou");
    first.unmount();
    api.fetchNetworkTopologyMaps.mockResolvedValue({ maps: [{ id: "legacy-1" }] });
    api.fetchNetworkTopologyMap.mockRejectedValue(new Error("pacote falhou"));
    await openLegacy();
    expect(screen.getByRole("alert")).toHaveTextContent("pacote falhou");
    expect(screen.getByText("Não foi possível carregar o mapa de rede")).toBeVisible();
  });

  it("adiciona ativos pelo seletor e trata falhas", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const { props } = await openLegacy();
    fireEvent.click(screen.getByRole("button", { name: "Visualizando" }));
    const picker = screen.getByRole("combobox", { name: "Adicionar ativo ao mapa" });
    fireEvent.focus(picker);
    fireEvent.change(picker, { target: { value: "Servidor" } });
    fireEvent.click((await screen.findAllByRole("option"))[0]);
    await settle();
    expect(api.createNetworkTopologyNode).toHaveBeenCalledWith("tok", "legacy-1", { assetId: "d3", x: 800, y: 500 });
    expect(screen.getByRole("complementary", { name: "Detalhes do ativo" })).toBeVisible();

    expect(props.notify).not.toHaveBeenCalled();
  });

  it("informa falha ao adicionar o ativo", async () => {
    api.createNetworkTopologyNode.mockRejectedValue(new Error("falha ao adicionar"));
    const { props } = await openLegacy();
    fireEvent.click(screen.getByRole("button", { name: "Visualizando" }));
    const picker = screen.getByRole("combobox", { name: "Adicionar ativo ao mapa" });
    fireEvent.focus(picker);
    fireEvent.click((await screen.findAllByRole("option"))[0]);
    await settle();
    expect(props.notify).toHaveBeenCalledWith("error", "falha ao adicionar");
    expect(screen.getByRole("combobox", { name: "Adicionar ativo ao mapa" })).toBeEnabled();
  });

  it("remove o ativo do mapa pelo inspetor após confirmar", async () => {
    const { props } = await openLegacy();
    fireEvent.keyDown(await screen.findByRole("button", { name: "Desktop A, ver ativo" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Visualizando" }));
    const inspector = screen.getByRole("complementary", { name: "Detalhes do ativo" });
    window.confirm.mockReturnValueOnce(false);
    fireEvent.click(within(inspector).getByRole("button", { name: /Remover/ }));
    expect(api.deleteNetworkTopologyNode).not.toHaveBeenCalled();
    fireEvent.click(within(inspector).getByRole("button", { name: /Remover/ }));
    await settle();
    expect(api.deleteNetworkTopologyNode).toHaveBeenCalledWith("tok", "ln1");
    expect(screen.queryByRole("complementary", { name: "Detalhes do ativo" })).toBeNull();
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("informa falha ao remover o ativo", async () => {
    api.deleteNetworkTopologyNode.mockRejectedValue(new Error("não removeu"));
    const { props } = await openLegacy();
    fireEvent.keyDown(await screen.findByRole("button", { name: "Desktop A, ver ativo" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Visualizando" }));
    fireEvent.click(within(screen.getByRole("complementary", { name: "Detalhes do ativo" })).getByRole("button", { name: /Remover/ }));
    await settle();
    expect(props.notify).toHaveBeenCalledWith("error", "não removeu");
  });
});

describe("InventoryNetworkTopologyView — conexões e navegação", () => {
  it("salva e exclui a conexão selecionada, informando falhas", async () => {
    const { props } = await (async () => {
      const props = makeProps();
      render(<InventoryNetworkTopologyView {...props} />);
      await openSegment();
      return { props };
    })();
    fireEvent.click(screen.getByRole("button", { name: "Conexão entre Desktop A e Desktop B: Rede física" }));
    const inspector = screen.getByRole("complementary", { name: "Detalhes da conexão" });
    fireEvent.click(within(inspector).getByRole("button", { name: "Salvar conexão" }));
    await settle();
    expect(api.updateNetworkTopologyLink).toHaveBeenCalledWith(
      "tok",
      "l1",
      expect.objectContaining({ sourceAssetId: "d1", targetAssetId: "d2", sourceType: "asset", targetType: "asset" })
    );
    expect(props.notify).toHaveBeenCalledWith("success", "Conexão atualizada.");

    api.updateNetworkTopologyLink.mockRejectedValueOnce(new Error("não salvou"));
    fireEvent.click(within(inspector).getByRole("button", { name: "Salvar conexão" }));
    await settle();
    expect(props.notify).toHaveBeenCalledWith("error", "não salvou");

    window.confirm.mockReturnValueOnce(false);
    fireEvent.click(within(inspector).getByRole("button", { name: "Excluir conexão" }));
    expect(api.deleteNetworkTopologyLink).not.toHaveBeenCalled();
    api.deleteNetworkTopologyLink.mockRejectedValueOnce(new Error("não excluiu"));
    fireEvent.click(within(inspector).getByRole("button", { name: "Excluir conexão" }));
    await settle();
    expect(props.notify).toHaveBeenCalledWith("error", "não excluiu");
    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Detalhes da conexão" })).getByRole("button", { name: "Excluir conexão" })
    );
    await settle();
    expect(api.deleteNetworkTopologyLink).toHaveBeenLastCalledWith("tok", "l1");
    expect(screen.queryByRole("complementary", { name: "Detalhes da conexão" })).toBeNull();
  });

  it("cancela a criação de conexão com Escape, com o botão e ao clicar no fundo", async () => {
    render(<InventoryNetworkTopologyView {...makeProps()} />);
    await openSegment();
    fireEvent.click(screen.getByRole("button", { name: "Conectar ativos" }));
    expect(screen.getByText(/Clique no primeiro ativo/)).toBeVisible();
    fireEvent.keyDown(document.querySelector(".network-topology-body"), { key: "Escape" });
    expect(screen.queryByText(/Clique no primeiro ativo/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Conectar ativos" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar conexão" }));
    expect(screen.queryByText(/Clique no primeiro ativo/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Conectar ativos" }));
    fireEvent.click(screen.getByRole("button", { name: "Escolha a origem" }));
    expect(screen.queryByText(/Clique no primeiro ativo/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Conectar ativos" }));
    fireEvent.pointerDown(document.querySelector(".network-topology-canvas"));
    fireEvent.click(document.querySelector(".network-topology-canvas"));
  });

  it("avisa falha ao criar conexão", async () => {
    api.createNetworkTopologyLink.mockRejectedValue(new Error("rede indisponível"));
    render(<InventoryNetworkTopologyView {...makeProps()} />);
    await openSegment();
    fireEvent.click(screen.getByRole("button", { name: "Conectar ativos" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Desktop A, ver ativo" }), { key: "Enter" });
    expect(screen.getByText(/Ativo de origem selecionado/)).toBeVisible();
    fireEvent.keyDown(screen.getByRole("button", { name: "Servidor, ver ativo" }), { key: "Enter" });
    await settle();
    expect(api.createNetworkTopologyLink).toHaveBeenCalledTimes(1);
  });

  it("não repete uma conexão já existente entre dois ativos", async () => {
    render(<InventoryNetworkTopologyView {...makeProps()} />);
    await openSegment();
    fireEvent.click(screen.getByRole("button", { name: "Conectar ativos" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Desktop A, ver ativo" }), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Desktop B, ver ativo" }), { key: "Enter" });
    await settle();
    expect(api.createNetworkTopologyLink).not.toHaveBeenCalled();
  });

  it("volta pelos botões e pelo trilho de navegação e troca de aba", async () => {
    const props = makeProps();
    const { rerender } = render(<InventoryNetworkTopologyView {...props} />);
    await openSegment();
    fireEvent.click(screen.getByRole("button", { name: "Voltar para Grupo A" }));
    expect(await screen.findByRole("button", { name: "Estações, ver segmento" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Voltar para Ambiente A" }));
    expect(await screen.findByRole("button", { name: "Grupo A, ver grupo" })).toBeVisible();
    fireEvent.keyDown(screen.getByRole("button", { name: "Grupo A, ver grupo" }), { key: "Enter", altKey: true });
    await screen.findByRole("button", { name: "Estações, ver segmento" });
    const crumbs = screen.getByRole("navigation", { name: "Navegação da hierarquia do mapa de rede" });
    fireEvent.click(within(crumbs).getByRole("button", { name: "Ambiente A" }));
    expect(await screen.findByRole("button", { name: "Grupo A, ver grupo" })).toBeVisible();
    fireEvent.keyDown(screen.getByRole("button", { name: "Grupo A, ver grupo" }), { key: "Enter", altKey: true });
    await screen.findByRole("button", { name: "Estações, ver segmento" });
    rerender(<InventoryNetworkTopologyView {...props} activeTab={tabs[1]} />);
    await settle();
    expect(screen.queryByRole("button", { name: "Estações, ver segmento" })).toBeNull();
    expect(screen.getByRole("navigation", { name: "Navegação da hierarquia do mapa de rede" })).toHaveTextContent("Ambiente B");
  });

  it("volta ao nível da aba quando o grupo selecionado deixa de existir", async () => {
    const props = makeProps();
    const { rerender } = render(<InventoryNetworkTopologyView {...props} />);
    await openSegment();
    rerender(<InventoryNetworkTopologyView {...props} segments={[{ id: "s9", name: "Outro", groupId: "g1", tabId: "t1" }]} />);
    await settle();
    expect(screen.queryByRole("button", { name: "Desktop A, ver ativo" })).toBeNull();
    expect(screen.getByRole("button", { name: "Voltar para Ambiente A" })).toBeVisible();
    rerender(<InventoryNetworkTopologyView {...props} groups={[]} segments={[]} />);
    await settle();
    expect(screen.queryByRole("button", { name: /^Voltar para/ })).toBeNull();
  });

  it("seleciona a aba pelo menu lateral e volta ao nível da aba", async () => {
    const props = makeProps();
    render(<InventoryNetworkTopologyView {...props} />);
    await openSegment();
    fireEvent.click(screen.getByRole("button", { name: "Abrir navegação do mapa" }));
    fireEvent.click(screen.getByRole("tab", { name: "Ambiente B" }));
    expect(props.onSelectTab).toHaveBeenCalledWith("t2");
    await settle();
    expect(screen.queryByRole("button", { name: "Desktop A, ver ativo" })).toBeNull();
  });

  it("bloqueia a visão sem permissão", () => {
    permissions.view = false;
    render(<InventoryNetworkTopologyView {...makeProps()} />);
    expect(api.fetchNetworkTopologyMapByScope).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Visão global/ })).toBeNull();
  });
});
