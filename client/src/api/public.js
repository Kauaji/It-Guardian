import { apiFetch } from "./http.js";

/** @import { ApiObject, Payload } from "./types.js" */

/**
 * @returns {Promise<ApiObject>}
 */
export function fetchPublicSupportOptions() {
  return apiFetch("/public/support-options");
}

/**
 * @param {string} deviceToken
 * @returns {Promise<ApiObject>}
 */
export function fetchPublicMachineContext(deviceToken) {
  return apiFetch(`/public/machine-context?device=${encodeURIComponent(deviceToken)}`);
}

/**
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createPublicServiceOrder(payload) {
  return apiFetch("/public/service-orders", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {string} trackingToken
 * @returns {Promise<ApiObject>}
 */
export function fetchPublicServiceOrderTracking(trackingToken) {
  return apiFetch(`/public/service-orders/track/${encodeURIComponent(trackingToken)}`);
}
