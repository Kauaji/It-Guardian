import { apiFetch } from "./http.js";

export function fetchPartsInventory(token, params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/parts${search ? `?${search}` : ""}`, { token });
}

export function fetchPartInventoryItem(token, id) { return apiFetch(`/parts/${id}`, { token }); }

export function createPartInventoryItem(token, payload) { return apiFetch("/parts", { token, method: "POST", body: JSON.stringify(payload) }); }

export function updatePartInventoryItem(token, id, payload) { return apiFetch(`/parts/${id}`, { token, method: "PATCH", body: JSON.stringify(payload) }); }

export function createPartInventoryMovement(token, id, payload) { return apiFetch(`/parts/${id}/movements`, { token, method: "POST", body: JSON.stringify(payload) }); }

export function reviewPartInventoryDiscrepancy(token, id, action) { return apiFetch(`/parts/${id}/discrepancy`, { token, method: "POST", body: JSON.stringify({ action }) }); }

export function fetchPartCategories(token) { return apiFetch("/parts/categories", { token }); }

export function createPartCategory(token, payload) { return apiFetch("/parts/categories", { token, method: "POST", body: JSON.stringify(payload) }); }

export function deletePartCategory(token, id) { return apiFetch(`/parts/categories/${id}`, { token, method: "DELETE" }); }

export function syncPartsFromAssets(token) { return apiFetch("/parts/sync-assets", { token, method: "POST" }); }

export function importPartsInvoice(token, xml) { return apiFetch("/parts/import-invoice", { token, method: "POST", headers: { "Content-Type": "application/xml" }, body: xml }); }
