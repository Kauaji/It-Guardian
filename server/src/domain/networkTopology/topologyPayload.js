import { makeHttpError } from "./topologyErrors.js";

/** @import { NormalizedTopologyLink, NormalizedTopologyMap, NormalizedTopologyNode, TopologyLink, TopologyMap, TopologyNode, TopologyPayload } from "./types.js" */

export const TOPOLOGY_MAP_SCOPE_TYPES = new Set(["global", "inventory_tab", "group", "segment"]);

export const TOPOLOGY_NODE_TYPES = new Set(["asset", "segment", "group"]);

export const TOPOLOGY_LINK_TYPES = new Set(["ethernet", "wifi", "fiber", "logical", "unknown"]);

export const TOPOLOGY_LINK_STATUS_OVERRIDES = new Set([
  "online",
  "warning",
  "critical",
  "offline",
  "unknown",
  "manual"
]);

/**
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string}
 */
function normalizeText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

/**
 * @param {unknown} value
 * @returns {string | null} Texto aparado ou `null` quando vazio.
 */
export function nullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
export function finiteNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/**
 * @param {TopologyPayload} [payload]
 * @param {TopologyMap} [existing]
 * @returns {NormalizedTopologyMap}
 * @throws {Error} 400 para nome curto ou escopo desconhecido.
 */
export function normalizeMapPayload(payload = {}, existing = {}) {
  const name = normalizeText(payload.name, existing.name || "");
  if (name.length < 2) {
    throw makeHttpError("Informe um nome para o mapa de rede.");
  }

  const scopeType = normalizeText(payload.scopeType ?? payload.scope_type ?? existing.scopeType, "global");
  if (!TOPOLOGY_MAP_SCOPE_TYPES.has(scopeType)) {
    throw makeHttpError("Escopo do mapa de rede nao suportado.");
  }

  return {
    name,
    scopeType,
    scopeId: nullableText(payload.scopeId ?? payload.scope_id ?? existing.scopeId)
  };
}

/**
 * @param {TopologyPayload} [payload]
 * @param {TopologyNode} [existing]
 * @returns {NormalizedTopologyNode}
 * @throws {Error} 400 para tipo desconhecido ou referencia ausente.
 */
export function normalizeNodePayload(payload = {}, existing = {}) {
  const nodeType = normalizeText(payload.nodeType ?? payload.node_type ?? existing.nodeType, "asset");
  if (!TOPOLOGY_NODE_TYPES.has(nodeType)) {
    throw makeHttpError("Tipo de no do mapa de rede nao suportado.");
  }

  const shared = {
    x: finiteNumber(payload.x, existing.x ?? 0),
    y: finiteNumber(payload.y, existing.y ?? 0),
    pinned: Boolean(payload.pinned ?? existing.pinned ?? false),
    labelOverride: nullableText(payload.labelOverride ?? payload.label_override ?? existing.labelOverride)
  };

  if (nodeType === "asset") {
    const assetId = nullableText(payload.assetId ?? payload.asset_id ?? existing.assetId);
    if (!assetId) {
      throw makeHttpError("Informe o ativo a ser posicionado no mapa de rede.");
    }
    return { nodeType, assetId, refId: null, ...shared };
  }

  const refId = nullableText(payload.refId ?? payload.ref_id ?? existing.refId);
  if (!refId) {
    throw makeHttpError("Informe o segmento ou grupo a ser posicionado no mapa de rede.");
  }
  return { nodeType, assetId: null, refId, ...shared };
}

/**
 * @param {TopologyPayload} [payload]
 * @param {TopologyLink} [existing]
 * @returns {NormalizedTopologyLink}
 * @throws {Error} 400 para conexao invalida.
 */
export function normalizeLinkPayload(payload = {}, existing = {}) {
  const sourceType = normalizeText(payload.sourceType ?? payload.source_type ?? existing.sourceType, "asset");
  const targetType = normalizeText(payload.targetType ?? payload.target_type ?? existing.targetType, "asset");
  if (!TOPOLOGY_NODE_TYPES.has(sourceType) || !TOPOLOGY_NODE_TYPES.has(targetType)) {
    throw makeHttpError("Tipo de no da conexao nao suportado.");
  }
  if (sourceType !== targetType) {
    throw makeHttpError("Uma conexao so pode ligar dois nos do mesmo tipo.");
  }

  const sourceAssetId = nullableText(payload.sourceAssetId ?? payload.source_asset_id ?? existing.sourceAssetId);
  const targetAssetId = nullableText(payload.targetAssetId ?? payload.target_asset_id ?? existing.targetAssetId);
  if (!sourceAssetId || !targetAssetId) {
    throw makeHttpError("Informe os dois lados da conexao.");
  }
  if (sourceAssetId === targetAssetId) {
    throw makeHttpError("Um item nao pode se conectar com ele mesmo.");
  }

  const type = normalizeText(payload.type ?? existing.type, "unknown");
  if (!TOPOLOGY_LINK_TYPES.has(type)) {
    throw makeHttpError("Tipo de conexao nao suportado.");
  }

  const statusOverride = nullableText(payload.statusOverride ?? payload.status_override ?? existing.statusOverride);
  if (statusOverride && !TOPOLOGY_LINK_STATUS_OVERRIDES.has(statusOverride)) {
    throw makeHttpError("Status de conexao nao suportado.");
  }

  return {
    sourceType,
    targetType,
    sourceAssetId,
    targetAssetId,
    label: nullableText(payload.label ?? existing.label),
    type,
    statusOverride,
    description: nullableText(payload.description ?? existing.description)
  };
}
