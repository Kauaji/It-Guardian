export function isPrivateNetworkUrl(value) {
  if (!value) return false;

  try {
    const hostname = new URL(value).hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "::1") {
      return true;
    }

    const octets = hostname.split(".").map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) return false;

    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  } catch {
    return false;
  }
}

export function resolveApiBaseUrl({ configuredUrl, isDev }) {
  const configured = String(configuredUrl || "").trim();

  if (!isDev && isPrivateNetworkUrl(configured)) return "/api";
  return configured || (isDev ? "http://localhost:4000" : "/api");
}

export const API_BASE_URL = resolveApiBaseUrl({
  configuredUrl: import.meta.env.VITE_API_URL,
  isDev: import.meta.env.DEV
});

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
  if (configured) {
    if (!import.meta.env.DEV && isPrivateNetworkUrl(configured)) return null;
    return configured;
  }

  const apiUrl = buildApiUrl("").replace(/\/$/, "");
  const wsPath = apiUrl.replace(/^http/, "ws").replace(/\/api$/, "/ws");

  if (wsPath.startsWith("/") && typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${wsPath}`;
  }

  return wsPath;
}

export async function apiFetch(path, { token, ...options } = {}) {
  let response;

  try {
    response = await fetch(buildApiUrl(path), {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw new Error("Não foi possível conectar ao servidor.", { cause: error });
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

export function fetchAuthSession() {
  return apiFetch("/auth/me");
}

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

export function endRemoteAssistanceSession({ token, sessionId, viewerToken }) {
  return apiFetch(`/remote-assistance/sessions/${encodeURIComponent(sessionId)}/end`, {
    token,
    method: "POST",
    headers: { "x-remote-viewer-token": viewerToken }
  });
}

export function logoutSession(token) {
  return apiFetch("/auth/logout", { method: "POST", token });
}

export function fetchUserPreference(token, key) {
  return apiFetch(`/preferences/${encodeURIComponent(key)}`, { token });
}

export function saveUserPreference(token, key, value) {
  return apiFetch(`/preferences/${encodeURIComponent(key)}`, {
    method: "PUT",
    token,
    body: JSON.stringify({ value })
  });
}

export function fetchDevices(token, params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/devices${search ? `?${search}` : ""}`, { token });
}

export function fetchDashboardSummary(token, { period = "30d" } = {}) {
  const search = new URLSearchParams({ period }).toString();
  return apiFetch(`/dashboard/summary?${search}`, { token });
}

export function fetchDashboardLayout(token) {
  return apiFetch("/dashboard/layout", { token });
}

export function saveDashboardLayout(token, layout) {
  return apiFetch("/dashboard/layout", { token, method: "PUT", body: JSON.stringify(layout) });
}

export function resetDashboardLayout(token) {
  return apiFetch("/dashboard/layout/reset", { token, method: "POST" });
}

export function fetchDashboardWidgetCatalog(token) {
  return apiFetch("/dashboard/widgets/catalog", { token });
}

export function previewDashboardWidget(token, { type, config, filters }, { signal } = {}) {
  return apiFetch("/dashboard/widgets/preview", {
    token,
    method: "POST",
    body: JSON.stringify({ type, config, ...(filters ? { filters } : {}) }),
    signal
  });
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

export function fetchInventoryVisualMaps(token) {
  return apiFetch("/inventory-visual-maps", { token });
}

export function fetchInventoryVisualMap(token, id) {
  return apiFetch(`/inventory-visual-maps/${id}`, { token });
}

export function createInventoryVisualMap(token, payload) {
  return apiFetch("/inventory-visual-maps", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateInventoryVisualMap(token, id, payload) {
  return apiFetch(`/inventory-visual-maps/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteInventoryVisualMap(token, id) {
  return apiFetch(`/inventory-visual-maps/${id}`, {
    token,
    method: "DELETE"
  });
}

export function fetchInventoryVisualMapObjects(token, id) {
  return apiFetch(`/inventory-visual-maps/${id}/objects`, { token });
}

export function fetchInventoryVisualMapConnections(token, id) {
  return apiFetch(`/inventory-visual-maps/${id}/connections`, { token });
}

export function createInventoryVisualMapObject(token, id, payload) {
  return apiFetch(`/inventory-visual-maps/${id}/objects`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateInventoryVisualMapObject(token, objectId, payload) {
  return apiFetch(`/inventory-visual-map-objects/${objectId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteInventoryVisualMapObject(token, objectId) {
  return apiFetch(`/inventory-visual-map-objects/${objectId}`, {
    token,
    method: "DELETE"
  });
}

export function createInventoryVisualMapConnection(token, id, payload) {
  return apiFetch(`/inventory-visual-maps/${id}/connections`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateInventoryVisualMapConnection(token, connectionId, payload) {
  return apiFetch(`/inventory-visual-map-connections/${connectionId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteInventoryVisualMapConnection(token, connectionId) {
  return apiFetch(`/inventory-visual-map-connections/${connectionId}`, {
    token,
    method: "DELETE"
  });
}

export function fetchNetworkTopologyMaps(token) {
  return apiFetch("/topology-maps", { token });
}

export function fetchNetworkTopologyMap(token, id) {
  return apiFetch(`/topology-maps/${id}`, { token });
}

export function fetchNetworkTopologyMapByScope(token, scopeType, scopeId, scopeName) {
  const params = { scopeType, scopeId };
  if (scopeName) params.scopeName = scopeName;
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/topology-maps/by-scope?${query}`, { token });
}

export function createNetworkTopologyMap(token, payload) {
  return apiFetch("/topology-maps", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateNetworkTopologyMap(token, id, payload) {
  return apiFetch(`/topology-maps/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteNetworkTopologyMap(token, id) {
  return apiFetch(`/topology-maps/${id}`, {
    token,
    method: "DELETE"
  });
}

export function createNetworkTopologyNode(token, mapId, payload) {
  return apiFetch(`/topology-maps/${mapId}/nodes`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateNetworkTopologyNode(token, nodeId, payload) {
  return apiFetch(`/topology-map-nodes/${nodeId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function saveNetworkTopologyNodePositions(token, mapId, positions) {
  return apiFetch(`/topology-maps/${mapId}/nodes/positions`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ positions })
  });
}

export function deleteNetworkTopologyNode(token, nodeId) {
  return apiFetch(`/topology-map-nodes/${nodeId}`, {
    token,
    method: "DELETE"
  });
}

export function createNetworkTopologyLink(token, mapId, payload) {
  return apiFetch(`/topology-maps/${mapId}/links`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateNetworkTopologyLink(token, linkId, payload) {
  return apiFetch(`/topology-map-links/${linkId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteNetworkTopologyLink(token, linkId) {
  return apiFetch(`/topology-map-links/${linkId}`, {
    token,
    method: "DELETE"
  });
}

export function generateNetworkTopologyAutoLayout(token, mapId, hints) {
  return apiFetch(`/topology-maps/${mapId}/auto-layout`, {
    token,
    method: "POST",
    body: JSON.stringify({ hints })
  });
}

export function fetchFloorPlans(token, inventoryTabId = "") {
  const query = inventoryTabId ? `?inventoryTabId=${encodeURIComponent(inventoryTabId)}` : "";
  return apiFetch(`/floor-plans${query}`, { token });
}

export function fetchFloorPlan(token, id) {
  return apiFetch(`/floor-plans/${id}`, { token });
}

export function createFloorPlan(token, payload = {}) {
  return apiFetch("/floor-plans", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateFloorPlan(token, id, payload = {}) {
  return apiFetch(`/floor-plans/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function saveFloorPlanEditorData(token, id, payload = {}) {
  return apiFetch(`/floor-plans/${id}/editor-data`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function duplicateFloorPlan(token, id) {
  return apiFetch(`/floor-plans/${id}/duplicate`, {
    token,
    method: "POST"
  });
}

export function deleteFloorPlan(token, id) {
  return apiFetch(`/floor-plans/${id}`, {
    token,
    method: "DELETE"
  });
}

export function linkFloorPlanObjectToAsset(token, objectId, payload = {}) {
  return apiFetch(`/floor-plans/objects/${objectId}/link-equipment`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function fetchAlerts(token) {
  return apiFetch("/alerts", { token });
}

export function fetchAlertHistory(token) {
  return apiFetch("/alerts/history", { token });
}

export function fetchAlertRules(token) {
  return apiFetch("/alerts/rules", { token });
}

export function fetchAlertSettings(token) {
  return apiFetch("/alerts/settings", { token });
}

export function fetchAlertCorrelations(token) {
  return apiFetch("/alerts/correlations", { token });
}

export function fetchAlertInsights(token) {
  return apiFetch("/alerts/insights", { token });
}

export function fetchAlertComments(token, id) {
  return apiFetch(`/alerts/${id}/comments`, { token });
}

export function createAlertComment(token, id, message) {
  return apiFetch(`/alerts/${id}/comments`, {
    token,
    method: "POST",
    body: JSON.stringify({ message })
  });
}

export function updateAlertSettings(token, payload) {
  return apiFetch("/alerts/settings", {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function updateAlertRule(token, id, payload) {
  return apiFetch(`/alerts/rules/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function evaluateAlerts(token) {
  return apiFetch("/alerts/evaluate", {
    token,
    method: "POST"
  });
}

export function fetchServiceOrderSuggestions(token) {
  return apiFetch("/service-order-suggestions", { token });
}

export function acceptServiceOrderSuggestion(token, id) {
  return apiFetch(`/service-order-suggestions/${id}/accept`, {
    token,
    method: "POST"
  });
}

export function rejectServiceOrderSuggestion(token, id, reason = "") {
  return apiFetch(`/service-order-suggestions/${id}/reject`, {
    token,
    method: "POST",
    body: JSON.stringify({ reason })
  });
}

export function useSuggestionScript(token, suggestionId, scriptId, payload = {}) {
  return apiFetch(`/service-order-suggestions/${suggestionId}/scripts/${scriptId}/use`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchSuggestionRecommendedScripts(token, suggestionId) {
  return apiFetch(`/service-order-suggestions/${suggestionId}/recommended-scripts`, { token });
}

export function useServiceOrderScript(token, serviceOrderId, scriptId, payload = {}) {
  return apiFetch(`/service-orders/${serviceOrderId}/scripts/${scriptId}/use`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchServiceOrderScriptActivity(token, serviceOrderId) {
  return apiFetch(`/service-orders/${serviceOrderId}/script-activity`, { token });
}

export function fetchSuggestionScriptValidations(token, suggestionId) {
  return apiFetch(`/service-order-suggestions/${suggestionId}/script-validations`, { token });
}

export function cancelScriptValidation(token, id) {
  return apiFetch(`/script-validations/${id}/cancel`, {
    token,
    method: "POST"
  });
}

export function fetchPendingScriptLogs(token) {
  return apiFetch("/script-logs/pending", { token });
}

export function fetchScriptLog(token, id) {
  return apiFetch(`/script-logs/${id}`, { token });
}

export function acknowledgeScriptLog(token, id) {
  return apiFetch(`/script-logs/${id}/acknowledge`, {
    token,
    method: "POST"
  });
}

export function applyScriptLogSuggestedSolution(token, id, payload = {}) {
  return apiFetch(`/script-logs/${id}/apply-suggested-solution`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchMaintenanceScripts(token, params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/maintenance-scripts${search ? `?${search}` : ""}`, { token });
}

export function fetchMaintenanceScriptRecommendations(token, payload = {}) {
  return apiFetch("/maintenance-scripts/recommendations", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchScriptExecutionDiagnosis(token, payload = {}) {
  return apiFetch("/maintenance-scripts/execution-diagnosis", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function analyzeMaintenanceScript(token, payload) {
  return apiFetch("/maintenance-scripts/analyze", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function createMaintenanceScript(token, payload) {
  return apiFetch("/maintenance-scripts", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateMaintenanceScript(token, id, payload) {
  return apiFetch(`/maintenance-scripts/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteMaintenanceScript(token, id) {
  return apiFetch(`/maintenance-scripts/${id}`, {
    token,
    method: "DELETE"
  });
}

export function registerMaintenanceScriptSimulation(token, id, payload) {
  return apiFetch(`/maintenance-scripts/${id}/register-simulation`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchPreventivePlans(token) {
  return apiFetch("/preventive-plans", { token });
}

export function createPreventivePlan(token, payload) {
  return apiFetch("/preventive-plans", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function createPreventivePlanServiceOrder(token, id) {
  return apiFetch(`/preventive-plans/${id}/service-order`, {
    token,
    method: "POST"
  });
}

export function preparePreventivePlan(token, id) {
  return apiFetch(`/preventive-plans/${id}/prepare`, {
    token,
    method: "POST"
  });
}

export function fetchPreventiveAutomationPlans(token) {
  return apiFetch("/preventive-automation-plans", { token });
}

export function fetchPreventiveAutomationManagement(token) {
  return apiFetch("/preventive-automation-plans/management", { token });
}

export function fetchPreventiveAutomationAgenda(token, filters = {}) {
  const search = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value != null) search.set(key, value);
  });
  const suffix = search.toString() ? `?${search}` : "";
  return apiFetch(`/preventive-automation-plans/agenda${suffix}`, { token });
}

export function fetchPreventiveAutomationPlanHistory(token, planId, limit = 50) {
  return apiFetch(`/preventive-automation-plans/${planId}/history?limit=${limit}`, { token });
}

export function fetchPreventiveAutomationAsset(token, planId, assetId) {
  return apiFetch(`/preventive-automation-plans/${planId}/assets/${assetId}`, { token });
}

export function createPreventiveAutomationPlan(token, payload) {
  return apiFetch("/preventive-automation-plans", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updatePreventiveAutomationPlan(token, id, payload) {
  return apiFetch(`/preventive-automation-plans/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function disablePreventiveAutomationPlan(token, id) {
  return apiFetch(`/preventive-automation-plans/${id}/disable`, {
    token,
    method: "POST"
  });
}

export function reactivatePreventiveAutomationPlan(token, id) {
  return apiFetch(`/preventive-automation-plans/${id}/reactivate`, {
    token,
    method: "POST"
  });
}

export function deletePreventiveAutomationPlan(token, id) {
  return apiFetch(`/preventive-automation-plans/${id}`, {
    token,
    method: "DELETE"
  });
}

export function savePreventiveAutomationAssetOverride(token, planId, assetId, payload) {
  return apiFetch(`/preventive-automation-plans/${planId}/assets/${assetId}/override`, {
    token,
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function removePreventiveAutomationAssetOverride(token, planId, assetId) {
  return apiFetch(`/preventive-automation-plans/${planId}/assets/${assetId}/override`, {
    token,
    method: "DELETE"
  });
}

export function removeAssetFromPreventiveAutomationPlan(token, planId, assetId) {
  return apiFetch(`/preventive-automation-plans/${planId}/assets/${assetId}`, {
    token,
    method: "DELETE"
  });
}

export function preparePreventiveAutomationPlan(token, id) {
  return apiFetch(`/preventive-automation-plans/${id}/prepare`, {
    token,
    method: "POST"
  });
}

export function processDuePreventiveAutomationPlans(token) {
  return apiFetch("/preventive-automation-plans/process-due", {
    token,
    method: "POST"
  });
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

export function fetchServiceOrders(token) {
  return apiFetch("/service-orders", { token });
}

export function fetchSystemSettings(token) {
  return apiFetch("/system-settings", { token });
}

export function updateSystemSettings(token, payload) {
  return apiFetch("/system-settings", {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function fetchServiceOrder(token, id) {
  return apiFetch(`/service-orders/${id}`, { token });
}

export function createServiceOrder(token, payload) {
  return apiFetch("/service-orders", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchServiceOrderSettings(token) {
  return apiFetch("/service-order-settings", { token });
}

export function updateServiceOrderSettings(token, payload) {
  return apiFetch("/service-order-settings", {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function fetchServiceOrderStatuses(token) {
  return apiFetch("/service-order-statuses", { token });
}

export function createServiceOrderStatus(token, payload) {
  return apiFetch("/service-order-statuses", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateServiceOrderStatusDefinition(token, id, payload) {
  return apiFetch(`/service-order-statuses/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteServiceOrderStatus(token, id) {
  return apiFetch(`/service-order-statuses/${id}`, {
    token,
    method: "DELETE"
  });
}

export function updateServiceOrder(token, id, payload) {
  return apiFetch(`/service-orders/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function updateServiceOrderStatus(token, id, status) {
  return apiFetch(`/service-orders/${id}/status`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function addServiceOrderHistory(token, id, payload) {
  return apiFetch(`/service-orders/${id}/history`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function deleteServiceOrder(token, id) {
  return apiFetch(`/service-orders/${id}`, {
    token,
    method: "DELETE"
  });
}

export function reopenServiceOrder(token, id, reason) {
  return apiFetch(`/service-orders/${id}/reopen`, {
    token,
    method: "POST",
    body: JSON.stringify({ reason })
  });
}

export function fetchServiceOrderFeedback(token, id) {
  return apiFetch(`/service-orders/${id}/feedback`, { token });
}

export function submitServiceOrderFeedback(token, id, payload) {
  return apiFetch(`/service-orders/${id}/feedback`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchServiceOrderChecklist(token, id) {
  return apiFetch(`/service-orders/${id}/checklist`, { token });
}

export function updateServiceOrderChecklistItem(token, id, resultId, payload) {
  return apiFetch(`/service-orders/${id}/checklist/${resultId}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function fetchServiceOrderAttachments(token, id) {
  return apiFetch(`/service-orders/${id}/attachments`, { token });
}

export function createServiceOrderAttachment(token, id, payload) {
  return apiFetch(`/service-orders/${id}/attachments`, {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function deleteServiceOrderAttachment(token, id, attachmentId) {
  return apiFetch(`/service-orders/${id}/attachments/${attachmentId}`, {
    token,
    method: "DELETE"
  });
}

export function fetchServiceOrderChecklistTemplates(token) {
  return apiFetch("/service-order-checklist-templates", { token });
}

export function createServiceOrderChecklistTemplate(token, payload) {
  return apiFetch("/service-order-checklist-templates", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateServiceOrderChecklistTemplate(token, id, payload) {
  return apiFetch(`/service-order-checklist-templates/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteServiceOrderChecklistTemplate(token, id) {
  return apiFetch(`/service-order-checklist-templates/${id}`, {
    token,
    method: "DELETE"
  });
}

export function updateServiceOrderChecklistPolicy(token, payload) {
  return apiFetch("/service-order-checklist-templates/policy", {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function fetchUsers(token) {
  return apiFetch("/users", { token });
}

export function fetchPermissions(token) {
  return apiFetch("/permissions", { token });
}

export function createUser(token, payload) {
  return apiFetch("/users", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateUserAccess(token, id, payload) {
  return apiFetch(`/users/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function updateUserPermissions(token, id, permissions) {
  return apiFetch(`/users/${id}/permissions`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ permissions })
  });
}

export function deleteUser(token, id) {
  return apiFetch(`/users/${id}`, {
    token,
    method: "DELETE"
  });
}

export function updateUserRole(token, id, role) {
  return apiFetch(`/users/${id}/role`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ role })
  });
}

export function fetchSectors(token) {
  return apiFetch("/sectors", { token });
}

export function createSector(token, payload) {
  return apiFetch("/sectors", {
    token,
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateSector(token, id, payload) {
  return apiFetch(`/sectors/${id}`, {
    token,
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function updateSectorPermissions(token, id, permissions) {
  return apiFetch(`/sectors/${id}/permissions`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ permissions })
  });
}

export function deleteSector(token, id) {
  return apiFetch(`/sectors/${id}`, {
    token,
    method: "DELETE"
  });
}

export function updateDeviceAlias(token, id, alias) {
  return apiFetch(`/devices/${id}/alias`, {
    token,
    method: "PATCH",
    body: JSON.stringify({ alias })
  });
}

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

export function fetchPublicSupportOptions() {
  return apiFetch("/public/support-options");
}

export function fetchPublicMachineContext(deviceToken) {
  return apiFetch(`/public/machine-context?device=${encodeURIComponent(deviceToken)}`);
}

export function createPublicServiceOrder(payload) {
  return apiFetch("/public/service-orders", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchPublicServiceOrderTracking(trackingToken) {
  return apiFetch(`/public/service-orders/track/${encodeURIComponent(trackingToken)}`);
}

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

export function uploadFloorPlanBackground(token, planId, floorId, file) {
  return apiFetch(`/floor-plans/${planId}/floors/${floorId}/background`, {
    token,
    method: "POST",
    headers: { "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name) },
    body: file
  });
}

export async function fetchFloorPlanBackgroundBlob(token, planId, floorId) {
  const response = await fetch(buildApiUrl(`/floor-plans/${planId}/floors/${floorId}/background`), {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) throw new Error(response.status === 404 ? "Imagem de fundo não cadastrada." : "Não foi possível carregar a imagem da planta.");
  return response.blob();
}

export function deleteFloorPlanBackground(token, planId, floorId) {
  return apiFetch(`/floor-plans/${planId}/floors/${floorId}/background`, { token, method: "DELETE" });
}

export function fetchFloorPlanSummary(token, planId, filters = {}) {
  const params = new URLSearchParams(filters);
  return apiFetch(`/floor-plans/${planId}/summary${params.size ? `?${params}` : ""}`, { token });
}

export function fetchFloorPlanAssetHeatmap(token, planId, metric = "availability", filters = {}) {
  const params = new URLSearchParams({ metric, ...filters });
  return apiFetch(`/floor-plans/${planId}/heatmap/assets?${params}`, { token });
}

export function fetchFloorPlanServiceOrderHeatmap(token, planId, startDate, endDate, filters = {}) {
  const params = new URLSearchParams({ startDate, endDate, ...filters });
  return apiFetch(`/floor-plans/${planId}/heatmap/service-orders?${params}`, { token });
}

export function fetchCalendarEvents(token, params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/calendar/events${search ? `?${search}` : ""}`, { token });
}

export function fetchCalendarSummary(token, params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/calendar/summary${search ? `?${search}` : ""}`, { token });
}

export function createCalendarEvent(token, payload) {
  return apiFetch("/calendar/events", { token, method: "POST", body: JSON.stringify(payload) });
}

export function updateCalendarEvent(token, id, payload) {
  return apiFetch(`/calendar/events/${id}`, { token, method: "PATCH", body: JSON.stringify(payload) });
}

export function cancelCalendarEvent(token, id, reason) {
  return apiFetch(`/calendar/events/${id}/cancel`, { token, method: "POST", body: JSON.stringify({ reason }) });
}

export function deleteCalendarEvent(token, id) {
  return apiFetch(`/calendar/events/${id}`, { token, method: "DELETE" });
}

export function fetchPartsInventory(token, params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/parts${search ? `?${search}` : ""}`, { token });
}
export function fetchPartInventoryItem(token, id) { return apiFetch(`/parts/${id}`, { token }); }
export function createPartInventoryItem(token, payload) { return apiFetch("/parts", { token, method: "POST", body: JSON.stringify(payload) }); }
export function updatePartInventoryItem(token, id, payload) { return apiFetch(`/parts/${id}`, { token, method: "PATCH", body: JSON.stringify(payload) }); }
export function createPartInventoryMovement(token, id, payload) { return apiFetch(`/parts/${id}/movements`, { token, method: "POST", body: JSON.stringify(payload) }); }
export function fetchPartCategories(token) { return apiFetch("/parts/categories", { token }); }
export function createPartCategory(token, payload) { return apiFetch("/parts/categories", { token, method: "POST", body: JSON.stringify(payload) }); }
export function deletePartCategory(token, id) { return apiFetch(`/parts/categories/${id}`, { token, method: "DELETE" }); }
export function syncPartsFromAssets(token) { return apiFetch("/parts/sync-assets", { token, method: "POST" }); }
export function importPartsInvoice(token, xml) { return apiFetch("/parts/import-invoice", { token, method: "POST", headers: { "Content-Type": "application/xml" }, body: xml }); }

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

export function createMonitoringSocket() {
  const wsUrl = buildWsUrl();
  if (!wsUrl) return null;

  return new WebSocket(wsUrl);
}
