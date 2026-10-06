import { useCallback, useEffect } from "react";
import { fetchDashboardSnapshot } from "./fetchDashboardSnapshot.js";
import {
  applyDashboardSnapshot,
  hasCriticalAlert,
  reconcileMaintenanceRecords,
  syncSelectedDevice
} from "./dashboardSnapshot.js";

const REFRESH_INTERVAL_MS = 15000;

/** Carrega o snapshot completo (e o repete a cada 15 s em silêncio). Devolve loadData(silent). */
export function useDashboardLoader({
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
}) {
  const { systemMode } = state;

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) state.setLoading(true);
      try {
        const snapshot = await fetchDashboardSnapshot({
          token,
          search,
          status,
          systemMode,
          can: {
            inventory: canViewInventory,
            alerts: canViewAlerts,
            scripts: canViewScripts,
            preventivePlans: canViewPreventivePlans,
            preventiveAutomation: canViewPreventiveAutomation,
            serviceOrders: canViewServiceOrders
          }
        });

        const maintenance = reconcileMaintenanceRecords(snapshot.allDeviceData.devices, maintenanceRecords);
        if (maintenance.changed) {
          onMaintenanceRecordsChange(maintenance.records);
        }

        applyDashboardSnapshot(state, snapshot, {
          inventory: { applyInventoryLocalState, applySegmentGroups, removedPeripherals, peripheralHistory, manualPeripherals },
          activeMaintenanceRecords: maintenance.records
        });

        await syncSelectedDevice({
          activeView, snapshot, selectedId, canViewMachine, token, setSelectedId, setSelectedDevice
        });

        if (!silent && hasCriticalAlert(snapshot.activeAlertData)) {
          notify("Existem avisos críticos pendentes.", "danger");
        }
      } catch (error) {
        notify(error.message, "danger");
      } finally {
        state.setLoading(false);
      }
    },
    [
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
      status,
      systemMode,
      token
    ]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setInterval(() => loadData(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadData]);

  return loadData;
}
