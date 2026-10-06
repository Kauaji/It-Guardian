import { useMemo } from "react";
import { getMachineSourceCollections, isAgentMachine } from "../agentPresentation.js";
import {
  buildActiveAlerts,
  buildResolvedAlerts,
  getDiskHealth,
  getMemoryModules,
  getVisibleTabs,
  isMaintenanceSegmentName,
  normalizeSoftware
} from "./machineDetailsModel.js";

// Valores derivados da maquina exibida no modal de detalhes.
export default function useMachineDetailsModel(machine) {
  const hardware = machine?.hardware || {};
  const isManualAsset = machine?.source === "manual";
  const isAgentAsset = isAgentMachine(machine);
  const latestChange = useMemo(
    () => [...(machine?.assetHistory || []), ...(hardware.changeHistory || [])][0],
    [hardware.changeHistory, machine?.assetHistory]
  );
  const activeAlerts = useMemo(() => buildActiveAlerts(machine), [machine]);
  const resolvedAlerts = useMemo(() => buildResolvedAlerts(machine, hardware), [hardware, machine]);
  const visibleTabs = useMemo(
    () => getVisibleTabs(activeAlerts.length, resolvedAlerts.length),
    [activeAlerts.length, resolvedAlerts.length]
  );
  const softwareRows = useMemo(
    () => (Array.isArray(hardware.software) ? hardware.software : []).map(normalizeSoftware),
    [hardware.software]
  );
  const diskHealth = useMemo(() => getDiskHealth(hardware), [hardware]);
  const sourceCollections = useMemo(() => getMachineSourceCollections(machine), [machine]);

  return {
    machine,
    hardware,
    manualAsset: machine?.manualAsset,
    agent: machine?.agent,
    isManualAsset,
    isAgentAsset,
    memoryModules: getMemoryModules(hardware),
    graphicsAdapters: Array.isArray(hardware.graphics) ? hardware.graphics : [],
    disks: Array.isArray(hardware.disks) ? hardware.disks : [],
    inMaintenance: Boolean(machine?.maintenance) || isMaintenanceSegmentName(machine?.segmentName),
    backupInUse: machine?.backupStatus === "in_use",
    latestChange,
    activeAlerts,
    resolvedAlerts,
    visibleTabs,
    softwareRows,
    diskHealth,
    sourceCollections
  };
}
