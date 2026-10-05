import { apiFetch, buildApiUrl, toSearchParams } from "./http.js";

/** @import { ApiObject, AuthToken, EntityId, Payload, QueryParams } from "./types.js" */

/**
 * @param {AuthToken} token
 * @param {EntityId} [inventoryTabId]
 * @returns {Promise<ApiObject>}
 */
export function fetchFloorPlans(token, inventoryTabId = "") {
  const query = inventoryTabId ? `?inventoryTabId=${encodeURIComponent(inventoryTabId)}` : "";
  return apiFetch(`/floor-plans${query}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function fetchFloorPlan(token, id) {
  return apiFetch(`/floor-plans/${id}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} [payload]
 * @returns {Promise<ApiObject>}
 */
export function createFloorPlan(token, payload = {}) {
  return apiFetch("/floor-plans", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} [payload]
 * @returns {Promise<ApiObject>}
 */
export function updateFloorPlan(token, id, payload = {}) {
  return apiFetch(`/floor-plans/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} [payload]
 * @returns {Promise<ApiObject>}
 */
export function saveFloorPlanEditorData(token, id, payload = {}) {
  return apiFetch(`/floor-plans/${id}/editor-data`, {
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
export function duplicateFloorPlan(token, id) {
  return apiFetch(`/floor-plans/${id}/duplicate`, {
    token,
    method: "POST"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function deleteFloorPlan(token, id) {
  return apiFetch(`/floor-plans/${id}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} objectId
 * @param {Payload} [payload]
 * @returns {Promise<ApiObject>}
 */
export function linkFloorPlanObjectToAsset(token, objectId, payload = {}) {
  return apiFetch(`/floor-plans/objects/${objectId}/link-equipment`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} planId
 * @param {EntityId} floorId
 * @param {File} file
 * @returns {Promise<ApiObject>}
 */
export function uploadFloorPlanBackground(token, planId, floorId, file) {
  return apiFetch(`/floor-plans/${planId}/floors/${floorId}/background`, {
    token,
    method: "POST",
    headers: { "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name) },
    body: file
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} planId
 * @param {EntityId} floorId
 * @returns {Promise<Blob>}
 */
export async function fetchFloorPlanBackgroundBlob(token, planId, floorId) {
  const response = await fetch(buildApiUrl(`/floor-plans/${planId}/floors/${floorId}/background`), {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) throw new Error(response.status === 404 ? "Imagem de fundo não cadastrada." : "Não foi possível carregar a imagem da planta.");
  return response.blob();
}

/**
 * @param {AuthToken} token
 * @param {EntityId} planId
 * @param {EntityId} floorId
 * @returns {Promise<ApiObject>}
 */
export function deleteFloorPlanBackground(token, planId, floorId) {
  return apiFetch(`/floor-plans/${planId}/floors/${floorId}/background`, { token, method: "DELETE" });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} planId
 * @param {QueryParams} [filters]
 * @returns {Promise<ApiObject>}
 */
export function fetchFloorPlanSummary(token, planId, filters = {}) {
  const params = toSearchParams(filters);
  return apiFetch(`/floor-plans/${planId}/summary${params.size ? `?${params}` : ""}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} planId
 * @param {string} [metric]
 * @param {QueryParams} [filters]
 * @returns {Promise<ApiObject>}
 */
export function fetchFloorPlanAssetHeatmap(token, planId, metric = "availability", filters = {}) {
  const params = toSearchParams({ metric, ...filters });
  return apiFetch(`/floor-plans/${planId}/heatmap/assets?${params}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} planId
 * @param {string} startDate
 * @param {string} endDate
 * @param {QueryParams} [filters]
 * @returns {Promise<ApiObject>}
 */
export function fetchFloorPlanServiceOrderHeatmap(token, planId, startDate, endDate, filters = {}) {
  const params = toSearchParams({ startDate, endDate, ...filters });
  return apiFetch(`/floor-plans/${planId}/heatmap/service-orders?${params}`, { token });
}
