import { apiFetch } from "./http.js";

export function fetchClients(token, params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/clients${search ? `?${search}` : ""}`, { token });
}

export function createClient(token, payload) {
  return apiFetch("/clients", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateClient(token, id, payload) {
  return apiFetch(`/clients/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteClient(token, id) {
  return apiFetch(`/clients/${id}`, {
    token,
    method: "DELETE"
  });
}

export function importClients(token, csv) {
  return apiFetch("/clients/import", {
    token,
    method: "POST",
    body: JSON.stringify({ csv })
  });
}

export function fetchProducts(token, params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/products${search ? `?${search}` : ""}`, { token });
}

export function createProduct(token, payload) {
  return apiFetch("/products", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateProduct(token, id, payload) {
  return apiFetch(`/products/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteProduct(token, id) {
  return apiFetch(`/products/${id}`, {
    token,
    method: "DELETE"
  });
}

export function importProducts(token, csv) {
  return apiFetch("/products/import", {
    token,
    method: "POST",
    body: JSON.stringify({ csv })
  });
}

export function fetchServices(token, params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/services${search ? `?${search}` : ""}`, { token });
}

export function createService(token, payload) {
  return apiFetch("/services", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateService(token, id, payload) {
  return apiFetch(`/services/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteService(token, id) {
  return apiFetch(`/services/${id}`, {
    token,
    method: "DELETE"
  });
}

export function fetchTechnicians(token, params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/technicians${search ? `?${search}` : ""}`, { token });
}

export function createTechnician(token, payload) {
  return apiFetch("/technicians", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateTechnician(token, id, payload) {
  return apiFetch(`/technicians/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteTechnician(token, id) {
  return apiFetch(`/technicians/${id}`, {
    token,
    method: "DELETE"
  });
}

export function fetchProblemTypes(token, params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/problem-types${search ? `?${search}` : ""}`, { token });
}

export function createProblemType(token, payload) {
  return apiFetch("/problem-types", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateProblemType(token, id, payload) {
  return apiFetch(`/problem-types/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteProblemType(token, id) {
  return apiFetch(`/problem-types/${id}`, {
    token,
    method: "DELETE"
  });
}

export function fetchPriorityRules(token, params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/priority-rules${search ? `?${search}` : ""}`, { token });
}

export function createPriorityRule(token, payload) {
  return apiFetch("/priority-rules", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updatePriorityRule(token, id, payload) {
  return apiFetch(`/priority-rules/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deletePriorityRule(token, id) {
  return apiFetch(`/priority-rules/${id}`, {
    token,
    method: "DELETE"
  });
}
