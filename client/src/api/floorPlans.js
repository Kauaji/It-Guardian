import { apiFetch, buildApiUrl } from "./http.js";

export function fetchFloorPlans(token, inventoryTabId = "") {
  const query = inventoryTabId ? `?inventoryTabId=${encodeURIComponent(inventoryTabId)}` : "";
  return apiFetch(`/floor-plans${query}`, { token });
}

export function fetchFloorPlan(token, id) {
  return apiFetch(`/floor-plans/${id}`, { token });
}

export function createFloorPlan(token, payload = {}) {
  return apiFetch("/floor-plans", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateFloorPlan(token, id, payload = {}) {
  return apiFetch(`/floor-plans/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function saveFloorPlanEditorData(token, id, payload = {}) {
  return apiFetch(`/floor-plans/${id}/editor-data`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function duplicateFloorPlan(token, id) {
  return apiFetch(`/floor-plans/${id}/duplicate`, {
    token,
    method: "POST"
  });
}

export function deleteFloorPlan(token, id) {
  return apiFetch(`/floor-plans/${id}`, {
    token,
    method: "DELETE"
  });
}

export function linkFloorPlanObjectToAsset(token, objectId, payload = {}) {
  return apiFetch(`/floor-plans/objects/${objectId}/link-equipment`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function uploadFloorPlanBackground(token, planId, floorId, file) {
  return apiFetch(`/floor-plans/${planId}/floors/${floorId}/background`, {
    token,
    method: "POST",
    headers: { "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name) },
    body: file
  });
}

export async function fetchFloorPlanBackgroundBlob(token, planId, floorId) {
  const response = await fetch(buildApiUrl(`/floor-plans/${planId}/floors/${floorId}/background`), {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) throw new Error(response.status === 404 ? "Imagem de fundo não cadastrada." : "Não foi possível carregar a imagem da planta.");
  return response.blob();
}

export function deleteFloorPlanBackground(token, planId, floorId) {
  return apiFetch(`/floor-plans/${planId}/floors/${floorId}/background`, { token, method: "DELETE" });
}

export function fetchFloorPlanSummary(token, planId, filters = {}) {
  const params = new URLSearchParams(filters);
  return apiFetch(`/floor-plans/${planId}/summary${params.size ? `?${params}` : ""}`, { token });
}

export function fetchFloorPlanAssetHeatmap(token, planId, metric = "availability", filters = {}) {
  const params = new URLSearchParams({ metric, ...filters });
  return apiFetch(`/floor-plans/${planId}/heatmap/assets?${params}`, { token });
}

export function fetchFloorPlanServiceOrderHeatmap(token, planId, startDate, endDate, filters = {}) {
  const params = new URLSearchParams({ startDate, endDate, ...filters });
  return apiFetch(`/floor-plans/${planId}/heatmap/service-orders?${params}`, { token });
}
