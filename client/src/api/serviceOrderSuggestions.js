import { apiFetch } from "./http.js";

export function fetchServiceOrderSuggestions(token) {
  return apiFetch("/service-order-suggestions", { token });
}

export function acceptServiceOrderSuggestion(token, id) {
  return apiFetch(`/service-order-suggestions/${id}/accept`, {
    token,
    method: "POST"
  });
}

export function rejectServiceOrderSuggestion(token, id, reason = "") {
  return apiFetch(`/service-order-suggestions/${id}/reject`, {
    token,
    method: "POST",
    body: JSON.stringify({ reason })
  });
}
