import { apiFetch } from "./http.js";

export function fetchRemoteAssistanceConfig(token) {
  return apiFetch("/remote-assistance/config", { token });
}

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

export function createRemoteAssistanceSession({
  token,
  assetId,
  serviceOrderId,
  reason,
  requestedMode,
  reauthenticationToken
}) {
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

export function fetchRemoteAssistanceSession({ token, sessionId }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}`, { token });
}

export function fetchRemoteAssistanceEvents({ token, sessionId }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/events`, { token });
}

export function fetchRemoteAssistanceFrame({ token, sessionId, viewerToken }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/frame`, {
    token,
    headers: { "x-remote-viewer-token": viewerToken }
  });
}

export function sendRemoteAssistanceWebrtcOffer({ token, sessionId, viewerToken, sdp }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/webrtc/offer`, {
    token,
    method: "POST",
    headers: { "x-remote-viewer-token": viewerToken },
    body: JSON.stringify({ sdp })
  });
}

export function fetchRemoteAssistanceWebrtcAnswer({ token, sessionId, viewerToken }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/webrtc/answer`, {
    token,
    headers: { "x-remote-viewer-token": viewerToken }
  });
}

export function selectRemoteAssistanceMonitor({ token, sessionId, viewerToken, monitorId }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/monitor`, {
    token,
    method: "POST",
    headers: { "x-remote-viewer-token": viewerToken },
    body: JSON.stringify({ monitorId })
  });
}

export function updateRemoteAssistanceControl({ token, sessionId, viewerToken, enabled }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/control`, {
    token,
    method: "POST",
    headers: { "x-remote-viewer-token": viewerToken },
    body: JSON.stringify({ enabled })
  });
}

export function updateRemoteAssistanceCapture({ token, sessionId, viewerToken, paused }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/pause`, {
    token,
    method: "POST",
    headers: { "x-remote-viewer-token": viewerToken },
    body: JSON.stringify({ paused })
  });
}

export function sendRemoteAssistanceInput({ token, sessionId, viewerToken, command }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/input`, {
    token,
    method: "POST",
    headers: { "x-remote-viewer-token": viewerToken },
    body: JSON.stringify(command)
  });
}

export function sendRemoteAssistanceChatMessage({ token, sessionId, viewerToken, text }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/chat`, {
    token,
    method: "POST",
    headers: { "x-remote-viewer-token": viewerToken },
    body: JSON.stringify({ text })
  });
}

export function fetchRemoteAssistanceRustdeskCredentials({ token, sessionId, viewerToken }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/rustdesk-credentials`, {
    token,
    headers: { "x-remote-viewer-token": viewerToken }
  });
}

export function endRemoteAssistanceSession({ token, sessionId, viewerToken }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/end`, {
    token,
    method: "POST",
    headers: { "x-remote-viewer-token": viewerToken }
  });
}
