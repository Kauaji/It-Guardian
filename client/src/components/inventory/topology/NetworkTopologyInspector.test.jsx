import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NetworkTopologyLinkInspector, NetworkTopologyNodeInspector } from "./NetworkTopologyInspector.jsx";

const DEVICES = [
  { id: "financeiro", name: "Servidor Financeiro", ip: "203.0.113.21", status: "online", assetType: "server" },
  { id: "arquivos", name: "Servidor de Arquivos", ip: "203.0.113.23", status: "offline", assetType: "server" }
];
const SEGMENT_NODE = { id: "node-servers", nodeType: "segment", refId: "servers", pinned: false };
const SEGMENT = { id: "servers", name: "Servidores", status: "atencao", deviceCount: 2 };
const CONNECTIONS = [{
  id: "connection-1", label: "Uplink principal", type: "ethernet", sourceName: "Servidor Financeiro",
  targetName: "Servidor de Arquivos", scopeLabel: "Dentro de Servidores"
}];

function renderNode(overrides = {}) {
  const props = {
    node: SEGMENT_NODE,
    clusterInfo: SEGMENT,
    clusterDevices: DEVICES,
    editMode: false,
    onOpenDetails: vi.fn(),
    onOpenCluster: vi.fn(),
    onTogglePinned: vi.fn(),
    onRemoveNode: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  };
  return { props, ...render(<NetworkTopologyNodeInspector {...props} />) };
}

describe("NetworkTopologyNodeInspector", () => {
  it("mostra nome, IP e status das máquinas reais de um segmento", () => {
    renderNode();
    expect(screen.getByRole("complementary", { name: "Detalhes do segmento" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Segmento selecionado" })).toBeInTheDocument();
    const machines = screen.getByRole("region", { name: "Máquinas do item" });
    expect(within(machines).getByText("Servidor Financeiro")).toBeInTheDocument();
    expect(within(machines).getByText("203.0.113.21")).toBeInTheDocument();
    expect(within(machines).getByText("Online")).toBeInTheDocument();
    expect(within(machines).getByText("Servidor de Arquivos")).toBeInTheDocument();
    expect(within(machines).getByText("Offline")).toBeInTheDocument();
  });

  it("abre a ficha da máquina clicada sem abrir o mapa do segmento", () => {
    const { props } = renderNode();
    fireEvent.click(screen.getByRole("button", { name: "Abrir ficha de Servidor de Arquivos" }));
    expect(props.onOpenDetails).toHaveBeenCalledWith(DEVICES[1]);
    expect(props.onOpenCluster).not.toHaveBeenCalled();
  });

  it("agrega as máquinas fornecidas para um grupo e mantém sua contagem de segmentos", () => {
    renderNode({
      node: { id: "node-infra", nodeType: "group", refId: "infra" },
      clusterInfo: { id: "infra", name: "Infraestrutura", status: "misto", segmentCount: 3, deviceCount: 2 }
    });
    expect(screen.getByRole("complementary", { name: "Detalhes do grupo" })).toBeInTheDocument();
    expect(screen.getByText("Segmentos").nextElementSibling).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: "Abrir ficha de Servidor Financeiro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir ficha de Servidor de Arquivos" })).toBeInTheDocument();
  });

  it("mostra origem, destino, tipo e contexto das conexões reais", () => {
    renderNode({ connections: CONNECTIONS });
    const connections = screen.getByRole("region", { name: "Conexões do item" });
    expect(within(connections).getByText("Uplink principal")).toBeInTheDocument();
    expect(within(connections).getByText("Servidor Financeiro")).toBeInTheDocument();
    expect(within(connections).getByText("Servidor de Arquivos")).toBeInTheDocument();
    expect(within(connections).getByText("Ethernet")).toBeInTheDocument();
    expect(within(connections).getByText("Dentro de Servidores")).toBeInTheDocument();
    expect(within(connections).queryByText(/Conexões informadas manualmente/)).not.toBeInTheDocument();
    expect(within(connections).getAllByRole("listitem")).toHaveLength(1);
  });

  it("não deduz conexões apenas porque existem máquinas no segmento", () => {
    renderNode();
    const connections = screen.getByRole("region", { name: "Conexões do item" });
    expect(within(connections).getByText("Nenhuma conexão cadastrada para este item.")).toBeInTheDocument();
    expect(within(connections).queryByRole("list")).not.toBeInTheDocument();
  });

  it("diferencia carregamento de conexões de uma lista realmente vazia", () => {
    renderNode({ connectionsLoading: true });
    expect(screen.getByRole("status")).toHaveTextContent("Carregando conexões...");
    expect(screen.getByRole("region", { name: "Conexões do item" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Nenhuma conexão cadastrada para este item.")).not.toBeInTheDocument();
  });

  it("informa erro de leitura sem apresentar a falha como ausência de conexões", () => {
    renderNode({ connectionsError: "Não foi possível carregar as conexões deste mapa." });
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar as conexões deste mapa.");
    expect(screen.queryByText("Nenhuma conexão cadastrada para este item.")).not.toBeInTheDocument();
  });

  it("preserva conexões conhecidas quando a leitura de um mapa interno falha", () => {
    renderNode({ connections: CONNECTIONS, connectionsError: "Falha ao carregar o mapa interno." });
    expect(screen.getByText("Uplink principal")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao carregar o mapa interno.");
  });

  it("mantém acesso somente leitura sem ações de alterar mapa ou criar conexão", () => {
    const { props } = renderNode();
    fireEvent.click(screen.getByRole("button", { name: "Abrir mapa" }));
    expect(props.onOpenCluster).toHaveBeenCalledWith(SEGMENT_NODE);
    expect(screen.queryByRole("button", { name: "Editar mapa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Conectar a outro item" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fixar posição" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover do mapa" })).not.toBeInTheDocument();
  });

  it("identifica a ação de abrir em edição quando o usuário tem permissão", () => {
    const { props } = renderNode({ canEditCluster: true });
    fireEvent.click(screen.getByRole("button", { name: "Editar mapa" }));
    expect(props.onOpenCluster).toHaveBeenCalledWith(SEGMENT_NODE);
  });

  it("permite iniciar uma conexão a partir do grupo ou segmento selecionado", () => {
    const onConnectNode = vi.fn();
    renderNode({ onConnectNode });
    fireEvent.click(screen.getByRole("button", { name: "Conectar a outro item" }));
    expect(onConnectNode).toHaveBeenCalledWith(SEGMENT_NODE);
  });

  it("orienta a escolha do destino e impede iniciar duas conexões simultâneas", () => {
    const onConnectNode = vi.fn();
    renderNode({ onConnectNode, connecting: true });
    const button = screen.getByRole("button", { name: "Selecione o destino no mapa" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onConnectNode).not.toHaveBeenCalled();
  });

  it("preserva as ações de fixar e remover quando disponíveis em edição", () => {
    const { props } = renderNode({ editMode: true });
    fireEvent.click(screen.getByRole("button", { name: "Fixar posição" }));
    fireEvent.click(screen.getByRole("button", { name: "Remover do mapa" }));
    expect(props.onTogglePinned).toHaveBeenCalledOnce();
    expect(props.onRemoveNode).toHaveBeenCalledOnce();
  });

  it("não oferece adicionar manualmente um item automático do inventário", () => {
    renderNode({ editMode: true, node: { ...SEGMENT_NODE, preview: true } });
    expect(screen.queryByRole("button", { name: "Adicionar ao mapa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionando..." })).not.toBeInTheDocument();
  });

  it("mantém a fixação sem oferecer remoção quando onRemoveNode está ausente", () => {
    const { props } = renderNode({ editMode: true, onRemoveNode: undefined, preservesConnectionsOnRemove: true });
    const pin = screen.getByRole("button", { name: "Fixar posição" });
    expect(screen.queryByRole("button", { name: /Remover (do mapa|posição salva)/ })).not.toBeInTheDocument();
    fireEvent.click(pin);
    expect(props.onTogglePinned).toHaveBeenCalledOnce();
  });

  it("não renderiza a fixação sem callback, mas mantém remoção autorizada do legado", () => {
    const { props } = renderNode({ editMode: true, onTogglePinned: undefined });
    expect(screen.queryByRole("button", { name: /Fixar posição|Desafixar/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remover do mapa" }));
    expect(props.onRemoveNode).toHaveBeenCalledOnce();
  });

  it("não mostra ações de posição sem callbacks mesmo em edição", () => {
    renderNode({ editMode: true, onTogglePinned: undefined, onRemoveNode: undefined });
    expect(screen.queryByRole("button", { name: /Fixar posição|Desafixar|Remover do mapa/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir mapa" })).toBeInTheDocument();
  });

  it("explica que remover a posição não exclui uma conexão salva", () => {
    const { props } = renderNode({ editMode: true, preservesConnectionsOnRemove: true });
    const remove = screen.getByRole("button", { name: "Remover posição salva" });
    expect(remove).toHaveAttribute("title", expect.stringContaining("conexões continuam visíveis"));
    fireEvent.click(remove);
    expect(props.onRemoveNode).toHaveBeenCalledOnce();
  });

  it.each(["segment", "group"])("mostra estado vazio de máquinas para um %s", (nodeType) => {
    renderNode({ node: { ...SEGMENT_NODE, nodeType }, clusterDevices: [], clusterInfo: { ...SEGMENT, deviceCount: 0 } });
    expect(screen.getByText(nodeType === "group" ? "Nenhuma máquina nos segmentos deste grupo." : "Nenhuma máquina neste segmento.")).toBeInTheDocument();
  });

  it("um cluster removido mantém o histórico das conexões, sem ações de navegar ou conectar", () => {
    renderNode({ clusterInfo: null, connections: CONNECTIONS, editMode: true, onConnectNode: vi.fn() });
    expect(screen.getByText(/Este segmento não existe mais no inventário/)).toBeInTheDocument();
    expect(screen.getByText("Uplink principal")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Máquinas do item" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abrir mapa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Conectar a outro item" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover do mapa" })).toBeInTheDocument();
  });

  it("também mostra as conexões e ações de um ativo individual", () => {
    const node = { id: "asset-node", nodeType: "asset", assetId: "financeiro", pinned: true };
    const onConnectNode = vi.fn();
    const { props } = renderNode({ node, device: DEVICES[0], connections: CONNECTIONS, onConnectNode, editMode: true });
    expect(screen.getByRole("complementary", { name: "Detalhes do ativo" })).toBeInTheDocument();
    expect(screen.getByText("Servidor")).toBeInTheDocument();
    expect(screen.getByText("Uplink principal")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Máquinas do item" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir ficha", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Conectar a outro item" }));
    fireEvent.click(screen.getByRole("button", { name: "Desafixar" }));
    expect(props.onOpenDetails).toHaveBeenCalledWith(DEVICES[0]);
    expect(onConnectNode).toHaveBeenCalledWith(node);
    expect(props.onTogglePinned).toHaveBeenCalledOnce();
  });

  it("identifica ativo removido e não oferece sua ficha", () => {
    renderNode({ node: { id: "removed", nodeType: "asset", assetId: "removed" }, device: null });
    expect(screen.getByText(/Este ativo não existe mais no inventário/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abrir ficha" })).not.toBeInTheDocument();
  });

  it("permite fechar pelos controles e por Escape dentro da barra lateral", () => {
    const { props } = renderNode();
    const close = screen.getByRole("button", { name: "Fechar detalhes do item" });
    fireEvent.click(close);
    fireEvent.keyDown(close, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });
});

describe("NetworkTopologyLinkInspector", () => {
  const link = {
    id: "link-1", label: "Uplink principal", type: "ethernet", description: "Rack principal",
    sourceType: "asset", targetType: "asset"
  };

  it("preserva rótulo, tipo e descrição da conexão em somente leitura", () => {
    render(<NetworkTopologyLinkInspector link={link} sourceEntity={DEVICES[0]} targetEntity={DEVICES[1]} onClose={vi.fn()} />);
    expect(screen.getByRole("complementary", { name: "Detalhes da conexão" })).toBeInTheDocument();
    expect(screen.getByText("Uplink principal")).toBeInTheDocument();
    expect(screen.getByText("Ethernet")).toBeInTheDocument();
    expect(screen.getByText("Rack principal")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar conexão" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Sua existência não significa/)).not.toBeInTheDocument();
  });

  it("preserva edição e remoção de conexões", () => {
    const onSave = vi.fn();
    const onRemove = vi.fn();
    render(<NetworkTopologyLinkInspector link={link} sourceEntity={DEVICES[0]} targetEntity={DEVICES[1]} editMode onSave={onSave} onRemove={onRemove} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Rótulo"), { target: { value: "Backup" } });
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "fiber" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar conexão" }));
    expect(onSave).toHaveBeenCalledWith({ label: "Backup", type: "fiber", description: "Rack principal" });
    fireEvent.click(screen.getByRole("button", { name: "Excluir conexão" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("mantém indicação de entidade removida nos dois endpoints", () => {
    render(<NetworkTopologyLinkInspector link={{ ...link, sourceType: "group", targetType: "segment" }} onClose={vi.fn()} />);
    expect(screen.getByText(/Grupo removido/)).toBeInTheDocument();
    expect(screen.getByText(/Segmento removido/)).toBeInTheDocument();
  });
});
