import { peripheralKey } from "./peripheralKey.js";

// Props do modal de detalhes: as acoes atualizam/fecham a maquina selecionada.
export default function useMachineDetailsProps(props, state) {
  const {
    token, user, notify, segments, aliases, observations, userName, canManage,
    onAliasSave, onAddObservation, onChangeDeviceType, onRefreshPing, onPutMaintenance,
    onToggleBackup, onRemoveMachine, onAddPeripheral, onRemovePeripheral
  } = props;
  const { selectedMachine, setSelectedMachine, setInventoryViewMode } = state;

  async function handleSelectedTypeChange(assetType) {
    if (!selectedMachine) return;
    const updated = await onChangeDeviceType(selectedMachine.id, assetType);
    if (updated) setSelectedMachine(updated);
  }

  async function handleSelectedPingRefresh() {
    if (!selectedMachine) return;
    const updated = await onRefreshPing(selectedMachine);
    if (updated) setSelectedMachine(updated);
  }

  return {
    machine: selectedMachine,
    token,
    user,
    notify,
    alias: selectedMachine ? aliases[selectedMachine.id] : "",
    observations: selectedMachine ? observations[selectedMachine.id] || [] : [],
    segmentColor: segments.find((segment) => segment.id === selectedMachine?.segmentId)?.color,
    userName,
    onAliasSave: (nextAlias) => onAliasSave(selectedMachine.id, nextAlias),
    onAddObservation: (text) => onAddObservation(selectedMachine.id, text),
    onChangeDeviceType: handleSelectedTypeChange,
    onRefreshPing: handleSelectedPingRefresh,
    onPutMaintenance: async () => {
      const moved = await onPutMaintenance?.(selectedMachine);
      if (moved) setSelectedMachine(null);
    },
    onToggleBackup: async (desiredState) => {
      const updated = await onToggleBackup?.(selectedMachine, desiredState);
      if (updated) setSelectedMachine(null);
    },
    onRemoveMachine: async () => {
      const removed = await onRemoveMachine?.(selectedMachine);
      if (removed) setSelectedMachine(null);
    },
    onOpenNetworkMap: () => {
      setInventoryViewMode("topology");
      setSelectedMachine(null);
    },
    canManage,
    onAddPeripheral: (peripheral) => {
      const result = onAddPeripheral(selectedMachine.id, peripheral);
      const savedPeripheral = result?.peripheral || peripheral;
      const event = result?.event;
      if (result) {
        setSelectedMachine((current) => ({
          ...current,
          assetHistory: event ? [event, ...(current.assetHistory || [])] : current.assetHistory,
          hardware: {
            ...current.hardware,
            peripherals: [...(current.hardware?.peripherals || []), savedPeripheral]
          }
        }));
      }
      return result;
    },
    onRemovePeripheral: (peripheral) => {
      const event = onRemovePeripheral(selectedMachine.id, peripheral);
      if (event) {
        setSelectedMachine((current) => ({
          ...current,
          assetHistory: [event, ...(current.assetHistory || [])],
          hardware: {
            ...current.hardware,
            peripherals: (current.hardware?.peripherals || []).filter((item) => peripheralKey(item) !== peripheralKey(peripheral))
          }
        }));
      }
      return event;
    },
    onClose: () => setSelectedMachine(null)
  };
}
