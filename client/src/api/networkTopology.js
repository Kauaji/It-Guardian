import { apiFetch, toSearchParams } from "./http.js";

/** @import { ApiObject, AuthToken, EntityId, Payload, QueryParams } from "./types.js" */

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchNetworkTopologyMaps(token) {
  return apiFetch("/topology-maps", { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function fetchNetworkTopologyMap(token, id) {
  return apiFetch(`/topology-maps/${id}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {string} scopeType
 * @param {EntityId} scopeId
 * @param {string} [scopeName]
 * @returns {Promise<ApiObject>}
 */
export function fetchNetworkTopologyMapByScope(token, scopeType, scopeId, scopeName) {
  /** @type {QueryParams} */
  const params = { scopeType, scopeId };
  if (scopeName) params.scopeName = scopeName;
  const query = toSearchParams(params).toString();
  return apiFetch(`/topology-maps/by-scope?${query}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createNetworkTopologyMap(token, payload) {
  return apiFetch("/topology-maps", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updateNetworkTopologyMap(token, id, payload) {
  return apiFetch(`/topology-maps/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function deleteNetworkTopologyMap(token, id) {
  return apiFetch(`/topology-maps/${id}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} mapId
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createNetworkTopologyNode(token, mapId, payload) {
  return apiFetch(`/topology-maps/${mapId}/nodes`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} nodeId
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updateNetworkTopologyNode(token, nodeId, payload) {
  return apiFetch(`/topology-map-nodes/${nodeId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} mapId
 * @param {Payload[]} positions
 * @returns {Promise<ApiObject>}
 */
export function saveNetworkTopologyNodePositions(token, mapId, positions) {
  return apiFetch(`/topology-maps/${mapId}/nodes/positions`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ positions })
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} nodeId
 * @returns {Promise<ApiObject>}
 */
export function deleteNetworkTopologyNode(token, nodeId) {
  return apiFetch(`/topology-map-nodes/${nodeId}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} mapId
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createNetworkTopologyLink(token, mapId, payload) {
  return apiFetch(`/topology-maps/${mapId}/links`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} linkId
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updateNetworkTopologyLink(token, linkId, payload) {
  return apiFetch(`/topology-map-links/${linkId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} linkId
 * @returns {Promise<ApiObject>}
 */
export function deleteNetworkTopologyLink(token, linkId) {
  return apiFetch(`/topology-map-links/${linkId}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} mapId
 * @param {Payload} [hints]
 * @returns {Promise<ApiObject>}
 */
export function generateNetworkTopologyAutoLayout(token, mapId, hints) {
  return apiFetch(`/topology-maps/${mapId}/auto-layout`, {
    token,
    method: "POST",
    body: JSON.stringify({ hints })
  });
}
