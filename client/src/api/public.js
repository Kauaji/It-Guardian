import { apiFetch } from "./http.js";

export function fetchPublicSupportOptions() {
  return apiFetch("/public/support-options");
}

export function fetchPublicMachineContext(deviceToken) {
  return apiFetch(`/public/machine-context?device=${encodeURIComponent(deviceToken)}`);
}

export function createPublicServiceOrder(payload) {
  return apiFetch("/public/service-orders", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchPublicServiceOrderTracking(trackingToken) {
  return apiFetch(`/public/service-orders/track/${encodeURIComponent(trackingToken)}`);
}
