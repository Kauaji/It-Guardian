export const DEFAULT_FILTERS = { search: "", status: "", segmentId: "", assetType: "" };

export const CONNECTION_ITEM_LABELS_BY_TYPE = {
  group: { singular: "grupo", plural: "grupos", title: "Grupo" },
  segment: { singular: "segmento", plural: "segmentos", title: "Segmento" },
  asset: { singular: "ativo", plural: "ativos", title: "Ativo" }
};

export const MIXED_CONNECTION_ITEM_LABELS = {
  singular: "item",
  destination: "item do mesmo tipo",
  plural: "itens do mesmo tipo",
  title: "Item"
};

// Posicao aproximada do centro do mapa para novos ativos adicionados sem coordenada.
export function jitteredCenter() {
  return {
    x: 800 + (Math.random() - 0.5) * 260,
    y: 500 + (Math.random() - 0.5) * 260
  };
}

// Rotulos usados nos avisos de conexao conforme os tipos dos nos visiveis.
export function resolveConnectionItemLabels(visibleNodes, viewLevel) {
  const nodeTypes = new Set(visibleNodes.map((node) => node.nodeType || "asset"));
  if (nodeTypes.size === 1) {
    return CONNECTION_ITEM_LABELS_BY_TYPE[[...nodeTypes][0]] || CONNECTION_ITEM_LABELS_BY_TYPE.asset;
  }
  if (nodeTypes.size > 1) return MIXED_CONNECTION_ITEM_LABELS;
  const fallbackType = viewLevel === "tab" ? "group" : viewLevel === "group" ? "segment" : "asset";
  return CONNECTION_ITEM_LABELS_BY_TYPE[fallbackType];
}

// Texto do guia exibido durante a criacao de uma conexao.
export function buildConnectionGuideText({ creatingLink, sourceNodeId, labels }) {
  if (creatingLink) return `Salvando conexão entre ${labels.plural}…`;
  if (sourceNodeId) {
    return `${labels.title} de origem selecionado. Clique no ${labels.singular} de destino para salvar a conexão.`;
  }
  return `Clique no primeiro ${labels.singular} para escolher a origem da conexão.`;
}

// Variante do estado vazio conforme o nivel da hierarquia.
export function emptyStateVariant(viewLevel) {
  if (viewLevel === "segment") return "segment-sem-ativos";
  return viewLevel === "group" ? "group-sem-segmentos" : "tab-sem-grupos";
}
