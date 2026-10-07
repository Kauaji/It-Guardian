import { apiFetch, toSearchParams } from "./http.js";

/** @import { ApiObject, AuthToken, EntityId, Payload, QueryParams } from "./types.js" */

/**
 * @param {AuthToken} token
 * @param {QueryParams} [params]
 * @returns {Promise<ApiObject>}
 */
export function fetchCalendarEvents(token, params = {}) {
  const search = toSearchParams(params).toString();
  return apiFetch(`/calendar/events${search ? `?${search}` : ""}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {QueryParams} [params]
 * @returns {Promise<ApiObject>}
 */
export function fetchCalendarSummary(token, params = {}) {
  const search = toSearchParams(params).toString();
  return apiFetch(`/calendar/summary${search ? `?${search}` : ""}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createCalendarEvent(token, payload) {
  return apiFetch("/calendar/events", { token, method: "POST", body: JSON.stringify(payload) });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updateCalendarEvent(token, id, payload) {
  return apiFetch(`/calendar/events/${id}`, { token, method: "PATCH", body: JSON.stringify(payload) });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {string} reason
 * @returns {Promise<ApiObject>}
 */
export function cancelCalendarEvent(token, id, reason) {
  return apiFetch(`/calendar/events/${id}/cancel`, { token, method: "POST", body: JSON.stringify({ reason }) });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function deleteCalendarEvent(token, id) {
  return apiFetch(`/calendar/events/${id}`, { token, method: "DELETE" });
}
