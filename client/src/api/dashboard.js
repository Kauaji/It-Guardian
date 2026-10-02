import { apiFetch } from "./http.js";

export function fetchDashboardSummary(token, { period = "30d" } = {}) {
  const search = new URLSearchParams({ period }).toString();
  return apiFetch(`/dashboard/summary?${search}`, { token });
}

export function fetchDashboardLayout(token) {
  return apiFetch("/dashboard/layout", { token });
}

export function saveDashboardLayout(token, layout) {
  return apiFetch("/dashboard/layout", { token, method: "PUT", body: JSON.stringify(layout) });
}

export function resetDashboardLayout(token) {
  return apiFetch("/dashboard/layout/reset", { token, method: "POST" });
}

export function fetchDashboardWidgetCatalog(token) {
  return apiFetch("/dashboard/widgets/catalog", { token });
}

export function previewDashboardWidget(token, { type, config, filters }, { signal } = {}) {
  return apiFetch("/dashboard/widgets/preview", {
    token,
    method: "POST",
    body: JSON.stringify({ type, config, ...(filters ? { filters } : {}) }),
    signal
  });
}
