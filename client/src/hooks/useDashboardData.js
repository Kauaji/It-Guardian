import { useDashboardLoader } from "./dashboardData/useDashboardLoader.js";
import { useDashboardState } from "./dashboardData/useDashboardState.js";
import { useMonitoringStream } from "./dashboardData/useMonitoringStream.js";

/**
 * Dados do servidor do app autenticado: estado (useDashboardState), carga periódica
 * (useDashboardLoader) e atualização em tempo real (useMonitoringStream).
 */
export function useDashboardData({
  activeView,
  applyInventoryLocalState,
  applySegmentGroups,
  canViewAlerts,
  canViewInventory,
  canViewMachine,
  canViewPreventiveAutomation,
  canViewPreventivePlans,
  canViewScripts,
  canViewServiceOrders,
  initialSystemMode,
  logout,
  maintenanceRecords,
  manualPeripherals,
  notify,
  onMaintenanceRecordsChange,
  peripheralHistory,
  removedPeripherals,
  search,
  selectedId,
  setSelectedDevice,
  setSelectedId,
  status,
  token
}) {
  const state = useDashboardState(initialSystemMode);

  const loadData = useDashboardLoader({
    activeView,
    applyInventoryLocalState,
    applySegmentGroups,
    canViewAlerts,
    canViewInventory,
    canViewMachine,
    canViewPreventiveAutomation,
    canViewPreventivePlans,
    canViewScripts,
    canViewServiceOrders,
    maintenanceRecords,
    manualPeripherals,
    notify,
    onMaintenanceRecordsChange,
    peripheralHistory,
    removedPeripherals,
    search,
    selectedId,
    setSelectedDevice,
    setSelectedId,
    state,
    status,
    token
  });

  useMonitoringStream({ applySegmentGroups, logout, notify, search, setSelectedDevice, state, status, token });

  return {
    alertCorrelations: state.alertCorrelations,
    alertPriorityColors: state.alertPriorityColors,
    alertPrioritySettings: state.alertPrioritySettings,
    alertRules: state.alertRules,
    alerts: state.alerts,
    allDevices: state.allDevices,
    devices: state.devices,
    history: state.history,
    lastUpdated: state.lastUpdated,
    loading: state.loading,
    loadData,
    maintenanceScripts: state.maintenanceScripts,
    preventiveAutomationManagement: state.preventiveAutomationManagement,
    preventiveAutomationManagementError: state.preventiveAutomationManagementError,
    preventiveAutomationPlans: state.preventiveAutomationPlans,
    preventivePlans: state.preventivePlans,
    segmentGroups: state.segmentGroups,
    segments: state.segments,
    serviceOrderSuggestions: state.serviceOrderSuggestions,
    serviceOrders: state.serviceOrders,
    setAlertCorrelations: state.setAlertCorrelations,
    setAlertPriorityColors: state.setAlertPriorityColors,
    setAlertPrioritySettings: state.setAlertPrioritySettings,
    setAlertRules: state.setAlertRules,
    setAlerts: state.setAlerts,
    setAllDevices: state.setAllDevices,
    setDevices: state.setDevices,
    setHistory: state.setHistory,
    setMaintenanceScripts: state.setMaintenanceScripts,
    setPreventiveAutomationManagement: state.setPreventiveAutomationManagement,
    setPreventiveAutomationManagementError: state.setPreventiveAutomationManagementError,
    setPreventiveAutomationPlans: state.setPreventiveAutomationPlans,
    setPreventivePlans: state.setPreventivePlans,
    setSegmentGroups: state.setSegmentGroups,
    setSegments: state.setSegments,
    setServiceOrderSuggestions: state.setServiceOrderSuggestions,
    setServiceOrders: state.setServiceOrders,
    setSummary: state.setSummary,
    setSystemMode: state.setSystemMode,
    summary: state.summary,
    systemMode: state.systemMode,
    remoteScriptExecutionEnabledOnServer: state.remoteScriptExecutionEnabledOnServer
  };
}
