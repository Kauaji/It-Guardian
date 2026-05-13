const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const WS_URL = import.meta.env.VITE_WS_URL || API_URL.replace(/^http/, "ws").replace(/\/api$/, "/ws");

export async function apiFetch(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

export function login(payload) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function register(payload) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchDevices(token, params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/devices${search ? `?${search}` : ""}`, { token });
}

export function fetchDevice(token, id) {
  return apiFetch(`/devices/${id}`, { token });
}

export function fetchPublicDevice(id) {
  return apiFetch(`/devices/public/${id}`);
}

export function updateDeviceSegment(token, id, segmentId) {
  return apiFetch(`/devices/${id}/segment`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ segmentId })
  });
}

export function createManualAsset(token, payload) {
  return apiFetch("/devices/manual", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateManualAsset(token, id, payload) {
  return apiFetch(`/devices/${id}/manual`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function updateDeviceType(token, id, assetType) {
  return apiFetch(`/devices/${id}/type`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ assetType })
  });
}

export function refreshAssetPing(token, id) {
  return apiFetch(`/devices/${id}/ping`, {
    token,
    method: "POST"
  });
}

export function fetchSegments(token) {
  return apiFetch("/segments", { token });
}

export function createSegment(token, nameOrPayload) {
  const payload = typeof nameOrPayload === "string" ? { name: nameOrPayload } : nameOrPayload;

  return apiFetch("/segments", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function renameSegment(token, id, updates) {
  return apiFetch(`/segments/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(typeof updates === "string" ? { name: updates } : updates)
  });
}

export function deleteSegment(token, id) {
  return apiFetch(`/segments/${id}`, {
    token,
    method: "DELETE"
  });
}

export function fetchAlerts(token) {
  return apiFetch("/alerts", { token });
}

export function fetchAlertHistory(token) {
  return apiFetch("/alerts/history", { token });
}

export function acknowledgeAlert(token, id, note = "") {
  return apiFetch(`/alerts/${id}/acknowledge`, {
    token,
    method: "POST",
    body: JSON.stringify({ note })
  });
}

export function removeAlertAcknowledgement(token, id) {
  return apiFetch(`/alerts/${id}/acknowledge`, {
    token,
    method: "DELETE"
  });
}

export function createMonitoringSocket(token) {
  return new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
}
