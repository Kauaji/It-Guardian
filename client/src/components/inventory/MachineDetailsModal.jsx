import { useEffect, useState } from "react";
import { useModalLifecycle } from "../../hooks/useModalLifecycle.js";
import MachineTabs from "./MachineTabs.jsx";
import ObservationTimeline from "./ObservationTimeline.jsx";
import AssetTechnicalTimeline from "./timeline/AssetTechnicalTimeline.jsx";
import ErrorAlertList from "./machineDetails/ErrorAlertList.jsx";
import MachineGeneralTab from "./machineDetails/MachineGeneralTab.jsx";
import MachineHardwareTab from "./machineDetails/MachineHardwareTab.jsx";
import MachineModalHeader from "./machineDetails/MachineModalHeader.jsx";
import MachineNetworkTab from "./machineDetails/MachineNetworkTab.jsx";
import MachinePeripheralsTab from "./machineDetails/MachinePeripheralsTab.jsx";
import MachineSoftwareTab from "./machineDetails/MachineSoftwareTab.jsx";
import useMachineDetailsModel from "./machineDetails/useMachineDetailsModel.js";

function getEyebrow(model) {
  if (model.isAgentAsset) return "Máquina real";
  return model.isManualAsset ? "Ativo de rede manual" : "Inventário integrado";
}

export default function MachineDetailsModal({
  machine,
  token,
  user,
  notify,
  alias,
  observations,
  segmentColor,
  userName,
  onAliasSave,
  onAddObservation,
  onChangeDeviceType,
  onRefreshPing,
  onPutMaintenance,
  onToggleBackup,
  onRemoveMachine,
  onAddPeripheral,
  onRemovePeripheral,
  onOpenNetworkMap,
  canManage = false,
  onClose
}) {
  const [activeTab, setActiveTab] = useState("general");
  const model = useMachineDetailsModel(machine);
  const { visibleTabs } = model;

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("general");
    }
  }, [activeTab, visibleTabs]);

  const dialogRef = useModalLifecycle(Boolean(machine), onClose);

  if (!machine) return null;

  return (
    <div className="modal-backdrop asset-modal-backdrop" role="presentation">
      <section ref={dialogRef} className="asset-modal" role="dialog" aria-modal="true" aria-label="Detalhes do ativo">
        <MachineModalHeader
          machine={machine}
          alias={alias}
          token={token}
          user={user}
          notify={notify}
          eyebrow={getEyebrow(model)}
          inMaintenance={model.inMaintenance}
          backupInUse={model.backupInUse}
          onPutMaintenance={onPutMaintenance}
          onToggleBackup={onToggleBackup}
          onRemoveMachine={onRemoveMachine}
          onClose={onClose}
        />

        <MachineTabs activeTab={activeTab} tabs={visibleTabs} onChange={setActiveTab} />

        <div className="asset-modal-body">
          {activeTab === "general" && (
            <MachineGeneralTab
              model={model}
              alias={alias}
              onAliasSave={onAliasSave}
              onChangeDeviceType={onChangeDeviceType}
              onRefreshPing={onRefreshPing}
            />
          )}
          {activeTab === "hardware" && <MachineHardwareTab model={model} />}
          {activeTab === "alerts" && (
            <ErrorAlertList alerts={model.activeAlerts} resolvedAlerts={model.resolvedAlerts} />
          )}
          {activeTab === "software" && (
            <MachineSoftwareTab softwareRows={model.softwareRows} isManualAsset={model.isManualAsset} />
          )}
          {activeTab === "network" && <MachineNetworkTab model={model} />}
          {activeTab === "peripherals" && (
            <MachinePeripheralsTab
              model={model}
              segmentColor={segmentColor}
              canManage={canManage}
              onAddPeripheral={onAddPeripheral}
              onRemovePeripheral={onRemovePeripheral}
            />
          )}
          {activeTab === "notes" && (
            <ObservationTimeline
              observations={observations}
              userName={userName}
              onAdd={onAddObservation}
            />
          )}
          {activeTab === "history" && (
            <AssetTechnicalTimeline
              assetId={machine.id}
              token={token}
              observations={observations}
              onOpenNetworkMap={onOpenNetworkMap}
            />
          )}
        </div>
      </section>
    </div>
  );
}
