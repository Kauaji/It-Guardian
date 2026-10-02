import { apiFetch } from "./http.js";

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

export function fetchAssetTimeline(token, assetId, params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== "" && value != null) search.set(key, value);
  });
  const suffix = search.toString() ? `?${search}` : "";
  return apiFetch(`/devices/${assetId}/timeline${suffix}`, { token });
}

export function fetchDeviceMetricHistory(token, deviceId, params = {}, { signal } = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== "" && value != null) search.set(key, value);
  });
  const suffix = search.toString() ? `?${search}` : "";
  return apiFetch(`/devices/${deviceId}/metrics-history${suffix}`, { token, signal });
}

export function updateDeviceSegment(token, id, segmentId, extra = {}) {
  return apiFetch(`/devices/${id}/segment`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ segmentId, ...extra })
  });
}

export function deleteDevice(token, id) {
  return apiFetch(`/devices/${id}`, {
    token,
    method: "DELETE"
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

export function updateDeviceBackup(token, id, payload) {
  return apiFetch(`/devices/${id}/backup`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function refreshAssetPing(token, id) {
  return apiFetch(`/devices/${id}/ping`, {
    token,
    method: "POST"
  });
}

export function updateDeviceAlias(token, id, alias) {
  return apiFetch(`/devices/${id}/alias`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ alias })
  });
}
