import { apiFetch } from "./http.js";

export function fetchServiceOrders(token) {
  return apiFetch("/service-orders", { token });
}

export function fetchServiceOrder(token, id) {
  return apiFetch(`/service-orders/${id}`, { token });
}

export function createServiceOrder(token, payload) {
  return apiFetch("/service-orders", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateServiceOrder(token, id, payload) {
  return apiFetch(`/service-orders/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function updateServiceOrderStatus(token, id, status) {
  return apiFetch(`/service-orders/${id}/status`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function addServiceOrderHistory(token, id, payload) {
  return apiFetch(`/service-orders/${id}/history`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function deleteServiceOrder(token, id) {
  return apiFetch(`/service-orders/${id}`, {
    token,
    method: "DELETE"
  });
}

export function reopenServiceOrder(token, id, reason) {
  return apiFetch(`/service-orders/${id}/reopen`, {
    token,
    method: "POST",
    body: JSON.stringify({ reason })
  });
}

export function fetchServiceOrderFeedback(token, id) {
  return apiFetch(`/service-orders/${id}/feedback`, { token });
}

export function submitServiceOrderFeedback(token, id, payload) {
  return apiFetch(`/service-orders/${id}/feedback`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchServiceOrderChecklist(token, id) {
  return apiFetch(`/service-orders/${id}/checklist`, { token });
}

export function updateServiceOrderChecklistItem(token, id, resultId, payload) {
  return apiFetch(`/service-orders/${id}/checklist/${resultId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function fetchServiceOrderAttachments(token, id) {
  return apiFetch(`/service-orders/${id}/attachments`, { token });
}

export function createServiceOrderAttachment(token, id, payload) {
  return apiFetch(`/service-orders/${id}/attachments`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function deleteServiceOrderAttachment(token, id, attachmentId) {
  return apiFetch(`/service-orders/${id}/attachments/${attachmentId}`, {
    token,
    method: "DELETE"
  });
}
