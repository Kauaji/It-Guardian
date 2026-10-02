import { apiFetch } from "./http.js";

export function fetchIntegrationStatus(token, source) {
  return apiFetch(`/integrations/${encodeURIComponent(source)}/status`, { token });
}

export function testIntegrationConnection(token, source) {
  return apiFetch(`/integrations/${encodeURIComponent(source)}/test`, {
    token,
    method: "POST"
  });
}

export function synchronizeIntegration(token, source) {
  return apiFetch(`/integrations/${encodeURIComponent(source)}/sync`, {
    token,
    method: "POST"
  });
}
