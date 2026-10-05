import { apiFetch } from "./http.js";

/** @import { ApiObject, AuthToken } from "./types.js" */

/**
 * @param {AuthToken} token
 * @param {string} source
 * @returns {Promise<ApiObject>}
 */
export function fetchIntegrationStatus(token, source) {
  return apiFetch(`/integrations/${encodeURIComponent(source)}/status`, { token });
}

/**
 * @param {AuthToken} token
 * @param {string} source
 * @returns {Promise<ApiObject>}
 */
export function testIntegrationConnection(token, source) {
  return apiFetch(`/integrations/${encodeURIComponent(source)}/test`, {
    token,
    method: "POST"
  });
}

/**
 * @param {AuthToken} token
 * @param {string} source
 * @returns {Promise<ApiObject>}
 */
export function synchronizeIntegration(token, source) {
  return apiFetch(`/integrations/${encodeURIComponent(source)}/sync`, {
    token,
    method: "POST"
  });
}
