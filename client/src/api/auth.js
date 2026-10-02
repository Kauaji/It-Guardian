import { apiFetch } from "./http.js";

export function login(payload) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function register(payload) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchAuthSession() {
  return apiFetch("/auth/me");
}

export function logoutSession(token) {
  return apiFetch("/auth/logout", { method: "POST", token });
}
