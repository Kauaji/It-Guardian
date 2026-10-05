import { apiFetch, toSearchParams } from "./http.js";

/** @import { ApiObject, AuthToken, EntityId, Payload, QueryParams } from "./types.js" */

/**
 * @param {AuthToken} token
 * @param {QueryParams} [params]
 * @returns {Promise<ApiObject>}
 */
export function fetchPartsInventory(token, params = {}) {
  const search = toSearchParams(params).toString();
  return apiFetch(`/parts${search ? `?${search}` : ""}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function fetchPartInventoryItem(token, id) { return apiFetch(`/parts/${id}`, { token }); }

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createPartInventoryItem(token, payload) { return apiFetch("/parts", { token, method: "POST", body: JSON.stringify(payload) }); }

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updatePartInventoryItem(token, id, payload) { return apiFetch(`/parts/${id}`, { token, method: "PATCH", body: JSON.stringify(payload) }); }

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createPartInventoryMovement(token, id, payload) { return apiFetch(`/parts/${id}/movements`, { token, method: "POST", body: JSON.stringify(payload) }); }

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {string} action
 * @returns {Promise<ApiObject>}
 */
export function reviewPartInventoryDiscrepancy(token, id, action) { return apiFetch(`/parts/${id}/discrepancy`, { token, method: "POST", body: JSON.stringify({ action }) }); }

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchPartCategories(token) { return apiFetch("/parts/categories", { token }); }

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createPartCategory(token, payload) { return apiFetch("/parts/categories", { token, method: "POST", body: JSON.stringify(payload) }); }

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function deletePartCategory(token, id) { return apiFetch(`/parts/categories/${id}`, { token, method: "DELETE" }); }

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function syncPartsFromAssets(token) { return apiFetch("/parts/sync-assets", { token, method: "POST" }); }

/**
 * @param {AuthToken} token
 * @param {string} xml
 * @returns {Promise<ApiObject>}
 */
export function importPartsInvoice(token, xml) { return apiFetch("/parts/import-invoice", { token, method: "POST", headers: { "Content-Type": "application/xml" }, body: xml }); }
