import { useCallback, useEffect, useState } from "react";

import {
  createMonitoringSocket,
  fetchAlertCorrelations,
  fetchAlertHistory,
  fetchAlertRules,
  fetchAlertSettings,
  fetchAlerts,
  fetchDevice,
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
} from "../api.js";
import { defaultPriorityColors, normalizePrioritySettings } from "../components/alerts/alertUtils.js";
import { isMaintenanceSegmentName } from "../utils/display.js";

const emptyAutomationManagement = {
  plans: [],
  machines: [],
  metadata: { planCount: 0, machineCount: 0 }
};

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
  const [alertPrioritySettings, setAlertPrioritySettings] = useState(() => normalizePrioritySettings());
  const [alertPriorityColors, setAlertPriorityColors] = useState(defaultPriorityColors);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
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
          canViewInventory ? fetchDevices(token, { search, status }) : Promise.resolve({ devices: [], summary: null }),
          canViewInventory ? fetchDevices(token) : Promise.resolve({ devices: [] }),
          canViewInventory ? fetchSegments(token) : Promise.resolve({ segments: [] }),
          canViewInventory ? fetchSegmentGroups(token) : Promise.resolve({ groups: [] }),
          canViewAlerts ? fetchAlerts(token) : Promise.resolve({ alerts: [] }),
          canViewAlerts ? fetchAlertHistory(token) : Promise.resolve({ alerts: [] }),
          canViewAlerts ? fetchAlertCorrelations(token).catch(() => ({ correlations: [] })) : Promise.resolve({ correlations: [] }),
          canViewAlerts ? fetchAlertRules(token) : Promise.resolve({ rules: [] }),
          canViewAlerts ? fetchServiceOrderSuggestions(token) : Promise.resolve({ suggestions: [] }),
          canViewScripts ? fetchMaintenanceScripts(token) : Promise.resolve({ scripts: [] }),
          canViewPreventivePlans ? fetchPreventivePlans(token) : Promise.resolve({ preventivePlans: [] }),
          canViewPreventiveAutomation ? fetchPreventiveAutomationPlans(token) : Promise.resolve({ preventiveAutomationPlans: [] }),
          canViewPreventiveAutomation
            ? fetchPreventiveAutomationManagement(token).catch((error) => ({
                ...emptyAutomationManagement,
                error: error.message
              }))
            : Promise.resolve(emptyAutomationManagement),
          canViewServiceOrders ? fetchServiceOrders(token) : Promise.resolve({ serviceOrders: [] }),
          canViewAlerts
            ? fetchAlertSettings(token).catch(() => ({ settings: normalizePrioritySettings() }))
            : Promise.resolve({ settings: normalizePrioritySettings() }),
          fetchSystemSettings(token).catch(() => ({ settings: { systemMode } }))
        ]);

        const nextMaintenanceRecords = { ...maintenanceRecords };
        let maintenanceRecordsChanged = false;

        for (const device of allDeviceData.devices) {
          if (
            nextMaintenanceRecords[device.id]?.active &&
            !isMaintenanceSegmentName(device.segmentName)
          ) {
            delete nextMaintenanceRecords[device.id];
            maintenanceRecordsChanged = true;
          }
        }

        if (maintenanceRecordsChanged) {
          onMaintenanceRecordsChange(nextMaintenanceRecords);
        }

        const activeMaintenanceRecords = maintenanceRecordsChanged
          ? nextMaintenanceRecords
          : maintenanceRecords;
        const nextDevices = applyInventoryLocalState(
          deviceData.devices,
          removedPeripherals,
          peripheralHistory,
          activeMaintenanceRecords
        );
        const nextAllDevices = applyInventoryLocalState(
          allDeviceData.devices,
          removedPeripherals,
          peripheralHistory,
          activeMaintenanceRecords
        );
        const nextGroups = groupData.groups || [];
        const nextSegments = applySegmentGroups(segmentData.segments, nextGroups);

        setDevices(nextDevices);
        setAllDevices(nextAllDevices);
        setSegmentGroups(nextGroups);
        setSegments(nextSegments);
        setSummary(deviceData.summary);
        setAlerts(activeAlertData.alerts);
        setHistory(alertHistoryData.alerts);
        setAlertCorrelations(alertCorrelationData.correlations || []);
        setAlertRules(alertRuleData.rules || []);
        setServiceOrderSuggestions(suggestionData.suggestions || []);
        setMaintenanceScripts(maintenanceScriptData.scripts || []);
        setPreventivePlans(preventivePlanData.preventivePlans || []);
        setPreventiveAutomationPlans(preventiveAutomationData.preventiveAutomationPlans || []);
        setPreventiveAutomationManagement({
          plans: preventiveAutomationManagementData.plans || [],
          machines: preventiveAutomationManagementData.machines || [],
          metadata: preventiveAutomationManagementData.metadata || emptyAutomationManagement.metadata
        });
        setPreventiveAutomationManagementError(preventiveAutomationManagementData.error || "");
        setServiceOrders(serviceOrderData.serviceOrders || []);

        const nextPrioritySettings = normalizePrioritySettings(alertSettingsData.settings);
        setAlertPrioritySettings(nextPrioritySettings);
        setAlertPriorityColors(nextPrioritySettings.priorityColors);

        if (systemSettingsData.settings?.systemMode) {
          const nextMode = systemSettingsData.settings.systemMode === "business" ? "business" : "local";
          setSystemMode(nextMode);
        }

        setLastUpdated(new Date());

        const visibleForSelection = activeView === "dashboard" ? deviceData.devices : allDeviceData.devices;
        const selectedStillVisible = visibleForSelection.some((device) => device.id === selectedId);
        const nextId = selectedStillVisible ? selectedId : visibleForSelection[0]?.id;
        setSelectedId(nextId);

        if (nextId && canViewMachine) {
          try {
            const details = await fetchDevice(token, nextId);
            setSelectedDevice(details.device);
          } catch {
            setSelectedDevice(null);
          }
        } else {
          setSelectedDevice(null);
        }

        if (
          !silent &&
          activeAlertData.alerts.some((alert) => alert.severity === "critical")
        ) {
          notify("Existem avisos críticos pendentes.", "danger");
        }
      } catch (error) {
        notify(error.message, "danger");
      } finally {
        setLoading(false);
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
    const timer = setInterval(() => loadData(true), 15000);
    return () => clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    const socket = createMonitoringSocket();

    if (!socket) return undefined;

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type !== "monitoring.snapshot") return;

        setSummary(payload.summary);
        setAlerts(payload.alerts);
        setLastUpdated(new Date(payload.updatedAt));
        setAllDevices(payload.devices);
        if (payload.segments) {
          setSegments(applySegmentGroups(payload.segments, segmentGroups));
        }

        if (!search && !status) {
          setDevices(payload.devices);
          setSelectedDevice((current) => {
            if (!current) return current;
            return payload.devices.find((device) => device.id === current.id) || current;
          });
        }
      } catch (_error) {
        notify("Não foi possível processar o streaming em tempo real.", "danger");
      }
    };

    socket.onclose = (event) => {
      if (event.code === 1008) {
        notify("Sessão de streaming não autorizada.", "danger");
        logout();
      }
    };

    return () => socket.close();
  }, [token, search, status, segmentGroups]);

  return {
    alertCorrelations,
    alertPriorityColors,
    alertPrioritySettings,
    alertRules,
    alerts,
    allDevices,
    devices,
    history,
    lastUpdated,
    loading,
    loadData,
    maintenanceScripts,
    preventiveAutomationManagement,
    preventiveAutomationManagementError,
    preventiveAutomationPlans,
    preventivePlans,
    segmentGroups,
    segments,
    serviceOrderSuggestions,
    serviceOrders,
    setAlertCorrelations,
    setAlertPriorityColors,
    setAlertPrioritySettings,
    setAlertRules,
    setAlerts,
    setAllDevices,
    setDevices,
    setHistory,
    setMaintenanceScripts,
    setPreventiveAutomationManagement,
    setPreventiveAutomationManagementError,
    setPreventiveAutomationPlans,
    setPreventivePlans,
    setSegmentGroups,
    setSegments,
    setServiceOrderSuggestions,
    setServiceOrders,
    setSummary,
    setSystemMode,
    summary,
    systemMode
  };
}
