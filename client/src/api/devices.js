import { apiFetch, buildQuerySuffix, toSearchParams } from "./http.js";

/** @import { ApiObject, AuthToken, DeviceListResponse, DeviceResponse, EntityId, Payload, QueryParams } from "./types.js" */

/**
 * @param {AuthToken} token
 * @param {QueryParams} [params]
 * @returns {Promise<DeviceListResponse>}
 */
export function fetchDevices(token, params = {}) {
  const search = toSearchParams(params).toString();
  return apiFetch(`/devices${search ? `?${search}` : ""}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<DeviceResponse>}
 */
export function fetchDevice(token, id) {
  return apiFetch(`/devices/${id}`, { token });
}

/**
 * @param {EntityId} id
 * @returns {Promise<DeviceResponse>}
 */
export function fetchPublicDevice(id) {
  return apiFetch(`/devices/public/${id}`);
}

/**
 * @param {AuthToken} token
 * @param {EntityId} assetId
 * @param {QueryParams} [params]
 * @returns {Promise<ApiObject>}
 */
export function fetchAssetTimeline(token, assetId, params = {}) {
  const suffix = buildQuerySuffix(params);
  return apiFetch(`/devices/${assetId}/timeline${suffix}`, { token });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} deviceId
 * @param {QueryParams} [params]
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<ApiObject>}
 */
export function fetchDeviceMetricHistory(token, deviceId, params = {}, { signal } = {}) {
  const suffix = buildQuerySuffix(params);
  return apiFetch(`/devices/${deviceId}/metrics-history${suffix}`, { token, signal });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {EntityId | null} segmentId
 * @param {Payload} [extra]
 * @returns {Promise<DeviceResponse>}
 */
export function updateDeviceSegment(token, id, segmentId, extra = {}) {
  return apiFetch(`/devices/${id}/segment`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ segmentId, ...extra })
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<ApiObject>}
 */
export function deleteDevice(token, id) {
  return apiFetch(`/devices/${id}`, {
    token,
    method: "DELETE"
  });
}

/**
 * @param {AuthToken} token
 * @param {Payload} payload
 * @returns {Promise<DeviceResponse>}
 */
export function createManualAsset(token, payload) {
  return apiFetch("/devices/manual", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<DeviceResponse>}
 */
export function updateManualAsset(token, id, payload) {
  return apiFetch(`/devices/${id}/manual`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {string} assetType
 * @returns {Promise<DeviceResponse>}
 */
export function updateDeviceType(token, id, assetType) {
  return apiFetch(`/devices/${id}/type`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ assetType })
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {Payload} payload
 * @returns {Promise<DeviceResponse>}
 */
export function updateDeviceBackup(token, id, payload) {
  return apiFetch(`/devices/${id}/backup`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @returns {Promise<DeviceResponse>}
 */
export function refreshAssetPing(token, id) {
  return apiFetch(`/devices/${id}/ping`, {
    token,
    method: "POST"
  });
}

/**
 * @param {AuthToken} token
 * @param {EntityId} id
 * @param {string} alias
 * @returns {Promise<DeviceResponse>}
 */
export function updateDeviceAlias(token, id, alias) {
  return apiFetch(`/devices/${id}/alias`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ alias })
  });
}
