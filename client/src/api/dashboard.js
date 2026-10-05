import { apiFetch } from "./http.js";

/** @import { ApiObject, AuthToken, Payload, QueryParams } from "./types.js" */

/**
 * @param {AuthToken} token
 * @param {{ period?: string }} [options]
 * @returns {Promise<ApiObject>}
 */
export function fetchDashboardSummary(token, { period = "30d" } = {}) {
  const search = new URLSearchParams({ period }).toString();
  return apiFetch(`/dashboard/summary?${search}`, { token });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchDashboardLayout(token) {
  return apiFetch("/dashboard/layout", { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} layout
 * @returns {Promise<ApiObject>}
 */
export function saveDashboardLayout(token, layout) {
  return apiFetch("/dashboard/layout", { token, method: "PUT", body: JSON.stringify(layout) });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function resetDashboardLayout(token) {
  return apiFetch("/dashboard/layout/reset", { token, method: "POST" });
}

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchDashboardWidgetCatalog(token) {
  return apiFetch("/dashboard/widgets/catalog", { token });
}

/**
 * @param {AuthToken} token
 * @param {{ type: string, config?: Payload, filters?: QueryParams }} args
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<ApiObject>}
 */
export function previewDashboardWidget(token, { type, config, filters }, { signal } = {}) {
  return apiFetch("/dashboard/widgets/preview", {
    token,
    method: "POST",
    body: JSON.stringify({ type, config, ...(filters ? { filters } : {}) }),
    signal
  });
}
