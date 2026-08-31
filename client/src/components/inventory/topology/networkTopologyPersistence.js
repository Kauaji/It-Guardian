import {
  createNetworkTopologyNode,
  fetchNetworkTopologyMap,
  saveNetworkTopologyNodePositions
} from "../../../api.js";

const NODE_TYPES = new Set(["asset", "segment", "group"]);

function assertMapId(mapId) {
  if (typeof mapId !== "string" || !mapId.trim()) {
    throw new Error("Selecione um mapa de rede para salvar o layout.");
  }
}

function nodeIdentity(node) {
  const nodeType = node?.nodeType || "asset";
  const ref = nodeType === "asset" ? node?.assetId : node?.refId;
  if (!NODE_TYPES.has(nodeType) || typeof ref !== "string" || !ref.trim()) {
    throw new Error("Não foi possível identificar o item do inventário no mapa.");
  }
  return { nodeType, ref, key: `${nodeType}:${ref}` };
}

function assertPosition(point) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
    throw new Error("As posições do mapa devem conter coordenadas válidas.");
  }
}

function assertNode(node, mapId) {
  const identity = nodeIdentity(node);
  if (node.mapId && node.mapId !== mapId) {
    throw new Error("Este item pertence a outro mapa de rede.");
  }
  if (node.automatic === true) {
    assertPosition(node);
  } else if (typeof node.id !== "string" || !node.id.trim()) {
    throw new Error("O item salvo não possui um identificador válido.");
  }
  return identity;
}

function creationPayload(node, identity) {
  return {
    nodeType: identity.nodeType,
    ...(identity.nodeType === "asset" ? { assetId: identity.ref } : { refId: identity.ref }),
    x: node.x,
    y: node.y,
    pinned: Boolean(node.pinned),
    ...(node.labelOverride === undefined ? {} : { labelOverride: node.labelOverride })
  };
}

function isConfirmedNode(node, mapId, key) {
  if (!node || node.automatic === true || typeof node.id !== "string" || !node.id.trim()) return false;
  if (node.mapId && node.mapId !== mapId) return false;
  try {
    return nodeIdentity(node).key === key;
  } catch {
    return false;
  }
}

function canReconcile(error) {
  return !error?.statusCode || error.statusCode === 409 || error.statusCode >= 500;
}

/** Materialize only after an explicit save/pin action, never while projecting inventory. */
export async function ensureTopologyNode({ token, mapId, node, isCurrent = () => true, onMaterialized }) {
  if (!isCurrent()) return null;
  assertMapId(mapId);
  const identity = assertNode(node, mapId);
  if (node.automatic !== true) return node;

  let savedNode;
  try {
    if (!isCurrent()) return null;
    const response = await createNetworkTopologyNode(token, mapId, creationPayload(node, identity));
    if (!isCurrent()) return null;
    if (!isConfirmedNode(response?.node, mapId, identity.key)) {
      throw new Error("O servidor não confirmou a posição deste item no mapa.");
    }
    savedNode = response.node;
  } catch (creationError) {
    if (!isCurrent()) return null;
    if (!canReconcile(creationError)) throw creationError;
    // A failed response can follow a successful INSERT. Read this exact map
    // once; never issue another POST or create a different map by scope.
    try {
      if (!isCurrent()) return null;
      const response = await fetchNetworkTopologyMap(token, mapId);
      if (!isCurrent()) return null;
      if (response?.map?.id === mapId && Array.isArray(response.nodes)) {
        savedNode = response.nodes.find((entry) => isConfirmedNode(entry, mapId, identity.key));
      }
    } catch {
      if (!isCurrent()) return null;
      // Keep the write error when reconciliation also fails.
    }
    if (!savedNode) throw creationError;
  }

  if (!isCurrent()) return null;
  onMaterialized?.(savedNode, node);
  return isCurrent() ? savedNode : null;
}

/**
 * INSERTs keep the base layout; one transactional PATCH applies all requested
 * positions after IDs are resolved. Confirmed INSERTs are intentionally not
 * deleted if a later request fails: they may already be shared by another user.
 */
export async function saveTopologyPositions({
  token, mapId, changes, isCurrent = () => true, onMaterialized
}) {
  if (!isCurrent()) return null;
  assertMapId(mapId);
  if (!Array.isArray(changes)) throw new Error("Informe as posições do layout a salvar.");

  // Validate the entire batch before the first write. Last position wins for
  // duplicate references, but a known persistent node takes precedence.
  const uniqueChanges = new Map();
  for (const change of changes) {
    assertPosition(change);
    const identity = assertNode(change?.node, mapId);
    const previous = uniqueChanges.get(identity.key);
    const node = previous && previous.node.automatic !== true && change.node.automatic === true
      ? previous.node : change.node;
    uniqueChanges.set(identity.key, { node, x: change.x, y: change.y });
  }
  if (!isCurrent()) return null;
  if (!uniqueChanges.size) return { nodes: [] };

  const positions = [];
  for (const change of uniqueChanges.values()) {
    if (!isCurrent()) return null;
    const node = await ensureTopologyNode({ token, mapId, node: change.node, isCurrent, onMaterialized });
    if (!isCurrent() || !node) return null;
    positions.push({ nodeId: node.id, x: change.x, y: change.y });
  }

  try {
    if (!isCurrent()) return null;
    const response = await saveNetworkTopologyNodePositions(token, mapId, positions);
    return isCurrent() ? response : null;
  } catch (saveError) {
    if (!isCurrent()) return null;
    throw saveError;
  }
}
