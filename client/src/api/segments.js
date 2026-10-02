import { apiFetch } from "./http.js";

export function fetchSegments(token) {
  return apiFetch("/segments", { token });
}

export function fetchSegmentGroups(token) {
  return apiFetch("/segments/groups", { token });
}

export function createSegment(token, nameOrPayload) {
  const payload = typeof nameOrPayload === "string" ? { name: nameOrPayload } : nameOrPayload;

  return apiFetch("/segments", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function renameSegment(token, id, updates) {
  return apiFetch(`/segments/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(typeof updates === "string" ? { name: updates } : updates)
  });
}

export function deleteSegment(token, id) {
  return apiFetch(`/segments/${id}`, {
    token,
    method: "DELETE"
  });
}

export function createSegmentGroup(token, payload) {
  return apiFetch("/segments/groups", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateSegmentGroup(token, id, payload) {
  return apiFetch(`/segments/groups/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteSegmentGroup(token, id) {
  return apiFetch(`/segments/groups/${id}`, {
    token,
    method: "DELETE"
  });
}
