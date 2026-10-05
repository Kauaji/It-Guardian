import { apiFetch } from "./http.js";

/** @import { ApiObject, AuthToken, EntityId, Payload } from "./types.js" */

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchServiceOrderSettings(token) {
  return apiFetch("/service-order-settings", { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updateServiceOrderSettings(token, payload) {
  return apiFetch("/service-order-settings", {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchServiceOrderStatuses(token) {
  return apiFetch("/service-order-statuses", { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createServiceOrderStatus(token, payload) {
  return apiFetch("/service-order-statuses", {
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
export function updateServiceOrderStatusDefinition(token, id, payload) {
  return apiFetch(`/service-order-statuses/${id}`, {
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
export function deleteServiceOrderStatus(token, id) {
  return apiFetch(`/service-order-statuses/${id}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchServiceOrderChecklistTemplates(token) {
  return apiFetch("/service-order-checklist-templates", { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createServiceOrderChecklistTemplate(token, payload) {
  return apiFetch("/service-order-checklist-templates", {
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
export function updateServiceOrderChecklistTemplate(token, id, payload) {
  return apiFetch(`/service-order-checklist-templates/${id}`, {
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
export function deleteServiceOrderChecklistTemplate(token, id) {
  return apiFetch(`/service-order-checklist-templates/${id}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updateServiceOrderChecklistPolicy(token, payload) {
  return apiFetch("/service-order-checklist-templates/policy", {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}
