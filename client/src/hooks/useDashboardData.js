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

  // `state` ja traz todos os valores e setters expostos; so os setters internos ficam de fora.
  const {
    setLoading: _setLoading,
    setLastUpdated: _setLastUpdated,
    setRemoteScriptExecutionEnabledOnServer: _setRemoteScriptExecutionEnabledOnServer,
    ...exposed
  } = state;
  return { ...exposed, loadData };
}
