import { topologyNodeKey } from "./networkTopologyConnections.js";
import { resolveAssetType } from "./networkTopologyModel.js";

/** Aplica nos do servidor ao bundle do mapa atual (ignora respostas de outro mapa). */
export function mergeSavedNodes(bundle, mapId, updates) {
  if (bundle?.map.id !== mapId) return bundle;
  const byKey = new Map(updates.map((node) => [topologyNodeKey(node), node]));
  const nodes = bundle.nodes.map((node) => {
    const key = topologyNodeKey(node);
    const updated = byKey.get(key);
    byKey.delete(key);
    return updated || node;
  });
  return { ...bundle, nodes: [...nodes, ...byKey.values()] };
}

/** Registra (ou remove, se voltou a base) a posicao arrastada de um no no mapa de pendencias. */
export function withDraggedPosition(dirty, node, x, y) {
  const next = new Map(dirty);
  const key = topologyNodeKey(node);
  if (node.x === x && node.y === y) next.delete(key);
  else next.set(key, { x, y });
  return next;
}

/** Remove das pendencias apenas as posicoes salvas que nao mudaram desde o snapshot. */
export function withoutSavedPositions(dirty, snapshot) {
  const next = new Map(dirty);
  for (const [key, point] of snapshot) {
    const latest = next.get(key);
    if (latest?.x === point.x && latest?.y === point.y) next.delete(key);
  }
  return next;
}

/** Alteracoes de posicao (no + x/y) a persistir a partir do snapshot de pendencias. */
export function dirtyPositionChanges(nodes, snapshot) {
  return nodes.filter((node) => snapshot.has(topologyNodeKey(node))).map((node) => ({ node, ...snapshot.get(topologyNodeKey(node)) }));
}

/** Dicas de tipo de ativo enviadas ao gerador de layout automatico. */
export function autoLayoutHints(nodes, devicesById) {
  return nodes
    .filter((node) => (node.nodeType || "asset") === "asset")
    .map((node) => ({
      assetId: node.assetId,
      assetType: resolveAssetType(devicesById.get(node.assetId))
    }));
}
