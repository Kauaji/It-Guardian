import { apiFetch } from "./http.js";

/** @import { ApiObject, AuthToken, EntityId, Payload } from "./types.js" */

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchInventoryVisualMaps(token) {
  return apiFetch("/inventory-visual-maps", { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function fetchInventoryVisualMap(token, id) {
  return apiFetch(`/inventory-visual-maps/${id}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createInventoryVisualMap(token, payload) {
  return apiFetch("/inventory-visual-maps", {
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
export function updateInventoryVisualMap(token, id, payload) {
  return apiFetch(`/inventory-visual-maps/${id}`, {
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
export function deleteInventoryVisualMap(token, id) {
  return apiFetch(`/inventory-visual-maps/${id}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function fetchInventoryVisualMapObjects(token, id) {
  return apiFetch(`/inventory-visual-maps/${id}/objects`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function fetchInventoryVisualMapConnections(token, id) {
  return apiFetch(`/inventory-visual-maps/${id}/connections`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createInventoryVisualMapObject(token, id, payload) {
  return apiFetch(`/inventory-visual-maps/${id}/objects`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} objectId
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updateInventoryVisualMapObject(token, objectId, payload) {
  return apiFetch(`/inventory-visual-map-objects/${objectId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} objectId
 * @returns {Promise<ApiObject>}
 */
export function deleteInventoryVisualMapObject(token, objectId) {
  return apiFetch(`/inventory-visual-map-objects/${objectId}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createInventoryVisualMapConnection(token, id, payload) {
  return apiFetch(`/inventory-visual-maps/${id}/connections`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} connectionId
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updateInventoryVisualMapConnection(token, connectionId, payload) {
  return apiFetch(`/inventory-visual-map-connections/${connectionId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} connectionId
 * @returns {Promise<ApiObject>}
 */
export function deleteInventoryVisualMapConnection(token, connectionId) {
  return apiFetch(`/inventory-visual-map-connections/${connectionId}`, {
    token,
    method: "DELETE"
  });
}
