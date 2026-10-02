import { apiFetch } from "./http.js";

export function fetchAlerts(token) {
  return apiFetch("/alerts", { token });
}

export function fetchAlertHistory(token) {
  return apiFetch("/alerts/history", { token });
}

export function fetchAlertRules(token) {
  return apiFetch("/alerts/rules", { token });
}

export function fetchAlertSettings(token) {
  return apiFetch("/alerts/settings", { token });
}

export function fetchAlertCorrelations(token) {
  return apiFetch("/alerts/correlations", { token });
}

export function fetchAlertInsights(token) {
  return apiFetch("/alerts/insights", { token });
}

export function fetchAlertComments(token, id) {
  return apiFetch(`/alerts/${id}/comments`, { token });
}

export function createAlertComment(token, id, message) {
  return apiFetch(`/alerts/${id}/comments`, {
    token,
    method: "POST",
    body: JSON.stringify({ message })
  });
}

export function updateAlertSettings(token, payload) {
  return apiFetch("/alerts/settings", {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function updateAlertRule(token, id, payload) {
  return apiFetch(`/alerts/rules/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function evaluateAlerts(token) {
  return apiFetch("/alerts/evaluate", {
    token,
    method: "POST"
  });
}

export function acknowledgeAlert(token, id, note = "") {
  return apiFetch(`/alerts/${id}/acknowledge`, {
    token,
    method: "POST",
    body: JSON.stringify({ note })
  });
}

export function removeAlertAcknowledgement(token, id) {
  return apiFetch(`/alerts/${id}/acknowledge`, {
    token,
    method: "DELETE"
  });
}
