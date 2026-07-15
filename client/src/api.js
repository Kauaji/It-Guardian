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

export function fetchDevice(token, id) {
  return apiFetch(`/devices/${id}`, { token });
}

export function fetchPublicDevice(id) {
  return apiFetch(`/devices/public/${id}`);
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

export function fetchPublicSupportOptions() {
  return apiFetch("/public/support-options");
}

export function createPublicServiceOrder(payload) {
  return apiFetch("/public/service-orders", {
    method: "POST",
    body: JSON.stringify(payload)
  });
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
