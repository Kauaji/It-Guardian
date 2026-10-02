import { apiFetch } from "./http.js";

export function fetchServiceOrderSettings(token) {
  return apiFetch("/service-order-settings", { token });
}

export function updateServiceOrderSettings(token, payload) {
  return apiFetch("/service-order-settings", {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function fetchServiceOrderStatuses(token) {
  return apiFetch("/service-order-statuses", { token });
}

export function createServiceOrderStatus(token, payload) {
  return apiFetch("/service-order-statuses", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateServiceOrderStatusDefinition(token, id, payload) {
  return apiFetch(`/service-order-statuses/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteServiceOrderStatus(token, id) {
  return apiFetch(`/service-order-statuses/${id}`, {
    token,
    method: "DELETE"
  });
}

export function fetchServiceOrderChecklistTemplates(token) {
  return apiFetch("/service-order-checklist-templates", { token });
}

export function createServiceOrderChecklistTemplate(token, payload) {
  return apiFetch("/service-order-checklist-templates", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateServiceOrderChecklistTemplate(token, id, payload) {
  return apiFetch(`/service-order-checklist-templates/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteServiceOrderChecklistTemplate(token, id) {
  return apiFetch(`/service-order-checklist-templates/${id}`, {
    token,
    method: "DELETE"
  });
}

export function updateServiceOrderChecklistPolicy(token, payload) {
  return apiFetch("/service-order-checklist-templates/policy", {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}
