import { apiFetch } from "./http.js";

/** @import { ApiObject, AuthToken, EntityId, Payload } from "./types.js" */

/**
 * @param {AuthToken} token
 * @returns {Promise<ApiObject>}
 */
export function fetchRemoteAssistanceConfig(token) {
  return apiFetch("/remote-assistance/config", { token });
}

/**
 * @param {{ token: AuthToken, password: string, assetId: EntityId, serviceOrderId?: EntityId }} args
 * @returns {Promise<ApiObject>}
 */
export function reauthenticateRemoteAssistance({ token, password, assetId, serviceOrderId }) {
  return apiFetch("/security/reauthenticate", {
    token,
    method: "POST",
    body: JSON.stringify({
      password,
      reason: "remote_assistance_start",
      assetId,
      serviceOrderId: serviceOrderId || null
    })
  });
}

/**
 * @param {{ token: AuthToken, assetId: EntityId, serviceOrderId?: EntityId, reason: string, requestedMode: string, reauthenticationToken: string }} args
 * @returns {Promise<ApiObject>}
 */
export function createRemoteAssistanceSession({ token, assetId, serviceOrderId, reason, requestedMode, reauthenticationToken }) {
  return apiFetch(`/remote-assistance/assets/${encodeURIComponent(assetId)}/sessions`, {
    token,
    method: "POST",
    body: JSON.stringify({
      serviceOrderId: serviceOrderId || null,
      reason,
      requestedMode,
      reauthenticationToken
    })
  });
}

/**
 * @param {{ token: AuthToken, sessionId: EntityId }} args
 * @returns {Promise<ApiObject>}
 */
export function fetchRemoteAssistanceSession({ token, sessionId }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}`, { token });
}

/**
 * @param {{ token: AuthToken, sessionId: EntityId }} args
 * @returns {Promise<ApiObject>}
 */
export function fetchRemoteAssistanceEvents({ token, sessionId }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/events`, { token });
}

/**
 * @param {{ token: AuthToken, sessionId: EntityId, viewerToken: string }} args
 * @returns {Promise<ApiObject>}
 */
export function fetchRemoteAssistanceFrame({ token, sessionId, viewerToken }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/frame`, {
    token,
    headers: { "x-remote-viewer-token": viewerToken }
  });
}

/**
 * @param {{ token: AuthToken, sessionId: EntityId, viewerToken: string, sdp: string }} args
 * @returns {Promise<ApiObject>}
 */
export function sendRemoteAssistanceWebrtcOffer({ token, sessionId, viewerToken, sdp }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/webrtc/offer`, {
    token,
    method: "POST",
    headers: { "x-remote-viewer-token": viewerToken },
    body: JSON.stringify({ sdp })
  });
}

/**
 * @param {{ token: AuthToken, sessionId: EntityId, viewerToken: string }} args
 * @returns {Promise<ApiObject>}
 */
export function fetchRemoteAssistanceWebrtcAnswer({ token, sessionId, viewerToken }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/webrtc/answer`, {
    token,
    headers: { "x-remote-viewer-token": viewerToken }
  });
}

/**
 * @param {{ token: AuthToken, sessionId: EntityId, viewerToken: string, monitorId: EntityId }} args
 * @returns {Promise<ApiObject>}
 */
export function selectRemoteAssistanceMonitor({ token, sessionId, viewerToken, monitorId }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/monitor`, {
    token,
    method: "POST",
    headers: { "x-remote-viewer-token": viewerToken },
    body: JSON.stringify({ monitorId })
  });
}

/**
 * @param {{ token: AuthToken, sessionId: EntityId, viewerToken: string, enabled: boolean }} args
 * @returns {Promise<ApiObject>}
 */
export function updateRemoteAssistanceControl({ token, sessionId, viewerToken, enabled }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/control`, {
    token,
    method: "POST",
    headers: { "x-remote-viewer-token": viewerToken },
    body: JSON.stringify({ enabled })
  });
}

/**
 * @param {{ token: AuthToken, sessionId: EntityId, viewerToken: string, paused: boolean }} args
 * @returns {Promise<ApiObject>}
 */
export function updateRemoteAssistanceCapture({ token, sessionId, viewerToken, paused }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/pause`, {
    token,
    method: "POST",
    headers: { "x-remote-viewer-token": viewerToken },
    body: JSON.stringify({ paused })
  });
}

/**
 * @param {{ token: AuthToken, sessionId: EntityId, viewerToken: string, command: Payload }} args
 * @returns {Promise<ApiObject>}
 */
export function sendRemoteAssistanceInput({ token, sessionId, viewerToken, command }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/input`, {
    token,
    method: "POST",
    headers: { "x-remote-viewer-token": viewerToken },
    body: JSON.stringify(command)
  });
}

/**
 * @param {{ token: AuthToken, sessionId: EntityId, viewerToken: string, text: string }} args
 * @returns {Promise<ApiObject>}
 */
export function sendRemoteAssistanceChatMessage({ token, sessionId, viewerToken, text }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/chat`, {
    token,
    method: "POST",
    headers: { "x-remote-viewer-token": viewerToken },
    body: JSON.stringify({ text })
  });
}

/**
 * @param {{ token: AuthToken, sessionId: EntityId, viewerToken: string }} args
 * @returns {Promise<ApiObject>}
 */
export function fetchRemoteAssistanceRustdeskCredentials({ token, sessionId, viewerToken }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/rustdesk-credentials`, {
    token,
    headers: { "x-remote-viewer-token": viewerToken }
  });
}

/**
 * @param {{ token: AuthToken, sessionId: EntityId, viewerToken: string }} args
 * @returns {Promise<ApiObject>}
 */
export function endRemoteAssistanceSession({ token, sessionId, viewerToken }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/end`, {
    token,
    method: "POST",
    headers: { "x-remote-viewer-token": viewerToken }
  });
}
