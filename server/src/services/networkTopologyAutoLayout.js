const DEFAULT_CENTER = { x: 800, y: 500 };
const INNER_RADIUS = 160;
const OUTER_RADIUS = 420;
const GRID_SPACING = 140;
const GRID_COLUMNS = 6;

/**
 * Gera um ponto de partida editavel, nao um layout definitivo: nos "centrais"
 * (assetId presente em centralAssetIds) formam um anel interno; os demais nos
 * tentam se posicionar perto do angulo do central com quem tem link (efeito
 * estrela), e caem numa grade quando nao ha central nenhum ou nenhum link.
 * Nos com pinned=true nunca sao movidos.
 */
export function computeAutoLayout({ nodes = [], links = [], centralAssetIds = new Set(), center = DEFAULT_CENTER }) {
  const positions = new Map();

  nodes
    .filter((node) => node.pinned)
    .forEach((node) => positions.set(node.id, { id: node.id, x: node.x, y: node.y }));

  const movable = nodes.filter((node) => !node.pinned);
  const central = movable.filter((node) => centralAssetIds.has(node.assetId));
  const peripheral = movable.filter((node) => !centralAssetIds.has(node.assetId));

  const centralAngleByNodeId = new Map();
  central.forEach((node, index) => {
    const angle = (2 * Math.PI * index) / Math.max(central.length, 1);
    centralAngleByNodeId.set(node.id, angle);
    positions.set(node.id, {
      id: node.id,
      x: center.x + INNER_RADIUS * Math.cos(angle),
      y: center.y + INNER_RADIUS * Math.sin(angle)
    });
  });

  const nodeByAssetId = new Map(nodes.map((node) => [node.assetId, node]));
  const findAnchorAngle = (assetId) => {
    for (const link of links) {
      const partnerAssetId =
        link.sourceAssetId === assetId
          ? link.targetAssetId
          : link.targetAssetId === assetId
            ? link.sourceAssetId
            : null;
      if (!partnerAssetId) continue;
      const partnerNode = nodeByAssetId.get(partnerAssetId);
      if (partnerNode && centralAngleByNodeId.has(partnerNode.id)) {
        return centralAngleByNodeId.get(partnerNode.id);
      }
    }
    return null;
  };

  let fallbackIndex = 0;
  peripheral.forEach((node, index) => {
    const anchorAngle = findAnchorAngle(node.assetId);
    if (anchorAngle !== null) {
      const jitter = ((index % 5) - 2) * 0.12;
      const angle = anchorAngle + jitter;
      positions.set(node.id, {
        id: node.id,
        x: center.x + OUTER_RADIUS * Math.cos(angle),
        y: center.y + OUTER_RADIUS * Math.sin(angle)
      });
      return;
    }

    const column = fallbackIndex % GRID_COLUMNS;
    const row = Math.floor(fallbackIndex / GRID_COLUMNS);
    fallbackIndex += 1;
    positions.set(node.id, {
      id: node.id,
      x: center.x - ((GRID_COLUMNS - 1) / 2) * GRID_SPACING + column * GRID_SPACING,
      y: center.y + OUTER_RADIUS + 100 + row * GRID_SPACING
    });
  });

  return nodes.map((node) => positions.get(node.id) || { id: node.id, x: node.x, y: node.y });
}
