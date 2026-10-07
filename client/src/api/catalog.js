import { apiFetch, toSearchParams } from "./http.js";

/** @import { ApiObject, AuthToken, EntityId, Payload, QueryParams } from "./types.js" */

/**
 * @param {AuthToken} token
 * @param {QueryParams} [params]
 * @returns {Promise<ApiObject>}
 */
export function fetchClients(token, params = {}) {
  const search = toSearchParams(params).toString();
  return apiFetch(`/clients${search ? `?${search}` : ""}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createClient(token, payload) {
  return apiFetch("/clients", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updateClient(token, id, payload) {
  return apiFetch(`/clients/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function deleteClient(token, id) {
  return apiFetch(`/clients/${id}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {string} csv
 * @returns {Promise<ApiObject>}
 */
export function importClients(token, csv) {
  return apiFetch("/clients/import", {
    token,
    method: "POST",
    body: JSON.stringify({ csv })
  });
}

/**
 * @param {AuthToken} token
 * @param {QueryParams} [params]
 * @returns {Promise<ApiObject>}
 */
export function fetchProducts(token, params = {}) {
  const search = toSearchParams(params).toString();
  return apiFetch(`/products${search ? `?${search}` : ""}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createProduct(token, payload) {
  return apiFetch("/products", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updateProduct(token, id, payload) {
  return apiFetch(`/products/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function deleteProduct(token, id) {
  return apiFetch(`/products/${id}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {string} csv
 * @returns {Promise<ApiObject>}
 */
export function importProducts(token, csv) {
  return apiFetch("/products/import", {
    token,
    method: "POST",
    body: JSON.stringify({ csv })
  });
}

/**
 * @param {AuthToken} token
 * @param {QueryParams} [params]
 * @returns {Promise<ApiObject>}
 */
export function fetchServices(token, params = {}) {
  const search = toSearchParams(params).toString();
  return apiFetch(`/services${search ? `?${search}` : ""}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createService(token, payload) {
  return apiFetch("/services", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updateService(token, id, payload) {
  return apiFetch(`/services/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function deleteService(token, id) {
  return apiFetch(`/services/${id}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {QueryParams} [params]
 * @returns {Promise<ApiObject>}
 */
export function fetchTechnicians(token, params = {}) {
  const search = toSearchParams(params).toString();
  return apiFetch(`/technicians${search ? `?${search}` : ""}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createTechnician(token, payload) {
  return apiFetch("/technicians", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updateTechnician(token, id, payload) {
  return apiFetch(`/technicians/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function deleteTechnician(token, id) {
  return apiFetch(`/technicians/${id}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {QueryParams} [params]
 * @returns {Promise<ApiObject>}
 */
export function fetchProblemTypes(token, params = {}) {
  const search = toSearchParams(params).toString();
  return apiFetch(`/problem-types${search ? `?${search}` : ""}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createProblemType(token, payload) {
  return apiFetch("/problem-types", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updateProblemType(token, id, payload) {
  return apiFetch(`/problem-types/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function deleteProblemType(token, id) {
  return apiFetch(`/problem-types/${id}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {QueryParams} [params]
 * @returns {Promise<ApiObject>}
 */
export function fetchPriorityRules(token, params = {}) {
  const search = toSearchParams(params).toString();
  return apiFetch(`/priority-rules${search ? `?${search}` : ""}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function createPriorityRule(token, payload) {
  return apiFetch("/priority-rules", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<ApiObject>}
 */
export function updatePriorityRule(token, id, payload) {
  return apiFetch(`/priority-rules/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function deletePriorityRule(token, id) {
  return apiFetch(`/priority-rules/${id}`, {
    token,
    method: "DELETE"
  });
}
