import { useState } from "react";
import { defaultPriorityColors, normalizePrioritySettings } from "../../components/alerts/alertUtils.js";
import { emptyAutomationManagement } from "./emptyState.js";

/** Todo o estado de dados do app autenticado (listas do servidor e seus setters). */
export function useDashboardState(initialSystemMode) {
  const [devices, setDevices] = useState([]);
  const [allDevices, setAllDevices] = useState([]);
  const [segments, setSegments] = useState([]);
  const [segmentGroups, setSegmentGroups] = useState([]);
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);
  const [alertCorrelations, setAlertCorrelations] = useState([]);
  const [alertRules, setAlertRules] = useState([]);
  const [serviceOrderSuggestions, setServiceOrderSuggestions] = useState([]);
  const [maintenanceScripts, setMaintenanceScripts] = useState([]);
  const [preventivePlans, setPreventivePlans] = useState([]);
  const [preventiveAutomationPlans, setPreventiveAutomationPlans] = useState([]);
  const [preventiveAutomationManagement, setPreventiveAutomationManagement] = useState(emptyAutomationManagement);
  const [preventiveAutomationManagementError, setPreventiveAutomationManagementError] = useState("");
  const [serviceOrders, setServiceOrders] = useState([]);
  const [systemMode, setSystemMode] = useState(initialSystemMode);
  const [remoteScriptExecutionEnabledOnServer, setRemoteScriptExecutionEnabledOnServer] = useState(null);
  const [alertPrioritySettings, setAlertPrioritySettings] = useState(() => normalizePrioritySettings());
  const [alertPriorityColors, setAlertPriorityColors] = useState(defaultPriorityColors);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  return {
    devices, setDevices,
    allDevices, setAllDevices,
    segments, setSegments,
    segmentGroups, setSegmentGroups,
    summary, setSummary,
    alerts, setAlerts,
    history, setHistory,
    alertCorrelations, setAlertCorrelations,
    alertRules, setAlertRules,
    serviceOrderSuggestions, setServiceOrderSuggestions,
    maintenanceScripts, setMaintenanceScripts,
    preventivePlans, setPreventivePlans,
    preventiveAutomationPlans, setPreventiveAutomationPlans,
    preventiveAutomationManagement, setPreventiveAutomationManagement,
    preventiveAutomationManagementError, setPreventiveAutomationManagementError,
    serviceOrders, setServiceOrders,
    systemMode, setSystemMode,
    remoteScriptExecutionEnabledOnServer, setRemoteScriptExecutionEnabledOnServer,
    alertPrioritySettings, setAlertPrioritySettings,
    alertPriorityColors, setAlertPriorityColors,
    loading, setLoading,
    lastUpdated, setLastUpdated
  };
}
