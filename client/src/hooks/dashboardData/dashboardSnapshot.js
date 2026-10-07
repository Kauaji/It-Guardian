import { fetchDevice } from "../../api.js";
import { normalizePrioritySettings } from "../../components/alerts/alertUtils.js";
import { isMaintenanceSegmentName } from "../../utils/display.js";
import { normalizeAlertRecord, normalizeSuggestionRecord } from "./alertNormalizers.js";
import { emptyAutomationManagement } from "./emptyState.js";

/**
 * Máquinas que saíram do segmento "Manutenção" perdem o registro ativo de manutenção.
 * Devolve os registros (os mesmos se nada mudou) e se houve mudança.
 */
export function reconcileMaintenanceRecords(allDevices, maintenanceRecords) {
  const next = { ...maintenanceRecords };
  let changed = false;

  for (const device of allDevices) {
    if (next[device.id]?.active && !isMaintenanceSegmentName(device.segmentName)) {
      delete next[device.id];
      changed = true;
    }
  }

  return { records: changed ? next : maintenanceRecords, changed };
}

/** Copia a resposta da API para o estado, aplicando o estado local do inventário. */
export function applyDashboardSnapshot(state, snapshot, { inventory, activeMaintenanceRecords }) {
  const {
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
  } = snapshot;
  const { applyInventoryLocalState, applySegmentGroups, removedPeripherals, peripheralHistory, manualPeripherals } = inventory;

  const localState = (list) =>
    applyInventoryLocalState(list, removedPeripherals, peripheralHistory, activeMaintenanceRecords, manualPeripherals);
  const nextGroups = groupData.groups || [];

  state.setDevices(localState(deviceData.devices));
  state.setAllDevices(localState(allDeviceData.devices));
  state.setSegmentGroups(nextGroups);
  state.setSegments(applySegmentGroups(segmentData.segments, nextGroups));
  state.setSummary(deviceData.summary);
  state.setAlerts((activeAlertData.alerts || []).map(normalizeAlertRecord));
  state.setHistory((alertHistoryData.alerts || []).map(normalizeAlertRecord));
  state.setAlertCorrelations(alertCorrelationData.correlations || []);
  state.setAlertRules(alertRuleData.rules || []);
  state.setServiceOrderSuggestions((suggestionData.suggestions || []).map(normalizeSuggestionRecord));
  state.setMaintenanceScripts(maintenanceScriptData.scripts || []);
  state.setPreventivePlans(preventivePlanData.preventivePlans || []);
  state.setPreventiveAutomationPlans(preventiveAutomationData.preventiveAutomationPlans || []);
  state.setPreventiveAutomationManagement({
    plans: preventiveAutomationManagementData.plans || [],
    machines: preventiveAutomationManagementData.machines || [],
    metadata: preventiveAutomationManagementData.metadata || emptyAutomationManagement.metadata
  });
  state.setPreventiveAutomationManagementError(preventiveAutomationManagementData.error || "");
  state.setServiceOrders(serviceOrderData.serviceOrders || []);

  const nextPrioritySettings = normalizePrioritySettings(alertSettingsData.settings);
  state.setAlertPrioritySettings(nextPrioritySettings);
  state.setAlertPriorityColors(nextPrioritySettings.priorityColors);

  if (systemSettingsData.settings?.systemMode) {
    state.setSystemMode(systemSettingsData.settings.systemMode === "business" ? "business" : "local");
  }
  if (typeof systemSettingsData.settings?.remoteScriptExecutionEnabled === "boolean") {
    state.setRemoteScriptExecutionEnabledOnServer(systemSettingsData.settings.remoteScriptExecutionEnabled);
  }

  state.setLastUpdated(new Date());
}

/** Mantém a máquina selecionada (ou a primeira visível) e carrega seu detalhe. */
export async function syncSelectedDevice({ activeView, snapshot, selectedId, canViewMachine, token, setSelectedId, setSelectedDevice }) {
  const visibleForSelection = activeView === "dashboard" ? snapshot.deviceData.devices : snapshot.allDeviceData.devices;
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
}

export function hasCriticalAlert(activeAlertData) {
  return (activeAlertData.alerts || []).some((alert) => normalizeAlertRecord(alert).severity === "critical");
}
