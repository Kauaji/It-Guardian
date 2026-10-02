import { apiFetch } from "./http.js";

export function fetchUserPreference(token, key) {
  return apiFetch(`/preferences/${encodeURIComponent(key)}`, { token });
}

export function saveUserPreference(token, key, value) {
  return apiFetch(`/preferences/${encodeURIComponent(key)}`, {
    method: "PUT",
    token,
    body: JSON.stringify({ value })
  });
}

export function fetchSystemSettings(token) {
  return apiFetch("/system-settings", { token });
}

export function updateSystemSettings(token, payload) {
  return apiFetch("/system-settings", {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}
