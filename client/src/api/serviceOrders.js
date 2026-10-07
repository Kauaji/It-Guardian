import { apiFetch } from "./http.js";

/** @import { ApiObject, AuthToken, EntityId, Payload, ServiceOrderListResponse, ServiceOrderResponse } from "./types.js" */

/**
 * @param {AuthToken} token
 * @returns {Promise<ServiceOrderListResponse>}
 */
export function fetchServiceOrders(token) {
  return apiFetch("/service-orders", { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ServiceOrderResponse>}
 */
export function fetchServiceOrder(token, id) {
  return apiFetch(`/service-orders/${id}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ServiceOrderResponse>}
 */
export function createServiceOrder(token, payload) {
  return apiFetch("/service-orders", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<ServiceOrderResponse>}
 */
export function updateServiceOrder(token, id, payload) {
  return apiFetch(`/service-orders/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {string} status
 * @returns {Promise<ServiceOrderResponse>}
 */
export function updateServiceOrderStatus(token, id, status) {
  return apiFetch(`/service-orders/${id}/status`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<ServiceOrderResponse>}
 */
export function addServiceOrderHistory(token, id, payload) {
  return apiFetch(`/service-orders/${id}/history`, {
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
export function deleteServiceOrder(token, id) {
  return apiFetch(`/service-orders/${id}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {string} reason
 * @returns {Promise<ServiceOrderResponse>}
 */
export function reopenServiceOrder(token, id, reason) {
  return apiFetch(`/service-orders/${id}/reopen`, {
    token,
    method: "POST",
    body: JSON.stringify({ reason })
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function fetchServiceOrderFeedback(token, id) {
  return apiFetch(`/service-orders/${id}/feedback`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function submitServiceOrderFeedback(token, id, payload) {
  return apiFetch(`/service-orders/${id}/feedback`, {
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
export function fetchServiceOrderChecklist(token, id) {
  return apiFetch(`/service-orders/${id}/checklist`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {EntityId} resultId
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updateServiceOrderChecklistItem(token, id, resultId, payload) {
  return apiFetch(`/service-orders/${id}/checklist/${resultId}`, {
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
export function fetchServiceOrderAttachments(token, id) {
  return apiFetch(`/service-orders/${id}/attachments`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createServiceOrderAttachment(token, id, payload) {
  return apiFetch(`/service-orders/${id}/attachments`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {EntityId} attachmentId
 * @returns {Promise<ApiObject>}
 */
export function deleteServiceOrderAttachment(token, id, attachmentId) {
  return apiFetch(`/service-orders/${id}/attachments/${attachmentId}`, {
    token,
    method: "DELETE"
  });
}
