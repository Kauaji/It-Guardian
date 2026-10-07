import { apiFetch, toSearchParams } from "./http.js";

/** @import { ApiObject, AuthToken, EntityId, Payload, QueryParams } from "./types.js" */

/**
 * @param {AuthToken} token
 * @param {EntityId} suggestionId
 * @param {EntityId} scriptId
 * @param {Payload} [payload]
 * @returns {Promise<ApiObject>}
 */
export function useSuggestionScript(token, suggestionId, scriptId, payload = {}) {
  return apiFetch(`/service-order-suggestions/${suggestionId}/scripts/${scriptId}/use`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} suggestionId
 * @returns {Promise<ApiObject>}
 */
export function fetchSuggestionRecommendedScripts(token, suggestionId) {
  return apiFetch(`/service-order-suggestions/${suggestionId}/recommended-scripts`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} serviceOrderId
 * @param {EntityId} scriptId
 * @param {Payload} [payload]
 * @returns {Promise<ApiObject>}
 */
export function useServiceOrderScript(token, serviceOrderId, scriptId, payload = {}) {
  return apiFetch(`/service-orders/${serviceOrderId}/scripts/${scriptId}/use`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} serviceOrderId
 * @returns {Promise<ApiObject>}
 */
export function fetchServiceOrderScriptActivity(token, serviceOrderId) {
  return apiFetch(`/service-orders/${serviceOrderId}/script-activity`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} suggestionId
 * @returns {Promise<ApiObject>}
 */
export function fetchSuggestionScriptValidations(token, suggestionId) {
  return apiFetch(`/service-order-suggestions/${suggestionId}/script-validations`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function cancelScriptValidation(token, id) {
  return apiFetch(`/script-validations/${id}/cancel`, {
    token,
    method: "POST"
  });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchPendingScriptLogs(token) {
  return apiFetch("/script-logs/pending", { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function fetchScriptLog(token, id) {
  return apiFetch(`/script-logs/${id}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function acknowledgeScriptLog(token, id) {
  return apiFetch(`/script-logs/${id}/acknowledge`, {
    token,
    method: "POST"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} [payload]
 * @returns {Promise<ApiObject>}
 */
export function applyScriptLogSuggestedSolution(token, id, payload = {}) {
  return apiFetch(`/script-logs/${id}/apply-suggested-solution`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {QueryParams} [params]
 * @returns {Promise<ApiObject>}
 */
export function fetchMaintenanceScripts(token, params = {}) {
  const search = toSearchParams(params).toString();
  return apiFetch(`/maintenance-scripts${search ? `?${search}` : ""}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} [payload]
 * @returns {Promise<ApiObject>}
 */
export function fetchMaintenanceScriptRecommendations(token, payload = {}) {
  return apiFetch("/maintenance-scripts/recommendations", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {Payload} [payload]
 * @returns {Promise<ApiObject>}
 */
export function fetchScriptExecutionDiagnosis(token, payload = {}) {
  return apiFetch("/maintenance-scripts/execution-diagnosis", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function analyzeMaintenanceScript(token, payload) {
  return apiFetch("/maintenance-scripts/analyze", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createMaintenanceScript(token, payload) {
  return apiFetch("/maintenance-scripts", {
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
export function updateMaintenanceScript(token, id, payload) {
  return apiFetch(`/maintenance-scripts/${id}`, {
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
export function deleteMaintenanceScript(token, id) {
  return apiFetch(`/maintenance-scripts/${id}`, {
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
export function registerMaintenanceScriptSimulation(token, id, payload) {
  return apiFetch(`/maintenance-scripts/${id}/register-simulation`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}
