import { useEffect, useRef, useState } from "react";
import { fetchUserPreference, saveUserPreference } from "../api.js";
import {
  activeInventoryTabKey,
  aliasKey,
  defaultInventoryTab,
  inventoryTabMetaKey,
  inventoryTabsKey,
  maintenanceRecordsKey,
  normalizeInventoryTabMeta,
  normalizeInventoryTabs,
  observationsKey,
  peripheralHistoryKey,
  peripheralRemovalsKey,
  readStoredJson
} from "../components/inventory/inventoryLocalState.js";

function readStoredObject(key) {
  return JSON.parse(localStorage.getItem(key) || "{}");
}

function persistState(setState, key, updater) {
  setState((current) => {
    const next = typeof updater === "function" ? updater(current) : updater;
    localStorage.setItem(key, JSON.stringify(next));
    return next;
  });
}

export function useInventoryPersistence(token) {
  const [machineAliases, setMachineAliases] = useState(() => readStoredObject(aliasKey));
  const [machineObservations, setMachineObservations] = useState(() =>
    readStoredObject(observationsKey)
  );
  const [removedPeripherals, setRemovedPeripherals] = useState(() =>
    readStoredObject(peripheralRemovalsKey)
  );
  const [peripheralHistory, setPeripheralHistory] = useState(() =>
    readStoredObject(peripheralHistoryKey)
  );
  const [maintenanceRecords, setMaintenanceRecords] = useState(() =>
    readStoredJson(maintenanceRecordsKey, {})
  );
  const [inventoryTabs, setInventoryTabs] = useState(() =>
    normalizeInventoryTabs(readStoredJson(inventoryTabsKey, [defaultInventoryTab]))
  );
  const [activeInventoryTabId, setActiveInventoryTabId] = useState(() =>
    localStorage.getItem(activeInventoryTabKey) || defaultInventoryTab.id
  );
  const [inventoryTabMeta, setInventoryTabMeta] = useState(() =>
    normalizeInventoryTabMeta(readStoredJson(inventoryTabMetaKey, {}))
  );
  const inventoryPreferenceHydrated = useRef(false);

  useEffect(() => {
    let active = true;

    fetchUserPreference(token, "inventory-workspace")
      .then(({ value }) => {
        if (!active || !value) return;
        setMachineAliases(value.aliases || {});
        setMachineObservations(value.observations || {});
        setRemovedPeripherals(value.removedPeripherals || {});
        setPeripheralHistory(value.peripheralHistory || {});
        setMaintenanceRecords(value.maintenanceRecords || {});
      })
      .catch(() => {
        // Local cache remains available when the backend preference has not been created yet.
      })
      .finally(() => {
        if (active) inventoryPreferenceHydrated.current = true;
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!inventoryPreferenceHydrated.current) return undefined;

    const timeoutId = window.setTimeout(() => {
      saveUserPreference(token, "inventory-workspace", {
        aliases: machineAliases,
        observations: machineObservations,
        removedPeripherals,
        peripheralHistory,
        maintenanceRecords
      }).catch(() => {});
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [
    machineAliases,
    machineObservations,
    maintenanceRecords,
    peripheralHistory,
    removedPeripherals,
    token
  ]);

  function saveMachineAliases(updater) {
    persistState(setMachineAliases, aliasKey, updater);
  }

  function saveMachineObservations(updater) {
    persistState(setMachineObservations, observationsKey, updater);
  }

  function saveRemovedPeripherals(updater) {
    persistState(setRemovedPeripherals, peripheralRemovalsKey, updater);
  }

  function savePeripheralHistory(updater) {
    persistState(setPeripheralHistory, peripheralHistoryKey, updater);
  }

  function saveInventoryTabs(updater) {
    const nextTabs = typeof updater === "function" ? updater(inventoryTabs) : updater;
    const normalized = normalizeInventoryTabs(nextTabs);
    localStorage.setItem(inventoryTabsKey, JSON.stringify(normalized));
    setInventoryTabs(normalized);
  }

  function saveInventoryTabMeta(updater) {
    setInventoryTabMeta((current) => {
      const next = normalizeInventoryTabMeta(typeof updater === "function" ? updater(current) : updater);
      localStorage.setItem(inventoryTabMetaKey, JSON.stringify(next));
      return next;
    });
  }

  function saveMaintenanceRecords(updater) {
    persistState(setMaintenanceRecords, maintenanceRecordsKey, updater);
  }

  return {
    activeInventoryTabId,
    inventoryTabMeta,
    inventoryTabs,
    machineAliases,
    machineObservations,
    maintenanceRecords,
    peripheralHistory,
    removedPeripherals,
    saveInventoryTabMeta,
    saveInventoryTabs,
    saveMachineAliases,
    saveMachineObservations,
    saveMaintenanceRecords,
    savePeripheralHistory,
    saveRemovedPeripherals,
    setActiveInventoryTabId
  };
}
