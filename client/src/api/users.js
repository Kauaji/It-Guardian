import { apiFetch } from "./http.js";

/** @import { ApiObject, AuthToken, EntityId, Payload, SectorListResponse, SectorResponse, UserListResponse, UserResponse } from "./types.js" */

/**
 * @param {AuthToken} token
 * @returns {Promise<UserListResponse>}
 */
export function fetchUsers(token) {
  return apiFetch("/users", { token });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchPermissions(token) {
  return apiFetch("/permissions", { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<UserResponse>}
 */
export function createUser(token, payload) {
  return apiFetch("/users", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<UserResponse>}
 */
export function updateUserAccess(token, id, payload) {
  return apiFetch(`/users/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {string[]} permissions
 * @returns {Promise<UserResponse>}
 */
export function updateUserPermissions(token, id, permissions) {
  return apiFetch(`/users/${id}/permissions`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ permissions })
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function deleteUser(token, id) {
  return apiFetch(`/users/${id}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {string} role
 * @returns {Promise<UserResponse>}
 */
export function updateUserRole(token, id, role) {
  return apiFetch(`/users/${id}/role`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ role })
  });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<SectorListResponse>}
 */
export function fetchSectors(token) {
  return apiFetch("/sectors", { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<SectorResponse>}
 */
export function createSector(token, payload) {
  return apiFetch("/sectors", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<SectorResponse>}
 */
export function updateSector(token, id, payload) {
  return apiFetch(`/sectors/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {string[]} permissions
 * @returns {Promise<SectorResponse>}
 */
export function updateSectorPermissions(token, id, permissions) {
  return apiFetch(`/sectors/${id}/permissions`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ permissions })
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function deleteSector(token, id) {
  return apiFetch(`/sectors/${id}`, {
    token,
    method: "DELETE"
  });
}
