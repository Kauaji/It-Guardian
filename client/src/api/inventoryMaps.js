import { apiFetch } from "./http.js";

export function fetchInventoryVisualMaps(token) {
  return apiFetch("/inventory-visual-maps", { token });
}

export function fetchInventoryVisualMap(token, id) {
  return apiFetch(`/inventory-visual-maps/${id}`, { token });
}

export function createInventoryVisualMap(token, payload) {
  return apiFetch("/inventory-visual-maps", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateInventoryVisualMap(token, id, payload) {
  return apiFetch(`/inventory-visual-maps/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteInventoryVisualMap(token, id) {
  return apiFetch(`/inventory-visual-maps/${id}`, {
    token,
    method: "DELETE"
  });
}

export function fetchInventoryVisualMapObjects(token, id) {
  return apiFetch(`/inventory-visual-maps/${id}/objects`, { token });
}

export function fetchInventoryVisualMapConnections(token, id) {
  return apiFetch(`/inventory-visual-maps/${id}/connections`, { token });
}

export function createInventoryVisualMapObject(token, id, payload) {
  return apiFetch(`/inventory-visual-maps/${id}/objects`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateInventoryVisualMapObject(token, objectId, payload) {
  return apiFetch(`/inventory-visual-map-objects/${objectId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteInventoryVisualMapObject(token, objectId) {
  return apiFetch(`/inventory-visual-map-objects/${objectId}`, {
    token,
    method: "DELETE"
  });
}

export function createInventoryVisualMapConnection(token, id, payload) {
  return apiFetch(`/inventory-visual-maps/${id}/connections`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateInventoryVisualMapConnection(token, connectionId, payload) {
  return apiFetch(`/inventory-visual-map-connections/${connectionId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteInventoryVisualMapConnection(token, connectionId) {
  return apiFetch(`/inventory-visual-map-connections/${connectionId}`, {
    token,
    method: "DELETE"
  });
}
