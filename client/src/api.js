export const API_BASE_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:4000" : "/api");

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/$/, "");
}

function buildApiUrl(path) {
  const baseUrl = normalizeBaseUrl(API_BASE_URL);
  const apiPrefix = baseUrl.endsWith("/api") ? "" : "/api";
  return `${baseUrl}${apiPrefix}${path}`;
}

function buildWsUrl() {
  if (import.meta.env.VITE_ENABLE_WS !== "true" && !import.meta.env.DEV) {
    return null;
  }

  const configured = import.meta.env.VITE_WS_URL;
  if (configured) return configured;

  const apiUrl = buildApiUrl("").replace(/\/$/, "");
  return apiUrl.replace(/^http/, "ws").replace(/\/api$/, "/ws");
}

export async function apiFetch(path, { token, ...options } = {}) {
  let response;

  try {
    response = await fetch(buildApiUrl(path), {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw new Error("Nao foi possivel conectar ao servidor.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.message || "Request failed";

    if (
      response.status === 401 &&
      token &&
      /token|sess/i.test(message) &&
      typeof window !== "undefined"
    ) {
      window.dispatchEvent(new CustomEvent("it-guardian:auth-expired", { detail: { message } }));
    }

    const error = new Error(message);
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

export function fetchSegmentGroups(token) {
  return apiFetch("/segments/groups", { token });
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

export function createSegmentGroup(token, payload) {
  return apiFetch("/segments/groups", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateSegmentGroup(token, id, payload) {
  return apiFetch(`/segments/groups/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteSegmentGroup(token, id) {
  return apiFetch(`/segments/groups/${id}`, {
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
  const wsUrl = buildWsUrl();
  if (!wsUrl) return null;

  return new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
}
