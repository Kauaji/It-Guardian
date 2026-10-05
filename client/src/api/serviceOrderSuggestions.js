import { apiFetch } from "./http.js";

/** @import { ApiObject, AuthToken, EntityId } from "./types.js" */

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchServiceOrderSuggestions(token) {
  return apiFetch("/service-order-suggestions", { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function acceptServiceOrderSuggestion(token, id) {
  return apiFetch(`/service-order-suggestions/${id}/accept`, {
    token,
    method: "POST"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {string} [reason]
 * @returns {Promise<ApiObject>}
 */
export function rejectServiceOrderSuggestion(token, id, reason = "") {
  return apiFetch(`/service-order-suggestions/${id}/reject`, {
    token,
    method: "POST",
    body: JSON.stringify({ reason })
  });
}
