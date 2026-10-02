import { apiFetch } from "./http.js";

export function fetchUsers(token) {
  return apiFetch("/users", { token });
}

export function fetchPermissions(token) {
  return apiFetch("/permissions", { token });
}

export function createUser(token, payload) {
  return apiFetch("/users", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateUserAccess(token, id, payload) {
  return apiFetch(`/users/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function updateUserPermissions(token, id, permissions) {
  return apiFetch(`/users/${id}/permissions`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ permissions })
  });
}

export function deleteUser(token, id) {
  return apiFetch(`/users/${id}`, {
    token,
    method: "DELETE"
  });
}

export function updateUserRole(token, id, role) {
  return apiFetch(`/users/${id}/role`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ role })
  });
}

export function fetchSectors(token) {
  return apiFetch("/sectors", { token });
}

export function createSector(token, payload) {
  return apiFetch("/sectors", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateSector(token, id, payload) {
  return apiFetch(`/sectors/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function updateSectorPermissions(token, id, permissions) {
  return apiFetch(`/sectors/${id}/permissions`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ permissions })
  });
}

export function deleteSector(token, id) {
  return apiFetch(`/sectors/${id}`, {
    token,
    method: "DELETE"
  });
}
