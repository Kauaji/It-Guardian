import {
  fetchAlertCorrelations,
  fetchAlertHistory,
  fetchAlertRules,
  fetchAlertSettings,
  fetchAlerts,
  fetchDevices,
  fetchMaintenanceScripts,
  fetchPreventiveAutomationManagement,
  fetchPreventiveAutomationPlans,
  fetchPreventivePlans,
  fetchServiceOrders,
  fetchServiceOrderSuggestions,
  fetchSegmentGroups,
  fetchSegments,
  fetchSystemSettings
} from "../../api.js";
import { normalizePrioritySettings } from "../../components/alerts/alertUtils.js";
import { emptyAutomationManagement } from "./emptyState.js";

/**
 * Busca em paralelo tudo que o app autenticado mostra. Cada fonte só é consultada
 * se a pessoa pode ver aquela área; sem permissão devolve a resposta vazia equivalente.
 */
export async function fetchDashboardSnapshot({ token, search, status, systemMode, can }) {
  const [
    deviceData,
    allDeviceData,
    segmentData,
    groupData,
    activeAlertData,
    alertHistoryData,
    alertCorrelationData,
    alertRuleData,
    suggestionData,
    maintenanceScriptData,
    preventivePlanData,
    preventiveAutomationData,
    preventiveAutomationManagementData,
    serviceOrderData,
    alertSettingsData,
    systemSettingsData
  ] = await Promise.all([
    can.inventory ? fetchDevices(token, { search, status }) : Promise.resolve({ devices: [], summary: null }),
    can.inventory ? fetchDevices(token) : Promise.resolve({ devices: [] }),
    can.inventory ? fetchSegments(token) : Promise.resolve({ segments: [] }),
    can.inventory ? fetchSegmentGroups(token) : Promise.resolve({ groups: [] }),
    can.alerts ? fetchAlerts(token) : Promise.resolve({ alerts: [] }),
    can.alerts ? fetchAlertHistory(token) : Promise.resolve({ alerts: [] }),
    can.alerts ? fetchAlertCorrelations(token).catch(() => ({ correlations: [] })) : Promise.resolve({ correlations: [] }),
    can.alerts ? fetchAlertRules(token) : Promise.resolve({ rules: [] }),
    can.alerts ? fetchServiceOrderSuggestions(token) : Promise.resolve({ suggestions: [] }),
    can.scripts ? fetchMaintenanceScripts(token) : Promise.resolve({ scripts: [] }),
    can.preventivePlans ? fetchPreventivePlans(token) : Promise.resolve({ preventivePlans: [] }),
    can.preventiveAutomation ? fetchPreventiveAutomationPlans(token) : Promise.resolve({ preventiveAutomationPlans: [] }),
    can.preventiveAutomation
      ? fetchPreventiveAutomationManagement(token).catch((error) => ({
          ...emptyAutomationManagement,
          error: error.message
        }))
      : Promise.resolve(emptyAutomationManagement),
    can.serviceOrders ? fetchServiceOrders(token) : Promise.resolve({ serviceOrders: [] }),
    can.alerts
      ? fetchAlertSettings(token).catch(() => ({ settings: normalizePrioritySettings() }))
      : Promise.resolve({ settings: normalizePrioritySettings() }),
    fetchSystemSettings(token).catch(() => ({ settings: { systemMode } }))
  ]);

  return {
    deviceData,
    allDeviceData,
    segmentData,
    groupData,
    activeAlertData,
    alertHistoryData,
    alertCorrelationData,
    alertRuleData,
    suggestionData,
    maintenanceScriptData,
    preventivePlanData,
    preventiveAutomationData,
    preventiveAutomationManagementData,
    serviceOrderData,
    alertSettingsData,
    systemSettingsData
  };
}
