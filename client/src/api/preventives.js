import { apiFetch, buildQuerySuffix } from "./http.js";

/** @import { ApiObject, AuthToken, EntityId, Payload, QueryParams } from "./types.js" */

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchPreventivePlans(token) {
  return apiFetch("/preventive-plans", { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createPreventivePlan(token, payload) {
  return apiFetch("/preventive-plans", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function createPreventivePlanServiceOrder(token, id) {
  return apiFetch(`/preventive-plans/${id}/service-order`, {
    token,
    method: "POST"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function preparePreventivePlan(token, id) {
  return apiFetch(`/preventive-plans/${id}/prepare`, {
    token,
    method: "POST"
  });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchPreventiveAutomationPlans(token) {
  return apiFetch("/preventive-automation-plans", { token });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchPreventiveAutomationManagement(token) {
  return apiFetch("/preventive-automation-plans/management", { token });
}

/**
 * @param {AuthToken} token
 * @param {QueryParams} [filters]
 * @returns {Promise<ApiObject>}
 */
export function fetchPreventiveAutomationAgenda(token, filters = {}) {
  const suffix = buildQuerySuffix(filters);
  return apiFetch(`/preventive-automation-plans/agenda${suffix}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} planId
 * @param {number} [limit]
 * @returns {Promise<ApiObject>}
 */
export function fetchPreventiveAutomationPlanHistory(token, planId, limit = 50) {
  return apiFetch(`/preventive-automation-plans/${planId}/history?limit=${limit}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} planId
 * @param {EntityId} assetId
 * @returns {Promise<ApiObject>}
 */
export function fetchPreventiveAutomationAsset(token, planId, assetId) {
  return apiFetch(`/preventive-automation-plans/${planId}/assets/${assetId}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createPreventiveAutomationPlan(token, payload) {
  return apiFetch("/preventive-automation-plans", {
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
export function updatePreventiveAutomationPlan(token, id, payload) {
  return apiFetch(`/preventive-automation-plans/${id}`, {
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
export function disablePreventiveAutomationPlan(token, id) {
  return apiFetch(`/preventive-automation-plans/${id}/disable`, {
    token,
    method: "POST"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function reactivatePreventiveAutomationPlan(token, id) {
  return apiFetch(`/preventive-automation-plans/${id}/reactivate`, {
    token,
    method: "POST"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function deletePreventiveAutomationPlan(token, id) {
  return apiFetch(`/preventive-automation-plans/${id}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} planId
 * @param {EntityId} assetId
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function savePreventiveAutomationAssetOverride(token, planId, assetId, payload) {
  return apiFetch(`/preventive-automation-plans/${planId}/assets/${assetId}/override`, {
    token,
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} planId
 * @param {EntityId} assetId
 * @returns {Promise<ApiObject>}
 */
export function removePreventiveAutomationAssetOverride(token, planId, assetId) {
  return apiFetch(`/preventive-automation-plans/${planId}/assets/${assetId}/override`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} planId
 * @param {EntityId} assetId
 * @returns {Promise<ApiObject>}
 */
export function removeAssetFromPreventiveAutomationPlan(token, planId, assetId) {
  return apiFetch(`/preventive-automation-plans/${planId}/assets/${assetId}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function preparePreventiveAutomationPlan(token, id) {
  return apiFetch(`/preventive-automation-plans/${id}/prepare`, {
    token,
    method: "POST"
  });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function processDuePreventiveAutomationPlans(token) {
  return apiFetch("/preventive-automation-plans/process-due", {
    token,
    method: "POST"
  });
}
