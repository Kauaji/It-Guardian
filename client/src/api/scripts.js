import { apiFetch } from "./http.js";

export function useSuggestionScript(token, suggestionId, scriptId, payload = {}) {
  return apiFetch(`/service-order-suggestions/${suggestionId}/scripts/${scriptId}/use`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchSuggestionRecommendedScripts(token, suggestionId) {
  return apiFetch(`/service-order-suggestions/${suggestionId}/recommended-scripts`, { token });
}

export function useServiceOrderScript(token, serviceOrderId, scriptId, payload = {}) {
  return apiFetch(`/service-orders/${serviceOrderId}/scripts/${scriptId}/use`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchServiceOrderScriptActivity(token, serviceOrderId) {
  return apiFetch(`/service-orders/${serviceOrderId}/script-activity`, { token });
}

export function fetchSuggestionScriptValidations(token, suggestionId) {
  return apiFetch(`/service-order-suggestions/${suggestionId}/script-validations`, { token });
}

export function cancelScriptValidation(token, id) {
  return apiFetch(`/script-validations/${id}/cancel`, {
    token,
    method: "POST"
  });
}

export function fetchPendingScriptLogs(token) {
  return apiFetch("/script-logs/pending", { token });
}

export function fetchScriptLog(token, id) {
  return apiFetch(`/script-logs/${id}`, { token });
}

export function acknowledgeScriptLog(token, id) {
  return apiFetch(`/script-logs/${id}/acknowledge`, {
    token,
    method: "POST"
  });
}

export function applyScriptLogSuggestedSolution(token, id, payload = {}) {
  return apiFetch(`/script-logs/${id}/apply-suggested-solution`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchMaintenanceScripts(token, params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/maintenance-scripts${search ? `?${search}` : ""}`, { token });
}

export function fetchMaintenanceScriptRecommendations(token, payload = {}) {
  return apiFetch("/maintenance-scripts/recommendations", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchScriptExecutionDiagnosis(token, payload = {}) {
  return apiFetch("/maintenance-scripts/execution-diagnosis", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function analyzeMaintenanceScript(token, payload) {
  return apiFetch("/maintenance-scripts/analyze", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function createMaintenanceScript(token, payload) {
  return apiFetch("/maintenance-scripts", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateMaintenanceScript(token, id, payload) {
  return apiFetch(`/maintenance-scripts/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteMaintenanceScript(token, id) {
  return apiFetch(`/maintenance-scripts/${id}`, {
    token,
    method: "DELETE"
  });
}

export function registerMaintenanceScriptSimulation(token, id, payload) {
  return apiFetch(`/maintenance-scripts/${id}/register-simulation`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}
