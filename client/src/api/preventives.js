import { apiFetch } from "./http.js";

export function fetchPreventivePlans(token) {
  return apiFetch("/preventive-plans", { token });
}

export function createPreventivePlan(token, payload) {
  return apiFetch("/preventive-plans", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function createPreventivePlanServiceOrder(token, id) {
  return apiFetch(`/preventive-plans/${id}/service-order`, {
    token,
    method: "POST"
  });
}

export function preparePreventivePlan(token, id) {
  return apiFetch(`/preventive-plans/${id}/prepare`, {
    token,
    method: "POST"
  });
}

export function fetchPreventiveAutomationPlans(token) {
  return apiFetch("/preventive-automation-plans", { token });
}

export function fetchPreventiveAutomationManagement(token) {
  return apiFetch("/preventive-automation-plans/management", { token });
}

export function fetchPreventiveAutomationAgenda(token, filters = {}) {
  const search = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value != null) search.set(key, value);
  });
  const suffix = search.toString() ? `?${search}` : "";
  return apiFetch(`/preventive-automation-plans/agenda${suffix}`, { token });
}

export function fetchPreventiveAutomationPlanHistory(token, planId, limit = 50) {
  return apiFetch(`/preventive-automation-plans/${planId}/history?limit=${limit}`, { token });
}

export function fetchPreventiveAutomationAsset(token, planId, assetId) {
  return apiFetch(`/preventive-automation-plans/${planId}/assets/${assetId}`, { token });
}

export function createPreventiveAutomationPlan(token, payload) {
  return apiFetch("/preventive-automation-plans", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updatePreventiveAutomationPlan(token, id, payload) {
  return apiFetch(`/preventive-automation-plans/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function disablePreventiveAutomationPlan(token, id) {
  return apiFetch(`/preventive-automation-plans/${id}/disable`, {
    token,
    method: "POST"
  });
}

export function reactivatePreventiveAutomationPlan(token, id) {
  return apiFetch(`/preventive-automation-plans/${id}/reactivate`, {
    token,
    method: "POST"
  });
}

export function deletePreventiveAutomationPlan(token, id) {
  return apiFetch(`/preventive-automation-plans/${id}`, {
    token,
    method: "DELETE"
  });
}

export function savePreventiveAutomationAssetOverride(token, planId, assetId, payload) {
  return apiFetch(`/preventive-automation-plans/${planId}/assets/${assetId}/override`, {
    token,
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function removePreventiveAutomationAssetOverride(token, planId, assetId) {
  return apiFetch(`/preventive-automation-plans/${planId}/assets/${assetId}/override`, {
    token,
    method: "DELETE"
  });
}

export function removeAssetFromPreventiveAutomationPlan(token, planId, assetId) {
  return apiFetch(`/preventive-automation-plans/${planId}/assets/${assetId}`, {
    token,
    method: "DELETE"
  });
}

export function preparePreventiveAutomationPlan(token, id) {
  return apiFetch(`/preventive-automation-plans/${id}/prepare`, {
    token,
    method: "POST"
  });
}

export function processDuePreventiveAutomationPlans(token) {
  return apiFetch("/preventive-automation-plans/process-due", {
    token,
    method: "POST"
  });
}
