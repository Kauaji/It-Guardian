import { apiFetch } from "./http.js";

export function fetchProductKeys(token) {
  return apiFetch("/product-keys", { token });
}

export function createProductKey(token, payload) {
  return apiFetch("/product-keys", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateProductKeyStatus(token, id, active) {
  return apiFetch(`/product-keys/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ active })
  });
}

export function fetchProductKeyActivations(token, id) {
  return apiFetch(`/product-keys/${id}/activations`, { token });
}

export function deactivateProductKeyActivation(token, id) {
  return apiFetch(`/product-keys/activations/${id}/deactivate`, {
    token,
    method: "POST"
  });
}
