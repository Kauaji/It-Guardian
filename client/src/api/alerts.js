import { apiFetch } from "./http.js";

/** @import { AlertListResponse, ApiObject, AuthToken, EntityId, Payload } from "./types.js" */

/**
 * @param {AuthToken} token
 * @returns {Promise<AlertListResponse>}
 */
export function fetchAlerts(token) {
  return apiFetch("/alerts", { token });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<AlertListResponse>}
 */
export function fetchAlertHistory(token) {
  return apiFetch("/alerts/history", { token });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchAlertRules(token) {
  return apiFetch("/alerts/rules", { token });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchAlertSettings(token) {
  return apiFetch("/alerts/settings", { token });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchAlertCorrelations(token) {
  return apiFetch("/alerts/correlations", { token });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchAlertInsights(token) {
  return apiFetch("/alerts/insights", { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function fetchAlertComments(token, id) {
  return apiFetch(`/alerts/${id}/comments`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {string} message
 * @returns {Promise<ApiObject>}
 */
export function createAlertComment(token, id, message) {
  return apiFetch(`/alerts/${id}/comments`, {
    token,
    method: "POST",
    body: JSON.stringify({ message })
  });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updateAlertSettings(token, payload) {
  return apiFetch("/alerts/settings", {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updateAlertRule(token, id, payload) {
  return apiFetch(`/alerts/rules/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function evaluateAlerts(token) {
  return apiFetch("/alerts/evaluate", {
    token,
    method: "POST"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {string} [note]
 * @returns {Promise<ApiObject>}
 */
export function acknowledgeAlert(token, id, note = "") {
  return apiFetch(`/alerts/${id}/acknowledge`, {
    token,
    method: "POST",
    body: JSON.stringify({ note })
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function removeAlertAcknowledgement(token, id) {
  return apiFetch(`/alerts/${id}/acknowledge`, {
    token,
    method: "DELETE"
  });
}
