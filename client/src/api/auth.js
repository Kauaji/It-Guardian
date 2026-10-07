import { apiFetch } from "./http.js";

/** @import { ApiObject, AuthToken, LoginResponse, Payload, SessionResponse } from "./types.js" */

/**
 * @param {Payload} payload
 * @returns {Promise<LoginResponse>}
 */
export function login(payload) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {Payload} payload
 * @returns {Promise<SessionResponse>}
 */
export function register(payload) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @returns {Promise<SessionResponse>}
 */
export function fetchAuthSession() {
  return apiFetch("/auth/me");
}

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function logoutSession(token) {
  return apiFetch("/auth/logout", { method: "POST", token });
}
