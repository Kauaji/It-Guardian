import { apiFetch } from "./http.js";

export function fetchCalendarEvents(token, params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/calendar/events${search ? `?${search}` : ""}`, { token });
}

export function fetchCalendarSummary(token, params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/calendar/summary${search ? `?${search}` : ""}`, { token });
}

export function createCalendarEvent(token, payload) {
  return apiFetch("/calendar/events", { token, method: "POST", body: JSON.stringify(payload) });
}

export function updateCalendarEvent(token, id, payload) {
  return apiFetch(`/calendar/events/${id}`, { token, method: "PATCH", body: JSON.stringify(payload) });
}

export function cancelCalendarEvent(token, id, reason) {
  return apiFetch(`/calendar/events/${id}/cancel`, { token, method: "POST", body: JSON.stringify({ reason }) });
}

export function deleteCalendarEvent(token, id) {
  return apiFetch(`/calendar/events/${id}`, { token, method: "DELETE" });
}
