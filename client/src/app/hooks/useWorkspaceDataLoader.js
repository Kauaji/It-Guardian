import { useState } from "react";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { useDashboardData } from "../../hooks/useDashboardData.js";
import {
  applyInventoryLocalState,
  applySegmentGroups
} from "../../components/inventory/inventoryLocalState.js";
import { remoteScriptExecutionEnabled as remoteScriptExecutionEnabledAtBuild } from "../../config/features.js";

function readSystemMode() {
  return "local";
}

// Carrega os dados do servidor (via useDashboardData) para o app autenticado
// e acrescenta o que o antigo Dashboard calculava em volta deles.
export function useWorkspaceDataLoader({ access, activeView, persistence }) {
  const { token, notify, logout } = useAppSession();
  const [selectedId, setSelectedId] = useState(null);
  // setSelectedDevice ainda e chamado por useDashboardData/sincronizacao em
  // tempo real; a leitura selectedDevice so alimentava o antigo
  // DashboardPage.jsx (removido no corte para o dashboard configuravel) e
  // ficou sem nenhum consumidor.
  const [, setSelectedDevice] = useState(null);

  const data = useDashboardData({
    activeView,
    applyInventoryLocalState,
    applySegmentGroups,
    canViewAlerts: access.canViewAlerts,
    canViewInventory: access.canViewInventory,
    canViewMachine: access.canViewMachine,
    canViewPreventiveAutomation: access.canViewPreventiveAutomation,
    canViewPreventivePlans: access.canViewPreventivePlans,
    canViewScripts: access.canViewScripts,
    canViewServiceOrders: access.canViewServiceOrders,
    initialSystemMode: readSystemMode,
    logout,
    maintenanceRecords: persistence.maintenanceRecords,
    manualPeripherals: persistence.manualPeripherals,
    notify,
    onMaintenanceRecordsChange: persistence.saveMaintenanceRecords,
    peripheralHistory: persistence.peripheralHistory,
    removedPeripherals: persistence.removedPeripherals,
    search: "",
    selectedId,
    setSelectedDevice,
    setSelectedId,
    status: "",
    token
  });

  // A flag de build-time (VITE_ENABLE_REMOTE_SCRIPT_EXECUTION) so muda com um
  // novo build do cliente; o valor vindo do servidor reflete o estado real do
  // backend sem precisar rebuildar - usado assim que carrega, com o flag de
  // build como fallback ate la.
  const remoteScriptExecutionEnabled =
    data.remoteScriptExecutionEnabledOnServer ?? remoteScriptExecutionEnabledAtBuild;

  return { ...data, remoteScriptExecutionEnabled, setSelectedDevice };
}
