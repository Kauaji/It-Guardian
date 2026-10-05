import { apiFetch } from "./http.js";

/** @import { ApiObject, AuthToken, EntityId, Payload } from "./types.js" */

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchProductKeys(token) {
  return apiFetch("/product-keys", { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createProductKey(token, payload) {
  return apiFetch("/product-keys", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {boolean} active
 * @returns {Promise<ApiObject>}
 */
export function updateProductKeyStatus(token, id, active) {
  return apiFetch(`/product-keys/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ active })
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function fetchProductKeyActivations(token, id) {
  return apiFetch(`/product-keys/${id}/activations`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function deactivateProductKeyActivation(token, id) {
  return apiFetch(`/product-keys/activations/${id}/deactivate`, {
    token,
    method: "POST"
  });
}
