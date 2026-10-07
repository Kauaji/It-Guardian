import { apiFetch } from "./http.js";

/** @import { ApiObject, AuthToken, Payload } from "./types.js" */

/**
 * @param {AuthToken} token
 * @param {string} key
 * @returns {Promise<ApiObject>}
 */
export function fetchUserPreference(token, key) {
  return apiFetch(`/preferences/${encodeURIComponent(key)}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {string} key
 * @param {unknown} value
 * @returns {Promise<ApiObject>}
 */
export function saveUserPreference(token, key, value) {
  return apiFetch(`/preferences/${encodeURIComponent(key)}`, {
    method: "PUT",
    token,
    body: JSON.stringify({ value })
  });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchSystemSettings(token) {
  return apiFetch("/system-settings", { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updateSystemSettings(token, payload) {
  return apiFetch("/system-settings", {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}
