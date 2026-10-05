import { apiFetch } from "./http.js";

/** @import { ApiObject, AuthToken, EntityId, Payload, SegmentListResponse } from "./types.js" */

/**
 * @param {AuthToken} token
 * @returns {Promise<SegmentListResponse>}
 */
export function fetchSegments(token) {
  return apiFetch("/segments", { token });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchSegmentGroups(token) {
  return apiFetch("/segments/groups", { token });
}

/**
 * @param {AuthToken} token
 * @param {string | Payload} nameOrPayload
 * @returns {Promise<ApiObject>}
 */
export function createSegment(token, nameOrPayload) {
  const payload = typeof nameOrPayload === "string" ? { name: nameOrPayload } : nameOrPayload;

  return apiFetch("/segments", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {string | Payload} updates
 * @returns {Promise<ApiObject>}
 */
export function renameSegment(token, id, updates) {
  return apiFetch(`/segments/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(typeof updates === "string" ? { name: updates } : updates)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function deleteSegment(token, id) {
  return apiFetch(`/segments/${id}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createSegmentGroup(token, payload) {
  return apiFetch("/segments/groups", {
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
export function updateSegmentGroup(token, id, payload) {
  return apiFetch(`/segments/groups/${id}`, {
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
export function deleteSegmentGroup(token, id) {
  return apiFetch(`/segments/groups/${id}`, {
    token,
    method: "DELETE"
  });
}
