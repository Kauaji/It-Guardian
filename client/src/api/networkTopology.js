import { apiFetch } from "./http.js";

export function fetchNetworkTopologyMaps(token) {
  return apiFetch("/topology-maps", { token });
}

export function fetchNetworkTopologyMap(token, id) {
  return apiFetch(`/topology-maps/${id}`, { token });
}

export function fetchNetworkTopologyMapByScope(token, scopeType, scopeId, scopeName) {
  const params = { scopeType, scopeId };
  if (scopeName) params.scopeName = scopeName;
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/topology-maps/by-scope?${query}`, { token });
}

export function createNetworkTopologyMap(token, payload) {
  return apiFetch("/topology-maps", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateNetworkTopologyMap(token, id, payload) {
  return apiFetch(`/topology-maps/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteNetworkTopologyMap(token, id) {
  return apiFetch(`/topology-maps/${id}`, {
    token,
    method: "DELETE"
  });
}

export function createNetworkTopologyNode(token, mapId, payload) {
  return apiFetch(`/topology-maps/${mapId}/nodes`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateNetworkTopologyNode(token, nodeId, payload) {
  return apiFetch(`/topology-map-nodes/${nodeId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function saveNetworkTopologyNodePositions(token, mapId, positions) {
  return apiFetch(`/topology-maps/${mapId}/nodes/positions`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ positions })
  });
}

export function deleteNetworkTopologyNode(token, nodeId) {
  return apiFetch(`/topology-map-nodes/${nodeId}`, {
    token,
    method: "DELETE"
  });
}

export function createNetworkTopologyLink(token, mapId, payload) {
  return apiFetch(`/topology-maps/${mapId}/links`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateNetworkTopologyLink(token, linkId, payload) {
  return apiFetch(`/topology-map-links/${linkId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteNetworkTopologyLink(token, linkId) {
  return apiFetch(`/topology-map-links/${linkId}`, {
    token,
    method: "DELETE"
  });
}

export function generateNetworkTopologyAutoLayout(token, mapId, hints) {
  return apiFetch(`/topology-maps/${mapId}/auto-layout`, {
    token,
    method: "POST",
    body: JSON.stringify({ hints })
  });
}
